/**
 * Atmosphere.js
 * Mars atmosphere shell with smooth altitude-driven gradient glow.
 * Multi-layer Fresnel produces a gradual limb halo rather than a hard edge.
 * Scene tint shifts subtly reddish during atmospheric entry.
 */

import * as THREE from 'three';

export class Atmosphere {
    /**
     * @param {number} planetRadius - scene-unit radius (33.9 ~= 3390 km at 1 unit = 100 km)
     */
    constructor(planetRadius = 33.9) {
        this.planetRadius = planetRadius;
        this.referenceAltitudeKm = 200; // wider onset for subtler gradient
        this.intensityScale = 1.0;
        this.mesh = null;
        this.material = null;

        // Scene-wide tint driven by atmospheric density
        this._sceneTint = { r: 0, g: 0, b: 0 };

        this.init();
    }

    init() {
        // Wider shell for a more gradual falloff (was 1.008)
        const atmRadius = this.planetRadius * 1.025;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 96);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:     { value: new THREE.Vector3(0, 0, 0) },
                planetRadius:     { value: this.planetRadius },
                atmosphereRadius: { value: atmRadius },
                glowColor:        { value: new THREE.Vector3(0.88, 0.42, 0.16) },
                intensity:        { value: 0.45 },
                fresnelPower:     { value: 5.0 },
                altitudeDensity:  { value: 0.0 },
                horizonSoftness:  { value: 0.14 },
                rimBoost:         { value: 0.40 }
            },
            vertexShader: /* glsl */`
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    vWorldNormal = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: /* glsl */`
                uniform vec3  planetCenter;
                uniform float planetRadius;
                uniform float atmosphereRadius;
                uniform vec3  glowColor;
                uniform float intensity;
                uniform float fresnelPower;
                uniform float altitudeDensity;
                uniform float horizonSoftness;
                uniform float rimBoost;

                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPosition);
                    vec3 normal  = normalize(vWorldNormal);

                    // Multi-layer Fresnel for smooth gradient:
                    // Inner glow (sharp limb) + outer halo (soft, wide spread)
                    float baseFresnel = 1.0 - abs(dot(viewDir, normal));
                    float innerGlow   = pow(max(baseFresnel, 0.0), fresnelPower);
                    float outerHalo   = pow(max(baseFresnel, 0.0), fresnelPower * 0.35);
                    float fresnel     = innerGlow * 0.65 + outerHalo * 0.35;

                    // Horizon band with smoother falloff via smoothstep
                    vec3 radialDir    = normalize(vWorldPosition - planetCenter);
                    float viewToRadial = abs(dot(viewDir, radialDir));
                    float horizonBand  = 1.0 - smoothstep(0.0, horizonSoftness * 1.5, viewToRadial);

                    // Combined glow shape
                    float glowShape = fresnel + horizonBand * rimBoost * 0.25;

                    float densityBoost = 0.25 + altitudeDensity * 0.75;
                    float alpha = intensity * glowShape * densityBoost;

                    // Warm Mars atmospheric tint toward horizon edge
                    vec3 horizonTint = vec3(0.20, 0.08, 0.02) * horizonBand;
                    vec3 densityTint = glowColor * (0.12 * altitudeDensity);
                    vec3 color = glowColor + horizonTint + densityTint;

                    // Softer max alpha for subtlety (was 0.85)
                    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.60));
                }
            `,
            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
    }

    /**
     * External intensity multiplier.
     * @param {number} value - 0..1
     */
    setIntensity(value) {
        this.intensityScale = THREE.MathUtils.clamp(value, 0, 1);
    }

    /**
     * Keep shader center aligned with planet world-space center.
     * @param {THREE.Vector3} center
     */
    setPlanetCenter(center) {
        if (!this.material || !center?.isVector3) return;
        this.material.uniforms.planetCenter.value.copy(center);
    }

    /**
     * Update visual density from spacecraft altitude.
     * Uses ease-in-out cubic for smoother transitions instead of linear lerp.
     * @param {number} spacecraftAltitudeKm
     * @param {THREE.Vector3|null} planetCenter
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        if (planetCenter?.isVector3) {
            this.material.uniforms.planetCenter.value.copy(planetCenter);
        }

        const altitudeKm = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm)
            : this.referenceAltitudeKm;

        const normalizedAlt = THREE.MathUtils.clamp(
            altitudeKm / this.referenceAltitudeKm,
            0,
            1
        );

        // Ease-in-out cubic for smoother density transitions
        const t = 1 - normalizedAlt;
        const density = t < 0.5
            ? 4 * t * t * t
            : 1 - Math.pow(-2 * t + 2, 3) / 2;

        const dynamicIntensity = THREE.MathUtils.lerp(0.25, 0.85, density) * this.intensityScale;
        const fresnelPower     = THREE.MathUtils.lerp(6.0, 2.5, density);
        const horizonSoftness  = THREE.MathUtils.lerp(0.06, 0.22, density);
        const rimBoost         = THREE.MathUtils.lerp(0.30, 0.85, density);

        this.material.uniforms.intensity.value      = dynamicIntensity;
        this.material.uniforms.altitudeDensity.value = density;
        this.material.uniforms.fresnelPower.value    = fresnelPower;
        this.material.uniforms.horizonSoftness.value = horizonSoftness;
        this.material.uniforms.rimBoost.value        = rimBoost;

        // Compute scene tint (reddish for Mars atmospheric entry)
        this._sceneTint.r = density * 0.12;
        this._sceneTint.g = density * 0.03;
        this._sceneTint.b = density * 0.01;
    }

    /**
     * Returns the current atmospheric tint for external scene-wide color grading.
     * @returns {{ r: number, g: number, b: number }}
     */
    getSceneTint() {
        return this._sceneTint;
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
