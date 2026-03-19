/**
 * Atmosphere.js
 * Mars atmospheric limb haze with extremely smooth outer-edge falloff.
 *
 * Uses a wide BackSide sphere with multi-term Fresnel that blends
 * smoothly from the planet surface colour outward into transparent space.
 * The outer edge is feathered using smoothstep so there is never a
 * visible hard boundary.
 */

import * as THREE from 'three';

export class Atmosphere {
    constructor(planetRadius = 33.9) {
        this.planetRadius = planetRadius;
        this.referenceAltitudeKm = 250;
        this.intensityScale = 1.0;
        this.mesh = null;
        this.material = null;
        this._density = 0;
        this.init();
    }

    init() {
        // Wide shell — the shader fades to zero well before the geometry edge
        const atmRadius = this.planetRadius * 1.03;
        const geometry = new THREE.SphereGeometry(atmRadius, 96, 64);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:  { value: new THREE.Vector3() },
                planetRadius:  { value: this.planetRadius },
                atmRadius:     { value: atmRadius },
                // Warm brownish-tan matching Mars tile hue
                glowColor:     { value: new THREE.Vector3(0.72, 0.50, 0.36) },
                intensity:     { value: 0.5 },
                fresnelPower:  { value: 3.0 },
            },

            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,

            fragmentShader: `
                uniform vec3  planetCenter;
                uniform float planetRadius;
                uniform float atmRadius;
                uniform vec3  glowColor;
                uniform float intensity;
                uniform float fresnelPower;

                varying vec3  vNormal;
                varying vec3  vWorldPos;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);

                    // --- Fresnel glow (strongest at planet limb) ---
                    float NdV = abs(dot(viewDir, vNormal));
                    float rawFresnel = 1.0 - NdV;

                    // Multi-term blend: sharp core + wide soft halo
                    float core = pow(clamp(rawFresnel, 0.0, 1.0), fresnelPower);
                    float halo = pow(clamp(rawFresnel, 0.0, 1.0), fresnelPower * 0.4);
                    float fresnel = core * 0.5 + halo * 0.5;

                    // --- Radial fade: blend to zero toward the outer geometry edge ---
                    // Fragments far from the planet surface fade out smoothly
                    float fragDist = length(vWorldPos - planetCenter);
                    float relHeight = (fragDist - planetRadius) / (atmRadius - planetRadius);
                    // smoothstep from 0.3 to 1.0 — fully gone at outer edge
                    float edgeFade = 1.0 - smoothstep(0.3, 1.0, relHeight);

                    float alpha = fresnel * intensity * edgeFade;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.40));
                }
            `,

            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
    }

    setIntensity(v) { this.intensityScale = THREE.MathUtils.clamp(v, 0, 1); }

    setPlanetCenter(c) {
        if (this.material && c?.isVector3)
            this.material.uniforms.planetCenter.value.copy(c);
    }

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;
        if (planetCenter?.isVector3)
            this.material.uniforms.planetCenter.value.copy(planetCenter);

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);
        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.5, 1.0, density) * this.intensityScale;
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(3.5, 2.0, density);
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
