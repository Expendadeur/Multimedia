/**
 * DB_Service — Production API Client (Offline-First)
 * ================================================
 * All data comes from the real Node/Express/MongoDB backend API.
 * Handles offline caching and sync queue via IndexedDB.
 */

const DB_Service = (() => {

    // ── Configuration ─────────────────────────────────────────────────────────
    const API_BASE = 'https://multimedia-mqle.onrender.com/api';

    const MEDIA_TYPES = [
        { value: 'video', label: '🎬 Vidéo', acceptStr: 'video/*' },
        { value: 'music', label: '🎵 Musique', acceptStr: 'audio/*' },
        { value: 'image', label: '🖼️ Image', acceptStr: 'image/*' },
        { value: 'animation', label: '✨ Animation', acceptStr: '.gif,.webp,video/*' },
        { value: 'article', label: '📄 Article', acceptStr: null },
        { value: 'podcast', label: '🎙️ Podcast', acceptStr: 'audio/*' },
        { value: 'interactive', label: '🕹️ Interactif', acceptStr: null },
        { value: 'vr', label: '🥽 VR / 360°', acceptStr: 'video/*,image/*' },
        { value: 'document', label: '📁 Document', acceptStr: '.pdf,.ppt,.pptx' },
        { value: 'corporate', label: '💼 Corporate', acceptStr: null },
    ];

    // ── Token management ──────────────────────────────────────────────────────
    function getToken() { return sessionStorage.getItem('sv_token') || null; }
    function saveToken(token) { sessionStorage.setItem('sv_token', token); }
    function clearToken() { sessionStorage.removeItem('sv_token'); sessionStorage.removeItem('sv_admin'); }

    // ── Core fetch wrapper ────────────────────────────────────────────────────
    async function apiFetch(endpoint, options = {}) {
        const token = getToken();
        // Pour FormData, on ne doit PAS mettre de Content-Type manuel (le navigateur le fait avec le boundary)
        const isFormData = options.body instanceof FormData;

        const headers = { ...(options.headers || {}) };
        if (!isFormData) headers['Content-Type'] = 'application/json';
        if (token) headers['Authorization'] = `Bearer ${token}`;

        try {
            const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || `Erreur ${res.status}`);
            return data;
        } catch (err) {
            throw err;
        }
    }

    const isConnected = () => navigator.onLine;

    // ── Public API ────────────────────────────────────────────────────────────
    return {
        API_BASE, MEDIA_TYPES, getToken, saveToken, clearToken,

        async ping() {
            try { await fetch(`${API_BASE}/health`); return true; } catch { return false; }
        },

        /** GET all media — handles offline cache */
        async getAll(type = null) {
            if (isConnected()) {
                try {
                    const params = new URLSearchParams();
                    if (type) params.append('type', type);
                    const res = await apiFetch(`/media?${params}`);
                    const items = res.data || [];
                    // Cache the results locally
                    if (!type) await OfflineDB.saveCatalog(items);
                    return items;
                } catch (err) {
                    console.error('API Error, falling back to cache:', err);
                }
            }
            // Offline or API failure: use cache
            let cached = await OfflineDB.getCatalog();
            if (type) cached = cached.filter(i => i.type === type);
            return cached;
        },

        async getById(id) {
            if (isConnected()) {
                try {
                    const res = await apiFetch(`/media/${id}`);
                    return res.data;
                } catch { }
            }
            const cached = await OfflineDB.getCatalog();
            return cached.find(i => (i._id === id || i.id === id)) || null;
        },

        async getFeatured() {
            if (isConnected()) {
                try {
                    const res = await apiFetch('/media?featured=true');
                    return res.data || [];
                } catch { }
            }
            const cached = await OfflineDB.getCatalog();
            return cached.filter(i => i.featured);
        },

        async search(query) {
            if (isConnected()) {
                try {
                    const params = new URLSearchParams({ search: query });
                    const res = await apiFetch(`/media?${params}`);
                    return res.data || [];
                } catch { }
            }
            const q = query.toLowerCase();
            const cached = await OfflineDB.getCatalog();
            return cached.filter(i =>
                i.title.toLowerCase().includes(q) ||
                (i.description && i.description.toLowerCase().includes(q))
            );
        },

        /** CREATE — handles sync queue */
        async create(payload, skipQueue = false) {
            if (isConnected() || skipQueue) {
                try {
                    const res = await apiFetch('/media', { method: 'POST', body: payload });
                    const newItem = res.data;
                    await OfflineDB.updateItem(newItem);
                    return newItem;
                } catch (err) {
                    if (skipQueue) throw err;
                }
            }
            // Offline: Handle FormData decomposition for IndexedDB
            let serializablePayload = payload;
            if (payload instanceof FormData) {
                serializablePayload = { _isFormData: true };
                for (let [key, value] of payload.entries()) {
                    serializablePayload[key] = value;
                }
            }

            const tempId = 'temp_' + Date.now();
            const optimisticItem = {
                ...(serializablePayload._isFormData ? serializablePayload : payload),
                _id: tempId,
                createdAt: new Date().toISOString(),
                thumbnail: serializablePayload.thumbnail instanceof File ? URL.createObjectURL(serializablePayload.thumbnail) : (serializablePayload.thumbnail || '')
            };

            await OfflineDB.addToQueue('CREATE', serializablePayload);
            await OfflineDB.updateItem(optimisticItem);
            return optimisticItem;
        },

        /** UPDATE — handles sync queue */
        async update(id, payload, skipQueue = false) {
            if (isConnected() || skipQueue) {
                try {
                    const res = await apiFetch(`/media/${id}`, { method: 'PUT', body: payload });
                    const updated = res.data;
                    await OfflineDB.updateItem(updated);
                    return updated;
                } catch (err) {
                    if (skipQueue) throw err;
                }
            }
            // Offline
            let serializablePayload = payload;
            if (payload instanceof FormData) {
                serializablePayload = { _isFormData: true, id };
                for (let [key, value] of payload.entries()) {
                    serializablePayload[key] = value;
                }
            } else {
                serializablePayload = { ...payload, id };
            }

            await OfflineDB.addToQueue('UPDATE', serializablePayload);
            // Optimistic update
            const cached = await this.getById(id);
            const merged = { ...cached, ...(serializablePayload._isFormData ? serializablePayload : payload) };
            if (serializablePayload.thumbnail instanceof File) {
                merged.thumbnail = URL.createObjectURL(serializablePayload.thumbnail);
            }
            await OfflineDB.updateItem(merged);
            return merged;
        },

        /** TOGGLE FEATURED */
        async toggleFeatured(id, skipQueue = false) {
            if (isConnected() || skipQueue) {
                try {
                    const res = await apiFetch(`/media/${id}/featured`, { method: 'PATCH' });
                    const updated = res.data;
                    await OfflineDB.updateItem(updated);
                    return updated;
                } catch (err) {
                    if (skipQueue) throw err;
                }
            }
            // Offline
            await OfflineDB.addToQueue('TOGGLE_FEATURED', { id });
            // Optimistic toggle locally
            const cached = await this.getById(id);
            if (cached) {
                cached.featured = !cached.featured;
                await OfflineDB.updateItem(cached);
            }
            return { id, featured: cached ? cached.featured : false };
        },

        /** DELETE */
        async delete(id, skipQueue = false) {
            if (isConnected() || skipQueue) {
                try {
                    await apiFetch(`/media/${id}`, { method: 'DELETE' });
                    await OfflineDB.deleteItem(id);
                    return true;
                } catch (err) {
                    if (skipQueue) throw err;
                }
            }
            // Offline
            await OfflineDB.addToQueue('DELETE', { id });
            await OfflineDB.deleteItem(id);
            return true;
        },

        async getStats() {
            if (isConnected()) {
                try {
                    const res = await apiFetch('/media/admin/stats');
                    return res.data;
                } catch { }
            }
            // Calc stats from local cache if offline
            const cached = await OfflineDB.getCatalog();
            const stats = { total: cached.length, featured: cached.filter(i => i.featured).length, byType: {} };
            cached.forEach(i => { stats.byType[i.type] = (stats.byType[i.type] || 0) + 1; });
            return stats;
        },

        async login(email, password) {
            const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
            if (res.token) {
                saveToken(res.token);
                sessionStorage.setItem('sv_admin', JSON.stringify(res.admin));
            }
            return res;
        },

        async checkSession() {
            const token = getToken();
            if (!token) return null;
            if (!isConnected()) return JSON.parse(sessionStorage.getItem('sv_admin') || 'null');
            try {
                const res = await apiFetch('/auth/me');
                return res.admin;
            } catch {
                clearToken();
                return null;
            }
        },

        logout() { clearToken(); }
    };
})();

window.DB_Service = DB_Service;
