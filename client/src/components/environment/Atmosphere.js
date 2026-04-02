/**
 * Atmosphere.js
 * Mars atmospheric limb haze — replica of NASA Eyes Mars 2020.
 *
 * Two visual layers:
 * 1. BackSide Fresnel shell: warm orange limb glow that softens the
 *    planet's silhouette edge against space.
 * 2. Scene fog: altitude-driven THREE.FogExp2 that tints the entire
 *    scene warm brown during atmospheric entry (read by SimulationManager).
 *
 * The shell is 3% above planet radius — thicker than 1.5% to properly
 * soften the hard planet edge visible in earlier versions. Colour is
 * warm orange (0.85, 0.55, 0.30) matching the NASA reference.
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

        // Fog parameters for scene-wide atmospheric tint
        this._fogDensity = 0;
        this._fogColor = new THREE.Color(0.45, 0.28, 0.15); // warm Mars dust

        this.init();
    }

    init() {
        // 3% above planet — wide enough to soften the limb edge
        const atmRadius = this.planetRadius * 1.03;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                // Warm orange matching NASA Eyes Mars 2020 limb colour
                glowColor:     { value: new THREE.Vector3(0.85, 0.55, 0.30) },
                intensity:     { value: 0.5 },
                fresnelPower:  { value: 3.0 },
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

                    // Fresnel: strongest at grazing angles (planet limb)
                    float NdV = abs(dot(viewDir, vNormal));
                    float fresnel = pow(clamp(1.0 - NdV, 0.0, 1.0), fresnelPower);

                    float alpha = fresnel * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.55));
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

    setPlanetCenter(c) { /* No planetCenter uniform needed */ }

    /**
     * Altitude-driven dynamics: limb glow + scene fog intensify during descent.
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t); // smoothstep
        this._density = density;

        // Limb glow: 0.5 at distance → 0.9 near surface
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.5, 0.9, density) * this.intensityScale;
        // Soften Fresnel as spacecraft enters atmosphere
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(3.0, 1.5, density);

        // Scene fog density: extremely subtle — only noticeable at very low altitude.
        // Previous 0.0006 was far too strong, washing out the sky at 50+ miles.
        // At Mars surface scale (~34 scene units), fog density must be tiny.
        this._fogDensity = THREE.MathUtils.lerp(0, 0.00008, density);
    }

    /** Returns fog parameters for SimulationManager to apply to the scene */
    getFog() {
        return { color: this._fogColor, density: this._fogDensity };
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
