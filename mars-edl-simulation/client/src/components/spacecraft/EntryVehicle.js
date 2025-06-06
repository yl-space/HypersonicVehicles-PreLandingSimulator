// client/src/components/spacecraft/EntryVehicle.js
import * as THREE from 'three';

/**
 * EntryVehicle Component - Mars Entry Capsule
 * 
 * This component teaches:
 * 1. Complex curved geometry creation
 * 2. Dynamic material properties for heat effects
 * 3. Particle systems for plasma effects
 * 4. Shader materials for advanced visuals
 */
export class EntryVehicle {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Entry Vehicle';
        
        // Component parts
        this.heatShield = null;
        this.backshell = null;
        this.thrusters = [];
        
        // Effects
        this.plasmaEffect = null;
        this.heatGlow = null;
        
        // State
        this.isInAtmosphere = false;
        this.entryAngle = 0;
        this.temperature = 300; // Kelvin
        this.maxTemperature = 2000;
        
        // Build components
        this.createHeatShield();
        this.createBackshell();
        this.createThrusters();
        this.createPlasmaEffect();
    }
    
    createHeatShield() {
        // Heat shield is a spherical section
        // We'll create it using a custom geometry for better control
        
        const radius = 4.5; // meters (scaled)
        const segments = 64;
        
        // Create custom geometry for heat shield shape
        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const normals = [];
        const uvs = [];
        const indices = [];
        
        // Generate vertices for spherical cap
        const phiStart = 0;
        const phiLength = Math.PI * 2;
        const thetaStart = Math.PI * 0.7; // Start angle (controls how much of sphere)
        const thetaLength = Math.PI * 0.3; // Length (creates the cap)
        
        for (let phi = 0; phi <= segments; phi++) {
            const u = phi / segments;
            
            for (let theta = 0; theta <= segments; theta++) {
                const v = theta / segments;
                
                // Spherical coordinates to Cartesian
                const phiAngle = phiStart + u * phiLength;
                const thetaAngle = thetaStart + v * thetaLength;
                
                const x = radius * Math.sin(thetaAngle) * Math.cos(phiAngle);
                const y = radius * Math.cos(thetaAngle);
                const z = radius * Math.sin(thetaAngle) * Math.sin(phiAngle);
                
                vertices.push(x, y, z);
                
                // Normal is just the normalized position for a sphere
                const normal = new THREE.Vector3(x, y, z).normalize();
                normals.push(normal.x, normal.y, normal.z);
                
                // UV coordinates
                uvs.push(u, v);
            }
        }
        
        // Generate indices for triangles
        for (let phi = 0; phi < segments; phi++) {
            for (let theta = 0; theta < segments; theta++) {
                const first = phi * (segments + 1) + theta;
                const second = first + segments + 1;
                
                // Two triangles per quad
                indices.push(first, second, first + 1);
                indices.push(second, second + 1, first + 1);
            }
        }
        
        // Set geometry attributes
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        
        // Create material with heat-reactive properties
        this.heatShieldMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513, // Saddle brown
            metalness: 0.2,
            roughness: 0.8,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        
        // Add texture for PICA tiles
        this.addHeatShieldTexture();
        
        this.heatShield = new THREE.Mesh(geometry, this.heatShieldMaterial);
        this.heatShield.rotation.x = Math.PI; // Flip to face down
        this.heatShield.castShadow = true;
        this.heatShield.receiveShadow = true;
        
        this.group.add(this.heatShield);
    }
    
    addHeatShieldTexture() {
        // Create procedural texture for PICA (Phenolic Impregnated Carbon Ablator) tiles
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
        
        // Add some variation to tiles
        for (let x = 0; x < 512; x += tileSize) {
            for (let y = 0; y < 512; y += tileSize) {
                if (Math.random() > 0.7) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
                    ctx.fillRect(x + 2, y + 2, tileSize - 4, tileSize - 4);
                }
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        this.heatShieldMaterial.map = texture;
        this.heatShieldMaterial.needsUpdate = true;
    }
    
    createBackshell() {
        // Backshell is a truncated cone
        const topRadius = 4.5;
        const bottomRadius = 2.25;
        const height = 3;
        const segments = 32;
        
        const geometry = new THREE.ConeGeometry(topRadius, height, segments, 1, true);
        
        // Modify vertices to create truncated cone
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
            const y = positions.getY(i);
            if (y > height / 2 - 0.1) {
                // Scale down the top vertices
                const x = positions.getX(i);
                const z = positions.getZ(i);
                const scale = bottomRadius / topRadius;
                positions.setXYZ(i, x * scale, y, z * scale);
            }
        }
        
        // Update geometry
        geometry.computeVertexNormals();
        positions.needsUpdate = true;
        
        // Material for backshell
        const material = new THREE.MeshStandardMaterial({
            color: 0xdddddd,
            metalness: 0.5,
            roughness: 0.4
        });
        
        this.backshell = new THREE.Mesh(geometry, material);
        this.backshell.position.y = 1.5;
        this.backshell.castShadow = true;
        
        // Add details to backshell
        this.addBackshellDetails();
        
        this.group.add(this.backshell);
    }
    
    addBackshellDetails() {
        // Add balance masses (ejected before entry)
        const massGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.4, 16);
        const massMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.7
        });
        
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            const radius = 3.5;
            
            const mass = new THREE.Mesh(massGeometry, massMaterial);
            mass.position.set(
                Math.cos(angle) * radius,
                1,
                Math.sin(angle) * radius
            );
            mass.userData.isBalanceMass = true;
            
            this.backshell.add(mass);
        }
        
        // Add parachute mortar cover
        const mortarGeometry = new THREE.CylinderGeometry(0.8, 0.8, 0.3, 16);
        const mortarMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.6
        });
        
        const mortar = new THREE.Mesh(mortarGeometry, mortarMaterial);
        mortar.position.y = 1.4;
        this.backshell.add(mortar);
    }
    
    createThrusters() {
        // RCS (Reaction Control System) thrusters for attitude control
        const thrusterGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
        const thrusterMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.2
        });
        
        // Thruster positions around backshell
        const positions = [
            { x: 3, y: 0.5, z: 0, rotation: { z: -Math.PI / 2 } },
            { x: -3, y: 0.5, z: 0, rotation: { z: Math.PI / 2 } },
            { x: 0, y: 0.5, z: 3, rotation: { x: Math.PI / 2 } },
            { x: 0, y: 0.5, z: -3, rotation: { x: -Math.PI / 2 } },
            // Additional thrusters for full control
            { x: 2, y: 1.5, z: 2, rotation: { z: -Math.PI / 4, x: Math.PI / 4 } },
            { x: -2, y: 1.5, z: 2, rotation: { z: Math.PI / 4, x: Math.PI / 4 } },
            { x: 2, y: 1.5, z: -2, rotation: { z: -Math.PI / 4, x: -Math.PI / 4 } },
            { x: -2, y: 1.5, z: -2, rotation: { z: Math.PI / 4, x: -Math.PI / 4 } }
        ];
        
        positions.forEach((pos, index) => {
            const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
            thruster.position.set(pos.x, pos.y, pos.z);
            
            if (pos.rotation) {
                thruster.rotation.x = pos.rotation.x || 0;
                thruster.rotation.z = pos.rotation.z || 0;
            }
            
            // Create flame effect (initially hidden)
            const flameGeometry = new THREE.ConeGeometry(0.08, 0.5, 8);
            const flameMaterial = new THREE.MeshBasicMaterial({
                color: 0xff6600,
                transparent: true,
                opacity: 0.8
            });
            
            const flame = new THREE.Mesh(flameGeometry, flameMaterial);
            flame.position.y = -0.4;
            flame.visible = false;
            thruster.add(flame);
            
            // Store reference
            this.thrusters.push({ mesh: thruster, flame: flame });
            
            this.backshell.add(thruster);
        });
    }
    
    createPlasmaEffect() {
        // Particle system for atmospheric entry plasma
        const particleCount = 2000;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const lifetimes = new Float32Array(particleCount);
        
        // Initialize particles
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Random position around heat shield
            const angle = Math.random() * Math.PI * 2;
            const radius = Math.random() * 5;
            
            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = -Math.random() * 2;
            positions[i3 + 2] = Math.sin(angle) * radius;
            
            // Velocity pointing backward
            velocities[i3] = (Math.random() - 0.5) * 2;
            velocities[i3 + 1] = Math.random() * 5 + 5;
            velocities[i3 + 2] = (Math.random() - 0.5) * 2;
            
            // Hot plasma colors (white-yellow-orange-red)
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
            
            sizes[i] = Math.random() * 0.3 + 0.1;
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        // Custom shader for plasma particles
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
    
    // State management methods
    enterAtmosphere() {
        this.isInAtmosphere = true;
        this.plasmaEffect.visible = true;
    }
    
    exitAtmosphere() {
        this.isInAtmosphere = false;
        this.plasmaEffect.visible = false;
        this.temperature = 300;
        this.updateHeatGlow();
    }
    
    ejectBalanceMasses() {
        // Animate balance masses being ejected
        this.backshell.children.forEach(child => {
            if (child.userData.isBalanceMass) {
                // Create ejection animation
                const direction = child.position.clone().normalize();
                child.userData.ejectionVelocity = direction.multiplyScalar(5);
                child.userData.ejected = true;
            }
        });
    }
    
    fireThruster(index, fire = true) {
        if (index < this.thrusters.length) {
            this.thrusters[index].flame.visible = fire;
        }
    }
    
    fireAllThrusters(fire = true) {
        this.thrusters.forEach(thruster => {
            thruster.flame.visible = fire;
        });
    }
    
    updateHeatGlow() {
        // Update heat shield glow based on temperature
        const normalizedTemp = (this.temperature - 300) / (this.maxTemperature - 300);
        
        if (normalizedTemp > 0) {
            // Interpolate color from dark red to white
            const r = 1;
            const g = Math.min(normalizedTemp * 2, 1);
            const b = Math.max(0, normalizedTemp * 2 - 1);
            
            this.heatShieldMaterial.emissive = new THREE.Color(r, g, b);
            this.heatShieldMaterial.emissiveIntensity = normalizedTemp;
        } else {
            this.heatShieldMaterial.emissive = new THREE.Color(0x000000);
            this.heatShieldMaterial.emissiveIntensity = 0;
        }
    }
    
    // Animation update
    update(deltaTime, velocity = 0, altitude = 100000) {
        // Update temperature based on velocity and altitude
        if (this.isInAtmosphere) {
            // Simplified heating model
            const atmosphericDensity = Math.exp(-altitude / 8000); // Scale height ~8km
            const heatingRate = velocity * velocity * atmosphericDensity * 0.00001;
            
            this.temperature += heatingRate * deltaTime;
            this.temperature = Math.min(this.temperature, this.maxTemperature);
            
            // Cool down
            this.temperature -= (this.temperature - 300) * 0.01 * deltaTime;
            
            this.updateHeatGlow();
        }
        
        // Update plasma effect
        if (this.plasmaEffect && this.plasmaEffect.visible) {
            const material = this.plasmaEffect.material;
            material.uniforms.time.value += deltaTime;
            material.uniforms.temperature.value = 
                (this.temperature - 300) / (this.maxTemperature - 300);
            
            // Regenerate particles that have died
            const positions = this.plasmaEffect.geometry.attributes.position;
            const velocities = this.plasmaEffect.geometry.attributes.velocity;
            const lifetimes = this.plasmaEffect.geometry.attributes.lifetime;
            
            for (let i = 0; i < lifetimes.count; i++) {
                lifetimes.array[i] += deltaTime;
                
                if (lifetimes.array[i] > 1) {
                    // Reset particle
                    lifetimes.array[i] = 0;
                    
                    const i3 = i * 3;
                    const angle = Math.random() * Math.PI * 2;
                    const radius = Math.random() * 5;
                    
                    positions.array[i3] = Math.cos(angle) * radius;
                    positions.array[i3 + 1] = -Math.random() * 2;
                    positions.array[i3 + 2] = Math.sin(angle) * radius;
                }
            }
            
            positions.needsUpdate = true;
            lifetimes.needsUpdate = true;
        }
        
        // Animate ejected balance masses
        this.backshell.children.forEach(child => {
            if (child.userData.ejected && child.userData.ejectionVelocity) {
                child.position.add(
                    child.userData.ejectionVelocity.clone().multiplyScalar(deltaTime)
                );
                child.rotation.x += deltaTime * 2;
                child.rotation.y += deltaTime * 3;
                
                // Remove when far enough
                if (child.position.length() > 50) {
                    this.backshell.remove(child);
                }
            }
        });
        
        // Thruster flame flicker
        this.thrusters.forEach(thruster => {
            if (thruster.flame.visible) {
                thruster.flame.material.opacity = 0.6 + Math.random() * 0.4;
                thruster.flame.scale.y = 0.8 + Math.random() * 0.4;
            }
        });
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
        
        if (this.plasmaEffect) {
            this.plasmaEffect.geometry.dispose();
            this.plasmaEffect.material.dispose();
        }
    }
}

// Usage example:
/*
const entryVehicle = new EntryVehicle();
scene.add(entryVehicle.group);

// During atmospheric entry
entryVehicle.enterAtmosphere();
entryVehicle.ejectBalanceMasses();

// In animation loop
entryVehicle.update(deltaTime, spacecraftVelocity, altitude);

// Fire specific thrusters for attitude control
entryVehicle.fireThruster(0, true); // Fire thruster 0
entryVehicle.fireAllThrusters(true); // Fire all thrusters
*/