/**
 * Admin Application — Production Ready
 * All operations call the real MongoDB API
 */

document.addEventListener('DOMContentLoaded', async () => {

    // ── Auth ──────────────────────────────────────────────────────────────────
    const loginScreen = document.getElementById('login-screen');
    const adminApp = document.getElementById('admin-app');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const togglePw = document.getElementById('toggle-pw');
    const pwInput = document.getElementById('login-password');

    // Check existing session
    const existing = await DB_Service.checkSession();
    if (existing) {
        showApp();
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const pwd = pwInput.value;
        const btn = loginForm.querySelector('[type=submit]');
        btn.disabled = true;
        btn.textContent = 'Connexion…';
        loginError.classList.add('hidden');

        try {
            await DB_Service.login(email, pwd);
            showApp();
        } catch (err) {
            loginError.textContent = err.message || 'Email ou mot de passe incorrect.';
            loginError.classList.remove('hidden');
            loginScreen.querySelector('.login-card').classList.add('shake');
            setTimeout(() => loginScreen.querySelector('.login-card').classList.remove('shake'), 600);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Se connecter';
        }
    });

    document.getElementById('admin-logout').addEventListener('click', () => {
        DB_Service.logout();
        adminApp.classList.add('hidden');
        loginScreen.classList.remove('hidden');
    });

    togglePw.addEventListener('click', () => {
        const show = pwInput.type === 'password';
        pwInput.type = show ? 'text' : 'password';
        togglePw.innerHTML = show ? '<i class="ri-eye-line"></i>' : '<i class="ri-eye-off-line"></i>';
    });

    function showApp() {
        loginScreen.classList.add('hidden');
        adminApp.classList.remove('hidden');
        renderDashboard();
    }

    // ── Navigation ────────────────────────────────────────────────────────────
    const sidebarBtns = document.querySelectorAll('.sidebar-btn[data-view]');
    const views = document.querySelectorAll('.admin-view');
    const viewTitle = document.getElementById('view-title');
    const TITLES = { dashboard: 'Dashboard', publish: 'Publier du Contenu', catalog: 'Catalogue Média' };

    sidebarBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            sidebarBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const v = btn.dataset.view;
            const type = btn.dataset.type;

            viewTitle.textContent = TITLES[v] || 'Admin';
            views.forEach(el => el.classList.add('hidden'));
            document.getElementById(`view-${v}`).classList.remove('hidden');

            if (v === 'dashboard') renderDashboard();
            if (v === 'catalog') renderCatalog();
            if (v === 'publish') {
                if (type) {
                    resetStudioForm();
                    openStudio(type);
                } else {
                    resetStudioForm();
                }
            }
        });
    });

    // ── Dashboard ─────────────────────────────────────────────────────────────
    const typeIcons = { video: 'ri-video-line', music: 'ri-music-2-line', image: 'ri-image-line', article: 'ri-article-line', animation: 'ri-magic-line', podcast: 'ri-mic-line', interactive: 'ri-gamepad-line', vr: 'ri-glasses-line', document: 'ri-file-pdf-line' };

    async function renderDashboard() {
        const statGrid = document.getElementById('stats-grid');
        statGrid.innerHTML = '<div class="stat-card glass" style="opacity:.5">Chargement…</div>';

        try {
            const stats = await DB_Service.getStats();
            statGrid.innerHTML = `
                <div class="stat-card glass"><i class="ri-layout-grid-line stat-icon"></i><div class="stat-value">${stats.total}</div><div class="stat-label">Total Médias</div></div>
                <div class="stat-card glass"><i class="ri-star-line stat-icon gold"></i><div class="stat-value">${stats.featured}</div><div class="stat-label">En Vedette</div></div>
                ${Object.entries(stats.byType).map(([t, c]) => `
                <div class="stat-card glass"><i class="${typeIcons[t] || 'ri-file-line'} stat-icon"></i><div class="stat-value">${c}</div><div class="stat-label">${DB_Service.MEDIA_TYPES.find(m => m.value === t)?.label || t}</div></div>
                `).join('')}
            `;

            const previewGrid = document.getElementById('preview-grid');
            const items = await DB_Service.getAll();
            previewGrid.innerHTML = items.slice(0, 6).map(item => `
                <div class="preview-item glass">
                    <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" onerror="this.style.display='none'">
                    <div class="preview-meta"><span class="preview-type">${item.type}</span><span class="preview-title">${item.title}</span></div>
                </div>
            `).join('') || '<p style="opacity:.5;padding:2rem;">Aucun contenu publié.</p>';
        } catch (err) {
            statGrid.innerHTML = `<div class="stat-card glass" style="color:#fca5a5">Erreur: ${err.message}</div>`;
        }
    }

    // ── Publish Form (Studios V4) ─────────────────────────────────────────────
    const studioSelector = document.querySelector('.studio-selector');
    const studioFormContainer = document.getElementById('studio-form-container');
    const backToSelector = document.getElementById('back-to-selector');
    const studioTitle = document.getElementById('studio-title');
    const publishForm = document.getElementById('publish-form');
    const mediaTypeInput = document.getElementById('media-type');
    const contentField = document.getElementById('content-field');
    const mediaFileGroup = document.getElementById('media-file-group');
    const mediaFileInput = document.getElementById('media-file-input');
    const thumbFileInput = document.getElementById('thumb-file-input');
    const thumbPreview = document.getElementById('thumb-preview');
    const mediaFileInfo = document.getElementById('media-file-info');
    const formFeedback = document.getElementById('form-feedback');

    // Animation Generator Specifics
    const animGeneratorGroup = document.getElementById('animation-generator-group');
    const animCanvas = document.getElementById('anim-canvas');
    const animCtx = animCanvas ? animCanvas.getContext('2d') : null;
    const animPresetSelect = document.getElementById('anim-preset-select');
    const btnGenerateAnim = document.getElementById('btn-generate-anim');
    const animCaptureStatus = document.getElementById('anim-capture-status');
    let generatedAnimationFile = null;
    let animRequestID = null;

    // --- Animation Drawing Logic ---
    function startAnimationPreview() {
        if (!animCanvas) return;
        stopAnimationPreview();
        const type = animPresetSelect.value;
        if (type === 'particles') drawParticles();
        else if (type === 'matrix') drawMatrix();
        else if (type === 'talking') drawTalking();
        else if (type === 'wave') drawWave();
    }

    function stopAnimationPreview() {
        if (animRequestID) cancelAnimationFrame(animRequestID);
    }

    if (animPresetSelect) {
        animPresetSelect.addEventListener('change', startAnimationPreview);
    }

    // Preset 1: Particles
    let particles = [];
    function drawParticles() {
        if (particles.length === 0) {
            for (let i = 0; i < 50; i++) particles.push({ x: Math.random() * 400, y: Math.random() * 300, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2 });
        }
        animCtx.fillStyle = '#0f172a'; animCtx.fillRect(0, 0, 400, 300);
        animCtx.fillStyle = '#8b5cf6';
        particles.forEach(p => {
            p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > 400) p.vx *= -1;
            if (p.y < 0 || p.y > 300) p.vy *= -1;
            animCtx.beginPath(); animCtx.arc(p.x, p.y, 3, 0, Math.PI * 2); animCtx.fill();
        });
        animRequestID = requestAnimationFrame(drawParticles);
    }

    // Preset 2: Matrix
    let columns = Array(Math.floor(400 / 15)).fill(0);
    function drawMatrix() {
        animCtx.fillStyle = 'rgba(0, 0, 0, 0.1)'; animCtx.fillRect(0, 0, 400, 300);
        animCtx.fillStyle = '#10b981'; animCtx.font = '15px monospace';
        columns.forEach((y, i) => {
            const char = String.fromCharCode(0x30A0 + Math.random() * 96);
            animCtx.fillText(char, i * 15, y);
            if (y > 300 + Math.random() * 10000) columns[i] = 0;
            else columns[i] = y + 15;
        });
        animRequestID = requestAnimationFrame(drawMatrix);
    }

    // Preset 3: Talking Character
    let mouthOpen = 0; let mouthDir = 1;
    function drawTalking() {
        animCtx.fillStyle = '#1e293b'; animCtx.fillRect(0, 0, 400, 300);
        animCtx.fillStyle = '#fed7aa'; animCtx.beginPath(); animCtx.arc(200, 150, 60, 0, Math.PI * 2); animCtx.fill(); // Head
        animCtx.fillStyle = '#000'; animCtx.beginPath(); animCtx.arc(175, 130, 8, 0, Math.PI * 2); animCtx.fill(); // Left Eye
        animCtx.beginPath(); animCtx.arc(225, 130, 8, 0, Math.PI * 2); animCtx.fill(); // Right Eye
        // Mouth
        mouthOpen += 2 * mouthDir; if (mouthOpen > 20 || mouthOpen < 0) mouthDir *= -1;
        animCtx.fillStyle = '#991b1b'; animCtx.beginPath(); animCtx.ellipse(200, 175, 15, 5 + mouthOpen / 2, 0, 0, Math.PI * 2); animCtx.fill();
        animCtx.fillStyle = '#fff'; animCtx.font = '20px sans-serif'; animCtx.fillText("Bonjour StreamVibe !", 110, 250);
        animRequestID = requestAnimationFrame(drawTalking);
    }

    // Preset 4: Wave
    let waveOffset = 0;
    function drawWave() {
        animCtx.fillStyle = '#020617'; animCtx.fillRect(0, 0, 400, 300);
        animCtx.strokeStyle = '#3b82f6'; animCtx.lineWidth = 3; animCtx.beginPath();
        for (let i = 0; i < 400; i += 5) {
            let y = 150 + Math.sin(i * 0.05 + waveOffset) * 50 * Math.sin(waveOffset * 0.5);
            if (i === 0) animCtx.moveTo(i, y); else animCtx.lineTo(i, y);
        }
        animCtx.stroke();
        waveOffset += 0.1;
        animRequestID = requestAnimationFrame(drawWave);
    }

    // --- MediaRecorder Capture Logic ---
    if (btnGenerateAnim) {
        btnGenerateAnim.addEventListener('click', () => {
            if (!animCanvas) return;

            btnGenerateAnim.disabled = true;
            btnGenerateAnim.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Enregistrement (3s)...';
            animCaptureStatus.classList.remove('hidden');
            animCaptureStatus.textContent = "Capture en cours, veuillez patienter...";

            const stream = animCanvas.captureStream(30); // 30 FPS
            const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
            const chunks = [];

            mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                generatedAnimationFile = new File([blob], `anim_gen_${Date.now()}.webm`, { type: 'video/webm' });

                btnGenerateAnim.innerHTML = '<i class="ri-check-line"></i> Capturé avec succès !';
                btnGenerateAnim.style.background = '#10b981';
                animCaptureStatus.textContent = `Fichier généré : ${(blob.size / 1024).toFixed(1)} KB. Prêt à publier.`;

                // Show thumbnail preview from the current canvas state
                if (thumbPreview && thumbFileInput && !thumbFileInput.files[0]) {
                    thumbPreview.src = animCanvas.toDataURL('image/jpeg');
                    thumbPreview.classList.remove('hidden');

                    // Convert dataURL to File for the thumbnail
                    fetch(thumbPreview.src)
                        .then(res => res.blob())
                        .then(blob => {
                            const file = new File([blob], "anim_thumb.jpg", { type: "image/jpeg" });
                            const dataTransfer = new DataTransfer();
                            dataTransfer.items.add(file);
                            document.getElementById('thumb-file-input').files = dataTransfer.files;
                        });
                }

                setTimeout(() => { btnGenerateAnim.disabled = false; btnGenerateAnim.style.background = '#8b5cf6'; btnGenerateAnim.innerHTML = '<i class="ri-record-circle-line"></i> Refaire une capture'; }, 3000);
            };

            mediaRecorder.start();
            setTimeout(() => { mediaRecorder.stop(); }, 3000); // 3 seconds recording
        });
    }

    const STUDIO_CONFIG = {
        video: { title: 'Studio Vidéo', icon: 'ri-video-add-line', label: 'Vidéo' },
        music: { title: 'Studio Musique', icon: 'ri-music-2-line', label: 'Musique' },
        article: { title: 'Studio Rédaction', icon: 'ri-article-line', label: 'Article' },
        image: { title: 'Studio Visuel', icon: 'ri-image-line', label: 'Image' },
        animation: { title: 'Studio Animation', icon: 'ri-movie-line', label: 'Animation' },
        vr: { title: 'Studio VR & 360°', icon: 'ri-radar-line', label: 'VR' },
        podcast: { title: 'Studio Podcast', icon: 'ri-mic-line', label: 'Podcast' },
        corporate: { title: 'Studio Corporate', icon: 'ri-briefcase-line', label: 'Corporate' }
    };

    const attachmentFileInput = document.getElementById('attachment-file-input');
    const attachmentDropzone = document.getElementById('attachment-dropzone');
    const attachmentFileInfo = document.getElementById('attachment-file-info');

    document.querySelectorAll('.studio-card').forEach(card => {
        card.addEventListener('click', () => openStudio(card.dataset.studio));
    });

    backToSelector.addEventListener('click', () => {
        studioFormContainer.classList.add('hidden');
        studioSelector.classList.remove('hidden');
    });

    function openStudio(type) {
        studioSelector.classList.add('hidden');
        studioFormContainer.classList.remove('hidden');
        mediaTypeInput.value = type;
        const config = STUDIO_CONFIG[type] || { title: 'Studio Média' };
        studioTitle.innerHTML = `<i class="${config.icon}"></i> ${config.title}`;

        const grid = document.querySelector('.form-grid-layout');
        const contentGroup = document.getElementById('content-field-group');
        const labelTitle = document.getElementById('label-title');
        const labelDesc = document.getElementById('label-desc');
        const titleInput = document.getElementById('media-title');
        const descInput = document.getElementById('media-description');

        // Specialized Labels & Placeholders
        if (type === 'article' || type === 'corporate') {
            labelTitle.textContent = "Titre du Document / Article *";
            titleInput.placeholder = type === 'corporate' ? "Ex: Offre d'Emploi - Développeur" : "Ex: Les enjeux de l'IA en 2025";
            labelDesc.textContent = "Résumé (Introduction)";
            descInput.placeholder = "Breve introduction qui apparaîtra dans le catalogue...";
            grid.classList.add('text-centric');
            contentGroup.classList.remove('hidden');
        } else {
            labelTitle.textContent = "Titre du Médias *";
            titleInput.placeholder = type === 'music' ? "Ex: Moonlight Sonata" : "Ex: Demo Reel 2024";
            labelDesc.textContent = "Description Courte";
            descInput.placeholder = "Présentez votre œuvre...";
            grid.classList.remove('text-centric');
            contentGroup.classList.add('hidden');
        }

        // Specific Visibility
        // Handle Animation Generator visibility
        if (type === 'animation') {
            animGeneratorGroup.classList.remove('hidden');
            mediaFileGroup.classList.add('hidden'); // Initially hide file input
            startAnimationPreview();
        } else {
            if (animGeneratorGroup) animGeneratorGroup.classList.add('hidden');
            mediaFileGroup.classList.remove('hidden');
            stopAnimationPreview();
        }

        if (type === 'article' || type === 'corporate') {
            mediaFileGroup.classList.add('hidden');
        }

        // Validate attachment file specific visibility
        if (attachmentDropzone) {
            attachmentDropzone.classList.toggle('hidden', type !== 'article' && type !== 'corporate');
        }

        // Update Media File Label
        const mediaLabel = document.querySelector('#media-file-group label');
        if (mediaLabel) {
            mediaLabel.textContent = type === 'music' ? 'Fichier Audio *' :
                type === 'image' ? 'Fichier Image *' :
                    'Fichier Vidéo (ou Anim) *';
        }
    }

    // Dropzone logic
    document.querySelectorAll('.upload-dropzone').forEach(zone => {
        const input = zone.querySelector('input[type=file]');
        zone.addEventListener('click', () => input.click());
        // ... drag events are already handled by and forEach ...
    });

    function handleFileSelect(input) {
        const file = input.files[0];
        if (!file) return;

        if (input.id === 'thumb-file-input') {
            const reader = new FileReader();
            reader.onload = (e) => {
                thumbPreview.src = e.target.result;
                thumbPreview.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        } else if (input.id === 'attachment-file-input') {
            attachmentFileInfo.textContent = `📎 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            attachmentFileInfo.classList.remove('hidden');
        } else {
            mediaFileInfo.textContent = `📎 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
            mediaFileInfo.classList.remove('hidden');
        }
    }

    publishForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-id').value;
        const type = mediaTypeInput.value;

        const formData = new FormData();
        formData.append('type', type);
        formData.append('title', document.getElementById('media-title').value.trim());
        formData.append('category', document.getElementById('media-category').value.trim());
        formData.append('description', document.getElementById('media-description').value.trim());
        formData.append('author', document.getElementById('media-author').value.trim() || 'Admin');
        formData.append('featured', document.getElementById('media-featured').checked);
        formData.append('backupUrl', document.getElementById('media-backup-url').value);

        if (type === 'article' || type === 'corporate') {
            formData.append('content', document.getElementById('content-field').value.trim());
        }

        // Determine which file to use for Media
        let finalMediaFile = mediaFileInput.files[0];
        if (type === 'animation' && generatedAnimationFile) {
            finalMediaFile = generatedAnimationFile;
        }

        const thumbFile = thumbFileInput.files[0];
        const attachmentFile = attachmentFileInput.files[0];

        if (!id && type !== 'article' && type !== 'corporate' && !finalMediaFile) {
            showFeedback('Veuillez générer ou sélectionner un fichier média.', 'error'); return;
        }
        if (!id && !thumbFile) {
            showFeedback('Veuillez sélectionner une miniature.', 'error'); return;
        }

        if (finalMediaFile) formData.append('media', finalMediaFile);
        if (thumbFile) formData.append('thumbnail', thumbFile);
        if (attachmentFile) formData.append('attachment', attachmentFile);

        // Gather Metadata for Corporate
        if (type === 'corporate') {
            const metadata = {
                jobTitle: document.getElementById('meta-job-title').value,
                deadline: document.getElementById('meta-deadline').value,
                location: document.getElementById('meta-location').value
            };
            formData.append('metadata', JSON.stringify(metadata));
        }

        const progressContainer = document.getElementById('upload-progress-container');
        const progressFill = document.getElementById('progress-fill');
        const progressPercent = document.getElementById('progress-percent');

        const btn = document.getElementById('submit-btn');
        const originalBtnHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="ri-loader-4-line"></i> Téléchargement...';

        try {
            const token = DB_Service.getToken();
            const url = id ? `${DB_Service.API_BASE}/media/${id}` : `${DB_Service.API_BASE}/media`;
            const method = id ? 'PUT' : 'POST';

            progressContainer.classList.remove('hidden');

            await new Promise((resolve, reject) => {
                const xhr = new XMLHttpRequest();
                xhr.open(method, url);
                if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

                xhr.upload.onprogress = (e) => {
                    if (e.lengthComputable) {
                        const percent = Math.round((e.loaded / e.total) * 100);
                        progressFill.style.width = percent + '%';
                        progressPercent.textContent = percent + '%';
                    }
                };

                xhr.onload = () => {
                    const res = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) resolve(res);
                    else reject(new Error(res.message || 'Erreur lors de l\'envoi'));
                };

                xhr.onerror = () => reject(new Error('Erreur réseau.'));
                xhr.send(formData);
            });

            toast(id ? 'Mise à jour réussie !' : 'Publication réussie !', 'success');
            setTimeout(() => {
                resetStudioForm();
                backToSelector.click();
                renderDashboard();
                renderCatalog();
            }, 1000);
        } catch (err) {
            showFeedback(`❌ Erreur: ${err.message}`, 'error');
            toast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalBtnHtml;
            setTimeout(() => progressContainer.classList.add('hidden'), 2000);
        }
    });

    function resetStudioForm() {
        document.getElementById('edit-id').value = '';
        publishForm.reset();
        document.getElementById('content-field').value = '';
        document.getElementById('content-field-group').classList.add('hidden');
        document.querySelector('.form-grid-layout').classList.remove('text-centric');
        thumbPreview.classList.add('hidden');
        mediaFileInfo.classList.add('hidden');
        attachmentFileInfo.classList.add('hidden');
        formFeedback.classList.add('hidden');
        document.getElementById('progress-fill').style.width = '0%';
        document.getElementById('progress-percent').textContent = '0%';

        generatedAnimationFile = null;
        if (animCaptureStatus) animCaptureStatus.classList.add('hidden');
        if (btnGenerateAnim) btnGenerateAnim.innerHTML = '<i class="ri-record-circle-line"></i> Générer & Capturer (3s)';
        stopAnimationPreview();
    }

    function showFeedback(msg, type) {
        formFeedback.textContent = msg;
        formFeedback.className = `form-feedback ${type}`;
        formFeedback.classList.remove('hidden');
    }

    // ── Catalog ───────────────────────────────────────────────────────────────
    const catalogBody = document.getElementById('catalog-body');
    const catalogSearch = document.getElementById('catalog-search');
    const catalogFilter = document.getElementById('catalog-filter');

    DB_Service.MEDIA_TYPES.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.value;
        opt.textContent = t.label;
        catalogFilter.appendChild(opt);
    });

    let searchDebounce;
    catalogSearch.addEventListener('input', () => { clearTimeout(searchDebounce); searchDebounce = setTimeout(renderCatalog, 300); });
    catalogFilter.addEventListener('change', renderCatalog);

    async function renderCatalog() {
        catalogBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:2rem;opacity:.5;">Chargement…</td></tr>';
        try {
            const q = catalogSearch.value.trim();
            const type = catalogFilter.value;
            let data = q ? await DB_Service.search(q) : await DB_Service.getAll();
            if (type !== 'all') data = data.filter(m => m.type === type);

            if (data.length === 0) {
                catalogBody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:3rem;opacity:.5;">Aucun contenu trouvé.</td></tr>';
                return;
            }

            catalogBody.innerHTML = data.map(item => {
                const date = new Date(item.createdAt || item.publishedAt);
                const dateStr = isNaN(date.getTime()) ? '–' : date.toLocaleDateString('fr-FR');

                return `
                <tr>
                    <td><img src="${item.thumbnail}" alt="${item.title}" class="catalog-thumb" onerror="this.style.background='#1e293b';this.src='assets/img/placeholder.png';this.onerror=null;"></td>
                    <td class="catalog-title-cell">
                        <div class="title-wrap" title="${item.title}">${item.title}</div>
                    </td>
                    <td><span class="type-badge type-${item.type}">${item.type}</span></td>
                    <td><span style="opacity:.8">${item.category}</span></td>
                    <td style="text-align:center;">
                        <button class="star-btn ${item.featured ? 'starred' : ''}" data-id="${item._id || item.id}">
                            <i class="${item.featured ? 'ri-star-fill' : 'ri-star-line'}"></i>
                        </button>
                    </td>
                    <td style="white-space:nowrap;opacity:.6;font-size:.8rem;">${dateStr}</td>
                    <td>
                        <div class="action-btns">
                            <button class="action-btn edit-btn" data-id="${item._id || item.id}" title="Modifier"><i class="ri-edit-line"></i></button>
                            <button class="action-btn del-btn" data-id="${item._id || item.id}" data-title="${item.title}" title="Supprimer"><i class="ri-delete-bin-line"></i></button>
                        </div>
                    </td>
                </tr>`;
            }).join('');

            catalogBody.querySelectorAll('.star-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    try { await DB_Service.toggleFeatured(btn.dataset.id); renderCatalog(); toast('Statut vedette mis à jour.', 'info'); }
                    catch (e) { toast(e.message, 'error'); }
                });
            });
            catalogBody.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => startEdit(btn.dataset.id)));
            catalogBody.querySelectorAll('.del-btn').forEach(btn => btn.addEventListener('click', () => confirmDelete(btn.dataset.id, btn.dataset.title)));

        } catch (err) {
            catalogBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;color:#fca5a5;">Erreur: ${err.message}</td></tr>`;
        }
    }

    async function startEdit(id) {
        try {
            const item = await DB_Service.getById(id);
            if (!item) { toast('Contenu introuvable.', 'error'); return; }

            sidebarBtns.forEach(b => b.classList.remove('active'));
            document.querySelector('[data-view="publish"]').classList.add('active');
            views.forEach(v => v.classList.add('hidden'));
            document.getElementById('view-publish').classList.remove('hidden');

            openStudio(item.type);
            viewTitle.textContent = 'Modifier le Contenu';

            document.getElementById('edit-id').value = item._id || item.id;
            document.getElementById('media-title').value = item.title;
            document.getElementById('media-category').value = item.category;
            document.getElementById('media-description').value = item.description || '';
            document.getElementById('content-field').value = item.content || '';
            document.getElementById('media-author').value = item.author || 'Admin';
            document.getElementById('media-featured').checked = item.featured;
            document.getElementById('media-backup-url').value = item.backupUrl || '';

            document.getElementById('submit-btn').innerHTML = '<i class="ri-save-line"></i> Sauvegarder';

            if (item.thumbnail) {
                thumbPreview.src = item.thumbnail;
                thumbPreview.classList.remove('hidden');
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } catch (e) { toast(e.message, 'error'); }
    }

    // ── Delete Confirmation ───────────────────────────────────────────────────
    const confirmModal = document.getElementById('confirm-modal');
    const confirmOk = document.getElementById('confirm-ok');
    const confirmCancel = document.getElementById('confirm-cancel');
    const confirmMsg = document.getElementById('confirm-msg');
    let pendingDeleteId = null;

    function confirmDelete(id, title) {
        pendingDeleteId = id;
        confirmMsg.textContent = `"${title}" sera supprimé définitivement de la base de données.`;
        confirmModal.classList.remove('hidden'); confirmModal.classList.add('active');
    }

    confirmOk.addEventListener('click', async () => {
        if (!pendingDeleteId) return;
        confirmOk.disabled = true;
        try {
            await DB_Service.delete(pendingDeleteId);
            toast('Contenu supprimé.', 'error');
            renderCatalog();
            renderDashboard();
        } catch (e) { toast(e.message, 'error'); }
        finally { confirmOk.disabled = false; pendingDeleteId = null; }
        confirmModal.classList.remove('active'); confirmModal.classList.add('hidden');
    });
    confirmCancel.addEventListener('click', () => {
        confirmModal.classList.remove('active'); confirmModal.classList.add('hidden'); pendingDeleteId = null;
    });

    // ── Toast ─────────────────────────────────────────────────────────────────
    function toast(msg, type = 'info') {
        const tc = document.getElementById('toast-container');
        const t = document.createElement('div');
        t.className = `toast toast-${type}`;
        t.innerHTML = `<i class="ri-notification-3-line"></i> ${msg}`;
        tc.appendChild(t);
        requestAnimationFrame(() => t.classList.add('show'));
        setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 3500);
    }
});
