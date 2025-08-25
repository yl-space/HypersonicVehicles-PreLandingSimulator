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
        this.surface = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        // Surface features removed for clean visualization
    }
    
    createSurface() {
        // Create Mars sphere with high detail
        const geometry = new THREE.SphereGeometry(this.radius, 128, 64);
        
        // Load textures from assets
        const textureLoader = new THREE.TextureLoader();
        const marsTexture = textureLoader.load('/assets/textures/Mars/Mars.jpg');
        const marsNormal = textureLoader.load('/assets/textures/Mars/Mars_normal.jpg');
        const marsSpecular = textureLoader.load('/assets/textures/Mars/Mars_specular.jpg');
        
        const material = new THREE.MeshPhongMaterial({
            map: marsTexture,
            normalMap: marsNormal,
            normalScale: new THREE.Vector2(1, 1),
            specularMap: marsSpecular,
            specular: new THREE.Color(0x222222),
            shininess: 10
        });
        
        this.surface = new THREE.Mesh(geometry, material);
        this.surface.receiveShadow = true;
        this.surface.castShadow = true;
        
        // Position Mars at origin (0,0,0) for J2000 frame
        this.surface.position.set(0, 0, 0);
        this.group.add(this.surface);
    }
    
    update(camera, deltaTime) {
        // No rotation - Mars remains stationary in J2000 reference frame
    }
    
    getObject3D() {
        return this.group;
    }
    
    getRadius() {
        return this.radius;
    }
    
    dispose() {
        if (this.surface) {
            this.surface.geometry.dispose();
            this.surface.material.dispose();
        }
    }
}