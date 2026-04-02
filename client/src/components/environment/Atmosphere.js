/**
 * Atmosphere.js
 * Minimal Mars atmospheric limb haze.
 *
 * Very thin shell (1% above planet) with high Fresnel power for extremely
 * blurred/soft edges. Colour: gradient of #977264 (warm Mars dust).
 * Scene fog provides subtle atmospheric tint during entry.
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

        // Fog parameters
        this._fogDensity = 0;
        this._fogColor = new THREE.Color(0x977264);

        this.init();
    }

    init() {
        // Minimal shell — just 1% above surface for thin limb haze
        const atmRadius = this.planetRadius * 1.01;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        // #977264 → RGB (0.592, 0.447, 0.392)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                glowColor:    { value: new THREE.Vector3(0.592, 0.447, 0.392) },
                intensity:    { value: 0.4 },
                fresnelPower: { value: 5.0 }, // high power = very blurred/soft edge
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

                    // High Fresnel power = concentrated at extreme grazing angles only.
                    // Smoothstep on top for extra-soft fade at the outer edge.
                    float rawFresnel = clamp(1.0 - NdV, 0.0, 1.0);
                    float fresnel = pow(rawFresnel, fresnelPower);
                    // Extra smoothstep blur: fade 0→1 over the outer 60% of the Fresnel band
                    fresnel *= smoothstep(0.0, 0.6, rawFresnel);

                    float alpha = fresnel * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.4));
                }
            `,

            transparent: true,
            side: THREE.BackSide,
            blending: THREE.NormalBlending,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
    }

    setIntensity(v) { this.intensityScale = THREE.MathUtils.clamp(v, 0, 1); }
    setPlanetCenter(c) { /* No uniform needed */ }

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Intensity: barely visible at distance, slightly stronger near surface
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.4, 0.7, density) * this.intensityScale;
        // Lower power near surface = slightly wider glow during entry
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(5.0, 3.0, density);

        this._fogDensity = THREE.MathUtils.lerp(0, 0.00003, density);
    }

    getFog() { return { color: this._fogColor, density: this._fogDensity }; }
    getDensity() { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
