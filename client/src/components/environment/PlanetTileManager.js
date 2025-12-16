import * as THREE from 'three';

/**
 * Simple quadtree tile manager for planet textures (equirectangular).
 * Expects tiles at baseUrl/{z}/{x}/{y}.(jpg|png).
 */
export class PlanetTileManager {
    constructor({ radius, baseUrl, maxLevel = 6, minLevel = 0, segments = 12, anisotropy = 1, extension = 'jpg' }) {
        this.radius = radius;
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.maxLevel = maxLevel;
        this.minLevel = minLevel;
        this.segments = segments;
        this.anisotropy = anisotropy;
        this.extension = extension.startsWith('.') ? extension.slice(1) : extension;

        this.rootTiles = [];
        this.group = new THREE.Group();
        this.tileCache = new Map(); // key -> tile
        this.textureCache = new Map(); // url -> texture
        this.lru = [];
        this.maxTextures = 64;
        this.loader = new THREE.TextureLoader();
        this.loader.crossOrigin = 'anonymous';

        // Throttle tile requests to avoid flooding the network
        this.maxConcurrentLoads = 6;
        this.activeLoads = 0;
        this.loadQueue = [];

        // Simple fallback sphere so the planet is visible even before tiles finish
        const fallbackGeo = new THREE.SphereGeometry(this.radius, 32, 16);
        const fallbackMat = new THREE.MeshBasicMaterial({ color: 0x7a5a45, side: THREE.DoubleSide });
        this.fallbackMesh = new THREE.Mesh(fallbackGeo, fallbackMat);
        this.group.add(this.fallbackMesh);

        this.init();
    }

    init() {
        // WMTS tile matrix: at level z, there are 2^(z+1) columns × 2^z rows
        // NASA Trek tiles typically start at level 1, not level 0
        const z = this.minLevel;
        const cols = 1 << (z + 1); // 2^(z+1) columns
        const rows = 1 << z;       // 2^z rows

        console.log(`[PlanetTileManager] Initializing with minLevel=${z}, creating ${cols}x${rows} root tiles`);

        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const tile = this.createTile(z, x, y);
                this.rootTiles.push(tile);
                this.group.add(tile.mesh);
            }
        }
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.tileCache.forEach(tile => this.disposeTile(tile));
        this.textureCache.forEach(tex => tex.dispose());
        this.tileCache.clear();
        this.textureCache.clear();
        this.lru = [];
    }

    disposeTile(tile) {
        if (tile.mesh) {
            tile.mesh.geometry.dispose();
            if (tile.mesh.material?.map) tile.mesh.material.map.dispose();
            tile.mesh.material.dispose?.();
            this.group.remove(tile.mesh);
        }
        if (tile.children) {
            tile.children.forEach(child => this.disposeTile(child));
        }
    }

    createTile(z, x, y, parent = null) {
        const key = `${z}/${x}/${y}`;
        if (this.tileCache.has(key)) return this.tileCache.get(key);

        const { mesh, latSpan, lonSpan, center } = this.buildTileMesh(z, x, y);

        const tile = {
            key,
            z,
            x,
            y,
            mesh,
            center,
            latSpan,
            lonSpan,
            loading: false,
            loaded: false,
            children: null,
            parent
        };

        this.tileCache.set(key, tile);
        this.loadTextureForTile(tile);
        return tile;
    }

    buildTileMesh(z, x, y) {
        // WMTS default028mm matrix: cols = 2^(z+1), rows = 2^z
        const cols = 1 << (z + 1);
        const rows = 1 << z;
        const lonLeft = -Math.PI + (2 * Math.PI * x) / cols;
        const lonRight = -Math.PI + (2 * Math.PI * (x + 1)) / cols;
        const latTop = Math.PI / 2 - (Math.PI * y) / rows;
        const latBottom = Math.PI / 2 - (Math.PI * (y + 1)) / rows;

        const lonSpan = lonRight - lonLeft;
        const latSpan = latTop - latBottom;

        const geometry = new THREE.BufferGeometry();
        const verts = [];
        const uvs = [];
        const indices = [];

        for (let iy = 0; iy <= this.segments; iy++) {
            const v = iy / this.segments;
            const lat = THREE.MathUtils.lerp(latTop, latBottom, v);
            const cosLat = Math.cos(lat);
            const sinLat = Math.sin(lat);
            for (let ix = 0; ix <= this.segments; ix++) {
                const u = ix / this.segments;
                const lon = THREE.MathUtils.lerp(lonLeft, lonRight, u);
                const cosLon = Math.cos(lon);
                const sinLon = Math.sin(lon);

                // Slight offset (0.001) to prevent z-fighting with fallback sphere
                const r = this.radius * 1.001;
                verts.push(
                    r * cosLat * cosLon,
                    r * sinLat,
                    r * cosLat * sinLon
                );
                // Use local tile UVs (0-1) - each tile texture covers its full extent
                // Flip V because image y=0 is top, but UV v=0 is bottom (OpenGL convention)
                uvs.push(u, 1 - v);
            }
        }

        for (let iy = 0; iy < this.segments; iy++) {
            for (let ix = 0; ix < this.segments; ix++) {
                const a = iy * (this.segments + 1) + ix;
                const b = a + this.segments + 1;
                // Counter-clockwise winding for outward-facing triangles
                indices.push(a, a + 1, b);
                indices.push(a + 1, b + 1, b);
            }
        }

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;

        const centerLat = (latTop + latBottom) * 0.5;
        const centerLon = (lonLeft + lonRight) * 0.5;
        const centerVec = new THREE.Vector3(
            this.radius * Math.cos(centerLat) * Math.cos(centerLon),
            this.radius * Math.sin(centerLat),
            this.radius * Math.cos(centerLat) * Math.sin(centerLon)
        );

        return { mesh, latSpan, lonSpan, center: centerVec };
    }

    loadTextureForTile(tile) {
        // WMTS standard order: /{TileMatrix}/{TileRow}/{TileCol}.{ext} = /{z}/{y}/{x}
        const url = `${this.baseUrl}/${tile.z}/${tile.y}/${tile.x}.${this.extension}`;
        if (this.textureCache.has(url)) {
            this.setTileTexture(tile, this.textureCache.get(url));
            return;
        }
        // Avoid duplicate queue entries
        if (this.loadQueue.find(entry => entry.url === url && entry.tile === tile)) return;
        // Enqueue load request with throttling
        this.loadQueue.push({ url, tile });
        this.sortQueueByPriority();
        this.processQueue();
    }

    setTileTexture(tile, texture) {
        console.log(`[PlanetTileManager] setTileTexture called for tile ${tile.key}, mesh exists: ${!!tile.mesh}, material exists: ${!!tile.mesh?.material}`);
        if (tile.mesh?.material) {
            tile.mesh.material.map = texture;
            tile.mesh.material.needsUpdate = true;
            tile.loaded = true;
            tile.loading = false;
            console.log(`[PlanetTileManager] Texture applied to tile ${tile.key}`);
            // Remove fallback completely once we have at least one textured tile
            if (this.fallbackMesh && this.fallbackMesh.parent) {
                this.group.remove(this.fallbackMesh);
                this.fallbackMesh.geometry.dispose();
                this.fallbackMesh.material.dispose();
                this.fallbackMesh = null;
                console.log(`[PlanetTileManager] Fallback mesh removed from scene`);
            }
        } else {
            console.warn(`[PlanetTileManager] Cannot apply texture - mesh or material missing for tile ${tile.key}`);
        }
    }

    evictIfNeeded() {
        while (this.lru.length > this.maxTextures) {
            const url = this.lru.shift();
            const tex = this.textureCache.get(url);
            if (tex) tex.dispose();
            this.textureCache.delete(url);
        }
    }

    processQueue() {
        while (this.activeLoads < this.maxConcurrentLoads && this.loadQueue.length > 0) {
            const { url, tile } = this.loadQueue.shift();
            if (tile.loading || tile.loaded) {
                continue;
            }
            tile.loading = true;
            this.activeLoads++;

            const done = () => {
                this.activeLoads = Math.max(0, this.activeLoads - 1);
                this.processQueue();
            };
            console.log(`[PlanetTileManager] Loading texture: ${url}`);
            this.loader.load(
                url,
                (tex) => {
                    console.log(`[PlanetTileManager] Texture loaded successfully: ${url}`);
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.minFilter = THREE.LinearMipmapLinearFilter;
                    tex.magFilter = THREE.LinearFilter;
                    tex.anisotropy = this.anisotropy;
                    tex.wrapS = THREE.ClampToEdgeWrapping;
                    tex.wrapT = THREE.ClampToEdgeWrapping;
                    this.textureCache.set(url, tex);
                    this.lru.push(url);
                    this.evictIfNeeded();
                    this.setTileTexture(tile, tex);
                    done();
                },
                undefined,
                (error) => {
                    console.error(`[PlanetTileManager] Failed to load tile ${tile.key}:`, url, error?.message || error);
                    tile.loading = false;
                    done();
                }
            );
        }
    }

    sortQueueByPriority() {
        const camPos = this.lastCameraPos;
        const camDir = this.lastCameraDir;
        this.loadQueue.sort((a, b) => this.computePriority(a.tile, camPos, camDir) - this.computePriority(b.tile, camPos, camDir));
    }

    computePriority(tile, camPos, camDir) {
        // Lower value = higher priority
        let priority = tile.z * 10; // favor coarser tiles first

        if (camPos && camDir) {
            const tileDir = tile.center.clone().normalize();
            const angle = 1 - Math.max(-1, Math.min(1, tileDir.dot(camDir)));
            const dist = camPos.distanceTo(tile.center);
            priority += angle * 100;
            priority += dist * 0.01;
        }
        return priority;
    }

    update(camera, renderer) {
        if (!camera || this.rootTiles.length === 0) return;

        // Debug: log group children count periodically
        if (!this._debugCounter) this._debugCounter = 0;
        if (++this._debugCounter % 60 === 0) {
            console.log(`[PlanetTileManager] Group has ${this.group.children.length} children, tileCache has ${this.tileCache.size} tiles`);
        }
        // Cache camera info for prioritization
        this.lastCameraPos = camera.position.clone();
        this.lastCameraDir = new THREE.Vector3();
        camera.getWorldDirection(this.lastCameraDir);
        const viewportHeight = renderer?.domElement?.clientHeight || window.innerHeight || 1080;
        const fovRad = (camera.fov || 50) * (Math.PI / 180);
        const pixelsPerRad = viewportHeight / fovRad;

        const desired = [];
        this.rootTiles.forEach(root => this.collectVisible(root, camera, pixelsPerRad, desired));

        // Retain desired tiles and their ancestors to avoid deleting the tree
        const retained = new Set();
        desired.forEach(tile => {
            let current = tile;
            while (current) {
                if (retained.has(current)) break;
                retained.add(current);
                current = current.parent;
            }
        });

        // Only remove tiles not in the retained set
        this.tileCache.forEach((tile) => {
            if (!retained.has(tile)) {
                this.removeTile(tile);
            }
        });
    }

    removeTile(tile) {
        if (tile.children) {
            tile.children.forEach(child => this.removeTile(child));
            tile.children = null;
        }
        if (tile.mesh && this.group.children.includes(tile.mesh)) {
            this.group.remove(tile.mesh);
        }
    }

    collectVisible(tile, camera, pixelsPerRad, desired) {
        // Convert tile center to world space for accurate distance calculation
        const worldCenter = tile.center.clone();
        this.group.localToWorld(worldCenter);

        // Check if tile is on the camera-facing side of the planet
        // Tile normal points outward from planet center (same direction as tile center from origin)
        const tileNormal = worldCenter.clone().normalize();
        const cameraDir = camera.position.clone().sub(worldCenter).normalize();
        const dotProduct = tileNormal.dot(cameraDir);

        // If tile is facing away from camera (back side of planet), skip it
        // Use small threshold to include tiles near the horizon
        if (dotProduct < -0.2) {
            // Hide this tile's mesh if it exists
            if (tile.mesh && this.group.children.includes(tile.mesh)) {
                this.group.remove(tile.mesh);
            }
            return; // Don't process or subdivide back-facing tiles
        }

        const dist = camera.position.distanceTo(worldCenter);

        // Calculate apparent angular size based on distance to tile
        // Tile's actual size in world units (arc length on sphere)
        const tileArcSize = Math.max(tile.latSpan, tile.lonSpan) * this.radius;
        // Apparent angular size from camera's perspective
        const apparentAngularSize = 2 * Math.atan2(tileArcSize / 2, dist);
        const screenSize = apparentAngularSize * pixelsPerRad;
        const shouldSubdivide = screenSize > 120 && tile.z < this.maxLevel;

        if (shouldSubdivide) {
            if (!tile.children) {
                tile.children = [];
                for (let dy = 0; dy < 2; dy++) {
                    for (let dx = 0; dx < 2; dx++) {
                        const child = this.createTile(tile.z + 1, tile.x * 2 + dx, tile.y * 2 + dy, tile);
                        tile.children.push(child);
                        this.group.add(child.mesh);
                    }
                }
            }
            tile.children.forEach(child => this.collectVisible(child, camera, pixelsPerRad, desired));
            // Keep parent mesh visible until all children are loaded to avoid gaps
            const allChildrenLoaded = tile.children.every(c => c.loaded);
            if (tile.mesh) {
                if (allChildrenLoaded) {
                    if (this.group.children.includes(tile.mesh)) {
                        this.group.remove(tile.mesh);
                    }
                } else {
                    if (!this.group.children.includes(tile.mesh)) {
                        this.group.add(tile.mesh);
                    }
                }
            }
        } else {
            if (tile.children) {
                tile.children.forEach(child => this.removeTile(child));
                tile.children = null;
            }
            if (tile.mesh && !this.group.children.includes(tile.mesh)) {
                this.group.add(tile.mesh);
            }
            desired.push(tile);
        }
    }
}
