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

        // Spacecraft attitude state (scientifically accurate)
        this.attitude = {
            quaternion: new THREE.Quaternion(),
            angleOfAttack: -16,  // MSL trim AoA: -16 degrees
            bankAngle: 0,        // Current bank angle
            sideslipAngle: 0     // Maintained at 0 during entry
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
        const axisLength = 0.03;

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

        // Velocity vector (yellow)
        const velocityLength = 0.02;
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, velocityLength, 0xffff00, velocityLength * 0.2, velocityLength * 0.15);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: 0xffff00, linewidth: 2 });
        this.velocityArrow.visible = false;
        this.velocityArrow.renderOrder = 999;
        this.group.add(this.velocityArrow);

        // Bank angle vector (cyan)
        const bankLength = 0.025;
        this.bankAngleArrow = new THREE.ArrowHelper(direction, origin, bankLength, 0x00ffff, bankLength * 0.2, bankLength * 0.15);
        this.bankAngleArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
        this.bankAngleArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00ffff, linewidth: 2 });
        this.bankAngleArrow.visible = false;
        this.bankAngleArrow.renderOrder = 999;
        this.group.add(this.bankAngleArrow);

        // Position vector (magenta)
        const posLength = 0.03;
        this.positionArrow = new THREE.ArrowHelper(direction, origin, posLength, 0xff00ff, posLength * 0.2, posLength * 0.15);
        this.positionArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.positionArrow.line.material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 2 });
        this.positionArrow.visible = false;
        this.positionArrow.renderOrder = 999;
        this.group.add(this.positionArrow);
    }

    createVectorLabels() {
        const createTextSprite = (text, color) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 128;
            canvas.height = 32;
            context.font = '16px Arial, sans-serif';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.001
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(0.03, 0.008, 1);
            sprite.visible = false;
            return sprite;
        };

        this.vectorLabels.velocity = createTextSprite('Velocity (Motion Direction)', '#ffff00');
        this.vectorLabels.lift = createTextSprite('Lift (Controlled by Bank Angle)', '#00ffff');
        this.vectorLabels.position = createTextSprite('Position (Radial from Mars)', '#ff00ff');
        this.group.add(this.vectorLabels.velocity);
        this.group.add(this.vectorLabels.lift);
        this.group.add(this.vectorLabels.position);
    }

    updateOrientationVectors(velocity, position, bankAngle = 0) {
        if (!velocity || !position) return;
        if (!this.vectorsVisible) return;

        // Update velocity arrow
        if (this.velocityArrow && velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const direction = velocity.clone().normalize();
            const velocityLength = 0.02;
            this.velocityArrow.setDirection(direction);
            this.velocityArrow.setLength(velocityLength, velocityLength * 0.2, velocityLength * 0.15);
            if (this.vectorLabels.velocity) {
                const labelPosition = direction.clone().multiplyScalar(velocityLength + 0.01);
                this.vectorLabels.velocity.position.copy(labelPosition);
                this.vectorLabels.velocity.visible = this.vectorsVisible;
            }
        }

        // Update position arrow
        if (this.positionArrow && position instanceof THREE.Vector3 && position.length() > 0.001) {
            const posDirection = position.clone().normalize();
            const posLength = 0.03;
            this.positionArrow.setDirection(posDirection);
            this.positionArrow.setLength(posLength, posLength * 0.2, posLength * 0.15);
            if (this.vectorLabels.position) {
                const labelPosition = posDirection.clone().multiplyScalar(posLength + 0.01);
                this.vectorLabels.position.position.copy(labelPosition);
                this.vectorLabels.position.visible = this.vectorsVisible;
            }
        }

        // Calculate lift vector
        if (this.bankAngleArrow && velocity.length() > 0.001 && position.length() > 0.001) {
            const velocityNorm = velocity.clone().normalize();
            const positionNorm = position.clone().normalize();
            const angularMomentum = new THREE.Vector3();
            angularMomentum.crossVectors(position, velocity).normalize();
            let liftDirection = new THREE.Vector3();
            liftDirection.crossVectors(angularMomentum, velocityNorm).normalize();

            if (liftDirection.length() < 0.001) {
                liftDirection.crossVectors(velocityNorm, positionNorm).normalize();
                if (liftDirection.length() < 0.001) {
                    liftDirection = new THREE.Vector3(0, 1, 0);
                    if (Math.abs(velocityNorm.dot(liftDirection)) > 0.9) {
                        liftDirection.set(1, 0, 0);
                    }
                    const dot = velocityNorm.dot(liftDirection);
                    liftDirection.sub(velocityNorm.clone().multiplyScalar(dot)).normalize();
                }
            }

            if (Math.abs(bankAngle) > 0.001) {
                const quaternion = new THREE.Quaternion();
                quaternion.setFromAxisAngle(velocityNorm, THREE.MathUtils.degToRad(bankAngle));
                liftDirection.applyQuaternion(quaternion);
            }

            const bankLength = 0.025;
            this.bankAngleArrow.setDirection(liftDirection);
            this.bankAngleArrow.setLength(bankLength, bankLength * 0.2, bankLength * 0.15);
            if (this.vectorLabels.lift) {
                const labelPosition = liftDirection.clone().multiplyScalar(bankLength + 0.01);
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
        if (this.vectorLabels.velocity) this.vectorLabels.velocity.visible = visible;
        if (this.vectorLabels.lift) this.vectorLabels.lift.visible = visible;
        if (this.vectorLabels.position) this.vectorLabels.position.visible = visible;

        if (this.vectorFadeTimer) {
            clearTimeout(this.vectorFadeTimer);
            this.vectorFadeTimer = null;
        }

        if (visible && autoFade) {
            this.vectorFadeTimer = setTimeout(() => {
                this.setVectorsVisible(false);
            }, 3000);
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

    /**
     * Set spacecraft attitude based on scientifically accurate Mars EDL principles
     * Maintains trim angle of attack relative to velocity vector
     * @param {THREE.Vector3} velocity - Velocity vector
     * @param {THREE.Vector3} position - Position vector (for radial reference)
     * @param {number} bankAngle - Bank angle in degrees (optional, defaults to current)
     */
    setScientificAttitude(velocity, position, bankAngle = null) {
        if (!velocity || !position || velocity.length() < 0.001) return;

        // Update bank angle if provided
        if (bankAngle !== null) {
            this.attitude.bankAngle = bankAngle;
        }

        // Normalize vectors
        const velNorm = velocity.clone().normalize();
        const posNorm = position.clone().normalize();

        // Calculate local coordinate frame
        // Right vector: perpendicular to velocity in orbital plane
        const right = new THREE.Vector3().crossVectors(velNorm, posNorm).normalize();

        // If right vector is too small (edge case), use alternative
        if (right.length() < 0.001) {
            right.set(1, 0, 0);
            if (Math.abs(velNorm.dot(right)) > 0.9) {
                right.set(0, 1, 0);
            }
            const dot = velNorm.dot(right);
            right.sub(velNorm.clone().multiplyScalar(dot)).normalize();
        }

        // Up vector: perpendicular to both velocity and right
        const up = new THREE.Vector3().crossVectors(right, velNorm).normalize();

        // Forward direction starts aligned with velocity
        const forward = velNorm.clone();

        // Apply trim angle of attack rotation around right axis
        // Negative AoA means nose pitched up relative to velocity
        const trimAoARad = THREE.MathUtils.degToRad(this.attitude.angleOfAttack);
        const trimQuaternion = new THREE.Quaternion();
        trimQuaternion.setFromAxisAngle(right, trimAoARad);

        // Rotate forward and up vectors by trim AoA
        forward.applyQuaternion(trimQuaternion);
        up.applyQuaternion(trimQuaternion);

        // Apply bank angle rotation around velocity axis (roll)
        const bankRad = THREE.MathUtils.degToRad(this.attitude.bankAngle);
        const bankQuaternion = new THREE.Quaternion();
        bankQuaternion.setFromAxisAngle(velNorm, bankRad);

        // Rotate right and up by bank angle
        right.applyQuaternion(bankQuaternion);
        up.applyQuaternion(bankQuaternion);

        // Create rotation matrix from basis vectors
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, up, forward.multiplyScalar(-1)); // -forward for Three.js convention

        // Extract quaternion from rotation matrix
        this.attitude.quaternion.setFromRotationMatrix(rotationMatrix);

        // Apply quaternion to spacecraft
        this.group.quaternion.copy(this.attitude.quaternion);
    }

    /**
     * Set angle of attack (for phase-specific changes like SUFR)
     * @param {number} aoa - Angle of attack in degrees
     */
    setAngleOfAttack(aoa) {
        this.attitude.angleOfAttack = aoa;
        console.log(`Spacecraft AoA set to ${aoa}°`);
    }

    /**
     * Set bank angle
     * @param {number} bankAngle - Bank angle in degrees
     */
    setBankAngle(bankAngle) {
        this.attitude.bankAngle = bankAngle;
    }
    
    triggerPhaseTransition(phaseName) {
        console.log(`Phase transition: ${phaseName}`);

        switch(phaseName) {
            case 'Entry Interface Point':
                // Set trim angle of attack for hypersonic entry
                this.setAngleOfAttack(-16);
                console.log('Entry phase: Trim AoA = -16° (MSL standard)');
                break;

            case 'Guidance Start':
                // Maintain trim AoA, activate thrusters for bank angle control
                this.activateThrusters(true);
                console.log('Guidance phase: Maintaining trim AoA, bank angle modulation active');
                break;

            case 'Heading Alignment':
                // Still maintaining trim AoA during alignment
                console.log('Heading alignment: Final trajectory corrections with trim AoA');
                break;

            case 'Begin SUFR':
                // CRITICAL: "Straighten Up and Fly Right" maneuver
                // Set angle of attack to ZERO for parachute deployment preparation
                this.setAngleOfAttack(0);
                this.setBankAngle(0);
                console.log('SUFR maneuver: AoA = 0°, Bank = 0° (preparing for parachute)');
                break;

            case 'Parachute Deploy':
                // Zero AoA, zero bank angle, stable descent
                this.setAngleOfAttack(0);
                this.setBankAngle(0);
                this.deployParachute();
                console.log('Parachute deployed: Stable descent configuration');
                break;

            case 'Heat Shield Separation':
                this.ejectHeatShield();
                console.log('Heat shield separated');
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