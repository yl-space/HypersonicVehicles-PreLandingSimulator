/**
 * Atmosphere.js
 * Thin Mars atmospheric limb haze — matches NASA Eyes Mars 2020 reference.
 *
 * The atmosphere is a barely-visible dusty-pink gradient at the planet's
 * horizon edge, blending from the surface colour into space. It is NOT a
 * pronounced halo — just a subtle softening of the planet's silhouette.
 *
 * Technique: BackSide sphere slightly larger than the planet. Fresnel
 * effect creates the limb glow (strongest at grazing angles, zero
 * when looking straight at the surface). The planet mesh occludes
 * everything behind the disk via depth testing.
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
        // Very thin shell — just 1.5% above planet surface
        // This keeps the haze tight to the limb, not a wide halo
        const atmRadius = this.planetRadius * 1.015;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                // Dusty pink-brown matching Mars surface edge colour
                glowColor:     { value: new THREE.Vector3(0.75, 0.50, 0.38) },
                intensity:     { value: 0.35 },
                fresnelPower:  { value: 3.5 },
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
                    float fresnel = pow(clamp(1.0 - NdV, 0.0, 1.0), fresnelPower);

                    float alpha = fresnel * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.35));
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

    setPlanetCenter(c) {
        // No planetCenter uniform needed for simple Fresnel approach
    }

    /**
     * Altitude-driven dynamics: atmosphere becomes slightly more visible
     * as spacecraft descends into it.
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Subtle intensity ramp: 0.35 at distance → 0.6 near surface
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.35, 0.6, density) * this.intensityScale;
        // Soften the Fresnel as spacecraft enters atmosphere (wider glow)
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(3.5, 2.0, density);
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
