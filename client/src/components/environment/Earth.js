/**
 * Earth.js - Earth planet with realistic textures
 */

import * as THREE from 'three';

export class Earth {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Earth radius = 6,378 km
        // Scale: 1 unit = 100 km for visualization
        this.radius = 63.78; // 6,378 km / 100
        this.surfaceLOD = null;
        this.lodMeshes = [];
        this.clouds = null;
        this.atmosphere = null;
        this.textures = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createClouds();
        this.createAtmosphere();
    }
    
    createSurface() {
        const loader = new THREE.TextureLoader();
        this.textures = {
            color: loader.load('/assets/textures/Earth/earthmap_color.jpg'),
            bump: loader.load('/assets/textures/Earth/earthmap_bump.jpg'),
            specular: loader.load('/assets/textures/Earth/earthmap_specular.jpg'),
            lights: loader.load('/assets/textures/Earth/earthamp_lights.jpg')
        };

        this.surfaceLOD = new THREE.LOD();
        const levels = [
            { segments: 128, distance: 0, detail: 'high' },
            { segments: 72, distance: 100, detail: 'medium' },
            { segments: 36, distance: 180, detail: 'low' }
        ];

        levels.forEach(level => {
            const mesh = this.createSurfaceMesh(level);
            this.surfaceLOD.addLevel(mesh, level.distance);
            this.lodMeshes.push(mesh);
        });

        this.group.add(this.surfaceLOD);
    }

    createSurfaceMesh({ segments, detail }) {
        const geometry = new THREE.SphereGeometry(this.radius, segments, Math.max(segments / 2, 16));
        const material = this.buildSurfaceMaterial(detail);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }

    buildSurfaceMaterial(detail) {
        const base = {
            map: this.textures.color,
            shininess: detail === 'high' ? 30 : 10
        };

        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: this.textures.color,
                color: 0xffffff
            });
        }

        const material = new THREE.MeshPhongMaterial({
            ...base,
            bumpMap: this.textures.bump,
            bumpScale: detail === 'high' ? 0.5 : 0.2,
            specularMap: this.textures.specular,
            specular: new THREE.Color(detail === 'high' ? 0x333333 : 0x222222),
            emissiveMap: this.textures.lights,
            emissive: new THREE.Color(0xffffaa),
            emissiveIntensity: detail === 'high' ? 0.1 : 0.05
        });

        return material;
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

        if (this.surfaceLOD) {
            this.surfaceLOD.update(camera);
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
        this.lodMeshes.forEach(mesh => {
            mesh.geometry.dispose();
            mesh.material.dispose();
        });
        
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
