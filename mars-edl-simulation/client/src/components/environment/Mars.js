// client/src/components/environment/Mars.js
import * as THREE from 'three';

export class Mars {
    constructor() {
        this.radius = 3389500; // Mars radius in meters
        this.mesh = null;
        this.atmosphere = null;
        this.init();
    }
    
    async init() {
        // Mars sphere
        const geometry = new THREE.SphereGeometry(this.radius, 64, 64);
        
        // Load textures
        const textureLoader = new THREE.TextureLoader();
        const marsTexture = await textureLoader.loadAsync('/assets/textures/mars_surface.jpg');
        const marsNormal = await textureLoader.loadAsync('/assets/textures/mars_normal.jpg');
        
        const material = new THREE.MeshStandardMaterial({
            map: marsTexture,
            normalMap: marsNormal,
            normalScale: new THREE.Vector2(0.5, 0.5),
            roughness: 0.9,
            metalness: 0.1
        });
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        
        // Add atmosphere
        this.createAtmosphere();
    }
    
    createAtmosphere() {
        const atmosphereGeometry = new THREE.SphereGeometry(
            this.radius * 1.03, // 3% larger than Mars
            64, 
            64
        );
        
        // Custom shader for atmospheric scattering
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.5 },
                p: { value: 4.5 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPositionNormal = normalize((modelViewMatrix * vec4(position, 1.0)).xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunDirection;
                uniform float c;
                uniform float p;
                varying vec3 vNormal;
                varying vec3 vPositionNormal;
                
                void main() {
                    float intensity = pow(c - dot(vNormal, vPositionNormal), p);
                    gl_FragColor = vec4(0.8, 0.4, 0.2, 1.0) * intensity;
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
    }
    
    addToScene(scene) {
        scene.add(this.mesh);
        scene.add(this.atmosphere);
    }
    
    update(camera) {
        // Update atmosphere based on camera position
        if (this.atmosphere) {
            this.atmosphere.material.uniforms.viewVector.value = 
                new THREE.Vector3().subVectors(camera.position, this.mesh.position);
        }
    }
}