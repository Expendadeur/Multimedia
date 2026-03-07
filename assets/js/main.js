/**
 * MainApp — StreamVibe Public Site
 * Production: All data from real API via DB_Service
 */

document.addEventListener('DOMContentLoaded', async () => {

    // ── Page Loader ──────────────────────────────────────────────────────────
    const loader = document.getElementById('page-loader');
    window.addEventListener('load', () => {
        setTimeout(() => { loader.classList.add('fade-out'); setTimeout(() => loader.remove(), 600); }, 600);
    });

    // Save scroll position for persistence
    window.addEventListener('scroll', () => {
        if (window.scrollY > 0) sessionStorage.setItem('gallery_scroll', window.scrollY);
    }, { passive: true });

    // ── Scroll Progress + Header ─────────────────────────────────────────────
    const progressBar = document.getElementById('scroll-progress-bar');
    const header = document.getElementById('main-header');
    window.addEventListener('scroll', () => {
        const s = (document.documentElement.scrollTop / (document.documentElement.scrollHeight - document.documentElement.clientHeight)) * 100;
        if (progressBar) progressBar.style.width = s + '%';
        header.classList.toggle('scrolled', window.scrollY > 60);
    }, { passive: true });

    // ── Mobile Menu ──────────────────────────────────────────────────────────
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const mobileOverlay = document.getElementById('mobile-overlay');
    const mobileClose = document.getElementById('mobile-close');
    function openMobile() { mobileMenu.classList.add('active'); mobileOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    function closeMobile() { mobileMenu.classList.remove('active'); mobileOverlay.classList.remove('active'); document.body.style.overflow = ''; }
    mobileMenuBtn?.addEventListener('click', openMobile);
    mobileClose?.addEventListener('click', closeMobile);
    mobileOverlay?.addEventListener('click', closeMobile);
    mobileMenu?.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMobile));

    // ── Search Overlay ───────────────────────────────────────────────────────
    const searchBtn = document.getElementById('search-btn');
    const searchOverlay = document.getElementById('search-overlay');
    const searchInput = document.getElementById('search-input');
    const searchClose = document.getElementById('search-close');
    const searchResults = document.getElementById('search-results');

    searchBtn?.addEventListener('click', () => { searchOverlay.classList.add('active'); searchInput.focus(); });
    searchClose?.addEventListener('click', () => searchOverlay.classList.remove('active'));
    searchOverlay?.addEventListener('click', (e) => { if (e.target === searchOverlay) searchOverlay.classList.remove('active'); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchOverlay.classList.remove('active'); closePlayerModal(); } });

    let searchTimeout;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (!q) { searchResults.innerHTML = ''; return; }
        searchTimeout = setTimeout(async () => {
            try {
                const results = (await DB_Service.search(q)).slice(0, 8);
                if (results.length === 0) {
                    searchResults.innerHTML = `<div class="search-empty">Aucun résultat pour "<b>${q}</b>"</div>`;
                    return;
                }
                searchResults.innerHTML = results.map(item => `
                    <div class="search-result-item" data-id="${item._id || item.id}" role="option" tabindex="0">
                        <img src="${item.thumbnail}" alt="${item.title}" onerror="this.style.display='none'">
                        <div class="search-result-info">
                            <span class="search-result-title">${item.title}</span>
                            <span class="search-result-meta">${getTypeLabel(item.type)} · ${item.category}</span>
                        </div>
                        <i class="ri-arrow-right-line"></i>
                    </div>
                `).join('');
                searchResults.querySelectorAll('.search-result-item').forEach(el => {
                    el.addEventListener('click', async () => {
                        try {
                            const item = await DB_Service.getById(el.dataset.id);
                            if (item) { openModal(item); searchOverlay.classList.remove('active'); }
                        } catch { }
                    });
                });
            } catch { searchResults.innerHTML = '<div class="search-empty">Erreur de recherche.</div>'; }
        }, 250);
    });

    // ── Gallery ──────────────────────────────────────────────────────────────
    let currentFilter = 'all';
    const grid = document.getElementById('media-grid');
    const filterBar = document.getElementById('filter-bar');
    const emptyState = document.getElementById('empty-state');

    const filters = [{ value: 'all', label: '🌐 Tous' }, ...DB_Service.MEDIA_TYPES];
    filters.forEach(f => {
        const btn = document.createElement('button');
        btn.className = `filter-chip ${f.value === 'all' ? 'active' : ''}`;
        btn.dataset.filter = f.value;
        btn.textContent = f.label;
        btn.addEventListener('click', () => {
            currentFilter = f.value;
            filterBar.querySelectorAll('.filter-chip').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderGallery();
        });
        filterBar.appendChild(btn);
    });

    async function renderGallery() {
        // Only show loader if grid is empty to avoid "flash" during sync
        if (grid.children.length === 0) {
            grid.innerHTML = `<div class="media-card glass" style="opacity:.4;padding:3rem;grid-column:1/-1;text-align:center;">Chargement…</div>`;
        }

        try {
            const data = await DB_Service.getAll(currentFilter === 'all' ? null : currentFilter);
            emptyState.classList.toggle('hidden', data.length > 0);

            // Build the HTML
            const html = data.map((item, i) => {
                const isCorporate = item.type === 'corporate';
                const meta = item.metadata || {};

                return `
                <article class="media-card glass reveal" style="animation-delay:${Math.min(i, 10) * 0.06}s" data-id="${item._id || item.id}" role="button" tabindex="0" aria-label="${item.title}">
                    <div class="card-media-wrap">
                        <img src="${item.thumbnail}" alt="${item.title}" class="card-image" loading="lazy" onerror="this.style.background='#1e293b';this.removeAttribute('src')">
                        <div class="card-hover-overlay">
                            <div class="play-pill"><i class="ri-${getTypeIcon(item.type)}"></i> ${getTypeLabel(item.type)}</div>
                        </div>
                        ${item.featured ? '<span class="feat-badge"><i class="ri-star-fill"></i></span>' : ''}
                        ${isCorporate ? '<span class="corporate-badge"><i class="ri-briefcase-line"></i> Info Entreprise</span>' : ''}
                    </div>
                    <div class="card-info">
                        <div class="card-header-row">
                            <span class="card-cat">${item.category}</span>
                            ${meta.deadline ? `<span class="deadline-badge"><i class="ri-calendar-event-line"></i> Expire le: ${new Date(meta.deadline).toLocaleDateString()}</span>` : ''}
                        </div>
                        <h3 class="card-title">${item.title}</h3>
                        ${meta.jobTitle ? `<p class="job-pill">Poste: ${meta.jobTitle}</p>` : ''}
                        <p class="card-desc">${item.description || ''}</p>
                        <div class="card-footer">
                            <span class="card-author"><i class="ri-user-line"></i> ${item.author || 'Admin'}</span>
                            <div class="card-actions">
                                ${item.attachmentUrl ? `<a href="${item.attachmentUrl}" class="btn btn-sm btn-ghost download-btn" download onclick="event.stopPropagation()"><i class="ri-download-2-line"></i> Doc</a>` : ''}
                                <button class="btn btn-sm btn-primary open-card-btn" data-id="${item._id || item.id}"><i class="ri-book-open-line"></i> Lire</button>
                            </div>
                        </div>
                    </div>
                </article>
                `;
            }).join('');

            // Atomic update: avoid flashing "Chargement..." if we already have data
            grid.innerHTML = html;

            // Restore scroll position after gallery render
            const savedScroll = sessionStorage.getItem('gallery_scroll');
            if (savedScroll) {
                window.scrollTo(0, parseInt(savedScroll));
                sessionStorage.removeItem('gallery_scroll');
            }

            grid.querySelectorAll('.open-card-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    try {
                        const item = await DB_Service.getById(btn.dataset.id);
                        if (item) openModal(item);
                    } catch (e) { showToast('Erreur de chargement.', 'error'); }
                });
            });
            initReveal();
        } catch (err) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:4rem;color:#fca5a5;">
                <i class="ri-error-warning-line" style="font-size:3rem;"></i>
                <p style="margin-top:1rem;">Impossible de charger le contenu.<br><small>${err.message}</small></p>
            </div>`;
        }
    }

    // ── Featured Strip ───────────────────────────────────────────────────────
    async function renderFeatured() {
        const strip = document.getElementById('featured-strip');
        if (!strip) return;
        try {
            const featured = (await DB_Service.getFeatured()).slice(0, 5);
            if (featured.length === 0) {
                strip.closest('.featured-section')?.remove();
                return;
            }
            strip.innerHTML = featured.map(item => `
                <div class="feat-card" data-id="${item._id || item.id}" role="button" tabindex="0" aria-label="${item.title}">
                    <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" onerror="this.style.display='none'">
                    <div class="feat-card-overlay">
                        <span class="feat-card-type"><i class="ri-${getTypeIcon(item.type)}"></i></span>
                        <div class="feat-card-info">
                            <span class="feat-card-cat">${item.category}</span>
                            <h3>${item.title}</h3>
                        </div>
                    </div>
                </div>
            `).join('');
            strip.querySelectorAll('.feat-card').forEach(el => {
                el.addEventListener('click', async () => {
                    try {
                        const item = await DB_Service.getById(el.dataset.id);
                        if (item) openModal(item);
                    } catch { }
                });
            });
        } catch { strip.closest('.featured-section')?.remove(); }
    }

    // ── Player Modal ─────────────────────────────────────────────────────────
    const playerModal = document.getElementById('player-modal');
    const playerContainer = document.getElementById('player-container');
    const closeModalBtn = document.getElementById('close-modal');

    closeModalBtn?.addEventListener('click', closePlayerModal);
    playerModal?.addEventListener('click', (e) => { if (e.target === playerModal) closePlayerModal(); });

    function openModal(item) {
        playerContainer.innerHTML = renderPlayer(item);
        playerModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closePlayerModal() {
        playerModal.classList.remove('active');
        playerContainer.innerHTML = '';
        document.body.style.overflow = '';
    }

    function renderPlayer(item) {
        const id = item._id || item.id;
        const meta = item.metadata || {};
        const isCorporate = item.type === 'corporate';

        const headerInfo = `
            <div class="player-header">
                <div class="card-header-row">
                    <span class="card-cat">${item.category}</span>
                    ${meta.deadline ? `<span class="deadline-badge modal-badge"><i class="ri-calendar-event-line"></i> Échéance : ${new Date(meta.deadline).toLocaleDateString()}</span>` : ''}
                </div>
                <h2>${item.title}</h2>
                ${meta.jobTitle ? `<div class="job-pill modal-job">Poste : ${meta.jobTitle}</div>` : ''}
                ${meta.location ? `<div class="loc-info"><i class="ri-map-pin-line"></i> ${meta.location}</div>` : ''}
                <p class="modal-desc">${item.description || ''}</p>
                ${item.attachmentUrl ? `
                    <div class="attachment-area">
                        <a href="${item.attachmentUrl}" class="btn btn-primary" download>
                            <i class="ri-download-2-line"></i> Télécharger le document source
                        </a>
                    </div>
                ` : ''}
            </div>
        `;

        const fallbackScript = item.backupUrl ? `onerror=\"this.onerror=null; this.src='${item.backupUrl}'; console.log('Resilience Fallback used for ${item.title}');\"` : '';

        switch (item.type) {
            case 'video': case 'animation': case 'vr':
                return `${headerInfo}<div class="video-wrap"><video controls autoplay playsinline class="custom-video"><source src="${item.url}" type="video/mp4" onerror="const v=this.parentElement; if('${item.backupUrl}'){v.src='${item.backupUrl}'; v.load();}">Navigateur non compatible.</video></div>`;
            case 'music': case 'podcast':
                return `${headerInfo}<div class="audio-player-wrap"><div class="audio-art glass"><i class="ri-music-2-fill audio-big-icon"></i></div><audio controls autoplay class="custom-audio"><source src="${item.url}" type="audio/mpeg" onerror="const a=this.parentElement; if('${item.backupUrl}'){a.src='${item.backupUrl}'; a.load();}">Navigateur non compatible.</audio></div>`;
            case 'image':
                return `${headerInfo}<div class="image-wrap"><img src="${item.url || item.thumbnail}" alt="${item.title}" class="full-image" loading="lazy" ${fallbackScript} onerror="this.src='${item.thumbnail}'"></div>`;
            case 'article': case 'corporate': case 'interactive':
                return `${headerInfo}<div class="article-wrap"><div class="article-body">${(item.content || 'Contenu non disponible.').split('\n').map(p => `<p>${p}</p>`).join('')}</div></div>`;
            case 'document':
                return `${headerInfo}<div class="doc-wrap"><iframe src="${item.url}" title="${item.title}" frameborder="0" class="doc-frame" ${item.backupUrl ? `onerror="this.src='${item.backupUrl}'"` : ''}></iframe></div>`;
            default:
                return `${headerInfo}<div class="generic-wrap glass"><i class="ri-file-line" style="font-size:4rem;color:var(--primary)"></i><a href="${item.url}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:1.5rem;">Ouvrir le fichier <i class="ri-external-link-line"></i></a></div>`;
        }
    }

    // ── Reveal Animations ────────────────────────────────────────────────────
    function initReveal() {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('active'); io.unobserve(e.target); } });
        }, { threshold: 0.08 });
        document.querySelectorAll('.reveal:not(.active)').forEach(el => io.observe(el));
    }
    initReveal();

    // ── Helpers ──────────────────────────────────────────────────────────────
    function getTypeIcon(type) {
        return { video: 'video-fill', music: 'music-2-fill', image: 'image-fill', animation: 'magic-fill', article: 'article-fill', podcast: 'mic-fill', interactive: 'gamepad-fill', vr: 'glasses-fill', document: 'file-pdf-fill', corporate: 'briefcase-fill' }[type] || 'play-fill';
    }
    function getTypeLabel(type) {
        const t = DB_Service.MEDIA_TYPES.find(m => m.value === type);
        return t ? t.label : type;
    }

    function showToast(msg, type = 'info') {
        const tc = document.getElementById('toast-container');
        if (!tc) return;
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<i class="ri-notification-3-line"></i> ${msg}`;
        tc.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3000);
    }
    window.toast = showToast;

    // ── Navigation Logic (Smooth Scroll & Menu Sync) ────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href').substring(1);
            if (!targetId) return;

            e.preventDefault();
            const targetElement = document.getElementById(targetId) || (targetId === 'categories' ? document.getElementById('filter-bar') : null);

            if (targetElement) {
                const headerOffset = 90;
                const elementPosition = targetElement.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });

                // Special highlight for categories
                if (targetId === 'categories' || targetId === 'filter-bar') {
                    const bar = document.getElementById('filter-bar');
                    if (bar) {
                        bar.style.transform = 'scale(1.05)';
                        bar.style.transition = 'transform 0.3s ease';
                        setTimeout(() => bar.style.transform = '', 600);
                    }
                }
            }

            // Close mobile menu if open
            if (typeof closeMobile === 'function') closeMobile();
        });
    });

    // ── Init ─────────────────────────────────────────────────────────────────
    await Promise.all([renderGallery(), renderFeatured()]);
});
