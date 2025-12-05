/**
 * Mars.js - FIXED VERSION
 * Mars planet with correct NASA dimensions
 */

import * as THREE from 'three';

export class Mars {
    constructor(options = {}) {
        this.group = new THREE.Group();
        // NASA Data: Mars radius = 3,390 km (about half of Earth)
        // Scale: 1 unit = 100 km for visualization
        this.radius = 33.9; // 3,390 km / 100
        this.textures = null;
        this.maxAnisotropy = options.maxAnisotropy || 1;
        this.tiles = [];
        this.tileGroup = null;
        this.tileMaps = [];
        this.tileMaterials = [];
        this.tileConfig = {
            rows: 4,
            cols: 8,
            lodLevels: [
                { detail: 'ultra', segments: 64, maxDistance: 50 },
                { detail: 'high', segments: 48, maxDistance: 150 },
                { detail: 'medium', segments: 32, maxDistance: 300 },
                { detail: 'low', segments: 16, maxDistance: Infinity }
            ]
        };
        
        this.init();
    }
    
    init() {
        this.createSurface();
        // Surface features removed for clean visualization
    }
    
    createSurface() {
        const loader = new THREE.TextureLoader();
        this.textures = {
            colorUltra: loader.load('/assets/textures/Mars/Mars_color_16k.jpg'),
            colorHigh: loader.load('/assets/textures/Mars/Mars_color_8k.jpg'),
            colorMedium: loader.load('/assets/textures/Mars/Mars_color_4k.jpg'),
            colorLow: loader.load('/assets/textures/Mars/Mars_color_2k.jpg'),
            normal: loader.load('/assets/textures/Mars/Mars_normal_4k.png')
        };

        Object.values(this.textures).forEach(tex => {
            if (!tex) return;
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.anisotropy = this.maxAnisotropy;
            tex.generateMipmaps = true;
        });

        this.buildTiledSurface();
    }

    buildTiledSurface() {
        this.tileGroup = new THREE.Group();
        const { rows, cols, lodLevels } = this.tileConfig;

        const thetaLength = (Math.PI * 2) / cols;
        const phiLength = Math.PI / rows;
        const uvRepeat = new THREE.Vector2(1 / cols, 1 / rows);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const thetaStart = col * thetaLength;
                const phiStart = row * phiLength;

                const tile = this.createTile({
                    row,
                    col,
                    thetaStart,
                    thetaLength,
                    phiStart,
                    phiLength,
                    uvRepeat,
                    lodLevels
                });

                this.tileGroup.add(tile.group);
                this.tiles.push(tile);
            }
        }

        this.group.add(this.tileGroup);
    }

    createTile({ row, col, thetaStart, thetaLength, phiStart, phiLength, uvRepeat, lodLevels }) {
        const tileGroup = new THREE.Group();
        const uvOffset = new THREE.Vector2(col * uvRepeat.x, row * uvRepeat.y);

        const levels = lodLevels.map((level, index) => {
            const mesh = this.createTileMesh({
                segments: level.segments,
                detail: level.detail,
                thetaStart,
                thetaLength,
                phiStart,
                phiLength,
                uvRepeat,
                uvOffset
            });
            mesh.visible = index === 0;
            tileGroup.add(mesh);
            return {
                mesh,
                maxDistance: level.maxDistance
            };
        });

        const center = new THREE.Vector3().setFromSpherical(
            new THREE.Spherical(
                this.radius,
                phiStart + (phiLength / 2),
                thetaStart + (thetaLength / 2)
            )
        );

        return { group: tileGroup, levels, center };
    }

    createTileMesh({ segments, detail, thetaStart, thetaLength, phiStart, phiLength, uvRepeat, uvOffset }) {
        const geometry = new THREE.SphereGeometry(
            this.radius,
            segments,
            Math.max(segments / 2, 12),
            thetaStart,
            thetaLength,
            phiStart,
            phiLength
        );
        const material = this.buildMaterial(detail, { uvRepeat, uvOffset });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }

    buildMaterial(detail, uvTransform = {}) {
        if (!this.textures) {
            const loader = new THREE.TextureLoader();
            this.textures = {
                colorHigh: loader.load('/assets/textures/Mars/Mars.jpg')
            };
        }

        const colorMap =
            detail === 'ultra'
                ? (this.textures.colorUltra || this.textures.colorHigh)
                : detail === 'high'
                    ? (this.textures.colorHigh || this.textures.colorMedium)
                    : detail === 'medium'
                        ? (this.textures.colorMedium || this.textures.colorLow || this.textures.colorHigh)
                        : (this.textures.colorLow || this.textures.colorMedium || this.textures.colorHigh);

        const tiledColorMap = this.createTiledMap(colorMap, uvTransform);
        const tiledNormalMap = (this.textures.normal && (detail === 'ultra' || detail === 'high' || detail === 'medium'))
            ? this.createTiledMap(this.textures.normal, uvTransform, true)
            : null;

        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: tiledColorMap,
                color: 0xffffff
            });
        }

        const mat = new THREE.MeshPhongMaterial({
            map: tiledColorMap,
            shininess: detail === 'ultra' ? 16 : detail === 'high' ? 12 : 6,
            side: THREE.DoubleSide
        });

        if (tiledNormalMap) {
            mat.normalMap = tiledNormalMap;
            mat.normalScale = new THREE.Vector2(0.7, 0.7);
        }

        this.tileMaterials.push(mat);
        return mat;
    }

    createTiledMap(texture, uvTransform, isNormal = false) {
        if (!texture) return null;

        const map = texture.clone();
        map.repeat.copy(uvTransform.uvRepeat || new THREE.Vector2(1, 1));
        map.offset.copy(uvTransform.uvOffset || new THREE.Vector2(0, 0));
        map.wrapS = THREE.ClampToEdgeWrapping;
        map.wrapT = THREE.ClampToEdgeWrapping;
        map.anisotropy = this.maxAnisotropy;
        map.needsUpdate = true;

        this.tileMaps.push(map);
        return map;
    }
    
    update(camera, deltaTime) {
        // No rotation - Mars remains stationary in J2000 reference frame
        if (camera && this.tiles.length) {
            const cameraPosition = camera.position;
            this.tiles.forEach(tile => {
                const distance = cameraPosition.distanceTo(tile.center);
                let selected = tile.levels.length - 1;

                for (let i = 0; i < tile.levels.length; i++) {
                    if (distance < tile.levels[i].maxDistance) {
                        selected = i;
                        break;
                    }
                }

                tile.levels.forEach((level, idx) => {
                    level.mesh.visible = idx === selected;
                });
            });
        }
    }
    
    getObject3D() {
        return this.group;
    }
    
    getRadius() {
        return this.radius;
    }
    
    dispose() {
        this.tiles.forEach(tile => {
            tile.levels.forEach(level => {
                level.mesh.geometry.dispose();
                if (level.mesh.material && level.mesh.material.dispose) {
                    level.mesh.material.dispose();
                }
            });
        });

        this.tileMaps.forEach(map => map.dispose?.());
        this.tileMaterials.forEach(mat => mat.dispose?.());
    }
}
