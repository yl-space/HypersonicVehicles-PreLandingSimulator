/**
 * Atmosphere.js
 * Atmospheric rendering and effects
 */

import * as THREE from '/node_modules/three/build/three.module.js';

export class Atmosphere {
    constructor(planetRadius = 3389.5) {
        this.planetRadius = planetRadius;
        this.atmosphereHeight = planetRadius * 0.1; // 10% of planet radius
        this.mesh = null;
        this.scatteringMaterial = null;
        
        this.init();
    }
    
    init() {
        this.createAtmosphere();
    }
    
    createAtmosphere() {
        const atmosphereRadius = this.planetRadius + this.atmosphereHeight;
        const geometry = new THREE.SphereGeometry(atmosphereRadius, 64, 64);
        
        // Atmospheric scattering shader
        this.scatteringMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                planetRadius: { value: this.planetRadius },
                atmosphereRadius: { value: atmosphereRadius },
                sunDirection: { value: new THREE.Vector3(1, 0, 0) },
                scatteringStrength: { value: 0.025 },
                atmosphereColor: { value: new THREE.Color(0.8, 0.5, 0.3) }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float time;
                uniform float planetRadius;
                uniform float atmosphereRadius;
                uniform vec3 sunDirection;
                uniform float scatteringStrength;
                uniform vec3 atmosphereColor;
                
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float fresnel = 1.0 - dot(viewDirection, vNormal);
                    
                    // Simple atmospheric scattering approximation
                    float sunDot = dot(vNormal, sunDirection);
                    float scattering = max(0.0, sunDot);
                    
                    // Distance-based opacity
                    float distance = length(vWorldPosition);
                    float atmosphereDepth = (distance - planetRadius) / (atmosphereRadius - planetRadius);
                    
                    vec3 color = atmosphereColor * (0.5 + 0.5 * scattering);
                    float opacity = fresnel * scatteringStrength * (1.0 - atmosphereDepth);
                    
                    gl_FragColor = vec4(color, opacity);
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.mesh = new THREE.Mesh(geometry, this.scatteringMaterial);
    }
    
    update(time, sunDirection) {
        if (this.scatteringMaterial) {
            this.scatteringMaterial.uniforms.time.value = time;
            if (sunDirection) {
                this.scatteringMaterial.uniforms.sunDirection.value.copy(sunDirection);
            }
        }
    }
    
    setScatteringStrength(strength) {
        if (this.scatteringMaterial) {
            this.scatteringMaterial.uniforms.scatteringStrength.value = strength;
        }
    }
    
    setAtmosphereColor(color) {
        if (this.scatteringMaterial) {
            this.scatteringMaterial.uniforms.atmosphereColor.value.copy(color);
        }
    }
    
    getObject3D() {
        return this.mesh;
    }
    
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}