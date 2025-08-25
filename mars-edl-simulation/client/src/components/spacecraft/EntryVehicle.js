import * as THREE from 'three';

export class EntryVehicle {
    constructor() {
        this.group = new THREE.Group();
        this.vehicleLOD = null;
        this.effects = {
            heatGlow: null,
            plasmaTail: null,
            thrusters: []
        };
        this.state = {
            heatShieldAttached: true,
            parachuteDeployed: false,
            thrustersActive: false
        };
        
        // Add coordinate axes and velocity vector
        this.localAxes = null;
        this.velocityArrow = null;
        
        this.init();
    }
    
    init() {
        this.createVehicleWithLOD();
        this.createHeatEffects();
        this.createThrusterSystem();
        this.createLocalCoordinateAxes();
        this.createVelocityVector();
    }
    
    createVehicleWithLOD() {
        // Use LOD for performance
        this.vehicleLOD = new THREE.LOD();
        
        // High detail (close)
        const highDetail = this.createHighDetailVehicle();
        this.vehicleLOD.addLevel(highDetail, 0);
        
        // Medium detail
        const mediumDetail = this.createMediumDetailVehicle();
        this.vehicleLOD.addLevel(mediumDetail, 50);
        
        // Low detail (far)
        const lowDetail = this.createLowDetailVehicle();
        this.vehicleLOD.addLevel(lowDetail, 200);
        
        this.group.add(this.vehicleLOD);
    }
    
    createHighDetailVehicle() {
        const group = new THREE.Group();
        
        // MSL Aeroshell actual dimensions: 4.5m diameter
        // At true scale (0.0000225 units) it would be invisible
        // Using 0.1 unit radius (10km equivalent) for visibility
        // This is ~4,444x larger than actual size but necessary for visualization
        const scaleFactor = 0.1; // Minimum visible size
        
        // Detailed aeroshell with PBR materials
        // Proportions based on actual MSL: diameter 4.5m, height ~3m
        const shellRadius = scaleFactor;
        const shellHeight = scaleFactor * 1.3; // Maintain proportions
        const shellGeometry = new THREE.ConeGeometry(shellRadius, shellHeight, 32, 16);
        const shellMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7,
            normalScale: new THREE.Vector2(0.5, 0.5),
            envMapIntensity: 0.5
        });
        
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.rotation.x = Math.PI;
        shell.position.y = shellHeight / 2;
        shell.castShadow = true;
        shell.receiveShadow = true;
        group.add(shell);
        
        // Heat shield with emissive properties
        const shieldRadius = scaleFactor * 1.2; // Slightly larger than cone base
        const shieldGeometry = new THREE.CylinderGeometry(shieldRadius, shieldRadius * 0.9, scaleFactor * 0.15, 32);
        const shieldMaterial = new THREE.MeshPhysicalMaterial({
            color: 0x2F1B14,
            metalness: 0.1,
            roughness: 0.9,
            clearcoat: 0.1,
            clearcoatRoughness: 0.8,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        
        const shield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        shield.position.y = -shellHeight * 0.3;
        shield.name = 'heatShield';
        group.add(shield);
        
        return group;
    }
    
    createMediumDetailVehicle() {
        const group = new THREE.Group();
        
        const scaleFactor = 0.1; // Same scale as high detail
        const shellRadius = scaleFactor;
        const shellHeight = scaleFactor * 1.3;
        
        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 16, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7
        });
        
        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = Math.PI;
        vehicle.position.y = shellHeight / 2;
        group.add(vehicle);
        
        return group;
    }
    
    createLowDetailVehicle() {
        const group = new THREE.Group();
        
        const scaleFactor = 0.1; // Same scale for consistency
        const shellRadius = scaleFactor;
        const shellHeight = scaleFactor * 1.3;
        
        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 8, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8B7355
        });
        
        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = Math.PI;
        vehicle.position.y = shellHeight / 2;
        group.add(vehicle);
        
        return group;
    }
    
    createHeatEffects() {
        // Modern shader for heat glow
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                intensity: { value: 0.0 },
                glowColor: { value: new THREE.Color(0xff6600) },
                viewVector: { value: new THREE.Vector3() },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float intensity;
                uniform vec3 glowColor;
                uniform vec3 viewVector;
                uniform float time;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float fresnel = pow(1.0 - dot(vNormal, viewDirection), 2.0);
                    
                    // Animated plasma effect
                    float noise = sin(time * 10.0 + vWorldPosition.y * 20.0) * 0.1;
                    float glow = fresnel * intensity * (1.0 + noise);
                    
                    vec3 color = glowColor * glow;
                    gl_FragColor = vec4(color, glow * 0.8);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        const glowGeometry = new THREE.SphereGeometry(1, 32, 32);
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.effects.heatGlow);
        
        // Plasma tail using particle system
        this.createPlasmaTail();
    }
    
    createPlasmaTail() {
        const particleCount = 500;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            velocities[i * 3] = (Math.random() - 0.5) * 0.1;
            velocities[i * 3 + 1] = -Math.random() * 0.2;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.1;
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.1,
            color: 0xff6600,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            vertexColors: true
        });
        
        this.effects.plasmaTail = new THREE.Points(geometry, material);
        this.effects.plasmaTail.frustumCulled = false;
        this.group.add(this.effects.plasmaTail);
    }
    
    createThrusterSystem() {
        // Modern instanced thrusters
        const thrusterGeometry = new THREE.ConeGeometry(0.1, 0.5, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        // Create 8 thrusters using InstancedMesh
        this.thrusterMesh = new THREE.InstancedMesh(
            thrusterGeometry,
            thrusterMaterial,
            8
        );
        
        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const rotation = new THREE.Euler();
        const scale = new THREE.Vector3(1, 1, 1);
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            position.set(
                Math.cos(angle) * 0.6,
                -0.5,
                Math.sin(angle) * 0.6
            );
            rotation.set(Math.PI, 0, angle);
            
            matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
            this.thrusterMesh.setMatrixAt(i, matrix);
        }
        
        this.thrusterMesh.instanceMatrix.needsUpdate = true;
        this.group.add(this.thrusterMesh);
    }
    
    createLocalCoordinateAxes() {
        // Create axes helper for spacecraft local reference frame
        const axesGroup = new THREE.Group();
        const axisLength = 0.3; // Scaled to new spacecraft size
        
        // X-axis (Red) - Forward
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(axisLength, 0, 0)
        ]);
        const xMaterial = new THREE.LineBasicMaterial({ color: 0xff0000, linewidth: 2 });
        const xAxis = new THREE.Line(xGeometry, xMaterial);
        axesGroup.add(xAxis);
        
        // Y-axis (Green) - Up
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, axisLength, 0)
        ]);
        const yMaterial = new THREE.LineBasicMaterial({ color: 0x00ff00, linewidth: 2 });
        const yAxis = new THREE.Line(yGeometry, yMaterial);
        axesGroup.add(yAxis);
        
        // Z-axis (Blue) - Right
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, axisLength)
        ]);
        const zMaterial = new THREE.LineBasicMaterial({ color: 0x0000ff, linewidth: 2 });
        const zAxis = new THREE.Line(zGeometry, zMaterial);
        axesGroup.add(zAxis);
        
        this.localAxes = axesGroup;
        this.group.add(this.localAxes);
    }
    
    createVelocityVector() {
        // Create arrow helper for velocity vector
        const origin = new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3(0, -1, 0); // Default downward
        const length = 0.5; // Scaled to new spacecraft size
        const color = 0xffff00; // Yellow for velocity
        
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, length, color, 1, 0.5);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: color });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: color, linewidth: 3 });
        
        this.group.add(this.velocityArrow);
    }
    
    updateVelocityVector(velocity) {
        if (!this.velocityArrow || !velocity) return;
        
        // Update velocity arrow direction and length
        if (velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const direction = velocity.clone().normalize();
            const length = Math.min(1, Math.max(0.2, velocity.length() * 20)); // Scale for new size
            
            this.velocityArrow.setDirection(direction);
            this.velocityArrow.setLength(length, length * 0.3, length * 0.2);
            this.velocityArrow.visible = true;
        } else {
            this.velocityArrow.visible = false;
        }
    }
    
    update(time, vehicleData) {
        if (!vehicleData) return;
        
        // Update velocity vector visualization
        if (vehicleData.velocity) {
            this.updateVelocityVector(vehicleData.velocity);
        }
        
        // Update heat effects based on altitude and velocity
        const altitude = vehicleData.altitude || 100;
        const velocity = vehicleData.velocityMagnitude || 0;
        
        // Heat intensity calculation
        const heatIntensity = altitude < 100 && altitude > 20 
            ? (1 - altitude / 100) * (velocity / 5900) 
            : 0;
        
        // Update glow shader
        if (this.effects.heatGlow) {
            this.effects.heatGlow.material.uniforms.intensity.value = heatIntensity;
            this.effects.heatGlow.material.uniforms.time.value = time;
            
            // Change color based on heat
            const heatColor = new THREE.Color();
            heatColor.setHSL(0.05 - heatIntensity * 0.05, 1, 0.5);
            this.effects.heatGlow.material.uniforms.glowColor.value = heatColor;
        }
        
        // Update plasma tail particles
        this.updatePlasmaTail(heatIntensity);
        
        // Update thruster visibility
        if (this.thrusterMesh) {
            this.thrusterMesh.material.opacity = this.state.thrustersActive ? 0.8 : 0;
        }
        
        // LOD updates handled automatically by Three.js
        this.vehicleLOD.update(this.group);
    }
    
    updatePlasmaTail(intensity) {
        if (!this.effects.plasmaTail) return;
        
        const positions = this.effects.plasmaTail.geometry.attributes.position;
        const velocities = this.effects.plasmaTail.geometry.attributes.velocity;
        const lifetimes = this.effects.plasmaTail.geometry.attributes.lifetime;
        
        for (let i = 0; i < positions.count; i++) {
            lifetimes.array[i] -= 0.01;
            
            if (lifetimes.array[i] <= 0) {
                // Reset particle
                positions.array[i * 3] = (Math.random() - 0.5) * 0.2;
                positions.array[i * 3 + 1] = -0.5;
                positions.array[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
                lifetimes.array[i] = 1;
            } else {
                // Update position
                positions.array[i * 3] += velocities.array[i * 3];
                positions.array[i * 3 + 1] += velocities.array[i * 3 + 1];
                positions.array[i * 3 + 2] += velocities.array[i * 3 + 2];
            }
        }
        
        positions.needsUpdate = true;
        lifetimes.needsUpdate = true;
        
        this.effects.plasmaTail.material.opacity = intensity * 0.5;
    }
    
    setPosition(position) {
        if (position?.isVector3) {
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
            case 'Guidance Start':
                this.activateThrusters(true);
                break;
        }
    }
    
    deployParachute() {
        // Implementation remains same as existing
        this.state.parachuteDeployed = true;
    }
    
    ejectHeatShield() {
        this.state.heatShieldAttached = false;
        
        // Find and animate heat shield
        this.vehicleLOD.traverse((child) => {
            if (child.name === 'heatShield') {
                // Animate separation
                const startPos = child.position.clone();
                const animate = () => {
                    child.position.y -= 0.05;
                    child.rotation.x += 0.1;
                    
                    if (child.position.y > startPos.y - 5) {
                        requestAnimationFrame(animate);
                    } else {
                        child.visible = false;
                    }
                };
                animate();
            }
        });
    }
    
    activateThrusters(active) {
        this.state.thrustersActive = active;
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}