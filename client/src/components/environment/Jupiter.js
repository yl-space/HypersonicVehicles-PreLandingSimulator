import * as THREE from 'three';

export class Jupiter {
    constructor() {
        this.group = new THREE.Group();
        // NASA Data: Jupiter radius = 69,911 km (11x Earth)
        // Scale: 1 unit = 100 km, but capped at 3x Earth for visibility
        this.radius = 191.34; // (6,378 * 3) / 100 = 3x Earth size for visibility
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
                { detail: 'high', segments: 72, maxDistance: 320 },
                { detail: 'medium', segments: 48, maxDistance: 520 },
                { detail: 'low', segments: 28, maxDistance: Infinity }
            ]
        };
        
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
        const material = this.buildMaterial(detail, { uvRepeat, uvOffset });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        return mesh;
    }

    buildMaterial(detail, uvTransform = {}) {
        if (detail === 'low') {
            return new THREE.MeshBasicMaterial({
                map: this.createTiledMap(this.textures.color, uvTransform),
                color: 0xffffff
            });
        }

        return new THREE.MeshPhongMaterial({
            map: this.createTiledMap(this.textures.color, uvTransform),
            specular: new THREE.Color(detail === 'high' ? 0x222222 : 0x111111),
            shininess: detail === 'high' ? 8 : 2
        });
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
    
    createAtmosphere() {
        // Jupiter's thick atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(this.radius * 1.01, 64, 64);
        
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
        
        // No rotation - Jupiter remains stationary in J2000 reference frame
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
        
        if (this.atmosphere) {
            this.atmosphere.geometry.dispose();
            this.atmosphere.material.dispose();
        }
    }
}
