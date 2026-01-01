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
        this.clouds = null;
        this.atmosphere = null;
        this.textures = null;
        this.tiles = [];
        this.tileGroup = null;
        this.tileMaps = [];
        this.tileMaterials = [];
        this.tileConfig = {
            rows: 4,
            cols: 8,
            lodLevels: [
                { detail: 'high', segments: 72, maxDistance: 160 },
                { detail: 'medium', segments: 48, maxDistance: 320 },
                { detail: 'low', segments: 28, maxDistance: Infinity }
            ]
        };
        
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

        this.buildTiledSurface();
    }

    buildTiledSurface() {
        this.tileGroup = new THREE.Group();
        const { rows, cols, lodLevels } = this.tileConfig;

        const thetaLength = (Math.PI * 2) / cols;
        const phiLength = Math.PI / rows;
        const uvRepeat = new THREE.Vector2(1 / cols, 1 / rows);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const thetaStart = col * thetaLength;
                const phiStart = row * phiLength;

                const tile = this.createTile({
                    row,
                    col,
                    thetaStart,
                    thetaLength,
                    phiStart,
                    phiLength,
                    uvRepeat,
                    lodLevels
                });

                this.tileGroup.add(tile.group);
                this.tiles.push(tile);
            }
        }

        this.group.add(this.tileGroup);
    }

    createTile({ row, col, thetaStart, thetaLength, phiStart, phiLength, uvRepeat, lodLevels }) {
        const tileGroup = new THREE.Group();
        const uvOffset = new THREE.Vector2(col * uvRepeat.x, row * uvRepeat.y);

        const levels = lodLevels.map((level, index) => {
            const mesh = this.createSurfaceMesh({
                segments: level.segments,
                detail: level.detail,
                thetaStart,
                thetaLength,
                phiStart,
                phiLength,
                uvRepeat,
                uvOffset
            });
            mesh.visible = index === 0;
            tileGroup.add(mesh);
            return {
                mesh,
                maxDistance: level.maxDistance
            };
        });

        const center = new THREE.Vector3().setFromSpherical(
            new THREE.Spherical(
                this.radius,
                phiStart + (phiLength / 2),
                thetaStart + (thetaLength / 2)
            )
        );

        return { group: tileGroup, levels, center };
    }

    createSurfaceMesh({ segments, detail, thetaStart, thetaLength, phiStart, phiLength, uvRepeat, uvOffset }) {
        const geometry = new THREE.SphereGeometry(
            this.radius,
            segments,
            Math.max(segments / 2, 16),
            thetaStart,
            thetaLength,
            phiStart,
            phiLength
        );
        const material = this.buildSurfaceMaterial(detail, { uvRepeat, uvOffset });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }

    buildSurfaceMaterial(detail, uvTransform = {}) {
        const base = {
            map: this.createTiledMap(this.textures.color, uvTransform),
            shininess: detail === 'high' ? 30 : 10
        };

        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: base.map,
                color: 0xffffff
            });
        }

        const material = new THREE.MeshPhongMaterial({
            ...base,
            bumpMap: this.createTiledMap(this.textures.bump, uvTransform),
            bumpScale: detail === 'high' ? 0.5 : 0.2,
            specularMap: this.createTiledMap(this.textures.specular, uvTransform),
            specular: new THREE.Color(detail === 'high' ? 0x333333 : 0x222222),
            emissiveMap: this.createTiledMap(this.textures.lights, uvTransform),
            emissive: new THREE.Color(0xffffaa),
            emissiveIntensity: detail === 'high' ? 0.1 : 0.05
        });

        this.tileMaterials.push(material);
        return material;
    }

    createTiledMap(texture, uvTransform) {
        if (!texture) return null;

        const map = texture.clone();
        map.repeat.copy(uvTransform.uvRepeat || new THREE.Vector2(1, 1));
        map.offset.copy(uvTransform.uvOffset || new THREE.Vector2(0, 0));
        map.wrapS = THREE.ClampToEdgeWrapping;
        map.wrapT = THREE.ClampToEdgeWrapping;
        map.needsUpdate = true;

        this.tileMaps.push(map);
        return map;
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
                precision mediump float;
                varying vec3 vNormal;
                varying vec3 vPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision mediump float;
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

        if (camera && this.tiles.length) {
            const cameraPosition = camera.position;
            this.tiles.forEach(tile => {
                const distance = cameraPosition.distanceTo(tile.center);
                let selected = tile.levels.length - 1;

                for (let i = 0; i < tile.levels.length; i++) {
                    if (distance < tile.levels[i].maxDistance) {
                        selected = i;
                        break;
                    }
                }

                tile.levels.forEach((level, idx) => {
                    level.mesh.visible = idx === selected;
                });
            });
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
        this.tiles.forEach(tile => {
            tile.levels.forEach(level => {
                level.mesh.geometry.dispose();
                if (level.mesh.material && level.mesh.material.dispose) {
                    level.mesh.material.dispose();
                }
            });
        });

        this.tileMaps.forEach(map => map.dispose?.());
        this.tileMaterials.forEach(mat => mat.dispose?.());
        
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
