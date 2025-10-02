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

        // Vector labels
        this.vectorLabels = {
            velocity: null,
            lift: null,
            position: null
        };
        
        this.init();
    }
    
    init() {
        this.createVehicleWithLOD();
        this.createHeatEffects();
        // this.createThrusterSystem();
        this.createLocalCoordinateAxes();
        this.createOrientationVectors();
        this.createVectorLabels();
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
        
        // MSL Aeroshell actual dimensions: 4.5m diameter (2.25m radius)
        // Mars radius in simulation: 33.9 units (3390 km)
        // Real spacecraft to Mars ratio: 2.25m / 3,390,000m = 6.64e-7
        // Simulation scale: 6.64e-7 * 33.9 = 0.0000225 units (too small to see)
        // Using enhanced scale: 0.01 units for better visibility while maintaining realism
        const scaleFactor = 0.01; // More realistic scale - 100x larger than actual but 10x smaller than before
        
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
        
        const scaleFactor = 0.01; // Same scale as high detail
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
        
        const scaleFactor = 0.01; // Same scale for consistency
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
                precision highp float;

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
                precision highp float;

                uniform float intensity;
                uniform vec3 glowColor;
                uniform vec3 viewVector;
                uniform float time;

                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float fresnel = pow(clamp(1.0 - dot(normalize(vNormal), viewDirection), 0.0, 1.0), 2.0);

                    // Animated plasma effect
                    float noise = sin(time * 10.0 + vWorldPosition.y * 20.0) * 0.1;
                    float glow = fresnel * intensity * (1.0 + noise);

                    vec3 color = glowColor * glow;
                    gl_FragColor = vec4(color, clamp(glow * 0.8, 0.0, 1.0));
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        // Scale glow to match new spacecraft size (0.01 units) - optimized geometry
        const glowRadius = 0.015; // Slightly larger than spacecraft for glow effect
        const glowGeometry = new THREE.SphereGeometry(glowRadius, 16, 16);
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.effects.heatGlow);
        
        // Plasma tail using particle system
        this.createPlasmaTail();
    }
    
    createPlasmaTail() {
        const particleCount = 200; // Reduced for better performance
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            // Scale velocities for smaller spacecraft
            velocities[i * 3] = (Math.random() - 0.5) * 0.002;
            velocities[i * 3 + 1] = -Math.random() * 0.004;
            velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.002;
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: 0.002,  // Scaled down for smaller spacecraft
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
        const axisLength = 0.03; // Scaled to new spacecraft size
        
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
        const velocityLength = 0.05;
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, velocityLength, 0xffff00, velocityLength * 0.3, velocityLength * 0.2);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 3 });
        this.velocityArrow.visible = false;
        this.group.add(this.velocityArrow);
        
        // Bank angle vector (cyan) - orthogonal to velocity
        const bankLength = 0.06;
        this.bankAngleArrow = new THREE.ArrowHelper(direction, origin, bankLength, 0x00ffff, bankLength * 0.3, bankLength * 0.2);
        this.bankAngleArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.bankAngleArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 3 });
        this.bankAngleArrow.visible = false;
        this.group.add(this.bankAngleArrow);
        
        // Position vector from planet center (magenta)
        const posLength = 0.08;
        this.positionArrow = new THREE.ArrowHelper(direction, origin, posLength, 0xff00ff, posLength * 0.3, posLength * 0.2);
        this.positionArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.positionArrow.line.material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 3 });
        this.positionArrow.visible = false;
        this.group.add(this.positionArrow);
    }

    createVectorLabels() {
        // Create text sprites for vector labels
        const createTextSprite = (text, color) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');

            // Set canvas size
            canvas.width = 128;
            canvas.height = 32;

            // Set font and style
            context.font = '16px Arial, sans-serif';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Draw text
            context.fillText(text, canvas.width / 2, canvas.height / 2);

            // Create texture and sprite
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.001
            });
            const sprite = new THREE.Sprite(spriteMaterial);

            // Scale sprite appropriately
            sprite.scale.set(0.03, 0.008, 1);
            sprite.visible = false;

            return sprite;
        };

        // Create labels for each vector with physics descriptions
        this.vectorLabels.velocity = createTextSprite('Velocity (Motion Direction)', '#ffff00');
        this.vectorLabels.lift = createTextSprite('Lift (Controlled by Bank Angle)', '#00ffff');
        this.vectorLabels.position = createTextSprite('Position (Radial from Mars)', '#ff00ff');

        // Add labels to group
        this.group.add(this.vectorLabels.velocity);
        this.group.add(this.vectorLabels.lift);
        this.group.add(this.vectorLabels.position);
    }
    
    updateOrientationVectors(velocity, position, bankAngle = 0) {
        if (!velocity || !position) return;

        // Update velocity arrow - scaled appropriately
        if (this.velocityArrow && velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const direction = velocity.clone().normalize();
            const velocityLength = 0.05; // Fixed length for visibility

            // Debug: Log velocity direction relative to position
            if (position instanceof THREE.Vector3) {
                const posNorm = position.clone().normalize();
                const velDotPos = direction.dot(posNorm);
                console.log(`Velocity angle relative to radial: ${THREE.MathUtils.radToDeg(Math.acos(Math.abs(velDotPos)))}°`);
            }

            this.velocityArrow.setDirection(direction);
            this.velocityArrow.setLength(velocityLength, velocityLength * 0.3, velocityLength * 0.2);

            // Position velocity label at the tip of the arrow, offset to avoid blocking spacecraft
            if (this.vectorLabels.velocity) {
                const labelPosition = direction.clone().multiplyScalar(velocityLength + 0.02);
                this.vectorLabels.velocity.position.copy(labelPosition);
                this.vectorLabels.velocity.visible = this.vectorsVisible;
            }
        }

        // Update position arrow (radial outward from Mars center)
        if (this.positionArrow && position instanceof THREE.Vector3 && position.length() > 0.001) {
            const posDirection = position.clone().normalize();
            const posLength = 0.08; // Fixed length for visibility

            this.positionArrow.setDirection(posDirection);
            this.positionArrow.setLength(posLength, posLength * 0.3, posLength * 0.2);

            // Position position label at the tip of the arrow, offset to avoid blocking spacecraft
            if (this.vectorLabels.position) {
                const labelPosition = posDirection.clone().multiplyScalar(posLength + 0.02);
                this.vectorLabels.position.position.copy(labelPosition);
                this.vectorLabels.position.visible = this.vectorsVisible;
            }
        }

        // Calculate lift vector using Mars EDL physics standards
        if (this.bankAngleArrow && velocity.length() > 0.001 && position.length() > 0.001) {
            const velocityNorm = velocity.clone().normalize();
            const positionNorm = position.clone().normalize();

            // For Mars EDL: Lift is perpendicular to velocity in the orbital plane
            // Step 1: Calculate angular momentum h = r × v (orbital plane normal)
            const angularMomentum = new THREE.Vector3();
            angularMomentum.crossVectors(position, velocity).normalize();

            // Step 2: Calculate lift direction in orbital plane perpendicular to velocity
            // Standard aerospace: L = h × v (right-hand rule)
            let liftDirection = new THREE.Vector3();
            liftDirection.crossVectors(angularMomentum, velocityNorm).normalize();

            // Step 3: Ensure lift direction matches NASA MSL convention
            // For atmospheric entry with lifting body, lift can point in various directions
            // The key is that it's perpendicular to velocity and controlled by bank angle
            // No need to force direction - let bank angle control it naturally

            // Handle edge case: if velocity is perpendicular to position (circular orbit)
            if (liftDirection.length() < 0.001) {
                // Default lift perpendicular to both velocity and radial direction
                liftDirection.crossVectors(velocityNorm, positionNorm).normalize();
                if (liftDirection.length() < 0.001) {
                    // Ultimate fallback: create arbitrary perpendicular vector
                    liftDirection = new THREE.Vector3(0, 1, 0);
                    if (Math.abs(velocityNorm.dot(liftDirection)) > 0.9) {
                        liftDirection.set(1, 0, 0);
                    }
                    const dot = velocityNorm.dot(liftDirection);
                    liftDirection.sub(velocityNorm.clone().multiplyScalar(dot)).normalize();
                }
            }

            // Step 4: Apply bank angle rotation around velocity axis (roll control)
            // Bank angle rotates lift vector: φ = 0° → lift up, φ = 90° → lift right
            if (Math.abs(bankAngle) > 0.001) {
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(velocityNorm, THREE.MathUtils.degToRad(bankAngle));
                liftDirection.applyQuaternion(quaternion);
            }

            const bankLength = 0.06; // Fixed length for visibility
            this.bankAngleArrow.setDirection(liftDirection);
            this.bankAngleArrow.setLength(bankLength, bankLength * 0.3, bankLength * 0.2);

            // Position lift label at the tip of the arrow, offset to avoid blocking spacecraft
            if (this.vectorLabels.lift) {
                const labelPosition = liftDirection.clone().multiplyScalar(bankLength + 0.02);
                this.vectorLabels.lift.position.copy(labelPosition);
                this.vectorLabels.lift.visible = this.vectorsVisible;
            }
        }
    }
    
    setVectorsVisible(visible, autoFade = false) {
        this.vectorsVisible = visible;

        if (this.velocityArrow) this.velocityArrow.visible = visible;
        if (this.bankAngleArrow) this.bankAngleArrow.visible = visible;
        if (this.positionArrow) this.positionArrow.visible = visible;

        // Show/hide vector labels
        if (this.vectorLabels.velocity) this.vectorLabels.velocity.visible = visible;
        if (this.vectorLabels.lift) this.vectorLabels.lift.visible = visible;
        if (this.vectorLabels.position) this.vectorLabels.position.visible = visible;
        
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