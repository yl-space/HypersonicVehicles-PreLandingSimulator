import * as THREE from '/node_modules/three/build/three.module.js';

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
        this.bankAngleArrow = null;
        this.positionArrow = null;
        this.vectorsVisible = false;
        this.vectorFadeTimer = null;
        
        this.init();
    }
    
    init() {
        this.createVehicleWithLOD();
        this.createHeatEffects();
        // this.createThrusterSystem();
        this.createLocalCoordinateAxes();
        this.createOrientationVectors();
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
        
        // Scale glow to match new spacecraft size (0.1 units)
        const glowRadius = 0.15; // Slightly larger than spacecraft for glow effect
        const glowGeometry = new THREE.SphereGeometry(glowRadius, 32, 32);
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
            
            // Scale velocities for smaller spacecraft
            velocities[i * 3] = (Math.random() - 0.5) * 0.02;
            velocities[i * 3 + 1] = -Math.random() * 0.04;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.02,  // Scaled down for smaller spacecraft
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
    
    // createThrusterSystem() {
    //     // Modern instanced thrusters - scaled for smaller spacecraft
    //     const scaleFactor = 0.1; // Match spacecraft scale
    //     const thrusterGeometry = new THREE.ConeGeometry(
    //         scaleFactor * 0.2,  // Radius: 0.02 units
    //         scaleFactor * 1.0,  // Height: 0.1 units
    //         8
    //     );
    //     const thrusterMaterial = new THREE.MeshBasicMaterial({
    //         color: 0xffaa00,
    //         transparent: true,
    //         opacity: 0,
    //         blending: THREE.AdditiveBlending
    //     });
        
    //     // Create 8 thrusters using InstancedMesh
    //     this.thrusterMesh = new THREE.InstancedMesh(
    //         thrusterGeometry,
    //         thrusterMaterial,
    //         8
    //     );
        
    //     const matrix = new THREE.Matrix4();
    //     const position = new THREE.Vector3();
    //     const rotation = new THREE.Euler();
    //     const scale = new THREE.Vector3(1, 1, 1);
        
    //     for (let i = 0; i < 8; i++) {
    //         const angle = (i / 8) * Math.PI * 2;
    //         position.set(
    //             Math.cos(angle) * scaleFactor * 1.2,  // Position around spacecraft
    //             -scaleFactor * 0.8,                    // Below spacecraft
    //             Math.sin(angle) * scaleFactor * 1.2
    //         );
    //         rotation.set(Math.PI, 0, angle);
            
    //         matrix.compose(position, new THREE.Quaternion().setFromEuler(rotation), scale);
    //         this.thrusterMesh.setMatrixAt(i, matrix);
    //     }
        
    //     this.thrusterMesh.instanceMatrix.needsUpdate = true;
    //     this.group.add(this.thrusterMesh);
    // }
    
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
    
    createOrientationVectors() {
        // Create arrow helper for velocity vector
        const origin = new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3(0, -1, 0);
        const length = 0.5;
        
        // Velocity vector (yellow)
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, length, 0xffff00, length * 0.3, length * 0.2);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });
        this.velocityArrow.visible = false;
        this.group.add(this.velocityArrow);
        
        // Bank angle vector (cyan) - orthogonal to velocity
        this.bankAngleArrow = new THREE.ArrowHelper(direction, origin, length, 0x00ffff, length * 0.3, length * 0.2);
        this.bankAngleArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.bankAngleArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
        this.bankAngleArrow.visible = false;
        this.group.add(this.bankAngleArrow);
        
        // Position vector from planet center (magenta)
        this.positionArrow = new THREE.ArrowHelper(direction, origin, length, 0xff00ff, length * 0.3, length * 0.2);
        this.positionArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.positionArrow.line.material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3 });
        this.positionArrow.visible = false;
        this.group.add(this.positionArrow);
    }
    
    updateOrientationVectors(velocity, position, bankAngle = 0) {
        if (!velocity || !position) return;
        
        // Update velocity arrow
        if (this.velocityArrow && velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const direction = velocity.clone().normalize();
            const length = Math.min(1, Math.max(0.3, velocity.length() * 50));
            
            this.velocityArrow.setDirection(direction);
            this.velocityArrow.setLength(length, length * 0.3, length * 0.2);
        }
        
        // Update position arrow (from planet center to spacecraft)
        if (this.positionArrow && position instanceof THREE.Vector3 && position.length() > 0.001) {
            const posDirection = position.clone().normalize();
            const posLength = 0.8;
            
            this.positionArrow.setDirection(posDirection);
            this.positionArrow.setLength(posLength, posLength * 0.3, posLength * 0.2);
        }
        
        // Calculate bank angle vector (orthogonal to velocity, coplanar with position)
        if (this.bankAngleArrow && velocity.length() > 0.001 && position.length() > 0.001) {
            const velocityNorm = velocity.clone().normalize();
            const positionNorm = position.clone().normalize();
            
            // Project position onto plane perpendicular to velocity
            const dotProduct = velocityNorm.dot(positionNorm);
            const projection = velocityNorm.clone().multiplyScalar(dotProduct);
            let bankDirection = positionNorm.clone().sub(projection).normalize();
            
            // If position and velocity are parallel, use a default up vector
            if (bankDirection.length() < 0.001) {
                bankDirection = new THREE.Vector3(0, 1, 0);
                const dot = velocityNorm.dot(bankDirection);
                const proj = velocityNorm.clone().multiplyScalar(dot);
                bankDirection.sub(proj).normalize();
            }
            
            // Apply bank angle rotation around velocity axis
            if (Math.abs(bankAngle) > 0.001) {
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(velocityNorm, THREE.MathUtils.degToRad(bankAngle));
                bankDirection.applyQuaternion(quaternion);
            }
            
            const bankLength = 0.6;
            this.bankAngleArrow.setDirection(bankDirection);
            this.bankAngleArrow.setLength(bankLength, bankLength * 0.3, bankLength * 0.2);
        }
    }
    
    setVectorsVisible(visible, autoFade = false) {
        this.vectorsVisible = visible;
        
        if (this.velocityArrow) this.velocityArrow.visible = visible;
        if (this.bankAngleArrow) this.bankAngleArrow.visible = visible;
        if (this.positionArrow) this.positionArrow.visible = visible;
        
        // Clear any existing fade timer
        if (this.vectorFadeTimer) {
            clearTimeout(this.vectorFadeTimer);
            this.vectorFadeTimer = null;
        }
        
        // Set up auto-fade if requested
        if (visible && autoFade) {
            this.vectorFadeTimer = setTimeout(() => {
                this.setVectorsVisible(false);
            }, 3000); // Hide after 3 seconds
        }
    }
    
    toggleVectors() {
        this.setVectorsVisible(!this.vectorsVisible);
    }
    
    update(time, vehicleData, bankAngle = 0) {
        if (!vehicleData) return;
        
        // Update orientation vectors if visible
        if (this.vectorsVisible && vehicleData.velocity && vehicleData.position) {
            this.updateOrientationVectors(vehicleData.velocity, vehicleData.position, bankAngle);
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
                // Reset particle - scaled for smaller spacecraft
                positions.array[i * 3] = (Math.random() - 0.5) * 0.04;  // Scaled to spacecraft size
                positions.array[i * 3 + 1] = -0.1;  // Start below smaller spacecraft
                positions.array[i * 3 + 2] = (Math.random() - 0.5) * 0.04;
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
                    child.position.y -= 0.01;  // Scaled for smaller spacecraft
                    child.rotation.x += 0.1;
                    
                    if (child.position.y > startPos.y - 1) {  // Scaled separation distance
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