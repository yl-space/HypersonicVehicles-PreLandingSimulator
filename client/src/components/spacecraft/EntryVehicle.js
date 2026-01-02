import * as THREE from 'three';
import { ModelMetadata, ModelTransformHelper, ModelSelector } from '../../config/ModelMetadata.js';

const METERS_PER_UNIT = 100000; // 1 unit = 100 km
const VEHICLE_DIAMETER_METERS = 4.5;
const VEHICLE_HEIGHT_METERS = 3.0;
const VEHICLE_RADIUS_UNITS = (VEHICLE_DIAMETER_METERS * 0.5) / METERS_PER_UNIT;
const VEHICLE_HEIGHT_UNITS = VEHICLE_HEIGHT_METERS / METERS_PER_UNIT;

export class EntryVehicle {
    constructor(assetLoader = null) {
        this.assetLoader = assetLoader;
        this.group = new THREE.Group();
        this.vehicleLOD = null;
        this.gltfModel = null;  // Store loaded GLTF model
        this.modelMetadata = null;  // Store model metadata
        this.useGLTF = assetLoader !== null;  // Use GLTF if asset loader provided

        this.effects = {
            heatGlow: null,
            plasmaTail: null,
            thrusters: []
        };
        this.state = {
            heatShieldAttached: true,
            parachuteDeployed: false,
            thrustersActive: false,
            modelLoaded: false  // Track if GLTF model is loaded
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

        // Derived visual scales tied to vehicle size (keeps vectors/callouts close to the hull)
        const baseVectorLength = VEHICLE_RADIUS_UNITS * 0.6; // ~60% of capsule radius
        this.visualScales = {
            velocityVector: baseVectorLength,
            bankVector: baseVectorLength,
            positionVector: baseVectorLength,
            label: VEHICLE_RADIUS_UNITS * 0.9,
            glowRadius: 2.5 / METERS_PER_UNIT,       // unchanged
            plasma: {
                lateralSpread: 2.0 / METERS_PER_UNIT,
                spawnDepth: 8 / METERS_PER_UNIT,
                velocityJitter: 1.2 / METERS_PER_UNIT,
                pointSize: 1.2 / METERS_PER_UNIT
            }
        };

        // Don't call init in constructor since it's async now
        // this.init();
    }

    async init() {
        // Try to load GLTF model first if asset loader is available
        if (this.useGLTF && this.assetLoader) {
            try {
                await this.loadGLTFModel();
                this.applyMaterialFixes();
            } catch (error) {
                console.error('Failed to load GLTF model during init:', error);
                // If GLTF fails, keep no spacecraft rather than procedural cone
                this.useGLTF = false;
            }
        }

        this.createHeatEffects();
        // this.createThrusterSystem();
        // this.createLocalCoordinateAxes(); // REMOVED: User requested removal of body axes
        this.createOrientationVectors();
        this.createVectorLabels();

        // Ensure a visible fallback if GLTF failed to load
        if (!this.state.modelLoaded && !this.vehicleLOD) {
            this.createVehicleWithLOD();
        }

        return this; // Return this for chaining
    }

    async loadGLTFModel(modelName = null) {
        try {
            // Use specified model or get from metadata
            const modelToLoad = modelName || ModelSelector.getPrimaryModel().filename;
            this.modelMetadata = ModelSelector.getModelByFilename(modelToLoad) || ModelSelector.getPrimaryModel();

            console.log(`Loading spacecraft model: ${this.modelMetadata.name}`);

            // Load the model using AssetLoader
            const { model, metadata } = await this.assetLoader.loadSpacecraftModel(
                modelToLoad,
                this.modelMetadata
            );

            this.gltfModel = model;
            this.state.modelLoaded = true;

            // Create LOD from GLTF model
            this.createGLTFLOD(model);

            console.log('GLTF model loaded successfully:', metadata);

            // Store metadata for reference (merge carefully to avoid circular references)
            this.modelMetadata = Object.assign({}, this.modelMetadata, {
                name: metadata.name,
                boundingBox: metadata.boundingBox,
                transformedBoundingBox: metadata.transformedBoundingBox,
                animations: metadata.animations
            });

        } catch (error) {
            console.error('Failed to load GLTF model; spacecraft will remain hidden until a valid model is available:', error);
            this.useGLTF = false;
        }
    }

    createGLTFLOD(model) {
        this.vehicleLOD = new THREE.LOD();

        const highDetail = model.clone(true);
        const mediumDetail = model.clone(true);
        const lowDetail = model.clone(true);

        this.applyMediumDetailTweaks(mediumDetail);
        this.applyLowDetailTweaks(lowDetail);

        this.vehicleLOD.addLevel(highDetail, 0);
        this.vehicleLOD.addLevel(mediumDetail, 0.0002);
        this.vehicleLOD.addLevel(lowDetail, 0.0005);

        this.group.add(this.vehicleLOD);
    }

    applyMediumDetailTweaks(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        const clone = mat.clone();
                        clone.flatShading = true;
                        clone.shininess = Math.min(clone.shininess || 20, 10);
                        clone.needsUpdate = true;
                        return clone;
                    });
                } else if (child.material) {
                    const clone = child.material.clone();
                    clone.flatShading = true;
                    clone.shininess = Math.min(clone.shininess || 20, 10);
                    clone.needsUpdate = true;
                    child.material = clone;
                }
                child.castShadow = false;
            }
        });
    }

    applyLowDetailTweaks(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                let baseColor = new THREE.Color(0xffffff);
                const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
                if (sourceMaterial && sourceMaterial.color) {
                    baseColor = sourceMaterial.color.clone();
                }
                child.material = new THREE.MeshBasicMaterial({
                    color: baseColor,
                    wireframe: false
                });
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
    }

    createVehicleWithLOD() {
        // Use LOD for performance (fallback cone geometry)
        this.vehicleLOD = new THREE.LOD();

        // High detail (close)
        const highDetail = this.createHighDetailVehicle();
        this.vehicleLOD.addLevel(highDetail, 0);

        // Medium detail
        const mediumDetail = this.createMediumDetailVehicle();
        this.vehicleLOD.addLevel(mediumDetail, 0.0002);

        // Low detail (far)
        const lowDetail = this.createLowDetailVehicle();
        this.vehicleLOD.addLevel(lowDetail, 0.0005);

        this.group.add(this.vehicleLOD);
    }
    
    createHighDetailVehicle() {
        const group = new THREE.Group();
        
        // True-scale aeroshell (~4.5 m dia, ~3 m height) mapped to scene units
        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;
        const shellGeometry = new THREE.ConeGeometry(shellRadius, shellHeight, 32, 16);
        const shellMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7,
            normalScale: new THREE.Vector2(0.5, 0.5),
            envMapIntensity: 0.5
        });

        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        // Reorient cone: rotate 90° around X so flat base faces forward (+Z direction)
        // Default cone points up (+Y), we want flat base facing +Z (forward in velocity frame)
        shell.rotation.x = -Math.PI / 2; // Rotate -90° to point cone along +Z
        shell.position.set(0, 0, 0); // Center at origin
        shell.castShadow = true;
        shell.receiveShadow = true;
        group.add(shell);

        // Heat shield REMOVED per user request

        return group;
    }
    
    createMediumDetailVehicle() {
        const group = new THREE.Group();

        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;

        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 16, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7
        });

        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = -Math.PI / 2; // Flat base faces forward
        vehicle.position.set(0, 0, 0);
        group.add(vehicle);

        return group;
    }
    
    createLowDetailVehicle() {
        const group = new THREE.Group();

        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;

        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 8, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8B7355
        });

        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = -Math.PI / 2; // Flat base faces forward
        vehicle.position.set(0, 0, 0);
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
                precision mediump float;

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
                precision mediump float;

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
            depthWrite: false,
            depthTest: false
        });
        
        // Scale glow to match new spacecraft size
        const glowRadius = this.visualScales.glowRadius; // Slightly larger than spacecraft for glow effect
        const glowGeometry = new THREE.SphereGeometry(glowRadius, 16, 16);
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.effects.heatGlow.renderOrder = 50; // on top of planet
        this.group.add(this.effects.heatGlow);
        
        // Plasma tail using particle system
        this.createPlasmaTail();
    }

    applyMaterialFixes() {
        // Ensure spacecraft materials render solid (no unintended transparency or backface culling issues)
        this.group.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    mat.depthWrite = true;
                    mat.depthTest = true;
                    mat.transparent = false;
                    mat.opacity = 1.0;
                    mat.side = THREE.DoubleSide;
                });
            }
        });
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
            
            // Scale velocities for smaller spacecraft (meters mapped to units)
            velocities[i * 3] = (Math.random() - 0.5) * this.visualScales.plasma.velocityJitter;
            velocities[i * 3 + 1] = -Math.random() * (this.visualScales.plasma.velocityJitter * 1.6);
            velocities[i * 3 + 2] = (Math.random() - 0.5) * this.visualScales.plasma.velocityJitter;
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: this.visualScales.plasma.pointSize,
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
    

    createOrientationVectors() {
        // Create arrow helper for velocity vector
        const origin = new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3(0, -1, 0);

        // Velocity vector (yellow) - compact with prominent arrow head
        const velocityLength = this.visualScales.velocityVector;
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, velocityLength, 0xffd447, velocityLength * 0.9, velocityLength * 0.7);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xffd447 });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: 0xffd447, linewidth: 1 });
        this.velocityArrow.visible = false;
        this.velocityArrow.renderOrder = 999;
        this.group.add(this.velocityArrow);

        // Bank angle vector (cyan) - compact with prominent arrow head
        const bankLength = this.visualScales.bankVector;
        this.bankAngleArrow = new THREE.ArrowHelper(direction, origin, bankLength, 0x00c1ff, bankLength * 0.9, bankLength * 0.7);
        this.bankAngleArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00c1ff });
        this.bankAngleArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00c1ff, linewidth: 1 });
        this.bankAngleArrow.visible = false;
        this.bankAngleArrow.renderOrder = 999;
        this.group.add(this.bankAngleArrow);

        // Position vector (magenta) - compact with prominent arrow head
        const posLength = this.visualScales.positionVector;
        this.positionArrow = new THREE.ArrowHelper(direction, origin, posLength, 0xff00ff, posLength * 0.9, posLength * 0.7);
        this.positionArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.positionArrow.line.material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 1 });
        this.positionArrow.visible = false;
        this.positionArrow.renderOrder = 999;
        this.group.add(this.positionArrow);
    }

    createVectorLabels() {
        const createTextSprite = (text, color) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.font = 'bold 28px Arial, sans-serif';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.001,
                depthTest: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(this.visualScales.label, this.visualScales.label * 0.25, 1);
            sprite.visible = false;
            sprite.renderOrder = 1000;
            return sprite;
        };

        this.vectorLabels.velocity = createTextSprite('Velocity', '#ffd447');
        this.vectorLabels.lift = createTextSprite('Lift', '#00c1ff');
        this.vectorLabels.position = createTextSprite('Position', '#ff4fd8');
        this.group.add(this.vectorLabels.velocity);
        this.group.add(this.vectorLabels.lift);
        this.group.add(this.vectorLabels.position);
    }

    updateOrientationVectors(velocity, position, bankAngle = 0) {
        if (!velocity || !position) return;
        if (!this.vectorsVisible) return;

        // Transform world-space directions to spacecraft local space
        // Since vectors are children of this.group, we need to account for spacecraft rotation
        const spacecraftQuaternionInverse = this.group.quaternion.clone().invert();

        // ====================================================================================
        // VELOCITY VECTOR (Yellow): Shows actual direction of motion along trajectory
        // ====================================================================================
        if (this.velocityArrow && velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const velocityDirection = velocity.clone().normalize();
            // Transform from world space to spacecraft local space
            const localVelocityDir = velocityDirection.clone().applyQuaternion(spacecraftQuaternionInverse);
            const velocityLength = this.visualScales.velocityVector;
            this.velocityArrow.position.set(0, 0, 0);
            this.velocityArrow.setDirection(localVelocityDir);
            this.velocityArrow.setLength(velocityLength);
            if (this.vectorLabels.velocity) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = localVelocityDir.clone().multiplyScalar(velocityLength * 1.05);
                this.vectorLabels.velocity.position.copy(labelPosition);
                this.vectorLabels.velocity.visible = this.vectorsVisible;
            }
        }

        // ====================================================================================
        // POSITION VECTOR (Magenta): Shows radial direction from Mars center
        // ====================================================================================
        if (this.positionArrow && position instanceof THREE.Vector3 && position.length() > 0.001) {
            const radialDirection = position.clone().normalize();
            // Transform from world space to spacecraft local space
            const localRadialDir = radialDirection.clone().applyQuaternion(spacecraftQuaternionInverse);

            const posLength = this.visualScales.positionVector;
            this.positionArrow.position.set(0, 0, 0);
            this.positionArrow.setDirection(localRadialDir);
            this.positionArrow.setLength(posLength);
            if (this.vectorLabels.position) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = localRadialDir.clone().multiplyScalar(posLength * 1.05);
                this.vectorLabels.position.position.copy(labelPosition);
                this.vectorLabels.position.visible = this.vectorsVisible;
            }
        }

        // ====================================================================================
        // BANK VECTOR (Cyan): Shows spacecraft body-fixed "up" direction
        // ====================================================================================
        if (this.bankAngleArrow) {
            // Body-fixed up direction (+Y in spacecraft frame)
            // Since the arrow is a child of the group, use local coordinates directly
            const spacecraftUpDir = new THREE.Vector3(0, 1, 0);

            const bankLength = this.visualScales.bankVector;
            this.bankAngleArrow.position.set(0, 0, 0);
            this.bankAngleArrow.setDirection(spacecraftUpDir);
            this.bankAngleArrow.setLength(bankLength);
            if (this.vectorLabels.lift) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = spacecraftUpDir.clone().multiplyScalar(bankLength * 1.05);
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

    update(time, vehicleData, bankAngle = 0, camera = null) {
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
        
        if (camera && this.vehicleLOD) {
            this.vehicleLOD.update(camera);
        }
    }
    
    updatePlasmaTail(intensity) {
        if (!this.effects.plasmaTail) return;

        // Skip update if intensity is too low (performance optimization)
        if (intensity < 0.01) {
            this.effects.plasmaTail.visible = false;
            return;
        } else {
            this.effects.plasmaTail.visible = true;
        }

        const positions = this.effects.plasmaTail.geometry.attributes.position;
        const velocities = this.effects.plasmaTail.geometry.attributes.velocity;
        const lifetimes = this.effects.plasmaTail.geometry.attributes.lifetime;

        // Update only every other frame for performance
        const skipFrame = Date.now() % 2 === 0;
        if (skipFrame && intensity < 0.5) return;

        // Update fewer particles when intensity is low
        const particlesToUpdate = Math.ceil(positions.count * Math.min(1, intensity + 0.3));

        for (let i = 0; i < particlesToUpdate; i++) {
            lifetimes.array[i] -= 0.01;

            if (lifetimes.array[i] <= 0) {
                // Reset particle - scaled for smaller spacecraft
                positions.array[i * 3] = (Math.random() - 0.5) * this.visualScales.plasma.lateralSpread;
                positions.array[i * 3 + 1] = -this.visualScales.plasma.spawnDepth;  // Start behind spacecraft
                positions.array[i * 3 + 2] = (Math.random() - 0.5) * this.visualScales.plasma.lateralSpread;
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
     * Set spacecraft attitude - SIMPLIFIED: flat base faces forward along velocity
     * Cone is pre-rotated so local +Z points forward
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

        // Normalize velocity vector
        const velNorm = velocity.clone().normalize();

        // Calculate angular momentum (perpendicular to orbital plane)
        const angularMomentum = new THREE.Vector3().crossVectors(position, velocity);

        // Handle edge case
        if (angularMomentum.length() < 0.001) {
            angularMomentum.crossVectors(velNorm, new THREE.Vector3(0, 1, 0));
            if (angularMomentum.length() < 0.001) {
                angularMomentum.crossVectors(velNorm, new THREE.Vector3(1, 0, 0));
            }
        }
        angularMomentum.normalize();

        // Build spacecraft reference frame with flat base facing velocity
        // Forward (+Z in spacecraft frame) = along velocity
        const forward = velNorm.clone();

        // Right (+X in spacecraft frame) = perpendicular to orbital plane
        // This is the angular momentum direction (or its negative)
        const right = angularMomentum.clone();

        // Ensure right vector points generally "right" relative to velocity
        // (can adjust based on convention)

        // Up (+Y in spacecraft frame) = perpendicular to forward and right
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();

        // Recalculate right to ensure orthogonal frame
        right.crossVectors(up, forward).normalize();

        // Apply bank angle rotation around forward axis (velocity axis)
        if (Math.abs(this.attitude.bankAngle) > 0.001) {
            const bankRad = THREE.MathUtils.degToRad(this.attitude.bankAngle);
            const bankQuat = new THREE.Quaternion();
            bankQuat.setFromAxisAngle(forward, bankRad);
            right.applyQuaternion(bankQuat);
            up.applyQuaternion(bankQuat);
        }

        // Create rotation matrix: [right, up, forward] maps to [X, Y, Z]
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, up, forward);

        // Extract quaternion
        this.attitude.quaternion.setFromRotationMatrix(rotationMatrix);

        // Apply to spacecraft group
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
        // DISABLED per user request - parachute not required
        console.log('Parachute deployment disabled');
    }

    ejectHeatShield() {
        // DISABLED per user request - heat shield removed from model
        console.log('Heat shield ejection disabled');
    }
    
    activateThrusters(active) {
        this.state.thrustersActive = active;
    }
    
    getObject3D() {
        return this.group;
    }
    
    /**
     * Switch to a different spacecraft model
     * @param {string} modelName - Name of the model to switch to ('primary', 'backup', 'cone')
     */
    async switchModel(modelName) {
        if (!this.assetLoader && modelName !== 'cone') {
            console.warn('Cannot switch to GLTF model without AssetLoader');
            return;
        }

        // Clear current model
        if (this.vehicleLOD) {
            this.group.remove(this.vehicleLOD);
            this.vehicleLOD.traverse((child) => {
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

        // Load new model based on selection
        switch (modelName) {
            case 'primary':
                {
                    const primaryModel = ModelSelector.getPrimaryModel();
                    this.useGLTF = true;
                    this.modelMetadata = primaryModel;
                    await this.loadGLTFModel(primaryModel.filename);
                }
                break;
            case 'backup':
            default:
                {
                    const backupModel = ModelSelector.getBackupModel();
                    this.useGLTF = true;
                    this.modelMetadata = backupModel;
                    await this.loadGLTFModel(backupModel.filename);
                }
                break;
        }

        console.log(`Switched spacecraft model to: ${modelName}`);
    }

    /**
     * Get available models
     */
    static getAvailableModels() {
        return [
            { id: 'primary', name: 'Dragon Spacecraft (GLTF)', requiresAssetLoader: true },
            { id: 'backup', name: 'Buran Spacecraft (GLTF)', requiresAssetLoader: true }
        ];
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
