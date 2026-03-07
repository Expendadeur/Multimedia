/**
 * StreamVibe Backend — Production Server
 * Node.js + Express + MongoDB (Mongoose) + JWT
 *
 * Démarrage: node server.js (ou npm run dev)
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const Admin = require('./models/Admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Security Headers ──────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

// ── CORS ──────────────────────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || '').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, cb) => {
        // Allow no-origin (mobile / Postman) and allowedOrigins
        if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            return cb(null, true);
        }
        cb(new Error(`CORS bloqué pour l'origine: ${origin}`));
    },
    credentials: true,
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Static Files (Uploads) ────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate Limiting ─────────────────────────────────────────────────
app.use('/api/auth/login', rateLimit({
    windowMs: 15 * 60 * 1000,  // 15 min
    max: 10,                     // 10 tentatives max par fenêtre
    message: { success: false, message: 'Trop de tentatives. Réessayez dans 15 minutes.' },
}));

app.use('/api/', rateLimit({
    windowMs: 60 * 1000,   // 1 min
    max: 200,
    message: { success: false, message: 'Trop de requêtes. Ralentissez.' },
}));

// ── Routes ────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: 'Outfit', sans-serif; text-align: center; padding: 50px; background: #080c1a; color: white; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
            <div style="font-size: 3rem; font-weight: 800; margin-bottom: 10px;">Stream<span style="color: #6366f1;">Vibe</span> API</div>
            <p style="font-size: 1.2rem; opacity: 0.8;">🚀 Le serveur backend est opérationnel et connecté à MongoDB.</p>
            <hr style="width: 50px; border: 1px solid #6366f1; margin: 30px 0;">
            <p style="opacity: 0.7; max-width: 500px; line-height: 1.6;">
                Ceci est le point d'entrée de l'API. Pour accéder à la plateforme multimédia, 
                veuillez ouvrir le fichier <strong style="color: #6366f1;">index.html</strong> dans votre navigateur.
            </p>
            <a href="/api/health" style="margin-top: 30px; color: #6366f1; text-decoration: none; font-weight: 600;">Vérifier le statut JSON →</a>
            <div style="margin-top: 50px; font-size: 0.8rem; opacity: 0.4;">© 2026 StreamVibe | Offline-First Engine v3</div>
        </div>
    `);
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/media', require('./routes/media'));

// ── Health Check ──────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        status: 'OK',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development',
    });
});

// ── 404 Handler ───────────────────────────────────────────────────
app.use('/api/*', (req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.originalUrl} introuvable.` });
});

// ── Global Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
    console.error('[ServerError]', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Erreur interne du serveur.' : err.message,
    });
});

// ── Database Connection + Seed ────────────────────────────────────
async function connectAndSeed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 10000,
        });
        console.log('✅  MongoDB connecté');

        // Créer l'admin par défaut si aucun n'existe
        const count = await Admin.countDocuments();
        if (count === 0) {
            await Admin.create({
                email: process.env.ADMIN_EMAIL || 'admin@streamvibe.com',
                password: process.env.ADMIN_PASSWORD || 'Admin123!',
                name: 'Administrateur',
            });
            console.log('✅  Admin créé:', process.env.ADMIN_EMAIL || 'admin@streamvibe.com');
        }

        // Seed quelques médias de démonstration si la base est vide
        const Media = require('./models/Media');
        const mediaCount = await Media.countDocuments();
        if (mediaCount === 0) {
            const seedData = [
                // 🎬 VIDEOS (Unique Samples)
                { type: 'video', title: 'Océans Profonds 4K', category: 'Nature', thumbnail: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800', url: 'https://vjs.zencdn.net/v/oceans.mp4', description: 'Exploration des fonds marins.', featured: true, author: 'NationalGeographic' },
                { type: 'video', title: 'Big Buck Bunny', category: 'Animation', thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', description: 'Le classique de Blender Studio.', featured: false, author: 'Blender' },
                { type: 'video', title: 'Elephants Dream', category: 'Sci-Fi', thumbnail: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', description: 'Premier film d\'animation open source.', featured: true, author: 'OrangeProject' },
                { type: 'video', title: 'Sintel', category: 'Fantasy', thumbnail: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', description: 'Une aventure épique et émouvante.', featured: false, author: 'DurianProject' },
                { type: 'video', title: 'Tears of Steel', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1502691876148-a84246f48c9b?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', description: 'Démonstration de puissance VFX.', featured: true, author: 'MangoProject' },

                // 🎵 MUSIC (Diverse Genres)
                { type: 'music', title: 'Smooth Jazz Night', category: 'Jazz', thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', description: 'Ambiance relaxante.', featured: true, author: 'JazzVibe' },
                { type: 'music', title: 'Synthwave Neon', category: 'Electro', thumbnail: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', description: 'Rythmes rétro-futuristes.', featured: false, author: 'RetroWave' },
                { type: 'music', title: 'Epic Orchestral', category: 'Classic', thumbnail: 'https://images.unsplash.com/photo-1507838546671-ccf813955685?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3', description: 'Puissance symphonique.', featured: true, author: 'Maestro' },
                { type: 'music', title: 'Deep House Flow', category: 'Club', thumbnail: 'https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3', description: 'Beats profonds pour le travail.', featured: false, author: 'DJCloud' },
                { type: 'music', title: 'Acoustic Soul', category: 'Folk', thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-15.mp3', description: 'Chaleur de la guitare acoustique.', featured: false, author: 'SoulSinger' },

                // 🖼️ IMAGES (High Quality Unsplash)
                { type: 'image', title: 'Architecture Brutaliste', category: 'Design', thumbnail: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=800', url: 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?w=1600', description: 'Lignes épurées et béton.', featured: true, author: 'LensMaster' },
                { type: 'image', title: 'Cyberpunk Tokyo', category: 'Street', thumbnail: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1600', description: 'Nuit électrique au Japon.', featured: false, author: 'NeonEye' },
                { type: 'image', title: 'Nature Wildlife', category: 'Nature', thumbnail: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=800', url: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=1600', description: 'Majesté des montagnes sauvages.', featured: true, author: 'WildSnap' },
                { type: 'image', title: 'Abstract Oil Paint', category: 'Art', thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=800', url: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=1600', description: 'Fluctuations de couleurs vibrantes.', featured: false, author: 'Artis' },
                { type: 'image', title: 'Future Tech Office', category: 'Business', thumbnail: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=800', url: 'https://images.unsplash.com/photo-1497215728101-856f4ea42174?w=1600', description: 'Espace de travail moderne.', featured: false, author: 'BizTech' },

                // ✨ ANIMATIONS (Dynamic GIFs/WebP)
                { type: 'animation', title: 'Fluid Wave Magic', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800', url: 'https://vjs.zencdn.net/v/oceans.mp4', description: 'Simulation de fluide haut de gamme.', featured: true, author: 'MotionX' },
                { type: 'animation', title: 'Abstract Loop 3D', category: 'Abstract', thumbnail: 'https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', description: 'Boucle cinématique infinie.', featured: false, author: 'RenderFarm' },
                { type: 'animation', title: 'Hologram Interface', category: 'Sci-Fi', thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', description: 'Interface utilisateur futuriste.', featured: true, author: 'UIFuture' },
                { type: 'animation', title: 'Particle Cloud', category: 'VFX', thumbnail: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4', description: 'Nuage de particules complexe.', featured: false, author: 'EffectMaker' },
                { type: 'animation', title: 'Typography Drift', category: 'Design', thumbnail: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Starve.mp4', description: 'Motion design typographique.', featured: false, author: 'FontMaster' },

                // 📄 ARTICLES (Structured Content)
                { type: 'article', title: 'L\'Ère de la Création IA', category: 'Tech', thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', content: '<h3>Le futur est ici</h3><p>Analyse de l\'impact de l\'IA sur le multimédia...</p>', description: 'Dossier exclusif.', featured: true, author: 'StreamVibe' },
                { type: 'article', title: 'Design System 2026', category: 'Design', thumbnail: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800', content: '<h3>Nouveaux Standards</h3><p>Vers une interface plus humaine et dynamique...</p>', description: 'Lignes directrices visuelles.', featured: false, author: 'CreativeTeam' },
                { type: 'article', title: 'Cryptographie Moderne', category: 'Security', thumbnail: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800', content: '<h3>Sécurité Maximale</h3><p>Protéger les données à l\'ère du quantique...</p>', description: 'Guide technique.', featured: true, author: 'SecuLab' },
                { type: 'article', title: 'Recrutement: Senior Dev', category: 'Job', thumbnail: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?w=800', content: '<h3>Nous recrutons !</h3><p>Rejoignez l\'aventure StreamVibe au poste de Senior Backend Developer.</p>', description: 'Offre d\'emploi active.', featured: false, author: 'HR-Vibe', metadata: { jobTitle: 'Senior Dev Backend', deadline: '2026-06-30' } },
                { type: 'article', title: 'Annonce: V6.0 Stable', category: 'News', thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', content: '<h3>Mise à jour majeure</h3><p>Découvrez les nouvelles fonctionnalités de stabilité et de résilience.</p>', description: 'Communiqué officiel.', featured: true, author: 'ProductTeam' },

                // 🎙️ PODCASTS
                { type: 'podcast', title: 'Startup Journey', category: 'Business', thumbnail: 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', description: 'Conseils pour entrepreneurs.', featured: true, author: 'BizTalk' },
                { type: 'podcast', title: 'Science Weekly', category: 'Science', thumbnail: 'https://images.unsplash.com/photo-1532094349884-543bc11b234d?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', description: 'Les mystères de l\'univers.', featured: false, author: 'SciHub' },

                // 🥽 VR / 360°
                { type: 'vr', title: 'Mars Discovery', category: 'Space', thumbnail: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4', description: 'Immersion à 360° sur Mars.', featured: true, author: 'NASA-Vibe' },
                { type: 'vr', title: 'Deep Sea Exploration', category: 'Nature', thumbnail: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800', url: 'https://vjs.zencdn.net/v/oceans.mp4', description: 'Visite des coraux abyssaux.', featured: false, author: 'OceanCam' },

                // 📁 DOCUMENTS
                { type: 'document', title: 'Fiche de Poste PDF', category: 'Legal', thumbnail: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', description: 'Détails du recrutement.', featured: true, author: 'HR' },
                { type: 'document', title: 'Rapport Annuel 2026', category: 'Business', thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', description: 'Transparence et financier.', featured: false, author: 'Finance' },
            ];
            await Media.insertMany(seedData);
            console.log(`✅  ${seedData.length} Médias de démonstration ajoutés`);
            console.log(`💡  Conseil: Lancez 'node migrate-to-local.js' pour générer les fichiers locaux et les sauvegardes.`);
        }

    } catch (err) {
        console.error('❌  Connexion MongoDB échouée:', err.message);
        process.exit(1);
    }
}

// ── Start Server ──────────────────────────────────────────────────
connectAndSeed().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀  StreamVibe API lancé sur http://localhost:${PORT}`);
        console.log(`🌍  Environnement: ${process.env.NODE_ENV || 'development'}`);
    });
});

// Gestion propre de l'arrêt
process.on('SIGTERM', async () => {
    await mongoose.connection.close();
    process.exit(0);
});
