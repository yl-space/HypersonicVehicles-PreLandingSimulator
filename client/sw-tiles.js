/**
 * Service Worker for Mars Tile Caching
 *
 * Intercepts tile requests and serves from cache when available.
 * Uses Cache API for tile storage with network-first strategy for reliability.
 *
 * Features:
 * - Network-first with cache fallback for tile requests
 * - Background cache population for prefetching
 * - Cache versioning for updates
 * - Offline support for previously viewed areas
 */

const CACHE_NAME = 'mars-tiles-v1';
const TILE_URL_PATTERN = /\/sim\/tiles\/mars\/\d+\/\d+\/\d+\.(jpg|png)$/;
const MAX_CACHE_SIZE = 500; // Maximum number of tiles to cache

// Install event - pre-cache critical assets
self.addEventListener('install', (event) => {
    console.log('[SW-Tiles] Installing service worker');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW-Tiles] Cache opened');
                // Don't pre-cache tiles - they'll be cached on demand
                return Promise.resolve();
            })
            .then(() => {
                // Skip waiting to activate immediately
                return self.skipWaiting();
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[SW-Tiles] Activating service worker');

    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name.startsWith('mars-tiles-') && name !== CACHE_NAME)
                    .map((name) => {
                        console.log('[SW-Tiles] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            // Take control of all pages immediately
            return self.clients.claim();
        })
    );
});

// Fetch event - intercept tile requests
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Only handle tile requests
    if (!TILE_URL_PATTERN.test(url.pathname)) {
        return;
    }

    event.respondWith(handleTileRequest(event.request));
});

/**
 * Handle tile request with network-first strategy
 */
async function handleTileRequest(request) {
    const cache = await caches.open(CACHE_NAME);

    try {
        // Try network first for freshness
        const networkResponse = await fetch(request, {
            mode: 'cors',
            credentials: 'omit'
        });

        if (networkResponse.ok) {
            // Clone response before caching (response can only be used once)
            const responseClone = networkResponse.clone();

            // Cache the successful response
            cache.put(request, responseClone).catch((err) => {
                console.warn('[SW-Tiles] Failed to cache tile:', err);
            });

            // Trim cache if needed (async, don't wait)
            trimCache(cache);

            return networkResponse;
        }

        // Network failed, try cache
        console.log('[SW-Tiles] Network failed, trying cache for:', request.url);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Both failed, return error response
        return new Response('Tile not available', {
            status: 503,
            statusText: 'Service Unavailable'
        });

    } catch (error) {
        // Network error, try cache
        console.log('[SW-Tiles] Network error, trying cache for:', request.url);
        const cachedResponse = await cache.match(request);

        if (cachedResponse) {
            return cachedResponse;
        }

        // Return placeholder or error
        return new Response('Tile not available (offline)', {
            status: 503,
            statusText: 'Service Unavailable'
        });
    }
}

/**
 * Trim cache to maximum size using LRU-like strategy
 */
async function trimCache(cache) {
    try {
        const keys = await cache.keys();

        if (keys.length > MAX_CACHE_SIZE) {
            // Delete oldest entries (first in cache)
            const deleteCount = keys.length - MAX_CACHE_SIZE;
            console.log(`[SW-Tiles] Trimming cache, removing ${deleteCount} old tiles`);

            const deletePromises = keys
                .slice(0, deleteCount)
                .map((key) => cache.delete(key));

            await Promise.all(deletePromises);
        }
    } catch (error) {
        console.warn('[SW-Tiles] Error trimming cache:', error);
    }
}

// Message handler for cache management
self.addEventListener('message', (event) => {
    const { type, data } = event.data || {};

    switch (type) {
        case 'CLEAR_CACHE':
            caches.delete(CACHE_NAME)
                .then(() => {
                    console.log('[SW-Tiles] Cache cleared');
                    event.ports[0]?.postMessage({ success: true });
                })
                .catch((err) => {
                    console.error('[SW-Tiles] Failed to clear cache:', err);
                    event.ports[0]?.postMessage({ success: false, error: err.message });
                });
            break;

        case 'GET_CACHE_STATS':
            getCacheStats()
                .then((stats) => {
                    event.ports[0]?.postMessage({ success: true, stats });
                })
                .catch((err) => {
                    event.ports[0]?.postMessage({ success: false, error: err.message });
                });
            break;

        case 'PREFETCH_TILES':
            prefetchTiles(data?.tiles || [])
                .then((result) => {
                    event.ports[0]?.postMessage({ success: true, ...result });
                })
                .catch((err) => {
                    event.ports[0]?.postMessage({ success: false, error: err.message });
                });
            break;

        default:
            console.log('[SW-Tiles] Unknown message type:', type);
    }
});

/**
 * Get cache statistics
 */
async function getCacheStats() {
    try {
        const cache = await caches.open(CACHE_NAME);
        const keys = await cache.keys();

        let totalSize = 0;
        for (const request of keys) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.clone().blob();
                totalSize += blob.size;
            }
        }

        return {
            tileCount: keys.length,
            sizeBytes: totalSize,
            sizeMB: (totalSize / (1024 * 1024)).toFixed(2),
            cacheName: CACHE_NAME
        };
    } catch (error) {
        console.error('[SW-Tiles] Error getting cache stats:', error);
        return { tileCount: 0, sizeBytes: 0, sizeMB: '0', cacheName: CACHE_NAME };
    }
}

/**
 * Prefetch tiles in background
 */
async function prefetchTiles(tileUrls) {
    if (!tileUrls || tileUrls.length === 0) {
        return { fetched: 0, failed: 0 };
    }

    const cache = await caches.open(CACHE_NAME);
    let fetched = 0;
    let failed = 0;

    for (const url of tileUrls) {
        try {
            // Check if already cached
            const existing = await cache.match(url);
            if (existing) {
                continue;
            }

            // Fetch and cache
            const response = await fetch(url, {
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                await cache.put(url, response);
                fetched++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;
        }
    }

    console.log(`[SW-Tiles] Prefetch complete: ${fetched} fetched, ${failed} failed`);
    return { fetched, failed };
}
