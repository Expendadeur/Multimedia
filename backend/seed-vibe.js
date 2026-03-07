const mongoose = require('mongoose');
require('dotenv').config();
const Media = require('./models/Media');

async function seed() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('🔌 Connected to DB.');

        await Media.deleteMany({});
        console.log('🗑️ Database Wiped.');

        const data = [
            // 🎬 VIDEOS
            { type: 'video', title: 'Océans Profonds 4K', category: 'Nature', thumbnail: 'https://images.unsplash.com/photo-1551244072-5d12893278ab?w=800', url: 'https://vjs.zencdn.net/v/oceans.mp4', description: 'Exploration sous-marine.', author: 'NationalGeo' },
            { type: 'video', title: 'Big Buck Bunny', category: 'Animation', thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', description: 'Blender classic.', author: 'Blender' },
            { type: 'video', title: 'Elephants Dream', category: 'Sci-Fi', thumbnail: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', description: 'Concept futuriste.', author: 'Orange' },

            // 🖼️ IMAGES
            { type: 'image', title: 'Cyber Tokyo', category: 'Street', thumbnail: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800', url: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1600', description: 'Nuit à Tokyo.', author: 'Lens' },
            { type: 'image', title: 'Nature Wildlife', category: 'Nature', thumbnail: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=800', url: 'https://images.unsplash.com/photo-1474044159687-1ee9f3a51722?w=1600', description: 'Nature sauvage.', author: 'Wild' },

            // 🎵 MUSIC
            { type: 'music', title: 'Midnight Jazz', category: 'Jazz', thumbnail: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=800', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', author: 'JazzVibe' },

            // ✨ ANIMATIONS
            { type: 'animation', title: 'Liquid Flow', category: 'Motion', thumbnail: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=800', url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', author: 'MotionMaster' },

            // 📄 ARTICLES
            { type: 'article', title: 'Le Futur de l\'IA', category: 'Tech', thumbnail: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800', content: '<p>L\'IA change tout...</p>', description: 'Dossier Tech' }
        ];

        await Media.insertMany(data);
        console.log(`✅ Seeded ${data.length} unique items.`);

        process.exit(0);
    } catch (err) {
        console.error('❌ SEED ERROR:', err);
        process.exit(1);
    }
}

seed();
