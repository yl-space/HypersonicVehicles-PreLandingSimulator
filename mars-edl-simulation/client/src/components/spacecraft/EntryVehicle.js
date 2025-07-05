/**
 * EntryVehicle.js - Mars Science Laboratory spacecraft component
 */

import * as THREE from 'three';
import { HeatShield } from '../effects/HeatShield.js';
import { ThrusterFlames } from '../effects/ThrusterFlames.js';

export class EntryVehicle {
    constructor() {
        this.mesh = new THREE.Group();
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        this.scale = 1;
        
        // Vehicle state
        this.altitude = 132000;
        this.speed = 5800;
        this.temperature = 300;
        this.gForce = 0;
        this.phase = 'entry';
        
        // Components
        this.heatShield = null;
        this.thrusterFlames = null;
        this.parachute = null;
        
        this.createGeometry();
        this.createEffects();
    }
    
    createGeometry() {
        // Main aeroshell
        const aeroshellGeometry = new THREE.ConeGeometry(4.5, 3.5, 32);
        const aeroshellMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            shininess: 30
        });
        this.aeroshell = new THREE.Mesh(aeroshellGeometry, aeroshellMaterial);
        this.aeroshell.castShadow = true;
        this.aeroshell.receiveShadow = true;
        this.mesh.add(this.aeroshell);
        
        // Heat shield (bottom)
        const heatShieldGeometry = new THREE.ConeGeometry(4.5, 0.5, 32);
        const heatShieldMaterial = new THREE.MeshPhongMaterial({
            color: 0x2F1B14,
            emissive: 0x331100,
            emissiveIntensity: 0.3
        });
        this.heatShieldMesh = new THREE.Mesh(heatShieldGeometry, heatShieldMaterial);
        this.heatShieldMesh.position.y = -2;
        this.heatShieldMesh.castShadow = true;
        this.mesh.add(this.heatShieldMesh);
        
        // Backshell
        const backshellGeometry = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const backshellMaterial = new THREE.MeshPhongMaterial({
            color: 0xC0C0C0,
            shininess: 50
        });
        this.backshell = new THREE.Mesh(backshellGeometry, backshellMaterial);
        this.backshell.position.y = 1.5;
        this.backshell.castShadow = true;
        this.mesh.add(this.backshell);
        
        // Rover (inside)
        const roverGeometry = new THREE.BoxGeometry(3, 2.5, 4);
        const roverMaterial = new THREE.MeshPhongMaterial({
            color: 0x4169E1,
            shininess: 60
        });
        this.rover = new THREE.Mesh(roverGeometry, roverMaterial);
        this.rover.position.y = 0.5;
        this.rover.castShadow = true;
        this.rover.visible = false; // Hidden until after heat shield separation
        this.mesh.add(this.rover);
        
        // Thruster nozzles
        this.createThrusters();
        
        // Initial scale for distance
        this.mesh.scale.setScalar(100);
    }
    
    createThrusters() {
        this.thrusters = new THREE.Group();
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const thrusterGeometry = new THREE.CylinderGeometry(0.2, 0.3, 1, 8);
            const thrusterMaterial = new THREE.MeshPhongMaterial({
                color: 0x666666,
                shininess: 80
            });
            
            const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
            thruster.position.set(
                Math.cos(angle) * 3,
                1,
                Math.sin(angle) * 3
            );
            thruster.castShadow = true;
            
            this.thrusters.add(thruster);
        }
        
        this.mesh.add(this.thrusters);
    }
    
    createEffects() {
        // Heat shield effects
        this.heatShield = new HeatShield();
        this.mesh.add(this.heatShield.mesh);
        
        // Thruster flames
        this.thrusterFlames = new ThrusterFlames();
        this.mesh.add(this.thrusterFlames.mesh);
    }
    
    updateState(trajectoryData) {
        if (!trajectoryData) return;
        
        // Update position (convert from meters to Three.js units)
        const scale = 0.001; // 1 meter = 0.001 Three.js units
        this.position.set(
            trajectoryData.x * scale,
            trajectoryData.z * scale, // Z becomes Y (up)
            trajectoryData.y * scale
        );
        this.mesh.position.copy(this.position);
        
        // Calculate altitude (assuming Mars radius ~3390 km)
        const marsRadius = 3390000; // meters
        const distanceFromCenter = Math.sqrt(
            trajectoryData.x * trajectoryData.x +
            trajectoryData.y * trajectoryData.y +
            trajectoryData.z * trajectoryData.z
        );
        this.altitude = Math.max(0, distanceFromCenter - marsRadius);
        
        // Update orientation based on velocity
        this.updateOrientation(trajectoryData);
        
        // Update visual effects based on phase
        this.updatePhaseVisuals();
    }
    
    updateOrientation(trajectoryData) {
        // Calculate velocity direction for realistic orientation
        if (this.previousData) {
            const dx = trajectoryData.x - this.previousData.x;
            const dy = trajectoryData.y - this.previousData.y;
            const dz = trajectoryData.z - this.previousData.z;
            
            this.velocity.set(dx, dz, dy);
            this.speed = this.velocity.length() * 100; // Approximate speed
            
            // Orient vehicle in direction of travel
            if (this.velocity.length() > 0) {
                const direction = this.velocity.clone().normalize();
                this.mesh.lookAt(
                    this.mesh.position.clone().add(direction)
                );
            }
        }
        
        this.previousData = { ...trajectoryData };
    }
    
    updatePhaseVisuals() {
        const altitudeKm = this.altitude / 1000;
        
        // Update heat shield intensity
        if (altitudeKm > 60 && altitudeKm < 100) {
            // Peak heating phase
            this.heatShield.setIntensity(1.0);
            this.temperature = 1500;
        } else if (altitudeKm > 30 && altitudeKm < 80) {
            this.heatShield.setIntensity(0.7);
            this.temperature = 1200;
        } else if (altitudeKm > 15 && altitudeKm < 40) {
            this.heatShield.setIntensity(0.4);
            this.temperature = 800;
        } else {
            this.heatShield.setIntensity(0.1);
            this.temperature = 400;
        }
        
        // Thruster firing during terminal descent
        if (altitudeKm < 20 && this.speed > 10) {
            this.thrusterFlames.setActive(true);
        } else {
            this.thrusterFlames.setActive(false);
        }
        
        // G-force calculation (simplified)
        this.gForce = Math.max(0, (this.speed - 500) / 100);
    }
    
    deployParachute() {
        if (this.parachute) return;
        
        // Create parachute geometry
        const parachuteGeometry = new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const parachuteMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF4500,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.parachute = new THREE.Mesh(parachuteGeometry, parachuteMaterial);
        this.parachute.position.y = 15;
        this.parachute.scale.set(0, 0, 0);
        this.mesh.add(this.parachute);
        
        // Animate parachute deployment
        const deployAnimation = () => {
            if (this.parachute.scale.x < 1) {
                this.parachute.scale.addScalar(0.02);
                requestAnimationFrame(deployAnimation);
            }
        };
        deployAnimation();
        
        this.phase = 'parachute';
    }
    
    separateHeatShield() {
        if (!this.heatShieldMesh.parent) return;
        
        // Animate heat shield separation
        const separateAnimation = () => {
            this.heatShieldMesh.position.y -= 0.1;
            this.heatShieldMesh.rotation.x += 0.02;
            
            if (this.heatShieldMesh.position.y > -10) {
                requestAnimationFrame(separateAnimation);
            } else {
                this.mesh.remove(this.heatShieldMesh);
                this.rover.visible = true;
            }
        };
        separateAnimation();
        
        this.phase = 'descent';
    }
    
    update(deltaTime) {
        // Update effects
        if (this.heatShield) {
            this.heatShield.update(deltaTime);
        }
        
        if (this.thrusterFlames) {
            this.thrusterFlames.update(deltaTime);
        }
        
        // Animate parachute swaying
        if (this.parachute && this.parachute.parent) {
            this.parachute.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        // Rotation during descent
        if (this.phase === 'entry') {
            this.mesh.rotation.y += deltaTime * 0.1;
        }
    }
    
    getAltitude() {
        return this.altitude;
    }
    
    getSpeed() {
        return this.speed;
    }
    
    getTemperature() {
        return this.temperature;
    }
    
    getGForce() {
        return this.gForce;
    }
    
    getPhase() {
        return this.phase;
    }
    
    dispose() {
        if (this.heatShield) {
            this.heatShield.dispose();
        }
        
        if (this.thrusterFlames) {
            this.thrusterFlames.dispose();
        }
        
        this.mesh.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}