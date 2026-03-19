/**
 * Atmosphere.js
 * Mars atmospheric limb haze — soft gradient matching planet tile hue.
 *
 * Uses a BackSide sphere slightly larger than the planet. The Fresnel
 * effect naturally concentrates glow at the planet limb (grazing angles)
 * and fades to zero where the camera looks straight at the surface.
 *
 * Bug fix history:
 *  - Previous versions used a "radial fade" (edgeFade) based on fragment
 *    distance from planet center. On a BackSide sphere viewed from outside,
 *    ALL fragments are at the same distance (= atmRadius), making
 *    edgeFade = 0 everywhere → atmosphere was invisible. Removed.
 *    Pure Fresnel provides the correct limb-glow effect.
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
        // Shell 4% larger than planet — Fresnel fades before the geometry edge
        const atmRadius = this.planetRadius * 1.04;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                // Warm brownish-tan matching Mars surface tile hue
                glowColor:    { value: new THREE.Vector3(0.78, 0.54, 0.38) },
                intensity:    { value: 0.9 },
                fresnelPower: { value: 2.8 },
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

                    // Fresnel: strongest at grazing angles (planet limb),
                    // zero when looking straight at the surface.
                    float NdV = abs(dot(viewDir, vNormal));
                    float f = clamp(1.0 - NdV, 0.0, 1.0);

                    // Multi-term: sharp limb core + wide diffuse halo
                    float core = pow(f, fresnelPower);
                    float halo = pow(f, fresnelPower * 0.35);
                    float glow = core * 0.4 + halo * 0.6;

                    float alpha = glow * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.6));
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
        // No longer needed (no planetCenter uniform), kept for API compat
    }

    /**
     * Altitude-driven dynamics: glow strengthens as spacecraft descends.
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        // Smoothstep easing: 0 at high altitude → 1 at surface
        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Intensity: 0.9 at distance → 1.5 close to surface
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.9, 1.5, density) * this.intensityScale;
        // Lower power = wider glow as spacecraft enters atmosphere
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(3.0, 1.6, density);
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
