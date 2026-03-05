/**
 * Atmosphere.js
 * Mars atmosphere shell with altitude-driven horizon glow.
 */

import * as THREE from 'three';

export class Atmosphere {
    /**
     * @param {number} planetRadius - scene-unit radius (33.9 ~= 3390 km at 1 unit = 100 km)
     */
    constructor(planetRadius = 33.9) {
        this.planetRadius = planetRadius;
        this.referenceAltitudeKm = 130;
        this.intensityScale = 1.0;
        this.mesh = null;
        this.material = null;
        this.init();
    }

    init() {
        // Thin shell hugging the surface for a realistic limb glow.
        const atmRadius = this.planetRadius * 1.008;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 96);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:     { value: new THREE.Vector3(0, 0, 0) },
                planetRadius:     { value: this.planetRadius },
                atmosphereRadius: { value: atmRadius },
                glowColor:        { value: new THREE.Vector3(0.92, 0.44, 0.18) },
                intensity:        { value: 0.55 },
                fresnelPower:     { value: 4.0 },
                altitudeDensity:  { value: 0.0 },
                horizonSoftness:  { value: 0.12 },
                rimBoost:         { value: 0.45 }
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
                    vec3 normal = normalize(vWorldNormal);

                    // Fresnel: strongest at grazing angles (planet limb)
                    float fresnel = 1.0 - abs(dot(viewDir, normal));
                    fresnel = pow(max(fresnel, 0.0), fresnelPower);

                    // Horizon band: view direction vs radial direction
                    vec3 radialDir = normalize(vWorldPosition - planetCenter);
                    float viewToRadial = abs(dot(viewDir, radialDir));
                    float horizonBand = 1.0 - smoothstep(0.0, horizonSoftness, viewToRadial);

                    // Combine: heavy limb fresnel + gentle horizon tint
                    float glowShape = fresnel + horizonBand * rimBoost * 0.3;

                    float densityBoost = 0.3 + altitudeDensity * 0.7;
                    float alpha = intensity * glowShape * densityBoost;

                    // Warm tint toward the horizon edge
                    vec3 horizonTint = vec3(0.22, 0.10, 0.03) * horizonBand;
                    vec3 color = glowColor + horizonTint + glowColor * (0.15 * altitudeDensity);

                    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.85));
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

        const density = 1 - normalizedAlt;
        const dynamicIntensity = THREE.MathUtils.lerp(0.3, 0.95, density) * this.intensityScale;
        const fresnelPower = THREE.MathUtils.lerp(5.0, 3.0, density);
        const horizonSoftness = THREE.MathUtils.lerp(0.08, 0.18, density);
        const rimBoost = THREE.MathUtils.lerp(0.35, 0.95, density);

        this.material.uniforms.intensity.value = dynamicIntensity;
        this.material.uniforms.altitudeDensity.value = density;
        this.material.uniforms.fresnelPower.value = fresnelPower;
        this.material.uniforms.horizonSoftness.value = horizonSoftness;
        this.material.uniforms.rimBoost.value = rimBoost;
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
