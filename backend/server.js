// backend/server.js
const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// ============================================
// VALIDATION DES VARIABLES D'ENVIRONNEMENT
// ============================================
const requiredEnvVars = [
    'NODE_ENV',
    'PORT',
    'DB_HOST',
    'DB_NAME',
    'DB_USER',
    'DB_PASSWORD',
    'JWT_SECRET'
];

const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingEnvVars.length > 0) {
    console.error('❌ Variables d\'environnement manquantes:', missingEnvVars.join(', '));
    process.exit(1);
}

// ============================================
// CONFIGURATION DES ORIGINES AUTORISÉES
// ============================================
const getAllowedOrigins = () => {
    const origins = [
        process.env.CLIENT_URL,
        process.env.EXPO_URL,
        process.env.EXPO_WEB_URL,
        process.env.MOBILE_URL,
        process.env.MOBILE_APP_URL
    ].filter(Boolean); // Retire les valeurs undefined

    // En développement, ajouter localhost avec différents ports
    if (process.env.NODE_ENV === 'development') {
        origins.push(
            'http://localhost:3000',
            'http://localhost:8081',
            'http://localhost:19006',
            'http://localhost:19000',
            'http://127.0.0.1:3000',
            'http://127.0.0.1:8081',
            'http://localhost:5000'
        );
    }

    return [...new Set(origins)]; // Retire les doublons
};

const allowedOrigins = getAllowedOrigins();
console.log('🌐 Origines CORS autorisées:', allowedOrigins);

// ============================================
// IMPORT DES ROUTES
// ============================================
const authRoutes = require('./api/routes/auth');
const rhRoute = require('./api/routes/rh');
const flotteRoutes = require('./api/routes/flotte');
const agricultureRoutes = require('./api/routes/agriculture');
const elevageRoutes = require('./api/routes/elevage');
const commercialeRoutes = require('./api/routes/commercial');
const financeRoutes = require('./api/routes/finance');
const managerRoutes = require('./api/routes/manager');
const notificationRoutes = require('./api/routes/notifications');
const comptabiliteRoutes = require('./api/routes/comptabilite');
const chauffeurRoutes = require('./api/routes/chauffeur');
const employe_inssRoutes = require('./api/routes/employe-inss');
const employe_temps_partielRoutes = require('./api/routes/employe-temps-partiel');
const veterinaireRoutes = require('./api/routes/veterinaire');
const fingerprint_routesRoutes = require('./api/routes/fingerprint-routes');
const dashboardRoute = require('./api/routes/comptabilite/dashboard');// je suis en confusion sur ici
const adminRoutes = require('./api/routes/adminRoutes');
const parametresRoutes = require('./api/routes/parametresRoutes');
const financelRoutes = require('./api/routes/financeRoutes');
const OperationsRoutes = require('./api/routes/operationsRoutes');
const commercialRoutes = require('./api/routes/commercialRoutes');
const rhsRoutes = require('./api/routes/rhRoutes');

// ============================================
// INITIALISATION DE L'APPLICATION
// ============================================
const app = express();
const httpServer = createServer(app);

// ============================================
// CONFIGURATION WEBSOCKET
// ============================================
const io = new Server(httpServer, {
    cors: {
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);
            if (process.env.NODE_ENV === 'development') return callback(null, true);
            if (allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error('Not allowed by CORS'));
        },
        credentials: true,
        methods: ['GET', 'POST']
    },
    pingTimeout: 60000,
    pingInterval: 25000
});

// ============================================
// CONFIGURATION DE LA BASE DE DONNÉES
// ============================================
const dbConfig = {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 10000,
    charset: 'utf8mb4'
};

const db = mysql.createPool(dbConfig);

// Test de connexion initial
db.getConnection()
    .then(connection => {
        console.log('✅ Base de données connectée');
        connection.release();
    })
    .catch(err => {
        console.error('❌ Échec de connexion à la base de données:', err.message);
        process.exit(1);
    });

// ============================================
// CRÉATION DU DOSSIER UPLOADS
// ============================================
const uploadPath = process.env.UPLOAD_PATH || './uploads';
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log('📁 Dossier uploads créé:', uploadPath);
}

// ============================================
// MIDDLEWARE GLOBAUX
// ============================================

// Trust proxy (important pour Heroku, AWS, etc.)
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// Compression des réponses
app.use(compression());

// Parsing du body
app.use(express.json({ 
    limit: process.env.MAX_FILE_SIZE || '10mb',
    strict: true
}));
app.use(express.urlencoded({ 
    extended: true, 
    limit: process.env.MAX_FILE_SIZE || '10mb'
}));

// Security headers avec Helmet
app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production' ? {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", ...allowedOrigins],
            fontSrc: ["'self'", "https:", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"]
        }
    } : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Configuration avancée
app.use(cors({
    origin: (origin, callback) => {
        // Autoriser les requêtes sans origine (mobile apps, Postman, curl)
        if (!origin) {
            return callback(null, true);
        }

        // En développement, autoriser toutes les origines
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }

        // En production, vérifier les origines autorisées
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }

        // Autoriser les sous-domaines en production
        const isSubdomain = allowedOrigins.some(allowed => {
            const domain = allowed.replace(/^https?:\/\//, '');
            return origin.endsWith(domain);
        });

        if (isSubdomain) {
            return callback(null, true);
        }

        console.warn('⚠️ Origine CORS refusée:', origin);
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
        'Content-Type', 
        'Authorization', 
        'X-Requested-With',
        'Accept',
        'Origin'
    ],
    exposedHeaders: ['X-Total-Count', 'X-Auth-Token'],
    maxAge: 86400 // 24 heures
}));

// Preflight pour toutes les routes
app.options('*', cors());

// Rate limiting global - Configuration de base
const globalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 200, // 200 requêtes par minute
    message: {
        success: false,
        message: 'Trop de requêtes, veuillez réessayer plus tard.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting pour les health checks
        return req.path === '/health' || req.path === '/api/health';
    },
    handler: (req, res) => {
        const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
        res.status(429).json({
            success: false,
            message: 'Limite de requêtes atteinte. Veuillez patienter.',
            retryAfter: retryAfter
        });
    }
});

// Rate limiting pour les managers - Plus permissif
const managerLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 500, // 500 requêtes par minute
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    handler: (req, res) => {
        const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
        res.status(429).json({
            success: false,
            message: 'Limite de requêtes atteinte pour ce module. Veuillez patienter.',
            retryAfter: retryAfter
        });
    }
});

// Rate limiting spécifique pour le login - Plus restrictif
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 tentatives
    message: {
        success: false,
        message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.'
    },
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false
});

// Appliquer le rate limiting global
app.use('/api/', globalLimiter);

// Logging
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
} else {
    app.use(morgan('combined', {
        skip: (req, res) => res.statusCode < 400
    }));
}

// Middleware pour ajouter db et io aux requêtes
app.use((req, res, next) => {
    req.db = db;
    req.io = io;
    next();
});

// Request ID pour tracking
app.use((req, res, next) => {
    req.id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader('X-Request-ID', req.id);
    next();
});

// Mode maintenance
if (process.env.MAINTENANCE_MODE === 'true') {
    app.use((req, res, next) => {
        if (req.path !== '/health') {
            return res.status(503).json({
                success: false,
                message: 'Service en maintenance. Veuillez réessayer plus tard.'
            });
        }
        next();
    });
}

// ============================================
// WEBSOCKET ÉVÉNEMENTS
// ============================================
io.on('connection', (socket) => {
    console.log('🔌 Client WebSocket connecté:', socket.id);
    
    socket.on('join-room', (room) => {
        socket.join(room);
        console.log(`📍 Socket ${socket.id} a rejoint: ${room}`);
    });
    
    socket.on('leave-room', (room) => {
        socket.leave(room);
        console.log(`📍 Socket ${socket.id} a quitté: ${room}`);
    });
    
    socket.on('send-notification', (data) => {
        if (data.room) {
            io.to(data.room).emit('new-notification', data);
        }
    });

    socket.on('ping', () => {
        socket.emit('pong');
    });
    
    socket.on('disconnect', (reason) => {
        console.log('🔌 Client déconnecté:', socket.id, 'Raison:', reason);
    });

    socket.on('error', (error) => {
        console.error('❌ Erreur WebSocket:', error);
    });
});

// ============================================
// FICHIERS STATIQUES
// ============================================
app.use('/uploads', express.static(uploadPath, {
    maxAge: '1d',
    etag: true
}));

// ============================================
// ROUTES API
// ============================================

// Health check (doit être AVANT les autres routes)
app.get('/health', async (req, res) => {
    try {
        await db.execute('SELECT 1');
        res.status(200).json({
            success: true,
            status: 'OK',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV,
            database: 'connected',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: '1.0.0'
        });
    } catch (error) {
        res.status(503).json({
            success: false,
            status: 'ERROR',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message
        });
    }
});

// Routes principales
app.use('/api/auth', loginLimiter, authRoutes);
app.use('/api/rh',managerLimiter, rhRoute);
app.use('/api/flotte',managerLimiter, flotteRoutes);
app.use('/api/agriculture',managerLimiter, agricultureRoutes);
app.use('/api/elevage',managerLimiter, elevageRoutes);
app.use('/api/commercial',managerLimiter, commercialRoutes);
app.use('/api/finance',managerLimiter, financeRoutes);
app.use('/api/notifications',managerLimiter, notificationRoutes);
app.use('/api/comptabilite',managerLimiter, comptabiliteRoutes);
app.use('/api/comptabilite',managerLimiter, dashboardRoute);
app.use('/api/chauffeur',managerLimiter, chauffeurRoutes);
app.use('/api/employe-inss',managerLimiter, employe_inssRoutes);
app.use('/api/employe-temps-partiel',managerLimiter, employe_temps_partielRoutes);
app.use('/api/veterinaire',managerLimiter, veterinaireRoutes);
app.use('/api/fingerprint',managerLimiter, fingerprint_routesRoutes);
app.use('/api/manager', managerLimiter,managerRoutes);
app.use('/api/admin',managerLimiter, adminRoutes);
app.use('/api/parametres',managerLimiter, parametresRoutes);
app.use('/api/finance', managerLimiter,financelRoutes);
app.use('/api/operations',managerLimiter, OperationsRoutes);
app.use('/api/personnel',managerLimiter,rhsRoutes)
  

// Route de test basique
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'API Nutrifix fonctionnelle',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// ============================================
// GESTION DES ERREURS
// ============================================

// 404 - Route non trouvée
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `Route non trouvée: ${req.method} ${req.originalUrl}`,
        timestamp: new Date().toISOString()
    });
});

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
    console.error('❌ Erreur serveur:', {
        message: err.message,
        stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        requestId: req.id
    });

    // Erreur CORS
    if (err.message === 'Not allowed by CORS') {
        return res.status(403).json({
            success: false,
            message: 'Origine CORS non autorisée.',
            origin: req.headers.origin
        });
    }

    // Erreur de validation
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            success: false,
            message: 'Erreur de validation',
            errors: err.errors
        });
    }

    // Erreur JWT
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Token invalide'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expiré'
        });
    }

    // Erreur de base de données
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
            success: false,
            message: 'Cette entrée existe déjà'
        });
    }

    // Erreur générique
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Erreur interne du serveur',
        requestId: req.id,
        ...(process.env.NODE_ENV === 'development' && { 
            stack: err.stack,
            error: err 
        })
    });
});

// ============================================
// GESTION DES PROCESSUS
// ============================================

// Graceful shutdown
const gracefulShutdown = async (signal) => {
    console.log(`\n⚠️ Signal ${signal} reçu. Arrêt gracieux...`);
    
    httpServer.close(async () => {
        console.log('🔌 Serveur HTTP fermé');
        
        try {
            await db.end();
            console.log('🔌 Pool de connexions DB fermé');
            process.exit(0);
        } catch (err) {
            console.error('❌ Erreur lors de la fermeture:', err);
            process.exit(1);
        }
    });

    // Force shutdown après 10 secondes
    setTimeout(() => {
        console.error('⚠️ Arrêt forcé après timeout');
        process.exit(1);
    }, 10000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Gestion des erreurs non gérées
process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Promesse rejetée non gérée:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('❌ Exception non capturée:', error);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// ============================================
// DÉMARRAGE DU SERVEUR
// ============================================
const PORT = process.env.PORT || 5000;

db.execute('SELECT 1')
    .then(() => {
        httpServer.listen(PORT, () => {
            console.log('\n' + '='.repeat(50));
            console.log('🚀 SERVEUR NUTRIFIX DÉMARRÉ');
            console.log('='.repeat(50));
            console.log(`📍 Environnement: ${process.env.NODE_ENV}`);
            console.log(`🌐 Port: ${PORT}`);
            console.log(`🔌 WebSocket: ${process.env.SOCKET_PORT || PORT}`);
            console.log(`💾 Base de données: ${process.env.DB_NAME}@${process.env.DB_HOST}`);
            console.log(`📁 Uploads: ${uploadPath}`);
            console.log(`🔐 CORS: ${allowedOrigins.length} origines autorisées`);
            console.log('='.repeat(50) + '\n');
        });
    })
    .catch((err) => {
        console.error('❌ Échec de démarrage du serveur:', err);
        process.exit(1);
    });

module.exports = { app, io, db };