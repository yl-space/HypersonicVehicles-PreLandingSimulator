/**
 * Mars.js - FIXED VERSION
 * Mars planet with correct NASA dimensions
 */

import * as THREE from 'three';

export class Mars {
    constructor() {
        this.group = new THREE.Group();
        this.radius = 10; // Mars scaled to match EntryVehicle scale
        this.atmosphere = null;
        this.surface = null;
        this.clouds = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createAtmosphere();
        this.createSurfaceFeatures();
    }
    
    createSurface() {
        // Create Mars sphere with high detail
        const geometry = new THREE.SphereGeometry(this.radius, 128, 64);
        
        // Create Mars texture programmatically
        const texture = this.createMarsTexture();
        
        const material = new THREE.MeshPhongMaterial({
            map: texture,
            bumpMap: texture,
            bumpScale: 2,
            specular: new THREE.Color(0x111111),
            shininess: 5
        });
        
        this.surface = new THREE.Mesh(geometry, material);
        this.surface.receiveShadow = true;
        this.surface.castShadow = true;
        
        // Position Mars at origin (0,0,0) for J2000 frame
        this.surface.position.set(0, 0, 0);
        this.group.add(this.surface);
    }
    
    createMarsTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Base Mars colors
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#d99559');    // Lighter orange-red
        gradient.addColorStop(0.3, '#c67b5c');   // Dusty red
        gradient.addColorStop(0.5, '#b87333');   // Rust orange
        gradient.addColorStop(0.7, '#a0522d');   // Darker rust
        gradient.addColorStop(1, '#8b4513');     // Dark brown
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add surface variation
        for (let i = 0; i < 1000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 15 + 3;
            const opacity = Math.random() * 0.3;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(139, 69, 19, ${opacity})`;
            ctx.fill();
        }
        
        // Add some darker regions (maria-like features)
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radiusX = Math.random() * 100 + 50;
            const radiusY = Math.random() * 50 + 25;
            
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(Math.random() * Math.PI);
            ctx.scale(1, radiusY / radiusX);
            ctx.beginPath();
            ctx.arc(0, 0, radiusX, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(60, 30, 10, 0.2)`;
            ctx.fill();
            ctx.restore();
        }
        
        // Add polar ice caps
        // North pole
        const northGradient = ctx.createRadialGradient(
            canvas.width / 2, 50, 0,
            canvas.width / 2, 50, 200
        );
        northGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        northGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = northGradient;
        ctx.fillRect(0, 0, canvas.width, 150);
        
        // South pole
        const southGradient = ctx.createRadialGradient(
            canvas.width / 2, canvas.height - 50, 0,
            canvas.width / 2, canvas.height - 50, 200
        );
        southGradient.addColorStop(0, 'rgba(255, 255, 255, 0.5)');
        southGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = southGradient;
        ctx.fillRect(0, canvas.height - 150, canvas.width, 150);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createAtmosphere() {
        // Thin atmospheric glow
        const atmosphereGeometry = new THREE.SphereGeometry(this.radius * 1.02, 64, 64);
        
        const atmosphereMaterial = new THREE.ShaderMaterial({
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 viewVector;
                uniform float c;
                uniform float p;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vec3 viewDir = normalize(cameraPosition - vPosition);
                    float intensity = pow(c - dot(vNormal, viewDir), p);
                    
                    // Mars atmosphere is thin and reddish
                    vec3 atmosphereColor = vec3(0.9, 0.6, 0.3);
                    float alpha = intensity * 0.15; // Very thin atmosphere
                    
                    gl_FragColor = vec4(atmosphereColor, alpha);
                }
            `,
            uniforms: {
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.5 },
                p: { value: 3.0 }
            },
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.group.add(this.atmosphere);
    }
    
    createSurfaceFeatures() {
        // Major surface features markers
        const features = [
            { name: 'Olympus Mons', lat: 18.65, lon: 226.2, scale: 30 },
            { name: 'Valles Marineris', lat: -14, lon: 301, scale: 50 },
            { name: 'Hellas Planitia', lat: -42.5, lon: 70, scale: 40 }
        ];
        
        features.forEach(feature => {
            const phi = (90 - feature.lat) * Math.PI / 180;
            const theta = feature.lon * Math.PI / 180;
            
            const x = this.radius * Math.sin(phi) * Math.cos(theta);
            const y = this.radius * Math.cos(phi);
            const z = this.radius * Math.sin(phi) * Math.sin(theta);
            
            // Add subtle marker
            const markerGeometry = new THREE.SphereGeometry(feature.scale, 8, 8);
            const markerMaterial = new THREE.MeshBasicMaterial({
                color: 0x663300,
                opacity: 0.3,
                transparent: true
            });
            
            const marker = new THREE.Mesh(markerGeometry, markerMaterial);
            marker.position.set(x, y, z);
            this.group.add(marker);
        });
    }
    
    update(camera, deltaTime) {
        // Update atmosphere shader with camera position
        if (this.atmosphere && this.atmosphere.material.uniforms) {
            this.atmosphere.material.uniforms.viewVector.value = 
                new THREE.Vector3().subVectors(camera.position, this.group.position);
        }
        
        // Slow rotation (Mars day = 24.6 hours)
        // For visualization, we'll make it rotate slowly
        this.surface.rotation.y += deltaTime * 0.01;
        
        // Atmosphere doesn't rotate
        if (this.atmosphere) {
            this.atmosphere.rotation.y = 0;
        }
    }
    
    getObject3D() {
        return this.group;
    }
    
    getRadius() {
        return this.radius;
    }
    
    dispose() {
        if (this.surface) {
            this.surface.geometry.dispose();
            this.surface.material.dispose();
        }
        
        if (this.atmosphere) {
            this.atmosphere.geometry.dispose();
            this.atmosphere.material.dispose();
        }
    }
}