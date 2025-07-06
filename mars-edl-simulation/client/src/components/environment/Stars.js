/**
 * Stars.js
 * Creates a realistic starfield background
 */

import * as THREE from 'three';

export class Stars {
    constructor() {
        this.group = new THREE.Group();
        this.stars = [];
        this.nebula = null;
        
        this.init();
    }
    
    init() {
        this.createStarfield();
        this.createBrightStars();
        this.createNebula();
        this.createMilkyWay();
    }
    
    createStarfield() {
        // Multiple star layers for depth
        const starLayers = [
            { count: 5000, size: 0.5, distance: 10000, brightness: 0.5 },
            { count: 3000, size: 1.0, distance: 20000, brightness: 0.7 },
            { count: 1000, size: 2.0, distance: 30000, brightness: 1.0 }
        ];
        
        starLayers.forEach(layer => {
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(layer.count * 3);
            const colors = new Float32Array(layer.count * 3);
            const sizes = new Float32Array(layer.count);
            
            for (let i = 0; i < layer.count; i++) {
                // Random position on sphere
                const theta = Math.random() * Math.PI * 2;
                const phi = Math.acos(2 * Math.random() - 1);
                const radius = layer.distance + Math.random() * 5000;
                
                positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = radius * Math.cos(phi);
                positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
                
                // Star color variation (blue to white to yellow)
                const colorTemp = Math.random();
                if (colorTemp < 0.3) {
                    // Blue stars
                    colors[i * 3] = 0.7;
                    colors[i * 3 + 1] = 0.8;
                    colors[i * 3 + 2] = 1.0;
                } else if (colorTemp < 0.7) {
                    // White stars
                    colors[i * 3] = 1.0;
                    colors[i * 3 + 1] = 1.0;
                    colors[i * 3 + 2] = 1.0;
                } else {
                    // Yellow/orange stars
                    colors[i * 3] = 1.0;
                    colors[i * 3 + 1] = 0.9;
                    colors[i * 3 + 2] = 0.7;
                }
                
                // Random size variation
                sizes[i] = layer.size * (0.5 + Math.random());
            }
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
            
            // Custom shader for better star rendering
            const material = new THREE.ShaderMaterial({
                uniforms: {
                    brightness: { value: layer.brightness }
                },
                vertexShader: `
                    attribute float size;
                    varying vec3 vColor;
                    
                    void main() {
                        vColor = color;
                        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                        gl_PointSize = size * (300.0 / -mvPosition.z);
                        gl_Position = projectionMatrix * mvPosition;
                    }
                `,
                fragmentShader: `
                    uniform float brightness;
                    varying vec3 vColor;
                    
                    void main() {
                        float r = 0.0;
                        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                        r = dot(cxy, cxy);
                        
                        if (r > 1.0) {
                            discard;
                        }
                        
                        float intensity = 1.0 - sqrt(r);
                        intensity = pow(intensity, 2.0);
                        
                        gl_FragColor = vec4(vColor * brightness, intensity);
                    }
                `,
                blending: THREE.AdditiveBlending,
                depthWrite: false,
                vertexColors: true
            });
            
            const stars = new THREE.Points(geometry, material);
            this.stars.push(stars);
            this.group.add(stars);
        });
    }
    
    createBrightStars() {
        // Add some extra bright stars (e.g., planets, bright stars)
        const brightStarCount = 20;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(brightStarCount * 3);
        const colors = new Float32Array(brightStarCount * 3);
        
        for (let i = 0; i < brightStarCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const radius = 40000 + Math.random() * 10000;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.cos(phi);
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
            
            // Bright white color
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 1.0;
            colors[i * 3 + 2] = 1.0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 50,
            vertexColors: true,
            transparent: true,
            opacity: 1.0,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            map: this.createStarTexture()
        });
        
        const brightStars = new THREE.Points(geometry, material);
        this.group.add(brightStars);
    }
    
    createStarTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        // Create gradient for star appearance
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.1, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.3, 'rgba(255, 255, 255, 0.3)');
        gradient.addColorStop(0.6, 'rgba(255, 255, 255, 0.1)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        // Add diffraction spikes
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 32);
        ctx.lineTo(64, 32);
        ctx.moveTo(32, 0);
        ctx.lineTo(32, 64);
        ctx.stroke();
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createNebula() {
        // Create subtle nebula clouds
        const nebulaGeometry = new THREE.BufferGeometry();
        const nebulaCount = 500;
        const positions = new Float32Array(nebulaCount * 3);
        const colors = new Float32Array(nebulaCount * 3);
        const sizes = new Float32Array(nebulaCount);
        
        // Create nebula in a specific region
        const nebulaCenter = new THREE.Vector3(30000, 10000, -20000);
        const nebulaRadius = 15000;
        
        for (let i = 0; i < nebulaCount; i++) {
            const offset = new THREE.Vector3(
                (Math.random() - 0.5) * nebulaRadius,
                (Math.random() - 0.5) * nebulaRadius * 0.5,
                (Math.random() - 0.5) * nebulaRadius
            );
            
            positions[i * 3] = nebulaCenter.x + offset.x;
            positions[i * 3 + 1] = nebulaCenter.y + offset.y;
            positions[i * 3 + 2] = nebulaCenter.z + offset.z;
            
            // Nebula colors (purple, blue, pink)
            const colorChoice = Math.random();
            if (colorChoice < 0.33) {
                colors[i * 3] = 0.6;
                colors[i * 3 + 1] = 0.3;
                colors[i * 3 + 2] = 0.8;
            } else if (colorChoice < 0.66) {
                colors[i * 3] = 0.3;
                colors[i * 3 + 1] = 0.5;
                colors[i * 3 + 2] = 0.9;
            } else {
                colors[i * 3] = 0.9;
                colors[i * 3 + 1] = 0.4;
                colors[i * 3 + 2] = 0.6;
            }
            
            sizes[i] = Math.random() * 500 + 200;
        }
        
        nebulaGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        nebulaGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        nebulaGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const nebulaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                opacity: { value: 0.02 }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform float opacity;
                varying vec3 vColor;
                
                void main() {
                    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
                    float r = dot(cxy, cxy);
                    
                    if (r > 1.0) discard;
                    
                    float intensity = exp(-r * 3.0);
                    gl_FragColor = vec4(vColor, intensity * opacity);
                }
            `,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
            vertexColors: true
        });
        
        this.nebula = new THREE.Points(nebulaGeometry, nebulaMaterial);
        this.group.add(this.nebula);
    }
    
    createMilkyWay() {
        // Create a subtle Milky Way band
        const milkyWayGeometry = new THREE.BufferGeometry();
        const particleCount = 10000;
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            // Create band across the sky
            const angle = Math.random() * Math.PI * 2;
            const spread = (Math.random() - 0.5) * 0.3;
            const distance = 50000 + Math.random() * 10000;
            
            positions[i * 3] = Math.cos(angle) * distance;
            positions[i * 3 + 1] = spread * distance;
            positions[i * 3 + 2] = Math.sin(angle) * distance;
            
            // Milky way colors (slightly warm white)
            colors[i * 3] = 1.0;
            colors[i * 3 + 1] = 0.95;
            colors[i * 3 + 2] = 0.9;
        }
        
        milkyWayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        milkyWayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const milkyWayMaterial = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const milkyWay = new THREE.Points(milkyWayGeometry, milkyWayMaterial);
        this.group.add(milkyWay);
    }
    
    update(deltaTime) {
        // Slowly rotate the entire starfield for subtle movement
        this.group.rotation.y += deltaTime * 0.00001;
        
        // Twinkle effect for bright stars
        this.stars.forEach((starLayer, index) => {
            if (starLayer.material.uniforms) {
                const time = Date.now() * 0.001;
                const twinkle = 0.9 + Math.sin(time + index) * 0.1;
                starLayer.material.uniforms.brightness.value = 
                    starLayer.material.uniforms.brightness.value * twinkle;
            }
        });
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        this.stars.forEach(stars => {
            stars.geometry.dispose();
            stars.material.dispose();
        });
        
        if (this.nebula) {
            this.nebula.geometry.dispose();
            this.nebula.material.dispose();
        }
    }
}