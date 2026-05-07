/**
 * Atmosphere.js
 * Mars limb glow — Stemkoski Shader-Halo technique.
 *
 * The shader computes normals in CAMERA SPACE (via normalMatrix), then
 * dots with vec3(0,0,1) which is the camera's forward direction. This
 * creates a rim glow that always outlines the planet silhouette from
 * any viewing angle — the glow is view-dependent, not position-dependent.
 *
 * Ref: stemkoski.github.io/Three.js/Shader-Halo.html
 * Color: #977264 (warm Mars dust)
 */

import * as THREE from 'three';

export class Atmosphere {
    constructor(planetRadius = 33.96) { // 3,396 km IAU 2018
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
        // Slightly larger than planet — the BackSide glow extends beyond the edge
        const atmRadius = this.planetRadius * 1.025;
        const geometry = new THREE.SphereGeometry(atmRadius, 96, 64);

        // #977264 = (0.592, 0.447, 0.392)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                // #977264 = (151, 114, 100) / 255 = (0.592, 0.447, 0.392)
                glowColor: { value: new THREE.Vector3(0.592, 0.447, 0.392) },
                coeff:     { value: 0.55 },
                power:     { value: 6.0 },
            },

            vertexShader: /* glsl */`
                varying vec3 vNormal;
                void main() {
                    // Normal in CAMERA SPACE — this is the key to view-dependent glow
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,

            fragmentShader: /* glsl */`
                uniform vec3  glowColor;
                uniform float coeff;
                uniform float power;
                varying vec3 vNormal;

                void main() {
                    // dot(vNormal, vec3(0,0,1)) = how much this fragment faces the camera.
                    // At the rim/silhouette edge: normal is perpendicular to camera → dot ≈ 0
                    // At the center (facing camera): dot ≈ 1
                    // coeff - dot gives high values at the rim, low at center.
                    // pow sharpens the falloff.
                    float raw = coeff - dot(vNormal, vec3(0.0, 0.0, 1.0));
                    float intensity = pow(max(raw, 0.0), power);
                    // Clamp intensity to prevent white saturation with AdditiveBlending.
                    // At max 0.35, the additive colour stays warm brown, never white.
                    intensity = min(intensity, 0.35);
                    gl_FragColor = vec4(glowColor * intensity, intensity);
                }
            `,

            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
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

        // Slightly increase glow during atmospheric entry
        this.material.uniforms.coeff.value =
            THREE.MathUtils.lerp(0.55, 0.65, density) * this.intensityScale;

        this._fogDensity = THREE.MathUtils.lerp(0, 0.00003, density);
    }

    getFog() { return { color: this._fogColor, density: this._fogDensity }; }
    getDensity() { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
