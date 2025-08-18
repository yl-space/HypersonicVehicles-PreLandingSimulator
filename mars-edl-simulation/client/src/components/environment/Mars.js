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
        this.createSurfaceFeatures();
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
    
    // createSurfaceFeatures() {
    //     // Major surface features markers
    //     const features = [
    //         { name: 'Olympus Mons', lat: 18.65, lon: 226.2, scale: 30 },
    //         { name: 'Valles Marineris', lat: -14, lon: 301, scale: 50 },
    //         { name: 'Hellas Planitia', lat: -42.5, lon: 70, scale: 40 }
    //     ];
        
    //     features.forEach(feature => {
    //         const phi = (90 - feature.lat) * Math.PI / 180;
    //         const theta = feature.lon * Math.PI / 180;
            
    //         const x = this.radius * Math.sin(phi) * Math.cos(theta);
    //         const y = this.radius * Math.cos(phi);
    //         const z = this.radius * Math.sin(phi) * Math.sin(theta);
            
    //         // Add subtle marker
    //         const markerGeometry = new THREE.SphereGeometry(feature.scale, 8, 8);
    //         const markerMaterial = new THREE.MeshBasicMaterial({
    //             color: 0x663300,
    //             opacity: 0.3,
    //             transparent: true
    //         });
            
    //         const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    //         marker.position.set(x, y, z);
    //         this.group.add(marker);
    //     });
    // }
    
    update(camera, deltaTime) {
        // Slow rotation (Mars day = 24.6 hours)
        // For visualization, we'll make it rotate slowly
        this.surface.rotation.y += deltaTime * 0.01;
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