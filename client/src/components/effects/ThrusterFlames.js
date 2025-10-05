import * as THREE from '/node_modules/three/build/three.module.js';

export class ThrusterFlames {
    constructor() {
        this.mesh = new THREE.Group();
        this.isActive = false;
        this.flames = [];
        this.createFlames();
    }
    
    createFlames() {
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const flameGeometry = new THREE.ConeGeometry(0.3, 2, 8);
            const flameMaterial = new THREE.MeshBasicMaterial({
                color: 0xFF4500,
                transparent: true,
                opacity: 0.8
            });
            
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.set(
                Math.cos(angle) * 3,
                -1,
                Math.sin(angle) * 3
            );
            flame.visible = false;
            
            this.flames.push(flame);
            this.mesh.add(flame);
        }
    }
    
    setActive(active) {
        this.isActive = active;
        this.flames.forEach(flame => {
            flame.visible = active;
        });
    }
    
    update(deltaTime) {
        if (!this.isActive) return;
        
        this.flames.forEach((flame, i) => {
            const flickerIntensity = 0.8 + Math.sin(Date.now() * 0.01 + i) * 0.2;
            flame.scale.y = flickerIntensity;
            flame.material.opacity = 0.6 + Math.random() * 0.4;
        });
    }
    
    dispose() {
        this.flames.forEach(flame => {
            flame.geometry.dispose();
            flame.material.dispose();
        });
    }
}