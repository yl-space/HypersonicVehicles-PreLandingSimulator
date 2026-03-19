/**
 * Atmosphere.js
 * Mars atmospheric limb haze — soft gradient that blends with planet tile hue.
 *
 * Renders on a large BackSide sphere. The fragment shader computes Fresnel
 * glow (strongest at the planet limb) and fades smoothly toward the outer
 * geometry edge via smoothstep so there is never a hard boundary.
 *
 * Key visual design:
 *  - Glow color matches the warm brownish-tan of Mars surface tiles
 *  - Intensity increases as the spacecraft descends (altitude-driven density)
 *  - Alpha capped at 0.55 to avoid solid-looking rings
 *  - Wide shell (1.04× radius) so the gradient starts early
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
        // Large shell — shader fades to zero well before the geometry edge
        const atmRadius = this.planetRadius * 1.04;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:  { value: new THREE.Vector3() },
                planetRadius:  { value: this.planetRadius },
                atmRadius:     { value: atmRadius },
                // Warm brownish-tan that blends with Mars surface tile hue
                glowColor:     { value: new THREE.Vector3(0.75, 0.52, 0.38) },
                intensity:     { value: 0.8 },
                fresnelPower:  { value: 2.5 },
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
                uniform vec3  planetCenter;
                uniform float planetRadius;
                uniform float atmRadius;
                uniform vec3  glowColor;
                uniform float intensity;
                uniform float fresnelPower;

                varying vec3 vNormal;
                varying vec3 vWorldPos;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);

                    // Fresnel: strongest at planet limb (grazing angles)
                    float NdV = abs(dot(viewDir, vNormal));
                    float rawFresnel = 1.0 - NdV;
                    float f = clamp(rawFresnel, 0.0, 1.0);

                    // Multi-term: sharp core limb + wide diffuse halo
                    float core = pow(f, fresnelPower);          // tight limb ring
                    float halo = pow(f, fresnelPower * 0.35);   // wide soft glow
                    float fresnel = core * 0.45 + halo * 0.55;

                    // Radial height fade — smoothly vanish toward outer geometry edge
                    float fragDist = length(vWorldPos - planetCenter);
                    float relHeight = (fragDist - planetRadius) / (atmRadius - planetRadius);
                    // Fade starts at 20% height, fully gone at 95%
                    float edgeFade = 1.0 - smoothstep(0.2, 0.95, relHeight);

                    float alpha = fresnel * intensity * edgeFade;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.55));
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

    /**
     * Altitude-driven dynamics: glow strengthens as spacecraft descends.
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;
        if (planetCenter?.isVector3)
            this.material.uniforms.planetCenter.value.copy(planetCenter);

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        // Smoothstep easing: 0 at high altitude → 1 at surface
        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Intensity ramps from 0.8 (distant) to 1.4 (close)
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.8, 1.4, density) * this.intensityScale;
        // Fresnel power decreases (wider glow) as spacecraft enters atmosphere
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(3.0, 1.8, density);
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
