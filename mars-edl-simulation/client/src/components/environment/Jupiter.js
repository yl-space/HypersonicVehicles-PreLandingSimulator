import * as THREE from 'three';

export class Jupiter {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Jupiter radius = 69,911 km (11x Earth)
        // Scale: 1 unit = 100 km, but capped at 3x Earth for visibility
        this.radius = 191.34; // (6,378 * 3) / 100 = 3x Earth size for visibility
        this.surface = null;
        this.atmosphere = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createAtmosphere();
        this.createStormFeatures();
    }
    
    createSurface() {
        // Create Jupiter sphere with high detail
        const geometry = new THREE.SphereGeometry(this.radius, 128, 64);
        
        // Load texture from assets
        const textureLoader = new THREE.TextureLoader();
        const jupiterTexture = textureLoader.load('/assets/textures/Jupiter/jupiter.jpg');
        
        const material = new THREE.MeshPhongMaterial({
            map: jupiterTexture,
            specular: new THREE.Color(0x111111),
            shininess: 5
        });
        
        this.surface = new THREE.Mesh(geometry, material);
        this.surface.receiveShadow = true;
        this.surface.castShadow = true;
        
        this.group.add(this.surface);
    }
    
    createAtmosphere() {
        // Jupiter's thick atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(this.radius * 1.01, 64, 64);
        
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
                uniform float time;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vec3 viewDir = normalize(cameraPosition - vPosition);
                    float intensity = pow(c - dot(vNormal, viewDir), p);
                    
                    // Jupiter atmosphere with swirling bands
                    float band = sin(vPosition.y * 10.0 + time) * 0.1;
                    vec3 atmosphereColor = vec3(0.9 + band, 0.7 + band * 0.5, 0.4);
                    float alpha = intensity * 0.25;
                    
                    gl_FragColor = vec4(atmosphereColor, alpha);
                }
            `,
            uniforms: {
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.4 },
                p: { value: 3.0 },
                time: { value: 0 }
            },
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.group.add(this.atmosphere);
    }
    
    createStormFeatures() {
        // Great Red Spot
        const spotGeometry = new THREE.SphereGeometry(3, 16, 16);
        const spotMaterial = new THREE.MeshBasicMaterial({
            color: 0xcc6644,
            transparent: true,
            opacity: 0.3
        });
        
        const redSpot = new THREE.Mesh(spotGeometry, spotMaterial);
        // Position on Jupiter's surface
        const lat = -22; // degrees
        const lon = 0;
        const phi = (90 - lat) * Math.PI / 180;
        const theta = lon * Math.PI / 180;
        
        redSpot.position.set(
            this.radius * Math.sin(phi) * Math.cos(theta),
            this.radius * Math.cos(phi),
            this.radius * Math.sin(phi) * Math.sin(theta)
        );
        
        this.group.add(redSpot);
    }
    
    update(camera, deltaTime) {
        // Update atmosphere shader with camera position
        if (this.atmosphere && this.atmosphere.material.uniforms) {
            this.atmosphere.material.uniforms.viewVector.value = 
                new THREE.Vector3().subVectors(camera.position, this.group.position);
            this.atmosphere.material.uniforms.time.value += deltaTime;
        }
        
        // Fast rotation (Jupiter day = 9.9 hours)
        this.surface.rotation.y += deltaTime * 0.04;
        
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