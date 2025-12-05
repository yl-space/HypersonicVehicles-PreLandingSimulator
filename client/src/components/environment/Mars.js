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
        this.surfaceLOD = null;
        this.lodMeshes = [];
        this.textures = null;
        this.maxAnisotropy = options.maxAnisotropy || 1;
        
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

        this.surfaceLOD = new THREE.LOD();
        this.group.add(this.surfaceLOD);

        const levels = [
            { segments: 128, distance: 0, detail: 'ultra' },
            { segments: 96, distance: 60, detail: 'high' },
            { segments: 48, distance: 120, detail: 'medium' },
            { segments: 24, distance: 180, detail: 'low' }
        ];

        levels.forEach(level => {
            const mesh = this.createSurfaceMesh(level);
            this.surfaceLOD.addLevel(mesh, level.distance);
            this.lodMeshes.push(mesh);
        });
    }

    createSurfaceMesh({ segments, detail }) {
        const geometry = new THREE.SphereGeometry(this.radius, segments, Math.max(segments / 2, 12));
        const material = this.buildMaterial(detail);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.position.set(0, 0, 0);
        return mesh;
    }

    buildMaterial(detail) {
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
    
    update(camera, deltaTime) {
        // No rotation - Mars remains stationary in J2000 reference frame
        if (this.surfaceLOD) {
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
    }
}
