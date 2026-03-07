/**
 * OfflineDB — IndexedDB Wrapper
 * handles persistent local storage for the media catalog and sync queue.
 */

const OfflineDB = (() => {
    const DB_NAME = 'StreamVibe_OfflineDB';
    const DB_VERSION = 1;
    const STORE_CATALOG = 'catalog';
    const STORE_QUEUE = 'sync_queue';

    let db = null;

    const open = () => {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_CATALOG)) {
                    db.createObjectStore(STORE_CATALOG, { keyPath: '_id' });
                }
                if (!db.objectStoreNames.contains(STORE_QUEUE)) {
                    db.createObjectStore(STORE_QUEUE, { keyPath: 'id', autoIncrement: true });
                }
            };

            request.onsuccess = (event) => {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = (event) => {
                console.error('IndexedDB error:', event.target.error);
                reject(event.target.error);
            };
        });
    };

    const getDB = async () => {
        if (!db) await open();
        return db;
    };

    // ── Catalog Operations ────────────────────────────────────────────────────
    const saveCatalog = async (items) => {
        const db = await getDB();
        const tx = db.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);

        // Overwrite existing or add new.
        // We don't clear anymore to avoid "no content" period during sync.
        items.forEach(item => {
            if (!item._id && item.id) item._id = item.id;
            store.put(item);
        });

        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    const getCatalog = async () => {
        const db = await getDB();
        const tx = db.transaction(STORE_CATALOG, 'readonly');
        const store = tx.objectStore(STORE_CATALOG);
        const request = store.getAll();

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
        });
    };

    const updateItem = async (item) => {
        const db = await getDB();
        const tx = db.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);
        store.put(item);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    const deleteItem = async (id) => {
        const db = await getDB();
        const tx = db.transaction(STORE_CATALOG, 'readwrite');
        const store = tx.objectStore(STORE_CATALOG);
        store.delete(id);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    // ── Sync Queue Operations ─────────────────────────────────────────────────
    const addToQueue = async (operation, data) => {
        const db = await getDB();
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.add({ operation, data, timestamp: Date.now() });
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    const getQueue = async () => {
        const db = await getDB();
        const tx = db.transaction(STORE_QUEUE, 'readonly');
        const store = tx.objectStore(STORE_QUEUE);
        const request = store.getAll();

        return new Promise((resolve) => {
            request.onsuccess = () => resolve(request.result);
        });
    };

    const removeFromQueue = async (id) => {
        const db = await getDB();
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.delete(id);
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    const clearQueue = async () => {
        const db = await getDB();
        const tx = db.transaction(STORE_QUEUE, 'readwrite');
        const store = tx.objectStore(STORE_QUEUE);
        store.clear();
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve(true);
        });
    };

    return {
        saveCatalog,
        getCatalog,
        updateItem,
        deleteItem,
        addToQueue,
        getQueue,
        removeFromQueue,
        clearQueue
    };
})();

window.OfflineDB = OfflineDB;
