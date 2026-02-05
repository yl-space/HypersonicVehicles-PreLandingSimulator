/**
 * TileWorker - Web Worker for off-main-thread tile geometry generation
 *
 * Handles computationally expensive operations:
 * - Tile geometry generation (vertices, UVs, indices)
 * - Quadtree traversal and LOD calculations
 * - Spatial indexing for tile visibility
 *
 * Communication via postMessage with TransferableArrayBuffer for efficiency.
 */

// Tile geometry generation (mirrors PlanetTileManager.buildTileMesh)
function buildTileGeometry(z, x, y, radius, segments, skirtEnabled, skirtDepthFactor) {
    // WMTS default028mm matrix: cols = 2^(z+1), rows = 2^z
    const cols = 1 << (z + 1);
    const rows = 1 << z;
    const lonLeft = -Math.PI + (2 * Math.PI * x) / cols;
    const lonRight = -Math.PI + (2 * Math.PI * (x + 1)) / cols;
    const latTop = Math.PI / 2 - (Math.PI * y) / rows;
    const latBottom = Math.PI / 2 - (Math.PI * (y + 1)) / rows;

    const lonSpan = lonRight - lonLeft;
    const latSpan = latTop - latBottom;

    const verts = [];
    const uvs = [];
    const indices = [];

    // Surface radius with slight offset to prevent z-fighting
    const surfaceR = radius * 1.001;
    // Skirt radius - drops below surface to hide cracks
    const skirtR = radius * (1.001 - skirtDepthFactor);

    // ===== MAIN TILE SURFACE =====
    for (let iy = 0; iy <= segments; iy++) {
        const v = iy / segments;
        const lat = lerp(latTop, latBottom, v);
        const cosLat = Math.cos(lat);
        const sinLat = Math.sin(lat);
        for (let ix = 0; ix <= segments; ix++) {
            const u = ix / segments;
            const lon = lerp(lonLeft, lonRight, u);
            const cosLon = Math.cos(lon);
            const sinLon = Math.sin(lon);

            verts.push(
                surfaceR * cosLat * cosLon,
                surfaceR * sinLat,
                surfaceR * cosLat * sinLon
            );
            // Flip V for OpenGL convention
            uvs.push(u, 1 - v);
        }
    }

    // Main surface triangles
    for (let iy = 0; iy < segments; iy++) {
        for (let ix = 0; ix < segments; ix++) {
            const a = iy * (segments + 1) + ix;
            const b = a + segments + 1;
            indices.push(a, a + 1, b);
            indices.push(a + 1, b + 1, b);
        }
    }

    // ===== SKIRT GEOMETRY =====
    if (skirtEnabled) {
        const surfaceVertCount = (segments + 1) * (segments + 1);

        // Bottom edge skirt
        for (let ix = 0; ix <= segments; ix++) {
            const u = ix / segments;
            const lon = lerp(lonLeft, lonRight, u);
            const cosLon = Math.cos(lon);
            const sinLon = Math.sin(lon);
            const cosLat = Math.cos(latBottom);
            const sinLat = Math.sin(latBottom);
            verts.push(skirtR * cosLat * cosLon, skirtR * sinLat, skirtR * cosLat * sinLon);
            uvs.push(u, 0);
        }

        // Top edge skirt
        for (let ix = 0; ix <= segments; ix++) {
            const u = ix / segments;
            const lon = lerp(lonLeft, lonRight, u);
            const cosLon = Math.cos(lon);
            const sinLon = Math.sin(lon);
            const cosLat = Math.cos(latTop);
            const sinLat = Math.sin(latTop);
            verts.push(skirtR * cosLat * cosLon, skirtR * sinLat, skirtR * cosLat * sinLon);
            uvs.push(u, 1);
        }

        // Left edge skirt
        for (let iy = 0; iy <= segments; iy++) {
            const v = iy / segments;
            const lat = lerp(latTop, latBottom, v);
            const cosLat = Math.cos(lat);
            const sinLat = Math.sin(lat);
            const cosLon = Math.cos(lonLeft);
            const sinLon = Math.sin(lonLeft);
            verts.push(skirtR * cosLat * cosLon, skirtR * sinLat, skirtR * cosLat * sinLon);
            uvs.push(0, 1 - v);
        }

        // Right edge skirt
        for (let iy = 0; iy <= segments; iy++) {
            const v = iy / segments;
            const lat = lerp(latTop, latBottom, v);
            const cosLat = Math.cos(lat);
            const sinLat = Math.sin(lat);
            const cosLon = Math.cos(lonRight);
            const sinLon = Math.sin(lonRight);
            verts.push(skirtR * cosLat * cosLon, skirtR * sinLat, skirtR * cosLat * sinLon);
            uvs.push(1, 1 - v);
        }

        // Skirt triangle indices
        const bottomSkirtStart = surfaceVertCount;
        const topSkirtStart = bottomSkirtStart + (segments + 1);
        const leftSkirtStart = topSkirtStart + (segments + 1);
        const rightSkirtStart = leftSkirtStart + (segments + 1);

        // Bottom skirt
        for (let ix = 0; ix < segments; ix++) {
            const surfaceIdx = segments * (segments + 1) + ix;
            const skirtIdx = bottomSkirtStart + ix;
            indices.push(surfaceIdx, skirtIdx, surfaceIdx + 1);
            indices.push(skirtIdx, skirtIdx + 1, surfaceIdx + 1);
        }

        // Top skirt
        for (let ix = 0; ix < segments; ix++) {
            const surfaceIdx = ix;
            const skirtIdx = topSkirtStart + ix;
            indices.push(surfaceIdx, surfaceIdx + 1, skirtIdx);
            indices.push(surfaceIdx + 1, skirtIdx + 1, skirtIdx);
        }

        // Left skirt
        for (let iy = 0; iy < segments; iy++) {
            const surfaceIdx = iy * (segments + 1);
            const skirtIdx = leftSkirtStart + iy;
            indices.push(surfaceIdx, skirtIdx, surfaceIdx + (segments + 1));
            indices.push(skirtIdx, skirtIdx + 1, surfaceIdx + (segments + 1));
        }

        // Right skirt
        for (let iy = 0; iy < segments; iy++) {
            const surfaceIdx = iy * (segments + 1) + segments;
            const skirtIdx = rightSkirtStart + iy;
            indices.push(surfaceIdx, surfaceIdx + (segments + 1), skirtIdx);
            indices.push(surfaceIdx + (segments + 1), skirtIdx + 1, skirtIdx);
        }
    }

    // Calculate tile center
    const centerLat = (latTop + latBottom) * 0.5;
    const centerLon = (lonLeft + lonRight) * 0.5;
    const centerX = radius * Math.cos(centerLat) * Math.cos(centerLon);
    const centerY = radius * Math.sin(centerLat);
    const centerZ = radius * Math.cos(centerLat) * Math.sin(centerLon);

    return {
        positions: new Float32Array(verts),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
        center: { x: centerX, y: centerY, z: centerZ },
        latSpan,
        lonSpan
    };
}

// Helper function
function lerp(a, b, t) {
    return a + (b - a) * t;
}

// Get adaptive segment count
function getSegmentsForLevel(z) {
    if (z <= 2) return 4;
    if (z <= 4) return 8;
    return 16;
}

// Calculate visible tiles based on camera frustum
function calculateVisibleTiles(cameraData, radius, minLevel, maxLevel) {
    const { position, direction, fov, aspect, viewportHeight } = cameraData;
    const fovRad = fov * (Math.PI / 180);
    const pixelsPerRad = viewportHeight / fovRad;

    const visibleTiles = [];
    const cols = 1 << (minLevel + 1);
    const rows = 1 << minLevel;

    // Check each root tile
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            collectVisibleTile(
                minLevel, x, y,
                position, direction, pixelsPerRad,
                radius, maxLevel, visibleTiles
            );
        }
    }

    return visibleTiles;
}

function collectVisibleTile(z, x, y, camPos, camDir, pixelsPerRad, radius, maxLevel, result) {
    // Calculate tile center
    const cols = 1 << (z + 1);
    const rows = 1 << z;
    const lonLeft = -Math.PI + (2 * Math.PI * x) / cols;
    const lonRight = -Math.PI + (2 * Math.PI * (x + 1)) / cols;
    const latTop = Math.PI / 2 - (Math.PI * y) / rows;
    const latBottom = Math.PI / 2 - (Math.PI * (y + 1)) / rows;

    const centerLat = (latTop + latBottom) * 0.5;
    const centerLon = (lonLeft + lonRight) * 0.5;
    const centerX = radius * Math.cos(centerLat) * Math.cos(centerLon);
    const centerY = radius * Math.sin(centerLat);
    const centerZ = radius * Math.cos(centerLat) * Math.sin(centerLon);

    // Back-face culling
    const tileNormX = centerX / radius;
    const tileNormY = centerY / radius;
    const tileNormZ = centerZ / radius;
    const cameraDirX = camPos.x - centerX;
    const cameraDirY = camPos.y - centerY;
    const cameraDirZ = camPos.z - centerZ;
    const dirLen = Math.sqrt(cameraDirX * cameraDirX + cameraDirY * cameraDirY + cameraDirZ * cameraDirZ);
    const dot = tileNormX * (cameraDirX / dirLen) + tileNormY * (cameraDirY / dirLen) + tileNormZ * (cameraDirZ / dirLen);

    if (dot < -0.2) {
        return; // Back-facing
    }

    // Calculate screen size
    const dist = Math.sqrt(
        (camPos.x - centerX) ** 2 +
        (camPos.y - centerY) ** 2 +
        (camPos.z - centerZ) ** 2
    );

    const lonSpan = lonRight - lonLeft;
    const latSpan = latTop - latBottom;
    const tileArcSize = Math.max(latSpan, lonSpan) * radius;
    const apparentAngularSize = 2 * Math.atan2(tileArcSize / 2, dist);
    const screenSize = apparentAngularSize * pixelsPerRad;

    const shouldSubdivide = screenSize > 60 && z < maxLevel;

    if (shouldSubdivide) {
        // Subdivide into children
        for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
                collectVisibleTile(
                    z + 1, x * 2 + dx, y * 2 + dy,
                    camPos, camDir, pixelsPerRad, radius, maxLevel, result
                );
            }
        }
    } else {
        // Add this tile as visible
        result.push({
            z, x, y,
            key: `${z}/${x}/${y}`,
            screenSize,
            distance: dist
        });
    }
}

// Message handler
self.onmessage = function(e) {
    const { type, data, id } = e.data;

    switch (type) {
        case 'BUILD_GEOMETRY': {
            const { z, x, y, radius, skirtEnabled, skirtDepthFactor } = data;
            const segments = getSegmentsForLevel(z);
            const geometry = buildTileGeometry(z, x, y, radius, segments, skirtEnabled, skirtDepthFactor);

            // Transfer ArrayBuffers for efficiency
            self.postMessage({
                type: 'GEOMETRY_READY',
                id,
                data: {
                    key: `${z}/${x}/${y}`,
                    ...geometry
                }
            }, [
                geometry.positions.buffer,
                geometry.uvs.buffer,
                geometry.indices.buffer
            ]);
            break;
        }

        case 'CALCULATE_VISIBLE': {
            const { cameraData, radius, minLevel, maxLevel } = data;
            const visibleTiles = calculateVisibleTiles(cameraData, radius, minLevel, maxLevel);

            self.postMessage({
                type: 'VISIBLE_TILES',
                id,
                data: { tiles: visibleTiles }
            });
            break;
        }

        case 'BATCH_BUILD_GEOMETRY': {
            const { tiles, radius, skirtEnabled, skirtDepthFactor } = data;
            const results = [];

            for (const tile of tiles) {
                const segments = getSegmentsForLevel(tile.z);
                const geometry = buildTileGeometry(
                    tile.z, tile.x, tile.y,
                    radius, segments, skirtEnabled, skirtDepthFactor
                );
                results.push({
                    key: tile.key,
                    ...geometry
                });
            }

            // Collect all buffers for transfer
            const transfers = results.flatMap(r => [
                r.positions.buffer,
                r.uvs.buffer,
                r.indices.buffer
            ]);

            self.postMessage({
                type: 'BATCH_GEOMETRY_READY',
                id,
                data: { geometries: results }
            }, transfers);
            break;
        }

        default:
            console.warn('[TileWorker] Unknown message type:', type);
    }
};

console.log('[TileWorker] Initialized');
