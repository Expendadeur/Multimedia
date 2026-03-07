const mongoose = require('mongoose');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const Media = require('./models/Media');
require('dotenv').config();

const MAX_DOWNLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

async function downloadFile(url, folder) {
    if (!url || !url.startsWith('http')) return null;
    try {
        // HEAD request to check size before downloading
        let contentLength = 0;
        try {
            const head = await axios.head(url, { timeout: 10000 });
            contentLength = parseInt(head.headers['content-length'] || '0');
        } catch { /* ignore head errors, proceed and monitor size */ }

        if (contentLength > MAX_DOWNLOAD_BYTES) {
            console.log(`   ⏭️  Skipped (${(contentLength / 1024 / 1024).toFixed(1)} MB > 5MB limit) — garde URL distante.`);
            return null;
        }

        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000
        });

        const ext = path.extname(url).split('?')[0] || '.bin';
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}${ext}`;
        const relativePath = `uploads/${folder}/${filename}`;
        const absolutePath = path.join(__dirname, relativePath);

        const dir = path.dirname(absolutePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const writer = fs.createWriteStream(absolutePath);
        let bytesWritten = 0;
        let aborted = false;

        response.data.on('data', chunk => {
            bytesWritten += chunk.length;
            if (bytesWritten > MAX_DOWNLOAD_BYTES && !aborted) {
                aborted = true;
                response.data.destroy();
                writer.destroy();
                fs.unlink(absolutePath, () => { });
                console.log(`   ⏭️  Téléchargement annulé (dépassé 5MB en cours) — garde URL distante.`);
            }
        });
        response.data.pipe(writer);

        return new Promise((resolve) => {
            writer.on('finish', () => resolve(aborted ? null : `/${relativePath}`));
            writer.on('error', () => resolve(null));
            response.data.on('error', () => resolve(null));
        });
    } catch (err) {
        console.error(`\n   FAILED to download ${url}:`, err.message);
        return null;
    }
}

async function migrate() {
    console.log('🚀 --- DÉMARRAGE DE LA MIGRATION VERS STOCKAGE LOCAL ---');
    try {
        if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI non défini dans .env');

        console.log('🔌 Connexion à MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connecté.');

        const items = await Media.find({
            $or: [
                { url: /^http/ },
                { thumbnail: /^http/ }
            ]
        });

        console.log(`📊 ${items.length} éléments à traiter.`);

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            console.log(`\n[${i + 1}/${items.length}] 📦 Objet: "${item.title}" (${item.type})`);

            const folder = item.type === 'video' ? 'videos' :
                item.type === 'music' ? 'audio' :
                    item.type === 'image' ? 'images' : 'docs';

            // Migration URL média
            const originalUrl = item.url;
            process.stdout.write(`   🔹 Téléchargement média... `);
            const localUrl = await downloadFile(item.url, folder);
            if (localUrl) {
                item.backupUrl = originalUrl;
                item.url = localUrl;
                console.log(`OK -> ${localUrl} (Backup: ${originalUrl})`);
            }

            // Migration Thumbnail
            if (item.thumbnail && item.thumbnail.startsWith('http')) {
                process.stdout.write(`   🔸 Téléchargement miniature... `);
                const localThumb = await downloadFile(item.thumbnail, 'thumbnails');
                if (localThumb) {
                    item.thumbnail = localThumb;
                    console.log(`OK -> ${localThumb}`);
                }
            }

            await item.save();
        }

        console.log('\n✨ --- MIGRATION TERMINÉE AVEC SUCCÈS ---');
    } catch (err) {
        console.error('\n❌ ERREUR FATALE DURANT LA MIGRATION:', err);
    } finally {
        console.log('🔌 Déconnexion...');
        mongoose.disconnect();
    }
}

migrate();
