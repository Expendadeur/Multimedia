const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Admin = require('../models/Admin');
const router = express.Router();

/**
 * POST /api/auth/login
 * Connexion admin — retourne un JWT
 */
router.post('/login', [
    body('email').isEmail().withMessage('Email invalide').normalizeEmail(),
    body('password').notEmpty().withMessage('Mot de passe requis'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, errors: errors.array() });
    }

    try {
        const { email, password } = req.body;

        // Chercher l'admin (avec le mdp qui est exclu par défaut)
        const admin = await Admin.findOne({ email }).select('+password');
        if (!admin) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
        }

        const isMatch = await admin.verifyPassword(password);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Email ou mot de passe incorrect.' });
        }

        // Générer le JWT
        const token = jwt.sign(
            { id: admin._id, email: admin.email },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
        );

        res.json({
            success: true,
            token,
            admin: { id: admin._id, email: admin.email, name: admin.name },
        });

    } catch (err) {
        console.error('[Auth] Login error:', err);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

/**
 * GET /api/auth/me
 * Vérifier la validité du token / récupérer le profil admin
 */
const authMiddleware = require('../middleware/auth');
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const admin = await Admin.findById(req.admin.id);
        if (!admin) return res.status(404).json({ success: false, message: 'Admin introuvable.' });
        res.json({ success: true, admin: { id: admin._id, email: admin.email, name: admin.name } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
