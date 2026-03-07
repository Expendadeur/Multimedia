const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const Media = require('../models/Media');
const auth = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// ── Multer Setup ───────────────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const type = req.body.type || 'other';
        let folder = 'uploads/other';

        if (file.fieldname === 'thumbnail') {
            folder = 'uploads/thumbnails';
        } else if (file.fieldname === 'attachment') {
            folder = 'uploads/docs';
        } else {
            switch (type) {
                case 'video': folder = 'uploads/videos'; break;
                case 'music': folder = 'uploads/audio'; break;
                case 'image': folder = 'uploads/images'; break;
                case 'article': folder = 'uploads/docs'; break;
                default: folder = 'uploads/other';
            }
        }

        const fullPath = path.join(__dirname, '..', folder);
        if (!fs.existsSync(fullPath)) {
            fs.mkdirSync(fullPath, { recursive: true });
        }
        cb(null, fullPath);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
}).fields([
    { name: 'media', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
    { name: 'attachment', maxCount: 1 }
]);

// ── Helpers ───────────────────────────────────────────────────────
function handleValidation(req, res) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return false;
    }
    return true;
}

// ── Public Routes (lecture) ────────────────────────────────────────

/**
 * GET /api/media
 * Récupère tous les médias avec filtres et recherche
 */
router.get('/', async (req, res) => {
    try {
        const { type, featured, search, limit = 50, page = 1 } = req.query;
        const filter = {};

        if (type && type !== 'all') filter.type = type;
        if (featured === 'true') filter.featured = true;
        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const [items, total] = await Promise.all([
            Media.find(filter)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            Media.countDocuments(filter),
        ]);

        res.json({ success: true, total, page: Number(page), data: items });
    } catch (err) {
        console.error('[Media] GET all error:', err.message);
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

/**
 * GET /api/media/:id
 */
router.get('/:id', async (req, res) => {
    try {
        const media = await Media.findByIdAndUpdate(
            req.params.id,
            { $inc: { views: 1 } },
            { new: true }
        ).lean();

        if (!media) return res.status(404).json({ success: false, message: 'Média introuvable.' });
        res.json({ success: true, data: media });
    } catch (err) {
        if (err.name === 'CastError') return res.status(400).json({ success: false, message: 'ID invalide.' });
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

// ── Protected Routes (admin uniquement) ───────────────────────────

/**
 * POST /api/media
 * Support FormData avec fichiers locaux
 */
router.post('/', auth, upload, [
    body('type').notEmpty().withMessage('Type requis'),
    body('title').notEmpty().trim().withMessage('Titre requis'),
    body('category').notEmpty().trim().withMessage('Catégorie requise'),
], async (req, res) => {
    if (!handleValidation(req, res)) return;
    try {
        const { type, title, category, description, author, featured, content, backupUrl } = req.body;

        // Résoudre les chemins de fichiers
        let mediaUrl = req.body.url || '';
        let thumbUrl = req.body.thumbnail || '';
        let attachmentUrl = req.body.attachmentUrl || '';

        if (req.files && req.files.media) {
            const folder = type === 'video' ? 'videos' : type === 'music' ? 'audio' : type === 'image' ? 'images' : 'docs';
            mediaUrl = `/uploads/${folder}/${req.files.media[0].filename}`;
        }

        if (req.files && req.files.thumbnail) {
            thumbUrl = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;
        }

        if (req.files && req.files.attachment) {
            attachmentUrl = `/uploads/docs/${req.files.attachment[0].filename}`;
        }

        let metadata = {};
        try {
            if (req.body.metadata) {
                metadata = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
            }
        } catch (e) { console.error('Metadata parse error:', e); }

        const media = await Media.create({
            type,
            title: title.trim(),
            category: category.trim(),
            description: (description || '').trim(),
            thumbnail: thumbUrl,
            url: mediaUrl,
            backupUrl: backupUrl || '',
            attachmentUrl,
            content: (content || '').trim(),
            metadata,
            author: (author || 'Admin').trim(),
            featured: featured === 'true' || featured === true,
        });

        res.status(201).json({ success: true, data: media });
    } catch (err) {
        console.error('[Media] POST error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la création.' });
    }
});

/**
 * PUT /api/media/:id
 */
router.put('/:id', auth, upload, async (req, res) => {
    try {
        const { type, title, category, description, author, featured, content, backupUrl } = req.body;
        const updates = {};

        if (type) updates.type = type;
        if (title) updates.title = title.trim();
        if (category) updates.category = category.trim();
        if (description !== undefined) updates.description = description.trim();
        if (author) updates.author = author.trim();
        if (featured !== undefined) updates.featured = (featured === 'true' || featured === true);
        if (content !== undefined) updates.content = content.trim();
        if (backupUrl !== undefined) updates.backupUrl = backupUrl.trim();

        if (req.files && req.files.media) {
            const folder = type === 'video' ? 'videos' : type === 'music' ? 'audio' : type === 'image' ? 'images' : 'docs';
            updates.url = `/uploads/${folder}/${req.files.media[0].filename}`;
        }

        if (req.files && req.files.thumbnail) {
            updates.thumbnail = `/uploads/thumbnails/${req.files.thumbnail[0].filename}`;
        }

        if (req.files && req.files.attachment) {
            updates.attachmentUrl = `/uploads/docs/${req.files.attachment[0].filename}`;
        }

        if (req.body.metadata) {
            try {
                updates.metadata = typeof req.body.metadata === 'string' ? JSON.parse(req.body.metadata) : req.body.metadata;
            } catch (e) { console.error('Metadata parse error:', e); }
        }

        const media = await Media.findByIdAndUpdate(req.params.id, updates, { new: true });
        if (!media) return res.status(404).json({ success: false, message: 'Média introuvable.' });

        res.json({ success: true, data: media });
    } catch (err) {
        console.error('[Media] PUT error:', err);
        res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour.' });
    }
});

/**
 * PATCH /api/media/:id/featured
 */
router.patch('/:id/featured', auth, async (req, res) => {
    try {
        const media = await Media.findById(req.params.id);
        if (!media) return res.status(404).json({ success: false, message: 'Média introuvable.' });
        media.featured = !media.featured;
        await media.save();
        res.json({ success: true, data: media });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

/**
 * DELETE /api/media/:id
 */
router.delete('/:id', auth, async (req, res) => {
    try {
        const media = await Media.findByIdAndDelete(req.params.id);
        if (!media) return res.status(404).json({ success: false, message: 'Média introuvable.' });

        // Optionnel: Supprimer les fichiers physiques ici

        res.json({ success: true, message: 'Contenu supprimé.' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

router.get('/admin/stats', auth, async (req, res) => {
    try {
        const [total, featured, byType] = await Promise.all([
            Media.countDocuments(),
            Media.countDocuments({ featured: true }),
            Media.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]),
        ]);
        const byTypeMap = {};
        byType.forEach(t => { byTypeMap[t._id] = t.count; });
        res.json({ success: true, data: { total, featured, byType: byTypeMap } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Erreur serveur.' });
    }
});

module.exports = router;
