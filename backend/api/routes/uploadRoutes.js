const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Configuration de stockage Multer
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const uploadDir = 'uploads/';
        // S'assurer que le dossier existe
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Générer un nom de fichier unique : timestamp + extension
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'img-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtre pour n'accepter que les images
const fileFilter = (req, file, cb) => {
    console.log('Multer fileFilter:', {
        originalname: file.originalname,
        mimetype: file.mimetype,
        fieldname: file.fieldname
    });

    if (file.mimetype.startsWith('image/')) {
        cb(null, true);
    } else {
        console.warn('File rejected by filter');
        cb(new Error('Le fichier doit être une image'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 10 * 1024 * 1024 // Limite à 10MB
    }
});

// Route POST /api/upload
router.post('/', (req, res, next) => {
    console.log('POST /api/upload hit');
    console.log('Headers:', req.headers['content-type']);
    upload.single('photo')(req, res, (err) => {
        if (err) {
            console.error('Multer error:', err);
            return res.status(400).json({ message: err.message });
        }
        next();
    });
}, (req, res) => {
    try {
        console.log('Request file:', req.file);
        if (!req.file) {
            return res.status(400).json({ message: 'Aucun fichier téléchargé' });
        }

        // Normaliser le chemin pour l'URL (remplacer backslashes par slashes)
        // On retourne 'uploads/filename.ext'
        const filePath = req.file.path.replace(/\\/g, '/');

        // On peut aussi retourner l'URL complète si on a accès au host, 
        // mais le chemin relatif est plus flexible (stocké en base).
        // Le frontend ajoutera l'URL de l'API si nécessaire pour l'affichage.

        res.status(201).json({
            success: true,
            message: 'Image téléchargée avec succès',
            url: filePath,
            filename: req.file.filename,
            mimetype: req.file.mimetype,
            size: req.file.size
        });
    } catch (error) {
        console.error('Erreur lors du téléchargement:', error);
        res.status(500).json({
            success: false,
            message: 'Erreur lors du traitement de l\'image',
            error: error.message
        });
    }
});

module.exports = router;
