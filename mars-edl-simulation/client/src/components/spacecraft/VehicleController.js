import * as THREE from 'three';

/**
 * Vehicle Controller
 * 
 * Handles:
 * 1. 3D vehicle model creation and management
 * 2. Vehicle animations and visual effects
 * 3. System deployments (parachute, heat shield, landing legs)
 * 4. Thruster effects and particle systems
 */
export class VehicleController {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Hypersonic Vehicle';
        
        // Vehicle components
        this.mainBody = null;
        this.heatShield = null;
        this.parachute = null;
        this.landingLegs = [];
        this.thrusters = [];
        this.rcsThrusters = [];
        
        // Effects
        this.mainEngineEffect = null;
        this.rcsEffects = [];
        this.plasmaEffect = null;
        this.heatGlow = null;
        
        // State
        this.isParachuteDeployed = false;
        this.isHeatShieldEjected = false;
        this.areLandingLegsDeployed = false;
        this.mainEngineActive = false;
        this.rcsActive = false;
        
        // Build vehicle
        this.createVehicle();
    }
    
    createVehicle() {
        // Create main vehicle body (capsule shape)
        this.createMainBody();
        
        // Create heat shield
        this.createHeatShield();
        
        // Create parachute (initially hidden)
        this.createParachute();
        
        // Create landing legs (initially retracted)
        this.createLandingLegs();
        
        // Create thrusters
        this.createMainThrusters();
        this.createRCSThrusters();
        
        // Create effects
        this.createEffects();
    }
    
    createMainBody() {
        // Main capsule body
        const bodyGeometry = new THREE.CapsuleGeometry(2, 6, 8, 16);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            metalness: 0.7,
            roughness: 0.3,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        
        this.mainBody = new THREE.Mesh(bodyGeometry, bodyMaterial);
        this.mainBody.castShadow = true;
        this.mainBody.receiveShadow = true;
        
        // Add details to main body
        this.addBodyDetails();
        
        this.group.add(this.mainBody);
    }
    
    addBodyDetails() {
        // Add windows
        const windowGeometry = new THREE.CircleGeometry(0.3, 16);
        const windowMaterial = new THREE.MeshStandardMaterial({
            color: 0x87ceeb,
            transparent: true,
            opacity: 0.8,
            metalness: 0.9,
            roughness: 0.1
        });
        
        // Front window
        const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
        frontWindow.position.set(0, 3, 0);
        frontWindow.rotation.x = Math.PI / 2;
        this.mainBody.add(frontWindow);
        
        // Side windows
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const window = new THREE.Mesh(windowGeometry, windowMaterial);
            window.position.set(
                Math.cos(angle) * 2,
                0,
                Math.sin(angle) * 2
            );
            window.rotation.y = angle;
            this.mainBody.add(window);
        }
        
        // Add antenna
        const antennaGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const antennaMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8
        });
        
        const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        antenna.position.set(0, 3.5, 0);
        this.mainBody.add(antenna);
    }
    
    createHeatShield() {
        // Heat shield is a curved surface at the bottom
        const shieldGeometry = new THREE.SphereGeometry(2.2, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const shieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            metalness: 0.2,
            roughness: 0.8,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        
        this.heatShield = new THREE.Mesh(shieldGeometry, shieldMaterial);
        this.heatShield.position.y = -3;
        this.heatShield.castShadow = true;
        
        // Add heat shield texture
        this.addHeatShieldTexture();
        
        this.group.add(this.heatShield);
    }
    
    addHeatShieldTexture() {
        // Create procedural texture for heat shield tiles
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base color
        ctx.fillStyle = '#4a3c28';
        ctx.fillRect(0, 0, 512, 512);
        
        // Tile pattern
        const tileSize = 64;
        ctx.strokeStyle = '#2a1c10';
        ctx.lineWidth = 2;
        
        for (let x = 0; x <= 512; x += tileSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, 512);
            ctx.stroke();
        }
        
        for (let y = 0; y <= 512; y += tileSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(512, y);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        this.heatShield.material.map = texture;
        this.heatShield.material.needsUpdate = true;
    }
    
    createParachute() {
        // Parachute canopy
        const canopyGeometry = new THREE.SphereGeometry(8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const canopyMaterial = new THREE.MeshStandardMaterial({
            color: 0xff6b6b,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        
        this.parachute = new THREE.Mesh(canopyGeometry, canopyMaterial);
        this.parachute.position.y = 10;
        this.parachute.visible = false;
        
        // Parachute lines
        this.createParachuteLines();
        
        this.group.add(this.parachute);
    }
    
    createParachuteLines() {
        const lineGeometry = new THREE.CylinderGeometry(0.02, 0.02, 10, 8);
        const lineMaterial = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            metalness: 0.8
        });
        
        // Create multiple lines around the parachute
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const line = new THREE.Mesh(lineGeometry, lineMaterial);
            
            line.position.set(
                Math.cos(angle) * 2,
                5,
                Math.sin(angle) * 2
            );
            
            line.rotation.z = Math.atan2(Math.sin(angle), Math.cos(angle));
            line.visible = false;
            
            this.parachute.add(line);
        }
    }
    
    createLandingLegs() {
        const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
        const legMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.7
        });
        
        // Create 4 landing legs
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            
            leg.position.set(
                Math.cos(angle) * 2.5,
                -2,
                Math.sin(angle) * 2.5
            );
            
            leg.rotation.z = Math.PI / 2;
            leg.rotation.y = angle;
            leg.visible = false;
            
            this.landingLegs.push(leg);
            this.group.add(leg);
        }
    }
    
    createMainThrusters() {
        const thrusterGeometry = new THREE.ConeGeometry(0.3, 1, 8);
        const thrusterMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8
        });
        
        // Main engine at the bottom
        const mainThruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
        mainThruster.position.y = -3.5;
        mainThruster.rotation.x = Math.PI;
        
        this.thrusters.push(mainThruster);
        this.group.add(mainThruster);
    }
    
    createRCSThrusters() {
        const rcsGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const rcsMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8
        });
        
        // RCS thruster positions around the vehicle
        const positions = [
            { x: 2, y: 0, z: 0, rotation: { z: -Math.PI / 2 } },
            { x: -2, y: 0, z: 0, rotation: { z: Math.PI / 2 } },
            { x: 0, y: 0, z: 2, rotation: { x: Math.PI / 2 } },
            { x: 0, y: 0, z: -2, rotation: { x: -Math.PI / 2 } },
            { x: 1.5, y: 2, z: 1.5, rotation: { z: -Math.PI / 4, x: Math.PI / 4 } },
            { x: -1.5, y: 2, z: 1.5, rotation: { z: Math.PI / 4, x: Math.PI / 4 } },
            { x: 1.5, y: 2, z: -1.5, rotation: { z: -Math.PI / 4, x: -Math.PI / 4 } },
            { x: -1.5, y: 2, z: -1.5, rotation: { z: Math.PI / 4, x: -Math.PI / 4 } }
        ];
        
        positions.forEach((pos, index) => {
            const thruster = new THREE.Mesh(rcsGeometry, rcsMaterial);
            thruster.position.set(pos.x, pos.y, pos.z);
            
            if (pos.rotation) {
                thruster.rotation.x = pos.rotation.x || 0;
                thruster.rotation.z = pos.rotation.z || 0;
            }
            
            this.rcsThrusters.push(thruster);
            this.group.add(thruster);
        });
    }
    
    createEffects() {
        // Main engine effect
        this.createMainEngineEffect();
        
        // RCS effects
        this.createRCSEffects();
        
        // Plasma effect for atmospheric entry
        this.createPlasmaEffect();
    }
    
    createMainEngineEffect() {
        const particleCount = 500;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const lifetimes = new Float32Array(particleCount);
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Random position in engine nozzle
            positions[i3] = (Math.random() - 0.5) * 0.5;
            positions[i3 + 1] = -3.5;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.5;
            
            // Velocity pointing downward
            velocities[i3] = (Math.random() - 0.5) * 2;
            velocities[i3 + 1] = -Math.random() * 10 - 5;
            velocities[i3 + 2] = (Math.random() - 0.5) * 2;
            
            // Engine exhaust colors
            const heat = Math.random();
            if (heat > 0.8) {
                colors[i3] = 1;
                colors[i3 + 1] = 1;
                colors[i3 + 2] = 1;
            } else if (heat > 0.5) {
                colors[i3] = 1;
                colors[i3 + 1] = 0.5;
                colors[i3 + 2] = 0;
            } else {
                colors[i3] = 0.8;
                colors[i3 + 1] = 0.3;
                colors[i3 + 2] = 0;
            }
            
            sizes[i] = Math.random() * 0.5 + 0.1;
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute vec3 velocity;
                attribute float size;
                attribute float lifetime;
                varying vec3 vColor;
                varying float vLifetime;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vLifetime = lifetime;
                    
                    vec3 pos = position + velocity * mod(time + lifetime, 1.0);
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vLifetime;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float opacity = (1.0 - dist * 2.0) * (1.0 - vLifetime);
                    gl_FragColor = vec4(vColor, opacity);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        
        this.mainEngineEffect = new THREE.Points(geometry, material);
        this.mainEngineEffect.visible = false;
        this.group.add(this.mainEngineEffect);
    }
    
    createRCSEffects() {
        // Create RCS effects for each thruster
        this.rcsThrusters.forEach((thruster, index) => {
            const effect = this.createRCSEffect();
            effect.position.copy(thruster.position);
            effect.rotation.copy(thruster.rotation);
            effect.visible = false;
            
            this.rcsEffects.push(effect);
            this.group.add(effect);
        });
    }
    
    createRCSEffect() {
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const lifetimes = new Float32Array(particleCount);
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            positions[i3] = (Math.random() - 0.5) * 0.2;
            positions[i3 + 1] = 0;
            positions[i3 + 2] = (Math.random() - 0.5) * 0.2;
            
            velocities[i3] = (Math.random() - 0.5) * 3;
            velocities[i3 + 1] = -Math.random() * 5 - 2;
            velocities[i3 + 2] = (Math.random() - 0.5) * 3;
            
            colors[i3] = 0.8;
            colors[i3 + 1] = 0.8;
            colors[i3 + 2] = 1.0;
            
            sizes[i] = Math.random() * 0.3 + 0.05;
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute vec3 velocity;
                attribute float size;
                attribute float lifetime;
                varying vec3 vColor;
                varying float vLifetime;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vLifetime = lifetime;
                    
                    vec3 pos = position + velocity * mod(time + lifetime, 1.0);
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vLifetime;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float opacity = (1.0 - dist * 2.0) * (1.0 - vLifetime);
                    gl_FragColor = vec4(vColor, opacity);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        
        return new THREE.Points(geometry, material);
    }
    
    createPlasmaEffect() {
        // Plasma effect for atmospheric entry
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const lifetimes = new Float32Array(particleCount);
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 3;
            
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = -Math.random() * 2;
            positions[i3 + 2] = Math.sin(angle) * radius;
            
            velocities[i3] = (Math.random() - 0.5) * 2;
            velocities[i3 + 1] = Math.random() * 3 + 2;
            velocities[i3 + 2] = (Math.random() - 0.5) * 2;
            
            // Plasma colors
            const heat = Math.random();
            if (heat > 0.8) {
                colors[i3] = 1;
                colors[i3 + 1] = 1;
                colors[i3 + 2] = 1;
            } else if (heat > 0.6) {
                colors[i3] = 1;
                colors[i3 + 1] = 1;
                colors[i3 + 2] = 0.5;
            } else if (heat > 0.3) {
                colors[i3] = 1;
                colors[i3 + 1] = 0.5;
                colors[i3 + 2] = 0;
            } else {
                colors[i3] = 1;
                colors[i3 + 1] = 0.2;
                colors[i3 + 2] = 0;
            }
            
            sizes[i] = Math.random() * 0.4 + 0.1;
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                temperature: { value: 0 }
            },
            vertexShader: `
                attribute vec3 velocity;
                attribute float size;
                attribute float lifetime;
                varying vec3 vColor;
                varying float vLifetime;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vLifetime = lifetime;
                    
                    vec3 pos = position + velocity * mod(time + lifetime, 1.0);
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vLifetime;
                uniform float temperature;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    
                    float opacity = (1.0 - dist * 2.0) * (1.0 - vLifetime) * temperature;
                    gl_FragColor = vec4(vColor, opacity);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        
        this.plasmaEffect = new THREE.Points(geometry, material);
        this.plasmaEffect.visible = false;
        this.group.add(this.plasmaEffect);
    }
    
    // Update methods
    update(deltaTime, vehicleState, controls) {
        // Update vehicle position and orientation
        this.group.position.copy(vehicleState.position);
        this.group.quaternion.copy(vehicleState.orientation);
        
        // Update effects
        this.updateEffects(deltaTime, controls);
        
        // Update heat shield glow based on temperature
        this.updateHeatGlow(vehicleState.temperature);
        
        // Update plasma effect
        this.updatePlasmaEffect(deltaTime, vehicleState);
    }
    
    updateEffects(deltaTime, controls) {
        // Update main engine effect
        if (this.mainEngineEffect) {
            this.mainEngineEffect.visible = controls.mainThrust > 0;
            if (this.mainEngineEffect.visible) {
                this.mainEngineEffect.material.uniforms.time.value += deltaTime;
                
                // Regenerate particles
                const positions = this.mainEngineEffect.geometry.attributes.position;
                const lifetimes = this.mainEngineEffect.geometry.attributes.lifetime;
                
                for (let i = 0; i < lifetimes.count; i++) {
                    lifetimes.array[i] += deltaTime;
                    
                    if (lifetimes.array[i] > 1) {
                        lifetimes.array[i] = 0;
                        
                        const i3 = i * 3;
                        positions.array[i3] = (Math.random() - 0.5) * 0.5;
                        positions.array[i3 + 1] = -3.5;
                        positions.array[i3 + 2] = (Math.random() - 0.5) * 0.5;
                    }
                }
                
                positions.needsUpdate = true;
                lifetimes.needsUpdate = true;
            }
        }
        
        // Update RCS effects
        this.rcsEffects.forEach((effect, index) => {
            effect.visible = controls.rcsThrust > 0;
            if (effect.visible) {
                effect.material.uniforms.time.value += deltaTime;
            }
        });
    }
    
    updateHeatGlow(temperature) {
        if (this.heatShield) {
            const normalizedTemp = (temperature - 300) / 1700; // 300K to 2000K
            
            if (normalizedTemp > 0) {
                const r = 1;
                const g = Math.min(normalizedTemp * 2, 1);
                const b = Math.max(0, normalizedTemp * 2 - 1);
                
                this.heatShield.material.emissive = new THREE.Color(r, g, b);
                this.heatShield.material.emissiveIntensity = normalizedTemp;
            } else {
                this.heatShield.material.emissive = new THREE.Color(0x000000);
                this.heatShield.material.emissiveIntensity = 0;
            }
        }
    }
    
    updatePlasmaEffect(deltaTime, vehicleState) {
        if (this.plasmaEffect) {
            // Show plasma effect during atmospheric entry
            const altitude = vehicleState.altitude;
            const velocity = vehicleState.velocity.length();
            
            this.plasmaEffect.visible = altitude < 100000 && velocity > 2000;
            
            if (this.plasmaEffect.visible) {
                this.plasmaEffect.material.uniforms.time.value += deltaTime;
                this.plasmaEffect.material.uniforms.temperature.value = 
                    Math.min(1, velocity / 5000);
            }
        }
    }
    
    // System deployment methods
    deployParachute() {
        if (!this.isParachuteDeployed) {
            this.parachute.visible = true;
            this.parachute.children.forEach(child => {
                child.visible = true;
            });
            
            // Animate parachute deployment
            this.animateParachuteDeployment();
            
            this.isParachuteDeployed = true;
        }
    }
    
    retractParachute() {
        if (this.isParachuteDeployed) {
            this.parachute.visible = false;
            this.parachute.children.forEach(child => {
                child.visible = false;
            });
            
            this.isParachuteDeployed = false;
        }
    }
    
    animateParachuteDeployment() {
        // Simple scale animation for parachute deployment
        this.parachute.scale.set(0, 0, 0);
        
        const animate = () => {
            this.parachute.scale.x += 0.1;
            this.parachute.scale.y += 0.1;
            this.parachute.scale.z += 0.1;
            
            if (this.parachute.scale.x < 1) {
                requestAnimationFrame(animate);
            } else {
                this.parachute.scale.set(1, 1, 1);
            }
        };
        
        animate();
    }
    
    ejectHeatShield() {
        if (!this.isHeatShieldEjected) {
            // Animate heat shield ejection
            const direction = new THREE.Vector3(0, -1, 0);
            const velocity = direction.multiplyScalar(10);
            
            const animate = () => {
                this.heatShield.position.add(velocity.clone().multiplyScalar(0.016));
                this.heatShield.rotation.x += 0.1;
                this.heatShield.rotation.z += 0.05;
                
                if (this.heatShield.position.y > -50) {
                    requestAnimationFrame(animate);
                } else {
                    this.heatShield.visible = false;
                }
            };
            
            animate();
            
            this.isHeatShieldEjected = true;
        }
    }
    
    deployLandingLegs() {
        if (!this.areLandingLegsDeployed) {
            this.landingLegs.forEach((leg, index) => {
                leg.visible = true;
                
                // Animate leg deployment
                const startRotation = leg.rotation.z;
                const targetRotation = startRotation + Math.PI / 2;
                
                const animate = () => {
                    leg.rotation.z += 0.05;
                    
                    if (leg.rotation.z < targetRotation) {
                        requestAnimationFrame(animate);
                    }
                };
                
                animate();
            });
            
            this.areLandingLegsDeployed = true;
        }
    }
    
    // Public methods
    createVehicleMesh() {
        return this.group;
    }
    
    getVehicleGroup() {
        return this.group;
    }
    
    // Cleanup
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
} 