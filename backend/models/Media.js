const mongoose = require('mongoose');

const mediaSchema = new mongoose.Schema({
    type: {
        type: String,
        required: [true, 'Le type est requis'],
        enum: ['video', 'music', 'image', 'animation', 'article', 'podcast', 'interactive', 'vr', 'document'],
    },
    title: {
        type: String,
        required: [true, 'Le titre est requis'],
        trim: true,
        maxlength: [200, 'Le titre ne peut dépasser 200 caractères'],
    },
    category: {
        type: String,
        required: [true, 'La catégorie est requise'],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
        maxlength: [1000, 'La description ne peut dépasser 1000 caractères'],
        default: '',
    },
    thumbnail: {
        type: String,
        required: [true, 'La miniature est requise'],
    },
    url: {
        type: String,
        default: '',
    },
    backupUrl: {
        type: String,
        default: '',
    },
    attachmentUrl: {
        type: String,
        default: '',
    },
    content: {
        type: String,
        default: '',
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    author: {
        type: String,
        default: 'Admin',
        trim: true,
    },
    featured: {
        type: Boolean,
        default: false,
    },
    views: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,   // createdAt + updatedAt automatiques
});

// Index pour la recherche textuelle
mediaSchema.index({ title: 'text', description: 'text', category: 'text' });

// Méthode virtuelle pour la compatibilité frontend
mediaSchema.virtual('publishedAt').get(function () {
    return this.createdAt;
});
mediaSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Media', mediaSchema);
