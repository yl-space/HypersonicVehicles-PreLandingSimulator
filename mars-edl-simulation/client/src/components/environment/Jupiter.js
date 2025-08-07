/**
 * Mars.js
 * Mars planet with surface features and atmosphere
 */

import * as THREE from 'three';

export class Mars {
    constructor() {
        this.group = new THREE.Group();
        this.radius = 3389.5; // km
        this.atmosphere = null;
        this.surface = null;
        this.clouds = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createAtmosphere();
        this.createSurfaceFeatures();
        this.createDustEffects();
    }
    
    createSurface() {
        // Main Mars sphere
        const geometry = new THREE.SphereGeometry(this.radius, 128, 64);
        
        // Create Mars texture with canvas
        const texture = this.createMarsTexture();
        
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            bumpMap: texture,
            bumpScale: 5,
            specularMap: texture,
            specular: new THREE.Color(0x222222),
            shininess: 5
        });
        
        this.surface = new THREE.Mesh(geometry, material);
        this.surface.receiveShadow = true;
        this.surface.castShadow = true;
        this.group.add(this.surface);
    }
    
    createMarsTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Base color
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#C67B5C');
        gradient.addColorStop(0.5, '#B87333');
        gradient.addColorStop(1, '#8B4513');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add surface features
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 20 + 5;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 69, 19, ${Math.random() * 0.3})`;
            ctx.fill();
        }
        
        // Add polar ice caps
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(0, 0, canvas.width, 50);
        ctx.fillRect(0, canvas.height - 50, canvas.width, 50);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createAtmosphere() {
        // Atmospheric glow
        const atmosphereGeometry = new THREE.SphereGeometry(this.radius * 1.01, 64, 64);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    float intensity = pow(0.7 - dot(vNormal, vec3(0, 0, 1.0)), 2.0);
                    vec3 atmosphereColor = vec3(0.8, 0.5, 0.3);
                    
                    gl_FragColor = vec4(atmosphereColor, intensity * 0.4);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.group.add(this.atmosphere);
    }
    
    createSurfaceFeatures() {
        // Major surface features
        const features = [
            { name: 'Olympus Mons', lat: 18.65, lon: 226.2, radius: 300 },
            { name: 'Valles Marineris', lat: -14, lon: 301, radius: 500 },
            { name: 'Hellas Planitia', lat: -42.5, lon: 70, radius: 400 }
        ];
        
        features.forEach(feature => {
            const phi = (90 - feature.lat) * Math.PI / 180;
            const theta = feature.lon * Math.PI / 180;
            
            const x = this.radius * Math.sin(phi) * Math.cos(theta);
            const y = this.radius * Math.cos(phi);
            const z = this.radius * Math.sin(phi) * Math.sin(theta);
            
            // Create feature marker
            const geometry = new THREE.SphereGeometry(feature.radius / 10, 16, 16);
            const material = new THREE.MeshPhongMaterial({
                color: 0x663333,
                emissive: 0x331111,
                emissiveIntensity: 0.1
            });
            
            const marker = new THREE.Mesh(geometry, material);
            marker.position.set(x * 1.001, y * 1.001, z * 1.001);
            this.group.add(marker);
        });
    }
    
    createDustEffects() {
        // Dust storm particles
        const particleCount = 5000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            // Random position around Mars
            const phi = Math.random() * Math.PI * 2;
            const theta = Math.acos(2 * Math.random() - 1);
            const radius = this.radius + Math.random() * 50;
            
            positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
            positions[i * 3 + 1] = radius * Math.cos(theta);
            positions[i * 3 + 2] = radius * Math.sin(theta) * Math.sin(phi);
            
            // Dust color
            colors[i * 3] = 0.8;
            colors[i * 3 + 1] = 0.5;
            colors[i * 3 + 2] = 0.3;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending
        });
        
        this.clouds = new THREE.Points(geometry, material);
        this.group.add(this.clouds);
    }
    
    // Create landing site marker
    createLandingSiteMarker(lat, lon) {
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        
        const x = this.radius * Math.sin(phi) * Math.cos(theta);
        const y = this.radius * Math.cos(phi);
        const z = this.radius * Math.sin(phi) * Math.sin(theta);
        
        // Marker geometry
        const geometry = new THREE.CylinderGeometry(0, 10, 20, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            emissive: 0xff3300,
            emissiveIntensity: 0.5
        });
        
        const marker = new THREE.Mesh(geometry, material);
        marker.position.set(x * 1.01, y * 1.01, z * 1.01);
        
        // Orient marker to point away from surface
        marker.lookAt(0, 0, 0);
        marker.rotateX(-Math.PI / 2);
        
        // Add pulsing animation
        const pulseAnimation = () => {
            marker.scale.y = 1 + Math.sin(Date.now() * 0.003) * 0.2;
            requestAnimationFrame(pulseAnimation);
        };
        pulseAnimation();
        
        this.group.add(marker);
        return marker;
    }
    
    // Create impact dust effect for landing
    createLandingDust(position) {
        const dustCount = 1000;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(dustCount * 3);
        const velocities = new Float32Array(dustCount * 3);
        
        for (let i = 0; i < dustCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 50 + 10;
            
            positions[i * 3] = position.x;
            positions[i * 3 + 1] = position.y;
            positions[i * 3 + 2] = position.z;
            
            velocities[i * 3] = Math.cos(angle) * speed;
            velocities[i * 3 + 1] = Math.random() * 30 + 10;
            velocities[i * 3 + 2] = Math.sin(angle) * speed;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        
        const material = new THREE.PointsMaterial({
            color: 0xB87333,
            size: 5,
            transparent: true,
            opacity: 0.8,
            blending: THREE.NormalBlending
        });
        
        const dust = new THREE.Points(geometry, material);
        this.group.add(dust);
        
        // Animate dust
        const startTime = Date.now();
        const animateDust = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            
            if (elapsed < 3) {
                const positions = dust.geometry.attributes.position.array;
                const velocities = dust.geometry.attributes.velocity.array;
                
                for (let i = 0; i < dustCount; i++) {
                    positions[i * 3] += velocities[i * 3] * 0.016;
                    positions[i * 3 + 1] += (velocities[i * 3 + 1] - elapsed * 20) * 0.016;
                    positions[i * 3 + 2] += velocities[i * 3 + 2] * 0.016;
                }
                
                dust.geometry.attributes.position.needsUpdate = true;
                dust.material.opacity = 0.8 * (1 - elapsed / 3);
                
                requestAnimationFrame(animateDust);
            } else {
                this.group.remove(dust);
                dust.geometry.dispose();
                dust.material.dispose();
            }
        };
        
        animateDust();
    }
    
    update(deltaTime) {
        // Planet rotation removed for clearer coordinate reference
        // Jupiter remains stationary relative to coordinate axes
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        this.surface.geometry.dispose();
        this.surface.material.dispose();
        this.atmosphere.geometry.dispose();
        this.atmosphere.material.dispose();
        
        if (this.clouds) {
            this.clouds.geometry.dispose();
            this.clouds.material.dispose();
        }
    }
}