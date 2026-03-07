/**
 * OfflineSync — Synchronization Logic
 * manages the sync queue and auto-triggers sync when online.
 */

const OfflineSync = (() => {
    let isSyncing = false;

    const init = () => {
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Initial check
        if (navigator.onLine) {
            handleOnline();
        }
    };

    const handleOnline = async () => {
        console.log('🌐 Connection restored. Syncing data...');
        if (window.toast) window.toast('Connexion rétablie. Synchronisation...', 'info');
        document.body.classList.remove('is-offline');

        await performSync();
    };

    const handleOffline = () => {
        console.warn('🔌 Connection lost. Working offline.');
        if (window.toast) window.toast('Mode hors-ligne activé. Les modifications seront synchronisées plus tard.', 'warning');
        document.body.classList.add('is-offline');
    };

    const performSync = async () => {
        if (isSyncing) return;
        isSyncing = true;

        try {
            const queue = await OfflineDB.getQueue();
            if (queue.length === 0) {
                isSyncing = false;
                return;
            }

            console.log(`📡 Syncing ${queue.length} operations...`);

            for (const op of queue) {
                try {
                    await processOperation(op);
                    await OfflineDB.removeFromQueue(op.id);
                } catch (err) {
                    console.error('❌ Sync failed for operation:', op, err);
                    // Decide whether to keep in queue or discard based on error
                    // For now, keep it to try again next time if it's a network error
                }
            }

            if (window.toast) window.toast('Synchronisation terminée avec succès !', 'success');

            // Refresh catalog from server after sync to ensure consistency
            if (window.DB_Service) {
                const freshData = await window.DB_Service.getAll();
                await OfflineDB.saveCatalog(freshData);
                // Trigger a global UI refresh if needed
                window.dispatchEvent(new CustomEvent('catalog-refreshed'));
            }

        } catch (err) {
            console.error('❌ Global sync error:', err);
        } finally {
            isSyncing = false;
        }
    };

    const processOperation = async (op) => {
        const { operation, data } = op;
        const db = window.DB_Service;
        if (!db) return;

        let payload = data;
        if (data && data._isFormData) {
            payload = new FormData();
            for (let key in data) {
                if (key !== '_isFormData' && key !== 'id') {
                    payload.append(key, data[key]);
                }
            }
        }

        switch (operation) {
            case 'CREATE':
                return await db.create(payload, true);
            case 'UPDATE':
                return await db.update(data.id || data._id, payload, true);
            case 'DELETE':
                return await db.delete(data.id || data._id, true);
            case 'TOGGLE_FEATURED':
                return await db.toggleFeatured(data.id || data._id, true);
            default:
                console.warn('Unknown operation:', operation);
        }
    };

    return {
        init,
        performSync
    };
})();

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    OfflineSync.init();
});

window.OfflineSync = OfflineSync;
