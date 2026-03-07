/**
 * Media Players Logic
 * Custom Audio/Video Players and Modal Management
 */

document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('player-modal');
    const playerContainer = document.getElementById('player-container');
    const closeBtn = document.getElementById('close-modal');

    // Sample data (should match main.js or be imported)
    const mediaData = [
        { id: 1, type: 'video', title: 'Voyage Spatial 4K', url: 'https://vjs.zencdn.net/v/oceans.mp4' },
        { id: 2, type: 'music', title: 'Lofi Midnight', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
        { id: 3, type: 'image', title: 'Architecture Moderne', url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1200&q=90' },
        { id: 4, type: 'article', title: 'L\'IA en 2026', content: 'L\'intelligence artificielle en 2026 est devenue omniprésente...' }
    ];

    // Event delegation for "View" buttons
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('view-btn')) {
            const id = parseInt(e.target.getAttribute('data-id'));
            const item = mediaData.find(m => m.id === id);
            if (item) openModal(item);
        }
    });

    closeBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    function openModal(item) {
        playerContainer.innerHTML = '';
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        if (item.type === 'video') {
            playerContainer.innerHTML = `
                <div class="video-wrapper">
                    <video controls autoplay class="custom-video">
                        <source src="${item.url}" type="video/mp4">
                        Votre navigateur ne supporte pas la lecture de vidéos.
                    </video>
                    <div class="media-info">
                        <h2>${item.title}</h2>
                        <p>Expérience immersive en haute définition.</p>
                    </div>
                </div>
            `;
        } else if (item.type === 'music') {
            playerContainer.innerHTML = `
                <div class="audio-player-custom glass">
                    <i class="ri-music-2-fill player-icon"></i>
                    <div class="player-info">
                        <h2>${item.title}</h2>
                        <audio controls autoplay>
                            <source src="${item.url}" type="audio/mpeg">
                        </audio>
                    </div>
                </div>
            `;
        } else if (item.type === 'image') {
            playerContainer.innerHTML = `
                <div class="image-viewer">
                    <img src="${item.url}" alt="${item.title}" class="full-img">
                    <div class="media-info">
                        <h2>${item.title}</h2>
                    </div>
                </div>
            `;
        } else if (item.type === 'article') {
            playerContainer.innerHTML = `
                <article class="article-viewer">
                    <h1>${item.title}</h1>
                    <div class="article-body">
                        <p>${item.content || 'Contenu détaillé de l\'article ici...'}</p>
                        <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.</p>
                    </div>
                </article>
            `;
        }
    }

    function closeModal() {
        modal.classList.remove('active');
        playerContainer.innerHTML = '';
        document.body.style.overflow = '';
    }
});
