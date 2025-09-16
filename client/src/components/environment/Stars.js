/**
 * Stars.js
 * Creates a starfield background using texture tiling
 */

import * as THREE from '/node_modules/three/build/three.module.js';

export class Stars {
    constructor() {
        this.group = new THREE.Group();
        
        this.init();
    }
    
    init() {
        // Only use texture-based starfield with tiling
        this.createStarfieldSkybox();
    }
    
    createStarfieldSkybox() {
        // Load and configure starfield texture with tiling
        const textureLoader = new THREE.TextureLoader();
        const starfieldTexture = textureLoader.load('/assets/textures/starfield.png');
        
        // Configure texture to repeat/tile for better coverage
        starfieldTexture.wrapS = THREE.RepeatWrapping;
        starfieldTexture.wrapT = THREE.RepeatWrapping;
        starfieldTexture.repeat.set(10, 10); // Tile 10x10 for dense star coverage
        starfieldTexture.minFilter = THREE.LinearMipmapLinearFilter;
        starfieldTexture.magFilter = THREE.LinearFilter;
        
        // Create a box skybox for better texture distribution
        const skyboxSize = 100000;
        const skyboxGeometry = new THREE.BoxGeometry(skyboxSize, skyboxSize, skyboxSize);
        
        // Create material array for each face of the cube
        const materials = [];
        for (let i = 0; i < 6; i++) {
            materials.push(new THREE.MeshBasicMaterial({
                map: starfieldTexture.clone(),
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: true,
                fog: false
            }));
            // Vary the tiling for each face to create variety
            materials[i].map.repeat.set(8 + i, 8 + i);
        }
        
        const skybox = new THREE.Mesh(skyboxGeometry, materials);
        skybox.renderOrder = -1; // Render skybox first
        this.group.add(skybox);
    }
    
    update(deltaTime) {
        // Slowly rotate the entire starfield for subtle movement
        this.group.rotation.y += deltaTime * 0.00001;
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        // Clean up skybox resources
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}