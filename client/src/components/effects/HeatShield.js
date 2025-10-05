import * as THREE from '/node_modules/three/build/three.module.js';

export class HeatShield {
    constructor() {
        this.mesh = new THREE.Group();
        this.intensity = 0;
        this.particles = null;
        this.createEffect();
    }
    
    createEffect() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 10;
            positions[i3 + 1] = Math.random() * -5;
            positions[i3 + 2] = (Math.random() - 0.5) * 10;
            
            colors[i3] = 1;
            colors[i3 + 1] = Math.random() * 0.5;
            colors[i3 + 2] = 0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.mesh.add(this.particles);
    }
    
    setIntensity(intensity) {
        this.intensity = Math.max(0, Math.min(1, intensity));
        if (this.particles) {
            this.particles.material.opacity = this.intensity * 0.8;
            this.particles.visible = this.intensity > 0.1;
        }
    }
    
    update(deltaTime) {
        if (!this.particles || this.intensity <= 0) return;
        
        const positions = this.particles.geometry.attributes.position.array;
        for (let i = 0; i < positions.length; i += 3) {
            positions[i + 1] -= deltaTime * 20 * this.intensity;
            if (positions[i + 1] < -10) {
                positions[i + 1] = 0;
            }
        }
        this.particles.geometry.attributes.position.needsUpdate = true;
    }
    
    dispose() {
        if (this.particles) {
            this.particles.geometry.dispose();
            this.particles.material.dispose();
        }
    }
}