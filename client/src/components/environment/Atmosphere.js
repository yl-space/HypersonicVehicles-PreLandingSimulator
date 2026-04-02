/**
 * Atmosphere.js
 * Ultra-thin Mars limb line — barely visible warm gradient at planet edge.
 *
 * Uses AdditiveBlending so the haze ADDS light to the scene instead of
 * blocking it (NormalBlending caused a solid dark wall at the horizon).
 * Shell is only 0.3% above surface — razor thin.
 * Very high Fresnel power (8+) concentrates the glow to the extreme
 * silhouette edge only.
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
        this._fogDensity = 0;
        this._fogColor = new THREE.Color(0x977264);
        this.init();
    }

    init() {
        // Razor-thin: 0.3% above surface (~10 km at Mars scale)
        const atmRadius = this.planetRadius * 1.003;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        // #977264 as additive glow
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                glowColor:    { value: new THREE.Vector3(0.592, 0.447, 0.392) },
                intensity:    { value: 0.15 },
                fresnelPower: { value: 8.0 },
            },

            vertexShader: /* glsl */`
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,

            fragmentShader: /* glsl */`
                uniform vec3  glowColor;
                uniform float intensity;
                uniform float fresnelPower;

                varying vec3 vNormal;
                varying vec3 vWorldPos;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    float NdV = abs(dot(viewDir, vNormal));

                    // Very high power = only the extreme grazing edge glows
                    float fresnel = pow(clamp(1.0 - NdV, 0.0, 1.0), fresnelPower);

                    float alpha = fresnel * intensity;

                    gl_FragColor = vec4(glowColor * alpha, alpha);
                }
            `,

            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,  // Adds light, never blocks/darkens
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
    }

    setIntensity(v) { this.intensityScale = THREE.MathUtils.clamp(v, 0, 1); }
    setPlanetCenter(c) {}

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Very subtle: 0.15 → 0.3 max intensity
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.15, 0.3, density) * this.intensityScale;
        // Power stays high even near surface — never becomes a wide band
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(8.0, 6.0, density);

        this._fogDensity = THREE.MathUtils.lerp(0, 0.00003, density);
    }

    getFog() { return { color: this._fogColor, density: this._fogDensity }; }
    getDensity() { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
