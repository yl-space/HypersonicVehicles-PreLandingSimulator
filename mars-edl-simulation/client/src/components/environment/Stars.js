/**
 * Stars.js
 * Starfield background component
 */

import * as THREE from 'three';

export class Stars extends THREE.Group {
    constructor() {
        super();
        
        this.starCount = 5000;
        this.starField = null;
        
        this.init();
    }
    
    init() {
        // Create star geometry
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(this.starCount * 3);
        const colors = new Float32Array(this.starCount * 3);
        const sizes = new Float32Array(this.starCount);
        
        // Generate random star positions
        for (let i = 0; i < this.starCount; i++) {
            const i3 = i * 3;
            
            // Position stars in a large sphere around the scene
            const radius = 10000 + Math.random() * 50000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Star colors (white to slightly blue/yellow)
            const colorTemp = Math.random();
            if (colorTemp < 0.3) {
                // Blue stars
                colors[i3] = 0.7;
                colors[i3 + 1] = 0.8;
                colors[i3 + 2] = 1.0;
            } else if (colorTemp < 0.7) {
                // White stars
                colors[i3] = 1.0;
                colors[i3 + 1] = 1.0;
                colors[i3 + 2] = 1.0;
            } else {
                // Yellow stars
                colors[i3] = 1.0;
                colors[i3 + 1] = 0.9;
                colors[i3 + 2] = 0.7;
            }
            
            // Random sizes
            sizes[i] = Math.random() * 2 + 0.5;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // Star material with custom shader
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
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
                uniform float time;
                varying vec3 vColor;
                
                void main() {
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    
                    if (dist > 0.5) discard;
                    
                    // Soft edge
                    float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                    
                    // Twinkle effect
                    float twinkle = sin(time * 2.0 + gl_FragCoord.x * 0.1) * 0.2 + 0.8;
                    
                    gl_FragColor = vec4(vColor * twinkle, alpha);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.starField = new THREE.Points(geometry, material);
        this.add(this.starField);
        
        // Add some bright stars (planets)
        this.addBrightStars();
        
        // Add Milky Way band
        this.addMilkyWay();
    }
    
    addBrightStars() {
        const brightStars = [
            { pos: new THREE.Vector3(15000, 8000, -5000), color: 0xFFFFAA, size: 5 },
            { pos: new THREE.Vector3(-12000, 10000, 8000), color: 0xAAFFFF, size: 4 },
            { pos: new THREE.Vector3(8000, -6000, 12000), color: 0xFFAAFF, size: 3 }
        ];
        
        brightStars.forEach(star => {
            const geometry = new THREE.SphereGeometry(star.size, 8, 8);
            const material = new THREE.MeshBasicMaterial({
                color: star.color,
                emissive: star.color,
                emissiveIntensity: 1
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.copy(star.pos);
            
            // Add glow
            const glowGeometry = new THREE.SphereGeometry(star.size * 3, 8, 8);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: star.color,
                transparent: true,
                opacity: 0.3,
                blending: THREE.AdditiveBlending
            });
            
            const glow = new THREE.Mesh(glowGeometry, glowMaterial);
            mesh.add(glow);
            
            this.add(mesh);
        });
    }
    
    addMilkyWay() {
        // Create a band of denser stars for Milky Way
        const milkyWayGeometry = new THREE.BufferGeometry();
        const count = 2000;
        const positions = new Float32Array(count * 3);
        const colors = new Float32Array(count * 3);
        
        for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            
            // Position along a band
            const angle = (i / count) * Math.PI * 2;
            const radius = 20000 + Math.random() * 5000;
            const spread = (Math.random() - 0.5) * 2000;
            
            positions[i3] = radius * Math.cos(angle);
            positions[i3 + 1] = spread;
            positions[i3 + 2] = radius * Math.sin(angle);
            
            // Milky way colors (warmer)
            colors[i3] = 1.0;
            colors[i3 + 1] = 0.9 + Math.random() * 0.1;
            colors[i3 + 2] = 0.8 + Math.random() * 0.2;
        }
        
        milkyWayGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        milkyWayGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 1,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        const milkyWay = new THREE.Points(milkyWayGeometry, material);
        milkyWay.rotation.x = Math.PI * 0.1; // Tilt the galaxy
        this.add(milkyWay);
    }
    
    update(deltaTime) {
        // Update shader time for twinkling
        if (this.starField && this.starField.material.uniforms) {
            this.starField.material.uniforms.time.value += deltaTime;
        }
        
        // Slowly rotate entire starfield for subtle movement
        this.rotation.y += deltaTime * 0.001;
    }
}

export default Stars;