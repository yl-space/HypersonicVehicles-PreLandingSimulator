/**
 * EntryVehicle.js
 * Mars Entry Vehicle with heat shield, backshell, and parachute
 */

import * as THREE from 'three';

export class EntryVehicle {
    constructor() {
        this.group = new THREE.Group();
        this.components = {};
        this.effects = {};
        
        // Vehicle state
        this.state = {
            heatShieldAttached: true,
            parachuteDeployed: false,
            thrustersActive: false,
            heatLevel: 0
        };
        
        this.init();
    }
    
    init() {
        this.createHeatShield();
        this.createBackshell();
        this.createParachute();
        this.createHeatEffect();
        this.createThrusterEffects();
    }
    
    createHeatShield() {
        // Main heat shield geometry (aeroshell)
        const heatShieldGeometry = new THREE.ConeGeometry(5, 8, 32);
        const heatShieldMaterial = new THREE.MeshPhongMaterial({
            color: 0xcccccc,
            emissive: 0x111111,
            emissiveIntensity: 0.1,
            shininess: 100,
            metalness: 0.3,
            roughness: 0.4
        });
        
        this.components.heatShield = new THREE.Mesh(heatShieldGeometry, heatShieldMaterial);
        this.components.heatShield.rotation.x = Math.PI;
        this.components.heatShield.position.y = 4;
        this.components.heatShield.castShadow = true;
        this.components.heatShield.receiveShadow = true;
        
        // Add thermal protection tiles detail
        const tilesTexture = this.createTilesTexture();
        const tilesMaterial = new THREE.MeshPhongMaterial({
            map: tilesTexture,
            normalScale: new THREE.Vector2(0.5, 0.5),
            bumpScale: 0.05
        });
        
        const tilesGeometry = new THREE.ConeGeometry(5.1, 8.1, 32);
        const tiles = new THREE.Mesh(tilesGeometry, tilesMaterial);
        tiles.rotation.x = Math.PI;
        tiles.position.y = 4;
        
        this.components.heatShield.add(tiles);
        this.group.add(this.components.heatShield);
    }
    
    createBackshell() {
        // Main backshell structure
        const backshellGroup = new THREE.Group();
        
        // Primary shell
        const shellGeometry = new THREE.CylinderGeometry(5, 5, 4, 32);
        const shellMaterial = new THREE.MeshPhongMaterial({
            color: 0xaaaaaa,
            emissive: 0x111111,
            emissiveIntensity: 0.05,
            shininess: 50,
            metalness: 0.2,
            roughness: 0.6
        });
        
        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        shell.castShadow = true;
        shell.receiveShadow = true;
        backshellGroup.add(shell);
        
        // Add detail panels
        const panelGeometry = new THREE.BoxGeometry(1, 0.5, 0.1);
        const panelMaterial = new THREE.MeshPhongMaterial({
            color: 0x888888
        });
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const panel = new THREE.Mesh(panelGeometry, panelMaterial);
            panel.position.x = Math.cos(angle) * 4.5;
            panel.position.z = Math.sin(angle) * 4.5;
            panel.rotation.y = angle;
            backshellGroup.add(panel);
        }
        
        // Thruster nozzles
        const nozzleGeometry = new THREE.ConeGeometry(0.3, 1, 8);
        const nozzleMaterial = new THREE.MeshPhongMaterial({
            color: 0x444444,
            emissive: 0x222222
        });
        
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const nozzle = new THREE.Mesh(nozzleGeometry, nozzleMaterial);
            nozzle.position.x = Math.cos(angle) * 3;
            nozzle.position.y = -2;
            nozzle.position.z = Math.sin(angle) * 3;
            nozzle.rotation.x = -Math.PI / 2;
            backshellGroup.add(nozzle);
        }
        
        this.components.backshell = backshellGroup;
        this.group.add(this.components.backshell);
    }
    
    createParachute() {
        const parachuteGroup = new THREE.Group();
        
        // Parachute canopy
        const canopyGeometry = new THREE.ConeGeometry(20, 15, 16, 8, true);
        const canopyMaterial = new THREE.MeshPhongMaterial({
            color: 0xff6644,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9,
            emissive: 0x331100,
            emissiveIntensity: 0.1
        });
        
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = 20;
        canopy.castShadow = true;
        parachuteGroup.add(canopy);
        
        // Add parachute pattern
        const patternGeometry = new THREE.ConeGeometry(19.5, 14.5, 16, 8, true);
        const patternMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
        });
        
        const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
        pattern.position.y = 20;
        parachuteGroup.add(pattern);
        
        // Suspension lines
        const linesMaterial = new THREE.LineBasicMaterial({ 
            color: 0x666666,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(Math.cos(angle) * 15, 20, Math.sin(angle) * 15)
            ];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(lineGeometry, linesMaterial);
            parachuteGroup.add(line);
        }
        
        // Initially hidden
        parachuteGroup.visible = false;
        parachuteGroup.scale.set(0.1, 0.1, 0.1);
        
        this.components.parachute = parachuteGroup;
        this.group.add(this.components.parachute);
    }
    
    createHeatEffect() {
        // Plasma glow effect
        const glowGeometry = new THREE.SphereGeometry(10, 32, 32);
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                intensity: { value: 0.0 },
                color: { value: new THREE.Color(0xff6600) }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float intensity;
                uniform vec3 color;
                varying vec3 vNormal;
                void main() {
                    float glow = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
                    gl_FragColor = vec4(color, glow * intensity);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.group.add(this.effects.heatGlow);
        
        // Plasma trail particles
        const particleCount = 1000;
        const particlesGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i++) {
            positions[i] = 0;
            velocities[i] = (Math.random() - 0.5) * 0.1;
        }
        
        particlesGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        particlesGeometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const particlesMaterial = new THREE.PointsMaterial({
            color: 0xff6600,
            size: 2,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.effects.plasmaTrail = new THREE.Points(particlesGeometry, particlesMaterial);
        this.effects.plasmaTrail.visible = false;
        this.group.add(this.effects.plasmaTrail);
    }
    
    createThrusterEffects() {
        this.effects.thrusters = [];
        
        const thrusterGeometry = new THREE.ConeGeometry(0.5, 3, 8);
        const thrusterMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
            const thruster = new THREE.Mesh(thrusterGeometry, thrusterMaterial);
            thruster.position.x = Math.cos(angle) * 3;
            thruster.position.y = -3;
            thruster.position.z = Math.sin(angle) * 3;
            thruster.rotation.x = Math.PI / 2;
            thruster.visible = false;
            
            this.effects.thrusters.push(thruster);
            this.group.add(thruster);
        }
    }
    
    createTilesTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create tile pattern
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, 512, 512);
        
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 2;
        
        const tileSize = 32;
        for (let x = 0; x < 512; x += tileSize) {
            for (let y = 0; y < 512; y += tileSize) {
                ctx.strokeRect(x, y, tileSize, tileSize);
            }
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    // Update methods
    update(time, data) {
        // Update heat effect based on velocity
        if (data && this.effects.heatGlow) {
            const heatIntensity = Math.min(data.velocity / 12000, 1);
            this.effects.heatGlow.material.uniforms.intensity.value = heatIntensity;
            
            // Update heat color (orange to white at peak)
            const heatColor = new THREE.Color();
            heatColor.setHSL(0.1 - heatIntensity * 0.1, 1, 0.5 + heatIntensity * 0.3);
            this.effects.heatGlow.material.uniforms.color.value = heatColor;
            
            // Show plasma trail during high heating
            this.effects.plasmaTrail.visible = heatIntensity > 0.3;
            
            // Update plasma trail particles
            if (this.effects.plasmaTrail.visible) {
                const positions = this.effects.plasmaTrail.geometry.attributes.position.array;
                const velocities = this.effects.plasmaTrail.geometry.attributes.velocity.array;
                
                for (let i = 0; i < positions.length; i += 3) {
                    positions[i] += velocities[i];
                    positions[i + 1] += velocities[i + 1] - 0.1;
                    positions[i + 2] += velocities[i + 2];
                    
                    // Reset particles that have fallen too far
                    if (positions[i + 1] < -50) {
                        positions[i] = (Math.random() - 0.5) * 10;
                        positions[i + 1] = 0;
                        positions[i + 2] = (Math.random() - 0.5) * 10;
                    }
                }
                
                this.effects.plasmaTrail.geometry.attributes.position.needsUpdate = true;
            }
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
                thruster.scale.y = 1 + Math.random() * 0.3;
                thruster.material.opacity = 0.6 + Math.random() * 0.2;
            });
        } else {
            this.effects.thrusters.forEach(thruster => {
                thruster.visible = false;
            });
        }
    }
    
    // Control methods
    deployParachute() {
        this.state.parachuteDeployed = true;
        this.components.parachute.visible = true;
        this.components.parachute.scale.set(0.1, 0.1, 0.1);
    }
    
    ejectHeatShield() {
        this.state.heatShieldAttached = false;
        
        // Animate heat shield separation
        const heatShield = this.components.heatShield;
        const duration = 2000;
        const startTime = Date.now();
        
        const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            heatShield.position.y = 4 - progress * 50;
            heatShield.rotation.x = Math.PI + progress * Math.PI * 2;
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
}