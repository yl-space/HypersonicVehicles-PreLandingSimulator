// client/src/components/environment/Mars.js
import * as THREE from 'three';

export class Mars {
    constructor() {
        this.radius = 3389500; // Mars radius in meters
        this.mesh = null;
        this.atmosphere = null;
        this.atmosphereShader = null;
        this.clouds = null;
        this.position = new THREE.Vector3(0, 0, 0); // Mars at origin
        
        this.textureLoader = new THREE.TextureLoader();     
    }
    
    async init() {
        // Create Mars sphere with high detail
        const geometry = new THREE.SphereGeometry(this.radius, 128, 128);
        
        // Load all textures with proper settings
        const [
            marsTexture,
            marsNormal,
            marsRoughness,
            marsDisplacement
        ] = await Promise.all([
            this.loadTexture('/assets/textures/Mars.jpg'),
            this.loadTexture('/assets/textures/Mars_normal.jpg'),
        ]);
        
        // Create material with realistic properties
        const material = new THREE.MeshStandardMaterial({
            map: marsTexture,
            normalMap: marsNormal,
            normalScale: new THREE.Vector2(1, 1),
            roughness: 0.85,
            metalness: 0.00
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(this.position);
        this.mesh.receiveShadow = true;
        this.mesh.castShadow = true;
        
        // Create atmosphere layers
        this.createAtmosphere();
        
        // Create optional dust clouds
        this.createDustClouds();
    }
    
    loadTexture(url) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    texture.encoding = THREE.sRGBEncoding;
                    texture.anisotropy = 16;
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.warn(`Failed to load texture ${url}, using fallback`);
                    // Create fallback texture
                    const fallbackTexture = new THREE.Texture();
                    fallbackTexture.image = this.createFallbackImage();
                    fallbackTexture.needsUpdate = true;
                    resolve(fallbackTexture);
                }
            );
        });
    }
    
    createFallbackImage() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create Mars-like gradient
        const gradient = ctx.createLinearGradient(0, 0, 512, 512);
        gradient.addColorStop(0, '#d2691e');
        gradient.addColorStop(0.5, '#cd853f');
        gradient.addColorStop(1, '#8b4513');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        return canvas;
    }
    
    createAtmosphere() {
        this.atmosphere = new THREE.Group();
        
        // Inner atmosphere layer
        const innerAtmosphereGeometry = new THREE.SphereGeometry(
            this.radius * 1.01,
            64,
            64
        );
        
        const innerAtmosphereMaterial = new THREE.MeshLambertMaterial({
            color: 0xff6b4a,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide,
            emissive: 0xff4500,
            emissiveIntensity: 0.1
        });
        
        const innerAtmosphere = new THREE.Mesh(innerAtmosphereGeometry, innerAtmosphereMaterial);
        innerAtmosphere.position.copy(this.position);
        this.atmosphere.add(innerAtmosphere);
        
        // Outer atmosphere with custom shader
        const outerAtmosphereGeometry = new THREE.SphereGeometry(
            this.radius * 1.025,
            64,
            64
        );
        
        const atmosphereShader = {
            uniforms: {
                sunDirection: { value: new THREE.Vector3(1, 0.5, 0.3).normalize() },
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.6 },
                p: { value: 4.0 },
                glowColor: { value: new THREE.Color(0xff6b4a) },
                intensity: { value: 1.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vPositionNormal = normalize(mvPosition.xyz);
                    vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                uniform vec3 sunDirection;
                uniform vec3 viewVector;
                uniform float c;
                uniform float p;
                uniform vec3 glowColor;
                uniform float intensity;
                
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float sunDot = dot(vNormal, sunDirection);
                    float viewDot = dot(vNormal, viewDirection);
                    
                    // Atmospheric scattering
                    float atmosphere = pow(c - viewDot, p);
                    
                    // Sun-side glow
                    float sunGlow = smoothstep(-0.3, 0.5, sunDot) * 0.5;
                    
                    // Combine effects
                    vec3 color = glowColor * (atmosphere + sunGlow) * intensity;
                    float alpha = (atmosphere * 0.8 + sunGlow * 0.4) * intensity;
                    
                    gl_FragColor = vec4(color, alpha);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        };
        
        const outerAtmosphereMaterial = new THREE.ShaderMaterial(atmosphereShader);
        const outerAtmosphere = new THREE.Mesh(outerAtmosphereGeometry, outerAtmosphereMaterial);
        outerAtmosphere.position.copy(this.position);
        this.atmosphere.add(outerAtmosphere);
        
        // Store reference for updates
        this.atmosphereShader = outerAtmosphereMaterial;
    }
    
    createDustClouds() {
        // Create subtle dust cloud layer
        const cloudGeometry = new THREE.SphereGeometry(
            this.radius * 1.005,
            32,
            32
        );
        
        const cloudMaterial = new THREE.MeshLambertMaterial({
            color: 0xcc9966,
            transparent: true,
            opacity: 0.05,
            side: THREE.DoubleSide
        });
        
        this.clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.clouds.position.copy(this.position);
    }
    
    addToScene(scene) {
        if (this.mesh) scene.add(this.mesh);
        if (this.atmosphere) scene.add(this.atmosphere);
        if (this.clouds) scene.add(this.clouds);
    }
    
    update(camera, time) {
        // Update atmosphere shader based on camera position
        if (this.atmosphereShader) {
            this.atmosphereShader.uniforms.viewVector.value = 
                new THREE.Vector3().subVectors(camera.position, this.mesh.position);
        }
        
        // Rotate Mars slowly (one rotation per sol ~24.6 hours)
        if (this.mesh) {
            this.mesh.rotation.y += 0.00001;
        }
        
        // Rotate dust clouds slightly faster for effect
        if (this.clouds) {
            this.clouds.rotation.y += 0.00002;
            this.clouds.rotation.x = Math.sin(time * 0.0001) * 0.02;
        }
    }
    
    getRadius() {
        return this.radius;
    }
    
    getPosition() {
        return this.position.clone();
    }
}