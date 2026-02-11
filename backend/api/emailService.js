// backend/services/emailService.js - SERVICE EMAIL COMPLET CORRIGÉ
const nodemailer = require('nodemailer');

/**
 * Service d'envoi d'emails avec toutes les fonctionnalités
 */
class EmailService {
  constructor() {
    // Configuration du transporteur Gmail avec gestion SSL
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Votre email Gmail
        pass: process.env.EMAIL_APP_PASSWORD // Mot de passe d'application Gmail
      },
      // Solution pour le problème de certificat auto-signé
      tls: {
        rejectUnauthorized: false // Accepter les certificats auto-signés
      }
    });
  }

  /**
   * Envoyer un code de vérification pour confirmation de salaire
   */
  async envoyerCodeVerification(destinataire, code, nomEmploye, mois, annee) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Code de vérification - Salaire ${mois}/${annee}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .code-box { background: white; border: 2px dashed #3B82F6; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .code { font-size: 32px; font-weight: bold; color: #1E3A8A; letter-spacing: 5px; }
              .warning { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Code de Vérification</h1>
                <p>Confirmation de réception de salaire</p>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Vous avez demandé la confirmation de réception de votre salaire pour <strong>${this.getMoisNom(mois)} ${annee}</strong>.</p>
                
                <p>Voici votre code de vérification à 6 chiffres :</p>
                
                <div class="code-box">
                  <div class="code">${code}</div>
                  <p style="margin-top: 10px; color: #6B7280;">Ce code est valide pendant 24 heures</p>
                </div>
                
                <div class="warning">
                  <strong>Important :</strong>
                  <ul style="margin: 10px 0;">
                    <li>Ne partagez jamais ce code avec qui que ce soit</li>
                    <li>Notre équipe ne vous demandera JAMAIS ce code par téléphone ou email</li>
                    <li>Si vous n'avez pas demandé ce code, ignorez cet email</li>
                  </ul>
                </div>
                
                <p>Pour confirmer la réception de votre salaire, entrez ce code dans l'application NUTRIFIX.</p>
                
                <div style="text-align: center;">
                  <p style="color: #6B7280; font-size: 14px;">
                    Besoin d'aide ? Contactez le service RH :<br>
                    📧 rh@nutrifix.bi | 📞 +257 22 XX XX XX
                  </p>
                </div>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>Cet email a été envoyé automatiquement, merci de ne pas y répondre.</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email code vérification envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi email code:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification de demande de congé aux managers
   */
  async envoyerNotificationConge(destinataire, nomEmploye, typeConge, dateDebut, dateFin, jours) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Nouvelle demande de congé - ${nomEmploye}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .button { display: inline-block; background: #3B82F6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Demande de Congé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour,</p>
                
                <p>Une nouvelle demande de congé nécessite votre approbation.</p>
                
                <div class="info-box">
                  <p><strong>Employé :</strong> ${nomEmploye}</p>
                  <p><strong>Type :</strong> ${this.getTypeCongeLabel(typeConge)}</p>
                  <p><strong>Période :</strong> Du ${this.formatDate(dateDebut)} au ${this.formatDate(dateFin)}</p>
                  <p><strong>Durée :</strong> ${jours} jour(s)</p>
                </div>
                
                <p>Veuillez vous connecter à l'application NUTRIFIX pour approuver ou rejeter cette demande.</p>
                
                <div style="text-align: center;">
                  <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
                    Cette demande nécessite une action de votre part dans les plus brefs délais.
                  </p>
                </div>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email notification congé envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi notification congé:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une confirmation de demande de congé à l'employé
   */
  async envoyerConfirmationDemandeConge(destinataire, nomEmploye, typeConge, dateDebut, dateFin, jours) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Confirmation de demande de congé`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border: 1px solid #E5E7EB; padding: 15px; margin: 20px 0; border-radius: 8px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Demande Enregistrée</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Votre demande de congé a été enregistrée avec succès et est en cours de traitement.</p>
                
                <div class="info-box">
                  <p><strong>Type de congé :</strong> ${this.getTypeCongeLabel(typeConge)}</p>
                  <p><strong>Période :</strong> Du ${this.formatDate(dateDebut)} au ${this.formatDate(dateFin)}</p>
                  <p><strong>Durée :</strong> ${jours} jour(s)</p>
                  <p><strong>Statut :</strong> <span style="color: #F59E0B;">En attente d'approbation</span></p>
                </div>
                
                <p>Vous recevrez une notification dès qu'une décision sera prise concernant votre demande.</p>
                
                <p style="color: #6B7280; font-size: 14px;">
                  Vous pouvez suivre l'état de votre demande dans l'application NUTRIFIX, section "Mes Congés".
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email confirmation demande congé envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi confirmation congé:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification de demande de paiement aux managers
   */
  async envoyerNotificationDemandePaiement(destinataire, nomManager, nomEmploye, mois, annee, montant) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Demande de paiement de salaire - ${nomEmploye}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #DC2626 0%, #EF4444 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border-left: 4px solid #DC2626; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .amount-box { background: white; border: 2px solid #DC2626; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .amount { font-size: 28px; font-weight: bold; color: #DC2626; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Demande de Paiement</h1>
                <p>Action requise</p>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomManager}</strong>,</p>
                
                <p><strong>${nomEmploye}</strong> a soumis une demande de paiement pour son salaire.</p>
                
                <div class="info-box">
                  <p><strong>Employé :</strong> ${nomEmploye}</p>
                  <p><strong>Période :</strong> ${this.getMoisNom(mois)} ${annee}</p>
                  <p><strong>Date de demande :</strong> ${this.formatDate(new Date())}</p>
                </div>
                
                <div class="amount-box">
                  <p style="margin: 0; color: #6B7280;">Montant demandé</p>
                  <div class="amount">${montant.toLocaleString('fr-FR')} FBU</div>
                </div>
                
                <p>Veuillez vous connecter à l'application NUTRIFIX pour traiter cette demande de paiement.</p>
                
                <div style="text-align: center;">
                  <p style="color: #DC2626; font-weight: bold; margin-top: 20px;">
                    Cette demande nécessite votre approbation urgente
                  </p>
                </div>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email notification demande paiement envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi notification paiement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une confirmation de demande de paiement à l'employé
   */
  async envoyerConfirmationDemandePaiement(destinataire, nomEmploye, mois, annee, montant) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Demande de paiement enregistrée - ${mois}/${annee}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border: 1px solid #E5E7EB; padding: 15px; margin: 20px 0; border-radius: 8px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Demande Enregistrée</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Votre demande de paiement a été enregistrée avec succès.</p>
                
                <div class="info-box">
                  <p><strong>Période :</strong> ${this.getMoisNom(mois)} ${annee}</p>
                  <p><strong>Montant :</strong> ${montant.toLocaleString('fr-FR')} FBU</p>
                  <p><strong>Statut :</strong> <span style="color: #F59E0B;">En attente d'approbation</span></p>
                </div>
                
                <p>Votre demande de paiement a été transmise à vos responsables. Vous recevrez une notification dès que le paiement sera effectué.</p>
                
                <p style="color: #6B7280; font-size: 14px;">
                  Vous pouvez suivre l'état de votre demande dans l'application NUTRIFIX.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email confirmation demande paiement envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi confirmation paiement:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier les managers de la confirmation de réception de salaire
   */
  async envoyerNotificationConfirmationReception(destinataire, nomManager, nomEmploye, mois, annee, montant) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Confirmation de réception - ${nomEmploye}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Réception Confirmée</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomManager}</strong>,</p>
                
                <p><strong>${nomEmploye}</strong> a confirmé la réception de son salaire.</p>
                
                <div class="info-box">
                  <p><strong>Employé :</strong> ${nomEmploye}</p>
                  <p><strong>Période :</strong> ${this.getMoisNom(mois)} ${annee}</p>
                  <p><strong>Montant :</strong> ${montant.toLocaleString('fr-FR')} FBU</p>
                  <p><strong>Statut :</strong> <span style="color: #10B981;">Confirmé</span></p>
                  <p><strong>Date de confirmation :</strong> ${this.formatDate(new Date())}</p>
                </div>
                
                <p>Le paiement a été confirmé et le processus est maintenant complet.</p>
                
                <p style="color: #6B7280; font-size: 14px;">
                  Cette confirmation garantit la traçabilité complète du paiement.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email notification confirmation réception envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi notification confirmation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification de salaire payé à l'employé
   */
  async envoyerNotificationSalairePaye(destinataire, nomEmploye, montant, mois, annee) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Salaire versé - ${mois}/${annee}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .amount-box { background: white; border: 2px solid #10B981; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
              .amount { font-size: 28px; font-weight: bold; color: #10B981; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Salaire Versé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Votre salaire du mois de <strong>${this.getMoisNom(mois)} ${annee}</strong> a été versé.</p>
                
                <div class="amount-box">
                  <p style="margin: 0; color: #6B7280;">Montant net</p>
                  <div class="amount">${montant.toLocaleString('fr-FR')} FBU</div>
                </div>
                
                <p>Le virement devrait apparaître sur votre compte bancaire sous 24 à 48 heures.</p>
                
                <p>Vous pouvez consulter votre bulletin de salaire détaillé dans l'application NUTRIFIX.</p>
                
                <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
                  N'oubliez pas de confirmer la réception de votre salaire dans l'application une fois le virement reçu.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email notification salaire envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi notification salaire:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer un email de bienvenue à un nouvel employé
   */
  async envoyerEmailBienvenue(destinataire, nomEmploye, matricule, motDePasse, dateEmbauche, role) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Bienvenue chez NUTRIFIX !',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border: 1px solid #E5E7EB; padding: 20px; margin: 20px 0; border-radius: 8px; }
              .credential-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .password { font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; color: #DC2626; letter-spacing: 2px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Bienvenue chez NUTRIFIX !</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Nous sommes ravis de vous accueillir dans notre équipe ! Voici vos informations de connexion au système RH NUTRIFIX.</p>
                
                <div class="info-box">
                  <p><strong>Vos informations :</strong></p>
                  <p><strong>Matricule :</strong> ${matricule}</p>
                  <p><strong>Email :</strong> ${destinataire}</p>
                  <p><strong>Rôle :</strong> ${this.getRoleLabel(role)}</p>
                  <p><strong>Date d'embauche :</strong> ${this.formatDate(dateEmbauche)}</p>
                </div>
                
                <div class="credential-box">
                  <p><strong>Mot de passe temporaire :</strong></p>
                  <div class="password">${motDePasse}</div>
                  <p style="margin-top: 15px; color: #DC2626; font-weight: bold;">
                    IMPORTANT : Vous devrez changer ce mot de passe lors de votre première connexion.
                  </p>
                </div>
                
                <p><strong>Pour vous connecter :</strong></p>
                <ol>
                  <li>Accédez à l'application NUTRIFIX RH</li>
                  <li>Utilisez votre email et le mot de passe ci-dessus</li>
                  <li>Créez votre nouveau mot de passe sécurisé</li>
                </ol>
                
                <p style="color: #6B7280; font-size: 14px; margin-top: 30px;">
                  Si vous avez des questions, n'hésitez pas à contacter le service RH.<br>
                  📧 rh@nutrifix.bi | 📞 +257 22 XX XX XX
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email de bienvenue envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email bienvenue:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier les admins RH d'un nouvel employé
   */
  async envoyerNotificationNouvelEmploye(destinataire, nomAdmin, nomEmploye, matricule, typeEmploye, dateEmbauche) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: `Nouvel employé ajouté - ${nomEmploye}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border-left: 4px solid #3B82F6; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Nouvel Employé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomAdmin}</strong>,</p>
                
                <p>Un nouvel employé a été ajouté au système RH.</p>
                
                <div class="info-box">
                  <p><strong>Nom :</strong> ${nomEmploye}</p>
                  <p><strong>Matricule :</strong> ${matricule}</p>
                  <p><strong>Type :</strong> ${typeEmploye}</p>
                  <p><strong>Date d'embauche :</strong> ${this.formatDate(dateEmbauche)}</p>
                </div>
                
                <p>L'employé a reçu un email de bienvenue avec ses identifiants de connexion.</p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Notification nouvel employé envoyée:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur notification nouvel employé:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier l'employé de l'approbation de son congé
   */
  async envoyerNotificationCongeApprouve(destinataire, nomEmploye, valideurNom, typeConge, dateDebut, dateFin, jours) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Congé approuvé',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .success-box { background: #D1FAE5; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .info-box { background: white; border: 1px solid #E5E7EB; padding: 15px; margin: 20px 0; border-radius: 8px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Congé Approuvé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <div class="success-box">
                  <p style="margin: 0; font-size: 18px; font-weight: bold; color: #059669;">
                    Bonne nouvelle ! Votre demande de congé a été approuvée.
                  </p>
                </div>
                
                <div class="info-box">
                  <p><strong>Type de congé :</strong> ${this.getTypeCongeLabel(typeConge)}</p>
                  <p><strong>Période :</strong> Du ${this.formatDate(dateDebut)} au ${this.formatDate(dateFin)}</p>
                  <p><strong>Durée :</strong> ${jours} jour(s)</p>
                  <p><strong>Approuvé par :</strong> ${valideurNom}</p>
                </div>
                
                <p>Profitez bien de votre repos !</p>
                
                <p style="color: #6B7280; font-size: 14px;">
                  N'oubliez pas de consulter l'application pour voir les détails complets de votre congé.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email approbation congé envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi approbation congé:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier l'employé du rejet de son congé
   */
  async envoyerNotificationCongeRejete(destinataire, nomEmploye, valideurNom, typeConge, dateDebut, dateFin, raisonRejet) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Congé non approuvé',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .reject-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .info-box { background: white; border: 1px solid #E5E7EB; padding: 15px; margin: 20px 0; border-radius: 8px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Congé Non Approuvé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Nous avons le regret de vous informer que votre demande de congé n'a pas été approuvée.</p>
                
                <div class="info-box">
                  <p><strong>Type de congé :</strong> ${this.getTypeCongeLabel(typeConge)}</p>
                  <p><strong>Période demandée :</strong> Du ${this.formatDate(dateDebut)} au ${this.formatDate(dateFin)}</p>
                  <p><strong>Traité par :</strong> ${valideurNom}</p>
                </div>
                
                <div class="reject-box">
                  <p><strong>Raison du rejet :</strong></p>
                  <p style="margin: 10px 0; color: #DC2626;">${raisonRejet}</p>
                </div>
                
                <p>Si vous souhaitez discuter de cette décision ou soumettre une nouvelle demande, n'hésitez pas à contacter votre responsable.</p>
                
                <p style="color: #6B7280; font-size: 14px;">
                  Vous pouvez consulter l'application pour voir tous les détails.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email rejet congé envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur envoi rejet congé:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification de réinitialisation de mot de passe à l'employé
   */
  async envoyerNotificationReinitialisationMotDePasse(destinataire, nomEmploye, nouveauMotDePasse) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Sécurité',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Réinitialisation de votre mot de passe',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #1E3A8A 0%, #3B82F6 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .credential-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .password { font-family: 'Courier New', monospace; font-size: 20px; font-weight: bold; color: #DC2626; letter-spacing: 2px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Sécurité de votre compte</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Votre mot de passe pour le système NUTRIFIX a été réinitialisé par un administrateur.</p>
                
                <div class="credential-box">
                  <p><strong>Votre nouveau mot de passe temporaire :</strong></p>
                  <div class="password">${nouveauMotDePasse}</div>
                  <p style="margin-top: 15px; color: #DC2626; font-weight: bold;">
                    IMPORTANT : Vous devrez changer ce mot de passe lors de votre prochaine connexion.
                  </p>
                </div>
                
                <p>Si vous n'êtes pas à l'origine de cette demande, veuillez contacter immédiatement le service informatique.</p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email réinitialisation mdp envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email réinitialisation mdp:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier l'employé d'une modification de son profil
   */
  async envoyerNotificationModificationCompte(destinataire, nomEmploye, modifications = []) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Système RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Mise à jour de votre compte',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; border-left: 4px solid #10B981; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Compte Mis à Jour</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Nous vous informons que des modifications ont été apportées à votre profil sur le système NUTRIFIX.</p>
                
                <div class="info-box">
                  <p><strong>Date de modification :</strong> ${this.formatDate(new Date())}</p>
                </div>
                
                <p>Si vous avez des questions concernant ces changements, veuillez contacter le service RH.</p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email modification compte envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email modification compte:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Notifier l'employé de la désactivation de son compte
   */
  async envoyerNotificationDesactivationCompte(destinataire, nomEmploye, raison) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - RH',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: 'Désactivation de votre compte',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .reject-box { background: #FEE2E2; border-left: 4px solid #EF4444; padding: 15px; margin: 20px 0; border-radius: 4px; }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Compte Désactivé</h1>
              </div>
              
              <div class="content">
                <p>Bonjour <strong>${nomEmploye}</strong>,</p>
                
                <p>Nous vous informons que votre compte sur le système NUTRIFIX a été désactivé.</p>
                
                <div class="reject-box">
                  <p><strong>Statut :</strong> Inactif</p>
                  <p><strong>Raison :</strong> ${raison || 'Supprimé par un administrateur'}</p>
                </div>
                
                <p>Pour toute réclamation, veuillez contacter le service RH.</p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Système de Gestion des Ressources Humaines</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email désactivation compte envoyé:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('❌ Erreur envoi email désactivation compte:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Envoyer une notification générale aux employés
   */
  async envoyerNotificationGenerale(destinataire, sujet, message) {
    try {
      const mailOptions = {
        from: {
          name: 'NUTRIFIX - Administration',
          address: process.env.EMAIL_USER
        },
        to: destinataire,
        subject: sujet,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #4F46E5 0%, #4338CA 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .message-box { background: white; border-left: 4px solid #4F46E5; padding: 20px; margin: 20px 0; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
              .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #E5E7EB; color: #6B7280; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Notification Importante</h1>
              </div>
              
              <div class="content">
                <p>Bonjour,</p>
                
                <p>Vous avez reçu une nouvelle notification de l'administration NUTRIFIX :</p>
                
                <div class="message-box">
                  <h3 style="margin-top: 0; color: #4F46E5;">${sujet}</h3>
                  <div style="white-space: pre-line;">${message}</div>
                </div>
                
                <p style="color: #6B7280; font-size: 14px; margin-top: 20px;">
                  Ceci est un message automatique, merci de ne pas y répondre directement sauf indication contraire.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>NUTRIFIX</strong> - Communication Interne</p>
                <p>&copy; ${new Date().getFullYear()} NUTRIFIX. Tous droits réservés.</p>
              </div>
            </div>
          </body>
          </html>
        `
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Notification générale envoyée:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('Erreur notification générale:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Obtenir le nom du mois
   */
  getMoisNom(mois) {
    const moisNoms = [
      'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
      'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return moisNoms[mois - 1] || '';
  }

  /**
   * Helper: Formater une date
   */
  formatDate(date) {
    const d = new Date(date);
    const jour = String(d.getDate()).padStart(2, '0');
    const mois = String(d.getMonth() + 1).padStart(2, '0');
    const annee = d.getFullYear();
    return `${jour}/${mois}/${annee}`;
  }

  /**
   * Helper: Obtenir le label du type de congé
   */
  getTypeCongeLabel(type) {
    const labels = {
      'annuel': 'Congé Annuel',
      'maladie': 'Congé Maladie',
      'maternite': 'Congé Maternité',
      'paternite': 'Congé Paternité',
      'sans_solde': 'Congé Sans Solde',
      'exceptionnel': 'Congé Exceptionnel'
    };
    return labels[type] || type;
  }

  /**
   * Helper: Obtenir le label du rôle
   */
  getRoleLabel(role) {
    const labels = {
      'admin': 'Administrateur',
      'manager': 'Manager',
      'employe': 'Employé'
    };
    return labels[role] || role;
  }

  /**
   * Vérifier la configuration email
   */
  async verifierConfiguration() {
    try {
      await this.transporter.verify();
      console.log('Configuration email valide');
      return true;
    } catch (error) {
      console.error('Configuration email invalide:', error);
      return false;
    }
  }
}

module.exports = new EmailService();