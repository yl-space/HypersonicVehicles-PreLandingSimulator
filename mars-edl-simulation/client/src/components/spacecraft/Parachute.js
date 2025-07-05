/**
 * Parachute.js
 * Supersonic parachute component for Mars EDL
 */

import * as THREE from 'three';

export class Parachute extends THREE.Group {
    constructor() {
        super();
        
        // Parachute parameters (based on MSL)
        this.canopyDiameter = 21.5; // meters
        this.lineLength = 50; // meters
        this.isDeployed = false;
        this.deploymentProgress = 0;
        this.inflationProgress = 0;
        
        // Components
        this.canopy = null;
        this.lines = [];
        this.riserLines = [];
        
        // Physics simulation
        this.dragCoefficient = 0.65; // Supersonic parachute
        this.swayAmplitude = 0;
        this.swayFrequency = 0.5;
        this.swayPhase = Math.random() * Math.PI * 2;
        
        this.init();
    }
    
    init() {
        // Create folded parachute (initial state)
        this.createFoldedParachute();
        
        // Prepare inflated parachute geometry
        this.createInflatedParachute();
        
        // Create suspension lines
        this.createSuspensionLines();
        
        // Initially hide everything
        this.visible = false;
    }
    
    createFoldedParachute() {
        // Small cylinder representing packed parachute
        const geometry = new THREE.CylinderGeometry(0.5, 0.5, 2, 16);
        const material = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            metalness: 0.1,
            roughness: 0.8
        });
        
        this.foldedChute = new THREE.Mesh(geometry, material);
        this.foldedChute.position.y = 5; // Above vehicle
        this.add(this.foldedChute);
    }
    
    createInflatedParachute() {
        // Create canopy using custom geometry for realistic shape
        const canopyGroup = new THREE.Group();
        
        // Main canopy - hemisphere shape
        const segments = 32;
        const rings = 16;
        const geometry = new THREE.SphereGeometry(
            this.canopyDiameter / 2,
            segments,
            rings,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.6  // Less than full hemisphere
        );
        
        // Modify vertices for parachute shape
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            // Create scalloped edge effect
            const angle = Math.atan2(x, z);
            const scallop = 1 + Math.sin(angle * 16) * 0.05;
            
            // Flatten top slightly
            const newY = y * 0.8 * scallop;
            positions.setY(i, newY);
        }
        geometry.computeVertexNormals();
        
        // Parachute material with both sides visible
        const canopyMaterial = new THREE.MeshPhysicalMaterial({
            color: 0xFF6B00, // Orange/red for visibility
            metalness: 0,
            roughness: 0.7,
            transmission: 0.1,
            thickness: 0.1,
            side: THREE.DoubleSide,
            emissive: 0xFF6B00,
            emissiveIntensity: 0.1
        });
        
        this.canopyMesh = new THREE.Mesh(geometry, canopyMaterial);
        this.canopyMesh.rotation.x = Math.PI;
        this.canopyMesh.castShadow = true;
        canopyGroup.add(this.canopyMesh);
        
        // Add reinforcement bands
        const bandGeometry = new THREE.TorusGeometry(
            this.canopyDiameter / 2,
            0.1,
            8,
            segments
        );
        const bandMaterial = new THREE.MeshStandardMaterial({
            color: 0xFFFFFF,
            metalness: 0.3,
            roughness: 0.5
        });
        
        for (let i = 0; i < 3; i++) {
            const band = new THREE.Mesh(bandGeometry, bandMaterial);
            band.position.y = -i * 2 - 2;
            band.rotation.x = Math.PI / 2;
            canopyGroup.add(band);
        }
        
        // Add vent at top
        const ventGeometry = new THREE.RingGeometry(0.5, 1, 16);
        const ventMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.5
        });
        const vent = new THREE.Mesh(ventGeometry, ventMaterial);
        vent.rotation.x = -Math.PI / 2;
        vent.position.y = -0.1;
        canopyGroup.add(vent);
        
        this.canopy = canopyGroup;
        this.canopy.scale.set(0.01, 0.01, 0.01); // Start small
        this.add(this.canopy);
    }
    
    createSuspensionLines() {
        const lineCount = 32;
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xCCCCCC,
            transparent: true,
            opacity: 0.8
        });
        
        // Create suspension lines from canopy to confluence point
        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2;
            const radius = this.canopyDiameter / 2 * 0.95;
            
            // Line from canopy edge to confluence point
            const points = [
                new THREE.Vector3(
                    Math.cos(angle) * radius,
                    -2, // Canopy bottom
                    Math.sin(angle) * radius
                ),
                new THREE.Vector3(0, -this.lineLength, 0) // Confluence point
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            line.visible = false;
            
            this.lines.push(line);
            this.add(line);
        }
        
        // Create riser lines from confluence to attachment points
        const riserCount = 3;
        for (let i = 0; i < riserCount; i++) {
            const angle = (i / riserCount) * Math.PI * 2;
            const attachRadius = 2; // Vehicle attachment radius
            
            const points = [
                new THREE.Vector3(0, -this.lineLength, 0),
                new THREE.Vector3(
                    Math.cos(angle) * attachRadius,
                    -this.lineLength - 5,
                    Math.sin(angle) * attachRadius
                )
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            line.visible = false;
            
            this.riserLines.push(line);
            this.add(line);
        }
    }
    
    // Deploy parachute
    deploy() {
        if (this.isDeployed) return;
        
        this.isDeployed = true;
        this.visible = true;
        this.deploymentProgress = 0;
        this.inflationProgress = 0;
        
        // Start deployment animation
        this.animateDeployment();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('parachute-deployed', {
            detail: { parachute: this }
        }));
    }
    
    animateDeployment() {
        const deployDuration = 2000; // 2 seconds
        const inflationDuration = 1500; // 1.5 seconds
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            
            // Deployment phase (lines extend)
            if (elapsed < deployDuration) {
                this.deploymentProgress = elapsed / deployDuration;
                this.updateDeployment();
                requestAnimationFrame(animate);
            }
            // Inflation phase (canopy inflates)
            else if (elapsed < deployDuration + inflationDuration) {
                this.deploymentProgress = 1;
                this.inflationProgress = (elapsed - deployDuration) / inflationDuration;
                this.updateInflation();
                requestAnimationFrame(animate);
            } else {
                // Fully deployed
                this.deploymentProgress = 1;
                this.inflationProgress = 1;
                this.updateInflation();
                this.foldedChute.visible = false;
            }
        };
        
        animate();
    }
    
    updateDeployment() {
        // Show lines progressively
        const visibleLines = Math.floor(this.deploymentProgress * this.lines.length);
        this.lines.forEach((line, i) => {
            line.visible = i < visibleLines;
        });
        
        // Show riser lines at end of deployment
        const showRisers = this.deploymentProgress > 0.8;
        this.riserLines.forEach(line => {
            line.visible = showRisers;
        });
        
        // Move folded chute up
        this.foldedChute.position.y = 5 + this.deploymentProgress * 20;
    }
    
    updateInflation() {
        // Inflate canopy
        const scale = this.inflationProgress;
        const eased = 1 - Math.pow(1 - scale, 3); // Ease out cubic
        
        this.canopy.scale.set(eased, eased * 0.8, eased);
        this.canopy.position.y = this.lineLength * this.deploymentProgress;
        
        // Make canopy visible when inflation starts
        this.canopy.visible = this.inflationProgress > 0;
        
        // Update line positions to match inflating canopy
        const canopyRadius = (this.canopyDiameter / 2) * eased * 0.95;
        
        this.lines.forEach((line, i) => {
            const angle = (i / this.lines.length) * Math.PI * 2;
            const positions = line.geometry.attributes.position;
            
            // Update canopy attachment point
            positions.setXYZ(0,
                Math.cos(angle) * canopyRadius,
                this.canopy.position.y - 2,
                Math.sin(angle) * canopyRadius
            );
            
            positions.needsUpdate = true;
        });
    }
    
    // Update physics simulation
    update(deltaTime, state) {
        if (!this.isDeployed || this.inflationProgress < 1) return;
        
        // Calculate drag force
        const dragForce = this.calculateDragForce(state);
        
        // Apply swaying motion
        this.updateSwaying(deltaTime);
        
        // Update canopy deformation based on forces
        this.updateCanopyDeformation(dragForce);
        
        // Return drag force for vehicle physics
        return dragForce;
    }
    
    calculateDragForce(state) {
        if (!state || !state.velocity) return new THREE.Vector3();
        
        // F_drag = 0.5 * ρ * v² * C_d * A
        const velocity = state.velocity;
        const speed = velocity.length();
        const density = state.atmosphericDensity || 0.02;
        const area = Math.PI * Math.pow(this.canopyDiameter / 2, 2);
        
        const dragMagnitude = 0.5 * density * speed * speed * this.dragCoefficient * area;
        
        // Drag opposes velocity
        const dragForce = velocity.clone().normalize().multiplyScalar(-dragMagnitude);
        
        return dragForce;
    }
    
    updateSwaying(deltaTime) {
        // Natural swaying motion
        this.swayPhase += deltaTime * this.swayFrequency;
        
        // Calculate sway offset
        const swayX = Math.sin(this.swayPhase) * this.swayAmplitude;
        const swayZ = Math.cos(this.swayPhase * 0.7) * this.swayAmplitude * 0.5;
        
        // Apply to canopy
        this.canopy.position.x = swayX;
        this.canopy.position.z = swayZ;
        
        // Slight rotation
        this.canopy.rotation.x = Math.PI + swayX * 0.02;
        this.canopy.rotation.z = swayZ * 0.02;
        
        // Gradually increase sway amplitude
        if (this.swayAmplitude < 2) {
            this.swayAmplitude += deltaTime * 0.5;
        }
    }
    
    updateCanopyDeformation(dragForce) {
        // Deform canopy based on drag force
        const deformation = Math.min(dragForce.length() / 10000, 0.3);
        
        // Flatten canopy under high load
        this.canopyMesh.scale.y = 1 - deformation;
        
        // Bulge sides slightly
        this.canopyMesh.scale.x = 1 + deformation * 0.1;
        this.canopyMesh.scale.z = 1 + deformation * 0.1;
    }
    
    // Cut away parachute (for powered descent)
    release() {
        if (!this.isDeployed) return;
        
        // Animate parachute floating away
        const animate = () => {
            this.position.y += 5;
            this.position.x += Math.random() * 2 - 1;
            this.position.z += Math.random() * 2 - 1;
            this.rotation.x += 0.01;
            this.rotation.z += 0.02;
            
            // Fade out
            this.traverse((child) => {
                if (child.material) {
                    child.material.opacity *= 0.98;
                    child.material.transparent = true;
                }
            });
            
            if (this.canopyMesh.material.opacity > 0.01) {
                requestAnimationFrame(animate);
            } else {
                this.visible = false;
            }
        };
        
        animate();
        
        // Dispatch event
        window.dispatchEvent(new CustomEvent('parachute-released', {
            detail: { parachute: this }
        }));
    }
}

export default Parachute;