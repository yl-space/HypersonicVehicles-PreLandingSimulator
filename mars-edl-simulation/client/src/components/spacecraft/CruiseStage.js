
// client/src/components/spacecraft/CruiseStage.js
import * as THREE from 'three';

/**
 * CruiseStage Component
 * Demonstrates modular 3D component design with lifecycle methods
 */
export class CruiseStage {
    constructor() {
        // Create a Group to hold all parts of this component
        // Groups allow us to move/rotate multiple objects as one
        this.group = new THREE.Group();
        this.group.name = 'CruiseStage';
        
        // Component state
        this.isActive = false;
        this.rotationSpeed = 0.5;
        
        // Build the 3D model
        this.createGeometry();
        this.createSolarPanels();
        
        // Setup animation properties
        this.animationMixers = [];
    }
    
    createGeometry() {
        // Main body - using BufferGeometry for performance
        const bodyGeometry = new THREE.CylinderGeometry(3, 3, 4, 16);
        
        // PBR (Physically Based Rendering) material for realism
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            metalness: 0.7,      // How metallic (0-1)
            roughness: 0.3,      // How rough (0-1)
            envMapIntensity: 1   // Environment reflection strength
        });
        
        this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.body.castShadow = true;
        this.body.receiveShadow = true;
        
        // Add detail with normal maps (simulated surface detail)
        this.loadTextures();
        
        this.group.add(this.body);
    }
    
    createSolarPanels() {
        // Solar panel geometry - demonstrating instanced meshes for performance
        const panelGeometry = new THREE.BoxGeometry(8, 0.1, 3);
        
        // Custom shader material for solar panel effect
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0x000080,
            metalness: 0.9,
            roughness: 0.1,
            emissive: 0x000033,
            emissiveIntensity: 0.2
        });
        
        // Create two panels
        const panelPositions = [
            { x: 5.5, rotation: 0 },
            { x: -5.5, rotation: Math.PI }
        ];
        
        this.solarPanels = [];
        panelPositions.forEach((pos, index) => {
            const panel = new THREE.Mesh(panelGeometry, panelMaterial);
            panel.position.set(pos.x, 0, 0);
            panel.rotation.y = pos.rotation;
            panel.castShadow = true;
            
            // Add solar cell texture pattern
            this.addSolarCellPattern(panel);
            
            this.solarPanels.push(panel);
            this.group.add(panel);
        });
    }
    
    addSolarCellPattern(panel) {
        // Create a grid pattern for solar cells using a canvas texture
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        
        // Draw grid pattern
        ctx.fillStyle = '#000040';
        ctx.fillRect(0, 0, 256, 128);
        ctx.strokeStyle = '#0000aa';
        ctx.lineWidth = 1;
        
        for (let x = 0; x < 256; x += 16) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 128);
            ctx.stroke();
        }
        
        for (let y = 0; y < 128; y += 16) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(256, y);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        panel.material.map = texture;
        panel.material.needsUpdate = true;
    }
    
    async loadTextures() {
        // Texture loading with proper error handling
        const textureLoader = new THREE.TextureLoader();
        
        try {
            const normalMap = await textureLoader.loadAsync('/assets/textures/metal_normal.jpg');
            this.body.material.normalMap = normalMap;
            this.body.material.normalScale = new THREE.Vector2(0.5, 0.5);
        } catch (error) {
            console.warn('Failed to load normal map:', error);
        }
    }
    
    update(deltaTime, simulationData) {
        // Update method called every frame
        if (!this.isActive) return;
        
        // Rotate the spacecraft
        this.group.rotation.y += this.rotationSpeed * deltaTime;
        
        // Animate solar panels based on sun direction
        if (simulationData.sunDirection) {
            this.orientSolarPanels(simulationData.sunDirection);
        }
    }
    
    orientSolarPanels(sunDirection) {
        // Calculate optimal panel angle towards sun
        this.solarPanels.forEach((panel, index) => {
            const targetAngle = Math.atan2(sunDirection.x, sunDirection.z);
            // Smooth rotation using lerp
            panel.rotation.y = THREE.MathUtils.lerp(
                panel.rotation.y,
                targetAngle + (index * Math.PI),
                0.02
            );
        });
    }
    
    activate() {
        this.isActive = true;
        this.group.visible = true;
    }
    
    deactivate() {
        this.isActive = false;
        this.group.visible = false;
    }
    
    dispose() {
        // Clean up resources
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                if (child.material.normalMap) child.material.normalMap.dispose();
                child.material.dispose();
            }
        });
    }
}