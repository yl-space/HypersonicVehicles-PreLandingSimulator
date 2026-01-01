/**
 * Mars.js - FIXED VERSION
 * Mars planet with correct NASA dimensions
 */

import * as THREE from 'three';
import { PlanetTileManager } from './PlanetTileManager.js';

export class Mars {
    constructor(options = {}) {
        this.group = new THREE.Group();
        // NASA Data: Mars radius = 3,390 km (about half of Earth)
        // Scale: 1 unit = 100 km for visualization
        this.radius = 33.9; // 3,390 km / 100
        this.textures = null;
        this.maxAnisotropy = options.maxAnisotropy || 1;
        this.renderMode = options.renderMode || 'tile'; // 'tile' | 'marsjs' | 'legacy'
        this.useTileLOD = this.renderMode === 'tile';
        this.tileBaseUrl = options.tileBaseUrl || 'https://trek.nasa.gov/tiles/Mars/EQ/corrected/Mars_Viking_MDIM21_ClrMosaic_global_232m';
        this.tileExtension = options.tileExtension || 'png';
        // Lower maxTileLevel by default for faster first-paint; adjust via options if needed
        this.maxTileLevel = options.maxTileLevel ?? 4;
        this.tileManager = null;
        this.marsJSBaseUrl = options.marsJSBaseUrl || '/assets/textures/MarsJS';
        
        this.init();
    }
    
    init() {
        switch (this.renderMode) {
            case 'marsjs':
                this.createMarsJS();
                break;
            case 'tile':
                this.createTiledSurface();
                break;
            default:
                this.createSurface();
                break;
        }
    }
    
    createTiledSurface() {
        this.tileManager = new PlanetTileManager({
            radius: this.radius,
            baseUrl: this.tileBaseUrl,
            maxLevel: this.maxTileLevel,
            minLevel: 1,  // NASA Trek tiles start at level 1, not 0
            segments: 12,
            anisotropy: this.maxAnisotropy,
            extension: this.tileExtension
        });
        this.group.add(this.tileManager.getObject3D());
    }

    createMarsJS() {
        const loader = new THREE.TextureLoader();
        const colorMap = loader.load(`${this.marsJSBaseUrl}/mars.jpg`);
        const normalMap = loader.load(`${this.marsJSBaseUrl}/Blended_NRM.png`);
        const dispMap = loader.load(`${this.marsJSBaseUrl}/Blended_DISP.jpg`);

        [colorMap, normalMap, dispMap].forEach(tex => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = this.maxAnisotropy;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
            tex.magFilter = THREE.LinearFilter;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
        });

        const material = new THREE.MeshBasicMaterial({
            map: colorMap,
            color: 0xffffff,
            side: THREE.DoubleSide,
            toneMapped: false
        });
        material.color.multiplyScalar(1.6); // brighten unlit marsjs surface

        const segments = 192;
        const geometry = new THREE.SphereGeometry(this.radius, segments, segments / 2);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        this.group.add(mesh);

        // Keep reference for disposal
        this.lodMeshes = [mesh];
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

        // Fully lit surface: use unshaded material at all LODs (no day/night or shadows)
        return new THREE.MeshBasicMaterial({
            map: colorMap,
            color: 0xffffff,
            side: THREE.DoubleSide
        });
    }
    
    update(camera, deltaTime, renderer = null) {
        // No rotation - Mars remains stationary in J2000 reference frame
        if (this.tileManager) {
            this.tileManager.update(camera, renderer);
        } else if (this.surfaceLOD) {
            this.surfaceLOD.update(camera);
        }
    }
    
    getObject3D() {
        return this.group;
    }
    
    getRadius() {
        return this.radius;
    }
    
    dispose() {
        this.lodMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        if (this.tileManager) {
            this.tileManager.dispose();
        }
    }
}
