
// client/src/components/environment/Mars.js
import * as THREE from 'three';

/**
 * Mars component with realistic terrain and atmosphere
 * Demonstrates advanced Three.js techniques
 */
export class Mars {
    constructor(scene, options = {}) {
        this.scene = scene;
        this.options = {
            radius: 3389.5,        // Mars radius in km (scaled)
            segments: 128,
            terrainDetail: 4,
            ...options
        };
        
        this.group = new THREE.Group();
        this.group.name = 'Mars';
        
        this.createPlanet();
        this.createAtmosphere();
        this.createTerrain();
    }
    
    createPlanet() {
        // Create sphere with proper UV mapping
        const geometry = new THREE.SphereGeometry(
            this.options.radius,
            this.options.segments,
            this.options.segments
        );
        
        // Load Mars textures
        const textureLoader = new THREE.TextureLoader();
        
        // Multiple texture maps for realism
        const textures = {
            map: textureLoader.load('/assets/textures/mars_color.jpg'),
            normalMap: textureLoader.load('/assets/textures/mars_normal.jpg'),
            displacementMap: textureLoader.load('/assets/textures/mars_height.jpg'),
            roughnessMap: textureLoader.load('/assets/textures/mars_roughness.jpg')
        };
        
        // Configure textures
        Object.values(textures).forEach(texture => {
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.anisotropy = 16; // Better texture quality at angles
        });
        
        // Material with all maps
        const material = new THREE.MeshStandardMaterial({
            map: textures.map,
            normalMap: textures.normalMap,
            normalScale: new THREE.Vector2(2, 2),
            displacementMap: textures.displacementMap,
            displacementScale: 50,
            roughnessMap: textures.roughnessMap,
            roughness: 0.8,
            metalness: 0.1
        });
        
        this.planet = new THREE.Mesh(geometry, material);
        this.planet.receiveShadow = true;
        this.planet.castShadow = true;
        
        this.group.add(this.planet);
    }
    
    createAtmosphere() {
        // Atmospheric scattering shader
        const atmosphereGeometry = new THREE.SphereGeometry(
            this.options.radius * 1.02,
            64,
            64
        );
        
        // Custom shader for atmospheric effect
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                viewVector: { value: new THREE.Vector3() },
                c: { value: 0.6 },
                p: { value: 4.0 }
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
                    float intensity = pow(c - dot(vNormal, vec3(0.0, 0.0, 1.0)), p);
                    vec3 atmosphere = vec3(0.8, 0.4, 0.1) * intensity;
                    
                    // Sun-side glow
                    float sunIntensity = pow(max(dot(vNormal, sunDirection), 0.0), 2.0);
                    atmosphere += vec3(1.0, 0.6, 0.3) * sunIntensity * 0.3;
                    
                    gl_FragColor = vec4(atmosphere, intensity * 0.5);
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        
        this.atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.group.add(this.atmosphere);
    }
    
    createTerrain() {
        // Detailed landing site terrain using height maps
        const terrainSize = 1000;
        const segments = 256;
        
        const geometry = new THREE.PlaneGeometry(
            terrainSize,
            terrainSize,
            segments,
            segments
        );
        
        // Load height data (could come from database)
        this.loadTerrainData().then(heightData => {
            const vertices = geometry.attributes.position.array;
            
            // Apply height data to vertices
            for (let i = 0; i < heightData.length; i++) {
                vertices[i * 3 + 2] = heightData[i] * 50; // Scale height
            }
            
            geometry.computeVertexNormals();
            geometry.attributes.position.needsUpdate = true;
        });
        
        const material = new THREE.MeshStandardMaterial({
            color: 0xCD853F,
            roughness: 0.9,
            metalness: 0.1,
            wireframe: false
        });
        
        this.terrain = new THREE.Mesh(geometry, material);
        this.terrain.rotation.x = -Math.PI / 2;
        this.terrain.position.y = -this.options.radius;
        this.terrain.receiveShadow = true;
        
        // Add to separate group for LOD management
        this.terrainGroup = new THREE.LOD();
        this.terrainGroup.addLevel(this.terrain, 0);
        
        // Lower detail versions for distance
        const lowDetailTerrain = this.createLowDetailTerrain();
        this.terrainGroup.addLevel(lowDetailTerrain, 1000);
        
        this.group.add(this.terrainGroup);
    }
    
    async loadTerrainData() {
        // Simulate loading terrain data from database
        // In production, this would fetch real Mars terrain data
        const size = 257 * 257;
        const heights = new Float32Array(size);
        
        // Generate procedural terrain for demo
        for (let i = 0; i < size; i++) {
            heights[i] = Math.random() * 0.5 + 
                         Math.sin(i * 0.01) * 0.3 + 
                         Math.cos(i * 0.02) * 0.2;
        }
        
        return heights;
    }
    
    createLowDetailTerrain() {
        const geometry = new THREE.PlaneGeometry(1000, 1000, 32, 32);
        const material = new THREE.MeshBasicMaterial({
            color: 0xCD853F
        });
        return new THREE.Mesh(geometry, material);
    }
    
    update(deltaTime, camera) {
        // Rotate planet
        this.planet.rotation.y += deltaTime * 0.01;
        
        // Update atmosphere shader
        if (this.atmosphere) {
            const viewVector = new THREE.Vector3().subVectors(
                camera.position,
                this.planet.position
            );
            this.atmosphere.material.uniforms.viewVector.value = viewVector;
        }
        
        // Update LOD
        this.terrainGroup.update(camera);
    }
    
    setLandingSite(coordinates) {
        // Position landing site marker
        const { lat, lon } = coordinates;
        
        // Convert lat/lon to 3D position on sphere
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        
        const x = this.options.radius * Math.sin(phi) * Math.cos(theta);
        const y = this.options.radius * Math.cos(phi);
        const z = this.options.radius * Math.sin(phi) * Math.sin(theta);
        
        // Create landing site marker
        const markerGeometry = new THREE.SphereGeometry(10, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            emissive: 0x00ff00,
            emissiveIntensity: 0.5
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        
        this.planet.add(marker);
    }
}