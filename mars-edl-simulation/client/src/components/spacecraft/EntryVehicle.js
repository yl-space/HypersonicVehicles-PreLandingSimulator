/**
 * EntryVehicle.js
 * Spacecraft component for EDL simulation
 */

import * as THREE from 'three';

export class EntryVehicle {
    constructor() {
        this.group = new THREE.Group();
        this.components = {
            capsule: null,
            heatShield: null,
            backshell: null,
            parachute: null
        };
        
        this.state = {
            heatShieldAttached: true,
            parachuteDeployed: false,
            thrustersActive: false,
            isDeflected: false
        };
        
        this.effects = {
            heatGlow: null,
            thrusters: []
        };
        
        this.lastDeflectionTime = 0;
        
        this.init();
    }
    
    init() {
        this.createCapsule();
        this.createVelocityVector();
        this.createHeatShield();
        this.createBackshell();
        this.createParachute();
        this.createEffects();
    }
    
    createCapsule() {
        const capsuleGroup = new THREE.Group();
        
        const coneGeometry = new THREE.ConeGeometry(0.5, 1, 16);
        const coneMaterial = new THREE.MeshStandardMaterial({
            color: 0xFF4500,
            metalness: 0.3,
            roughness: 0.7,
            emissive: 0xFF4500,
            emissiveIntensity: 0.4
        });
        
        const cone = new THREE.Mesh(coneGeometry, coneMaterial);
        cone.rotation.x = Math.PI;
        cone.position.y = 0.5;
        capsuleGroup.add(cone);
        
        const cylinderGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16);
        const cylinder = new THREE.Mesh(cylinderGeometry, coneMaterial);
        capsuleGroup.add(cylinder);
        
        this.components.capsule = capsuleGroup;
        this.group.add(capsuleGroup);
    }

    createHeatShield() {
        const shieldGeometry = new THREE.CylinderGeometry(0.7, 0.6, 0.1, 32);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x2F1B14,
            emissive: 0x000000,
            metalness: 0.1,
            roughness: 0.9
        });
        
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.y = -0.3;
        
        this.components.heatShield = shield;
        this.group.add(shield);
    }
    
    createBackshell() {
        const backshellGroup = new THREE.Group();
        
        // Conical backshell
        const shellGeometry = new THREE.ConeGeometry(0.55, 0.6, 16);
        const shellMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 0.2,
            roughness: 0.6
        });
        
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        backshellGroup.add(shell);
        
        this.components.backshell = backshellGroup;
        this.group.add(backshellGroup);
    }
    
    createParachute() {
        const parachuteGroup = new THREE.Group();
        
        // Parachute canopy
        const canopyGeometry = new THREE.ConeGeometry(2, 1.5, 16, 8, true);
        const canopyMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6644,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });
        
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = 20;
        parachuteGroup.add(canopy);
        
        // Initially hidden
        parachuteGroup.visible = false;
        parachuteGroup.scale.set(0.1, 0.1, 0.1);
        
        this.components.parachute = parachuteGroup;
        this.group.add(parachuteGroup);
    }
    
    createEffects() {
        // Heat glow effect
        const glowGeometry = new THREE.SphereGeometry(1, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.effects.heatGlow);
        
        // Thruster flames
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const flameGeometry = new THREE.ConeGeometry(0.5, 3, 8);
            const flameMaterial = new THREE.MeshBasicMaterial({
                color: 0xffaa00,
                transparent: true,
                opacity: 0,
                blending: THREE.AdditiveBlending
            });
            
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.x = Math.cos(angle) * 3;
            flame.position.y = -3;
            flame.position.z = Math.sin(angle) * 3;
            flame.rotation.x = Math.PI;
            flame.visible = false;
            
            this.effects.thrusters.push(flame);
            this.group.add(flame);
        }
    }

    createVelocityVector() {
        const arrowHelper = new THREE.ArrowHelper(
            new THREE.Vector3(0, -1, 0),  // Initial direction
            new THREE.Vector3(0, 0, 0),   // Origin
            5,                             // Length
            0x00ff00,                      // Green color
            1,                             // Head length
            0.5                            // Head width
        );
        arrowHelper.name = 'velocityVector';
        this.velocityVector = arrowHelper;
        this.group.add(arrowHelper);
    }
    
    update(time, vehicleData) {
        if (!vehicleData) return;
        
        // Update velocity vector
        if (this.velocityVector && vehicleData.velocity) {
            let velocityDir;
            if (vehicleData.velocity instanceof THREE.Vector3) {
                velocityDir = vehicleData.velocity.clone().normalize();
            } else {
                velocityDir = new THREE.Vector3(0, -1, 0);
            }
            this.velocityVector.setDirection(velocityDir);
            
            // Scale arrow based on velocity magnitude
            const speed = vehicleData.velocityMagnitude || 1000;
            const arrowLength = Math.min(10, speed / 1000);
            this.velocityVector.setLength(arrowLength, arrowLength * 0.2, arrowLength * 0.1);
        }


        // Update heat shield glow based on altitude
        const glowIntensity = Math.max(0, 1 - vehicleData.altitude / 132000);
        this.effects.heatGlow.material.opacity = glowIntensity * 0.5;
        
        // Update heat shield color based on heating
        if (this.state.heatShieldAttached && this.components.heatShield) {
            const heat = glowIntensity;
            this.components.heatShield.material.emissive = new THREE.Color(heat, heat * 0.3, 0);
            this.components.heatShield.material.emissiveIntensity = heat;
        }
        
        // Animate parachute deployment
        if (this.state.parachuteDeployed && this.components.parachute.visible) {
            const targetScale = 1;
            this.components.parachute.scale.lerp(
                new THREE.Vector3(targetScale, targetScale, targetScale), 
                0.05
            );
            
            // Gentle swaying motion
            this.components.parachute.rotation.x = Math.sin(time * 0.5) * 0.05;
            this.components.parachute.rotation.z = Math.cos(time * 0.3) * 0.05;
        }
        
        // Thruster effects
        if (this.state.thrustersActive) {
            this.effects.thrusters.forEach((thruster, i) => {
                thruster.visible = true;
                thruster.material.opacity = 0.6 + Math.random() * 0.2;
            });
        }
        
        // Deflection reaction
        if (this.state.isDeflected) {
            const wobble = Math.sin(time * 10) * 0.1 * Math.exp(-(time - this.lastDeflectionTime));
            this.group.rotation.z = wobble;
            
            if (Date.now() - this.lastDeflectionTime > 1000) {
                this.state.isDeflected = false;
                this.group.rotation.z = 0;
            }
        }
    }
    
    onDeflection() {
        this.state.isDeflected = true;
        this.lastDeflectionTime = Date.now() / 1000;
    }
    
    deployParachute() {
        this.state.parachuteDeployed = true;
        this.components.parachute.visible = true;
        this.components.parachute.scale.set(0.1, 0.1, 0.1);
    }
    
    ejectHeatShield() {
        this.state.heatShieldAttached = false;
        
        const heatShield = this.components.heatShield;
        const duration = 2000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            heatShield.position.y = -2.5 - progress * 50;
            heatShield.rotation.x = progress * Math.PI * 2;
            heatShield.material.opacity = 1 - progress;
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                heatShield.visible = false;
            }
        };
        
        animate();
    }
    
    activateThrusters(active = true) {
        this.state.thrustersActive = active;
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        // Dispose of geometries and materials
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }

    setPosition(position) {
        if (position && position.isVector3) {
            this.group.position.copy(position);
        }
    }
    
    triggerPhaseTransition(phaseName) {
        switch(phaseName) {
            case 'Parachute Deploy':
                this.deployParachute();
                break;
            case 'Heat Shield Separation':
                this.ejectHeatShield();
                break;
            case 'Powered Descent':
                this.activateThrusters(true);
                break;
        }
    }
}