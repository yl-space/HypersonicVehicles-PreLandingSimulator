/**
 * TileCache - IndexedDB-based persistent cache for map tiles
 *
 * Provides a simple key-value store for caching tile image blobs,
 * surviving page refreshes and reducing network requests.
 *
 * Storage limits:
 * - Chrome/Edge: ~60% of disk space (up to 60GB+)
 * - Firefox: ~50% of disk space (up to 2GB per origin by default)
 * - Safari: ~1GB per origin
 *
 * For Mars tiles at level 6: ~8000 tiles × 50KB = ~400MB (well within limits)
 */

const DB_VERSION = 1;
const TILE_STORE_NAME = 'tiles';
const METADATA_STORE_NAME = 'metadata';

export class TileCache {
    constructor(dbName = 'mars-tiles', version = DB_VERSION) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
        this.isOpen = false;
    }

    /**
     * Open the IndexedDB database
     * @returns {Promise<void>}
     */
    open() {
        return new Promise((resolve, reject) => {
            if (this.isOpen && this.db) {
                resolve();
                return;
            }

            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                console.error('[TileCache] Failed to open IndexedDB:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isOpen = true;
                console.log(`[TileCache] Opened IndexedDB: ${this.dbName}`);
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create tile store (key = "z/x/y", value = Blob)
                if (!db.objectStoreNames.contains(TILE_STORE_NAME)) {
                    db.createObjectStore(TILE_STORE_NAME);
                    console.log('[TileCache] Created tiles store');
                }

                // Create metadata store for cache stats and expiry
                if (!db.objectStoreNames.contains(METADATA_STORE_NAME)) {
                    const metaStore = db.createObjectStore(METADATA_STORE_NAME);
                    // Initialize metadata
                    metaStore.put({ created: Date.now(), count: 0 }, 'stats');
                    console.log('[TileCache] Created metadata store');
                }
            };
        });
    }

    /**
     * Get a tile blob from the cache
     * @param {string} key - Tile key (e.g., "3/4/2")
     * @returns {Promise<Blob|null>}
     */
    get(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve(null);
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.get(key);

                request.onsuccess = () => {
                    resolve(request.result || null);
                };

                request.onerror = () => {
                    console.warn('[TileCache] Get failed:', request.error);
                    resolve(null);
                };
            } catch (error) {
                console.warn('[TileCache] Get error:', error);
                resolve(null);
            }
        });
    }

    /**
     * Store a tile blob in the cache
     * @param {string} key - Tile key (e.g., "3/4/2")
     * @param {Blob} blob - Image blob data
     * @returns {Promise<void>}
     */
    put(key, blob) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.put(blob, key);

                request.onsuccess = () => {
                    resolve();
                };

                request.onerror = () => {
                    console.warn('[TileCache] Put failed:', request.error);
                    resolve(); // Don't reject, caching is optional
                };
            } catch (error) {
                console.warn('[TileCache] Put error:', error);
                resolve();
            }
        });
    }

    /**
     * Delete a tile from the cache
     * @param {string} key - Tile key
     * @returns {Promise<void>}
     */
    delete(key) {
        return new Promise((resolve, reject) => {
            if (!this.db) {
                resolve();
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.delete(key);

                request.onsuccess = () => resolve();
                request.onerror = () => resolve();
            } catch (error) {
                resolve();
            }
        });
    }

    /**
     * Check if a tile exists in the cache
     * @param {string} key - Tile key
     * @returns {Promise<boolean>}
     */
    has(key) {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(false);
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.count(IDBKeyRange.only(key));

                request.onsuccess = () => resolve(request.result > 0);
                request.onerror = () => resolve(false);
            } catch (error) {
                resolve(false);
            }
        });
    }

    /**
     * Get the number of cached tiles
     * @returns {Promise<number>}
     */
    count() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve(0);
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.count();

                request.onsuccess = () => resolve(request.result);
                request.onerror = () => resolve(0);
            } catch (error) {
                resolve(0);
            }
        });
    }

    /**
     * Clear all cached tiles
     * @returns {Promise<void>}
     */
    clear() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve();
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readwrite');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.clear();

                request.onsuccess = () => {
                    console.log('[TileCache] Cache cleared');
                    resolve();
                };
                request.onerror = () => resolve();
            } catch (error) {
                resolve();
            }
        });
    }

    /**
     * Get all cached tile keys
     * @returns {Promise<string[]>}
     */
    keys() {
        return new Promise((resolve) => {
            if (!this.db) {
                resolve([]);
                return;
            }

            try {
                const transaction = this.db.transaction([TILE_STORE_NAME], 'readonly');
                const store = transaction.objectStore(TILE_STORE_NAME);
                const request = store.getAllKeys();

                request.onsuccess = () => resolve(request.result || []);
                request.onerror = () => resolve([]);
            } catch (error) {
                resolve([]);
            }
        });
    }

    /**
     * Get approximate cache size in bytes
     * @returns {Promise<number>}
     */
    async getSize() {
        if (!this.db) return 0;

        const keys = await this.keys();
        let totalSize = 0;

        for (const key of keys) {
            const blob = await this.get(key);
            if (blob) {
                totalSize += blob.size;
            }
        }

        return totalSize;
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>}
     */
    async getStats() {
        const count = await this.count();
        const size = await this.getSize();

        return {
            tileCount: count,
            sizeBytes: size,
            sizeMB: (size / (1024 * 1024)).toFixed(2),
            dbName: this.dbName
        };
    }

    /**
     * Close the database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
            this.isOpen = false;
            console.log('[TileCache] Database closed');
        }
    }

    /**
     * Delete the entire database
     * @returns {Promise<void>}
     */
    static deleteDatabase(dbName = 'mars-tiles') {
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(dbName);
            request.onsuccess = () => {
                console.log(`[TileCache] Database ${dbName} deleted`);
                resolve();
            };
            request.onerror = () => {
                console.error(`[TileCache] Failed to delete database ${dbName}`);
                reject(request.error);
            };
        });
    }
}

/**
 * Singleton instance for global tile caching
 */
let globalTileCache = null;

export async function getGlobalTileCache() {
    if (!globalTileCache) {
        globalTileCache = new TileCache('mars-tiles', DB_VERSION);
        await globalTileCache.open();
    }
    return globalTileCache;
}

export default TileCache;
