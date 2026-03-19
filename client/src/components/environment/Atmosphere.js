/**
 * Atmosphere.js
 * Mars atmospheric haze — radial gradient (opaque near surface, fading outward).
 *
 * Technique: ray-sphere atmospheric scattering approximation.
 * For each fragment on the BackSide atmosphere shell, we cast the view ray
 * and compute how close it passes to the planet surface (closest approach).
 * Rays that graze the planet limb pass through maximum atmosphere → opaque.
 * Rays far from the surface pass through thin atmosphere → transparent.
 * This creates the desired radial gradient: dense near the horizon,
 * smoothly fading to nothing at the outer edge.
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
        // Shell 5% larger than planet for generous gradient space
        const atmRadius = this.planetRadius * 1.05;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:  { value: new THREE.Vector3() },
                planetRadius:  { value: this.planetRadius },
                atmRadius:     { value: atmRadius },
                // Reddish-brown Mars atmosphere color
                glowColor:     { value: new THREE.Vector3(0.65, 0.35, 0.20) },
                intensity:     { value: 1.0 },
            },

            vertexShader: /* glsl */`
                varying vec3 vWorldPos;
                void main() {
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

                varying vec3 vWorldPos;

                void main() {
                    // View ray: from camera through this fragment
                    vec3 rayOrigin = cameraPosition;
                    vec3 rayDir = normalize(vWorldPos - cameraPosition);

                    // Closest approach of the view ray to the planet center
                    // This determines how much atmosphere the ray passes through
                    vec3 oc = rayOrigin - planetCenter;
                    float b = dot(oc, rayDir);
                    float c = dot(oc, oc);
                    // Closest distance squared = |oc|² - (oc·rayDir)²
                    float closestDistSq = c - b * b;
                    float closestDist = sqrt(max(closestDistSq, 0.0));

                    // Normalize: 0 = at planet surface, 1 = at atmosphere edge
                    float atmThickness = atmRadius - planetRadius;
                    float heightAboveSurface = closestDist - planetRadius;
                    float normalizedHeight = clamp(heightAboveSurface / atmThickness, 0.0, 1.0);

                    // Radial gradient: opaque (1) at surface, transparent (0) at outer edge
                    // Use squared falloff for natural-looking density decrease
                    float density = 1.0 - normalizedHeight;
                    density = density * density; // Quadratic falloff — dense near surface

                    // Extra softening at the very outer edge
                    density *= smoothstep(1.0, 0.85, normalizedHeight);

                    float alpha = density * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.65));
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

        // Intensity ramps from 1.0 (distant) to 1.8 (close to surface)
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(1.0, 1.8, density) * this.intensityScale;
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
