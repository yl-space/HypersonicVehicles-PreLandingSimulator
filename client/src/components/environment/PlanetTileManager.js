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

        this.root = null;
        this.group = new THREE.Group();
        this.tileCache = new Map(); // key -> tile
        this.textureCache = new Map(); // url -> texture
        this.lru = [];
        this.maxTextures = 64;
        this.loader = new THREE.TextureLoader();
        this.loader.crossOrigin = 'anonymous';

        this.init();
    }

    init() {
        this.root = this.createTile(0, 0, 0);
        this.group.add(this.root.mesh);
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
        const tilesAtLevel = 1 << z;
        const lonLeft = -Math.PI + (2 * Math.PI * x) / tilesAtLevel;
        const lonRight = -Math.PI + (2 * Math.PI * (x + 1)) / tilesAtLevel;
        const latTop = Math.PI / 2 - (Math.PI * y) / tilesAtLevel;
        const latBottom = Math.PI / 2 - (Math.PI * (y + 1)) / tilesAtLevel;

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

                verts.push(
                    this.radius * cosLat * cosLon,
                    this.radius * sinLat,
                    this.radius * cosLat * sinLon
                );
                uvs.push((lon + Math.PI) / (2 * Math.PI), 1 - (lat + Math.PI / 2) / Math.PI);
            }
        }

        for (let iy = 0; iy < this.segments; iy++) {
            for (let ix = 0; ix < this.segments; ix++) {
                const a = iy * (this.segments + 1) + ix;
                const b = a + this.segments + 1;
                indices.push(a, b, a + 1);
                indices.push(b, b + 1, a + 1);
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
        const url = `${this.baseUrl}/${tile.z}/${tile.x}/${tile.y}.${this.extension}`;
        if (this.textureCache.has(url)) {
            this.setTileTexture(tile, this.textureCache.get(url));
            return;
        }
        tile.loading = true;
        this.loader.load(
            url,
            (tex) => {
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
            },
            undefined,
            () => {
                tile.loading = false;
            }
        );
    }

    setTileTexture(tile, texture) {
        if (tile.mesh?.material) {
            tile.mesh.material.map = texture;
            tile.mesh.material.needsUpdate = true;
            tile.loaded = true;
            tile.loading = false;
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

    update(camera, renderer) {
        if (!camera || !this.root) return;
        const viewportHeight = renderer?.domElement?.clientHeight || window.innerHeight || 1080;
        const fovRad = (camera.fov || 50) * (Math.PI / 180);
        const pixelsPerRad = viewportHeight / fovRad;

        const desired = [];
        this.collectVisible(this.root, camera, pixelsPerRad, desired);

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
        const dist = camera.position.distanceTo(tile.center);
        const angularSize = Math.max(tile.latSpan, tile.lonSpan);
        const screenSize = angularSize * pixelsPerRad;
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
            if (tile.mesh && this.group.children.includes(tile.mesh)) {
                this.group.remove(tile.mesh);
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
