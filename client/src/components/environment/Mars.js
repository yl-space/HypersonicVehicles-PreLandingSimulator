/**
 * Mars.js - FIXED VERSION
 * Mars planet with correct NASA dimensions
 */

import * as THREE from 'three';

export class Mars {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Mars radius = 3,390 km (about half of Earth)
        // Scale: 1 unit = 100 km for visualization
        this.radius = 33.9; // 3,390 km / 100
        this.surfaceLOD = null;
        this.lodMeshes = [];
        this.textures = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        // Surface features removed for clean visualization
    }
    
    createSurface() {
        const loader = new THREE.TextureLoader();
        this.textures = {
            color: loader.load('/assets/textures/Mars/Mars.jpg'),
            normal: loader.load('/assets/textures/Mars/Mars_normal.jpg'),
            specular: loader.load('/assets/textures/Mars/Mars_specular.jpg')
        };

        this.surfaceLOD = new THREE.LOD();
        this.group.add(this.surfaceLOD);

        const levels = [
            { segments: 96, distance: 0, detail: 'high' },
            { segments: 48, distance: 80, detail: 'medium' },
            { segments: 24, distance: 140, detail: 'low' }
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
        mesh.castShadow = detail !== 'low';
        mesh.receiveShadow = true;
        mesh.position.set(0, 0, 0);
        return mesh;
    }

    buildMaterial(detail) {
        if (!this.textures) {
            const loader = new THREE.TextureLoader();
            this.textures = {
                color: loader.load('/assets/textures/Mars/Mars.jpg')
            };
        }

        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: this.textures.color,
                color: 0xffffff
            });
        }

        const mat = new THREE.MeshPhongMaterial({
            map: this.textures.color,
            shininess: detail === 'high' ? 12 : 6,
            side: THREE.DoubleSide
        });

        if (this.textures.normal && detail === 'high') {
            mat.normalMap = this.textures.normal;
            mat.normalScale = new THREE.Vector2(1, 1);
        }

        if (this.textures.specular && detail !== 'low') {
            mat.specularMap = this.textures.specular;
            mat.specular = new THREE.Color(0x222222);
        }

        return mat;
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
