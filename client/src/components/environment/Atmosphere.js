/**
 * Atmosphere.js
 * Mars atmosphere — thin limb haze with altitude-reactive scene tint.
 *
 * Design goals (matching NASA Mars 2020 EDL visualisation):
 *   - At high altitude: barely-visible peach/white haze at the planet limb,
 *     no distinct "ring" or hard edge.
 *   - During entry: the whole scene gradually warms (dusty salmon tint),
 *     the limb haze intensifies slightly, and exposure brightens.
 *   - The shell must blend seamlessly into the planet edge — the viewer
 *     should never perceive a separate glowing element.
 */

import * as THREE from 'three';

export class Atmosphere {
    /**
     * @param {number} planetRadius  scene-unit radius (33.9 ≈ 3 390 km)
     */
    constructor(planetRadius = 33.9) {
        this.planetRadius = planetRadius;
        this.referenceAltitudeKm = 250;   // onset begins early but very faintly
        this.intensityScale = 1.0;
        this.mesh = null;
        this.material = null;

        // Externally-readable scene-wide colour-grade values
        this._sceneTint   = { r: 0, g: 0, b: 0 };
        this._exposure    = 1.2;   // base renderer exposure
        this._density     = 0;     // cached 0-1 density

        this.init();
    }

    /* ------------------------------------------------------------------ */
    init() {
        // Very thin shell — just enough to cover the limb.
        // A thinner shell means less visible "edge" where the geometry ends.
        const atmRadius = this.planetRadius * 1.012;
        const geometry  = new THREE.SphereGeometry(atmRadius, 128, 96);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:     { value: new THREE.Vector3() },
                planetRadius:     { value: this.planetRadius },
                atmosphereRadius: { value: atmRadius },
                // Pale peach — not saturated orange
                glowColor:        { value: new THREE.Vector3(0.95, 0.72, 0.55) },
                intensity:        { value: 0.0 },
                fresnelPower:     { value: 8.0 },
                altitudeDensity:  { value: 0.0 },
                horizonSoftness:  { value: 0.05 },
            },

            vertexShader: /* glsl */`
                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = wp.xyz;
                    vWorldNormal   = normalize(mat3(modelMatrix) * normal);
                    gl_Position    = projectionMatrix * viewMatrix * wp;
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

                varying vec3 vWorldNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 V = normalize(cameraPosition - vWorldPosition);
                    vec3 N = normalize(vWorldNormal);

                    // ── Limb fresnel (very high power → razor-thin at limb only) ──
                    float NdV     = abs(dot(V, N));
                    float fresnel = pow(1.0 - NdV, fresnelPower);

                    // ── Horizon proximity (radial-view alignment) ──
                    vec3  R   = normalize(vWorldPosition - planetCenter);
                    float RdV = abs(dot(V, R));
                    // Smooth fade — widest when horizonSoftness is large
                    float horizon = 1.0 - smoothstep(0.0, horizonSoftness, RdV);

                    // Combine: only visible where limb AND horizon align
                    float shape = fresnel * (0.6 + 0.4 * horizon);

                    // Density-modulated alpha — nearly invisible at high alt
                    float alpha = intensity * shape;

                    // Slight colour warm-up toward the horizon
                    vec3 tint = glowColor + vec3(0.08, 0.02, 0.0) * horizon;

                    // Very soft cap — never fully opaque
                    gl_FragColor = vec4(tint, clamp(alpha, 0.0, 0.35));
                }
            `,

            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.renderOrder = 5;  // draw after planet tiles
    }

    /* ------------------------------------------------------------------ */
    setIntensity(value) {
        this.intensityScale = THREE.MathUtils.clamp(value, 0, 1);
    }

    setPlanetCenter(center) {
        if (!this.material || !center?.isVector3) return;
        this.material.uniforms.planetCenter.value.copy(center);
    }

    /* ------------------------------------------------------------------ */
    /**
     * Drive atmosphere visuals from live spacecraft altitude.
     *
     * High altitude  → limb haze invisible, no scene tint.
     * Low altitude   → thin limb haze appears, scene warms noticeably,
     *                   tone-mapping exposure lifts slightly.
     */
    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        if (planetCenter?.isVector3) {
            this.material.uniforms.planetCenter.value.copy(planetCenter);
        }

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm)
            : this.referenceAltitudeKm;

        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        // Smooth ease-in curve so atmosphere "fades in" gradually
        const t = 1 - norm;                         // 0 at ref alt → 1 at surface
        const density = t * t * (3.0 - 2.0 * t);    // smoothstep hermite

        this._density = density;

        // ── Shader uniforms ──
        // Intensity ramps from 0 (invisible) to moderate
        const dynIntensity    = THREE.MathUtils.lerp(0.0, 0.55, density) * this.intensityScale;
        // High power at altitude (razor thin) → lower power at entry (slightly wider)
        const fresnelPower    = THREE.MathUtils.lerp(8.0, 4.0, density);
        // Horizon softness widens during entry
        const horizonSoftness = THREE.MathUtils.lerp(0.03, 0.12, density);

        this.material.uniforms.intensity.value      = dynIntensity;
        this.material.uniforms.altitudeDensity.value = density;
        this.material.uniforms.fresnelPower.value    = fresnelPower;
        this.material.uniforms.horizonSoftness.value = horizonSoftness;

        // ── Scene-wide colour grade (warm dusty salmon during entry) ──
        // These are mixed into the clear-colour and tone-mapping by SimulationManager
        this._sceneTint.r = density * 0.18;
        this._sceneTint.g = density * 0.07;
        this._sceneTint.b = density * 0.03;

        // Slightly lift exposure during entry (planet surface brightens, looks dusty)
        this._exposure = THREE.MathUtils.lerp(1.2, 1.55, density);
    }

    /* ── Getters for SimulationManager ── */

    /** { r, g, b } tint to blend into renderer.setClearColor */
    getSceneTint()  { return this._sceneTint; }
    /** Target toneMappingExposure (1.2 nominal → 1.55 deep entry) */
    getExposure()   { return this._exposure; }
    /** Current 0-1 density value */
    getDensity()    { return this._density; }

    getObject3D()   { return this.mesh; }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}
