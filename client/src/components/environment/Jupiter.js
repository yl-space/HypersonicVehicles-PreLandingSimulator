import * as THREE from 'three';

export class Jupiter {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Jupiter radius = 69,911 km (11x Earth)
        // Scale: 1 unit = 100 km, but capped at 3x Earth for visibility
        this.radius = 191.34; // (6,378 * 3) / 100 = 3x Earth size for visibility
        this.surfaceLOD = null;
        this.lodMeshes = [];
        this.atmosphere = null;
        this.textures = null;
        
        this.init();
    }
    
    init() {
        this.createSurface();
        this.createAtmosphere();
        this.createStormFeatures();
    }
    
    createSurface() {
        const loader = new THREE.TextureLoader();
        this.textures = {
            color: loader.load('/assets/textures/Jupiter/jupiter.jpg')
        };

        this.surfaceLOD = new THREE.LOD();
        const levels = [
            { segments: 128, distance: 0, detail: 'high' },
            { segments: 72, distance: 180, detail: 'medium' },
            { segments: 32, distance: 320, detail: 'low' }
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
        const material = this.buildMaterial(detail);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = detail !== 'low';
        mesh.receiveShadow = true;
        return mesh;
    }

    buildMaterial(detail) {
        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: this.textures.color,
                color: 0xffffff
            });
        }

        return new THREE.MeshPhongMaterial({
            map: this.textures.color,
            specular: new THREE.Color(detail === 'high' ? 0x222222 : 0x111111),
            shininess: detail === 'high' ? 8 : 2
        });
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

        if (this.surfaceLOD) {
            this.surfaceLOD.update(camera);
        }
        
        // No rotation - Jupiter remains stationary in J2000 reference frame
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
        
        if (this.atmosphere) {
            this.atmosphere.geometry.dispose();
            this.atmosphere.material.dispose();
        }
    }
}
