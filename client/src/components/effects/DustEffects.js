/**
 * DustEffects.js
 * Atmospheric dust and particle effects
 */

import * as THREE from 'three';

export class DustEffects {
    constructor() {
        this.group = new THREE.Group();
        this.particles = null;
        this.isActive = false;
        this.intensity = 0;
        
        this.init();
    }
    
    init() {
        this.createDustParticles();
    }
    
    createDustParticles() {
        const particleCount = 2000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Distribute particles in a sphere around the vehicle
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 20 + Math.random() * 50;
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.cos(phi);
            positions[i3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
            
            // Dust color (brownish/reddish)
            colors[i3] = 0.8 + Math.random() * 0.2;     // R
            colors[i3 + 1] = 0.6 + Math.random() * 0.2; // G
            colors[i3 + 2] = 0.3 + Math.random() * 0.2; // B
            
            sizes[i] = 0.5 + Math.random() * 2;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.particles.visible = false;
        this.group.add(this.particles);
    }
    
    setActive(active) {
        this.isActive = active;
        if (this.particles) {
            this.particles.visible = active;
        }
    }
    
    setIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity));
        if (this.particles) {
            this.particles.material.opacity = this.intensity * 0.6;
        }
    }
    
    update(deltaTime) {
        if (!this.isActive || !this.particles) return;
        
        // Animate dust particles
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            // Simple wind effect
            positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.1;
            positions[i + 1] += Math.cos(Date.now() * 0.0015 + i) * 0.05;
            positions[i + 2] += Math.sin(Date.now() * 0.0008 + i) * 0.08;
        }
        
        this.particles.geometry.attributes.position.needsUpdate = true;
        this.particles.rotation.y += deltaTime * 0.0001;
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
    }
}
