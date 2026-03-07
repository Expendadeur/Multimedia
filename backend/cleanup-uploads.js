/**
 * cleanup-uploads.js
 * Supprime les fichiers orphelins (non référencés en BD) ET les fichiers > 5MB
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

async function cleanup() {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connecté à MongoDB.');

    const media = await mongoose.connection.collection('media').find({}).toArray();

    // Extraire tous les chemins locaux référencés (url, thumbnail, attachmentUrl, backupUrl si local)
    const referenced = new Set();
    for (const item of media) {
        const fields = [item.url, item.thumbnail, item.attachmentUrl];
        for (const f of fields) {
            if (f && f.startsWith('/uploads/')) {
                // Convertir URL path vers chemin fichier absolu
                const rel = f.replace(/^\/uploads\//, '');
                referenced.add(path.join(UPLOADS_DIR, ...rel.split('/')));
            }
        }
    }

    console.log(`\n📦 ${media.length} éléments en base, ${referenced.size} fichiers référencés.`);

    let deleted = 0;
    let deletedSize = 0;

    function walkDir(dir) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walkDir(fullPath);
            } else {
                const stat = fs.statSync(fullPath);
                const isOrphaned = !referenced.has(fullPath);
                const isTooBig = stat.size > MAX_SIZE_BYTES;

                if (isOrphaned || isTooBig) {
                    const reason = isOrphaned ? 'ORPHELIN' : '';
                    const sizeReason = isTooBig ? `TROP GRAND (${(stat.size / 1024 / 1024).toFixed(1)}MB)` : '';
                    console.log(`🗑️  [${[reason, sizeReason].filter(Boolean).join(' + ')}] ${path.relative(UPLOADS_DIR, fullPath)}`);
                    fs.unlinkSync(fullPath);
                    deleted++;
                    deletedSize += stat.size;
                }
            }
        }
    }

    walkDir(UPLOADS_DIR);

    console.log(`\n✨ Nettoyage terminé: ${deleted} fichier(s) supprimé(s) — ${(deletedSize / 1024 / 1024).toFixed(2)} MB libérés.`);
    mongoose.disconnect();
}

cleanup().catch(err => { console.error('❌', err); process.exit(1); });
