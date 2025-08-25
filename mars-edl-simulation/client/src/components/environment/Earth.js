/**
 * Earth.js - Earth planet with realistic textures
 */

import * as THREE from '/node_modules/three/build/three.module.js';

export class Earth {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Earth radius = 6,378 km
        // Scale: 1 unit = 100 km for visualization
        this.radius = 63.78; // 6,378 km / 100
        this.surface = null;
        this.clouds = null;
        this.atmosphere = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createClouds();
        this.createAtmosphere();
    }
    
    createSurface() {
        // Create Earth sphere with high detail
        const geometry = new THREE.SphereGeometry(this.radius, 128, 64);
        
        // Load textures from assets
        const textureLoader = new THREE.TextureLoader();
        const earthTexture = textureLoader.load('/assets/textures/Earth/earthmap_color.jpg');
        const earthBump = textureLoader.load('/assets/textures/Earth/earthmap_bump.jpg');
        const earthSpecular = textureLoader.load('/assets/textures/Earth/earthmap_specular.jpg');
        const earthLights = textureLoader.load('/assets/textures/Earth/earthamp_lights.jpg');
        
        const material = new THREE.MeshPhongMaterial({
            map: earthTexture,
            bumpMap: earthBump,
            bumpScale: 0.5,
            specularMap: earthSpecular,
            specular: new THREE.Color(0x333333),
            shininess: 25,
            emissiveMap: earthLights,
            emissive: new THREE.Color(0xffff88),
            emissiveIntensity: 0.1
        });
        
        this.surface = new THREE.Mesh(geometry, material);
        this.surface.receiveShadow = true;
        this.surface.castShadow = true;
        
        this.group.add(this.surface);
    }
    
    createClouds() {
        // Create cloud layer
        const cloudGeometry = new THREE.SphereGeometry(this.radius * 1.01, 64, 64);
        
        const textureLoader = new THREE.TextureLoader();
        const cloudTexture = textureLoader.load('/assets/textures/Earth/earthmap_cloud.jpg');
        const cloudTransparency = textureLoader.load('/assets/textures/Earth/earthcloudmap_transperancy.jpg');
        
        const cloudMaterial = new THREE.MeshPhongMaterial({
            map: cloudTexture,
            alphaMap: cloudTransparency,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide,
            depthWrite: false
        });
        
        this.clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        this.group.add(this.clouds);
    }
    
    createAtmosphere() {
        // Atmospheric glow
        const atmosphereGeometry = new THREE.SphereGeometry(this.radius * 1.03, 64, 64);
        
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
                    
                    // Earth atmosphere is blue
                    vec3 atmosphereColor = vec3(0.3, 0.6, 1.0);
                    float alpha = intensity * 0.4;
                    
                    gl_FragColor = vec4(atmosphereColor, alpha);
                }
            `,
            uniforms: {
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.6 },
                p: { value: 2.5 }
            },
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.group.add(this.atmosphere);
    }
    
    update(camera, deltaTime) {
        // Update atmosphere shader with camera position
        if (this.atmosphere && this.atmosphere.material.uniforms) {
            this.atmosphere.material.uniforms.viewVector.value = 
                new THREE.Vector3().subVectors(camera.position, this.group.position);
        }
        
        // No rotation - Earth remains stationary in J2000 reference frame
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
        
        if (this.clouds) {
            this.clouds.geometry.dispose();
            this.clouds.material.dispose();
        }
        
        if (this.atmosphere) {
            this.atmosphere.geometry.dispose();
            this.atmosphere.material.dispose();
        }
    }
}