/**
 * Atmosphere.js
 * Mars atmospheric limb glow using the Stemkoski atmosphere technique.
 *
 * A BackSide sphere 20% larger than the planet with a view-angle-dependent
 * intensity: pow(c - dot(vNormal, viewDir), p). This creates a soft glow
 * that fades from the planet edge into space, softening the planet's
 * hard silhouette — matching the user's reference image.
 *
 * Ref: stemkoski.github.io/Three.js/Atmosphere.html
 * Ref: discourse.threejs.org/t/creating-a-pseudo-realistic-planetary-atmosphere
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
        // 20% larger than planet — the glow extends well beyond the silhouette
        const atmRadius = this.planetRadius * 1.2;
        const geometry = new THREE.SphereGeometry(atmRadius, 64, 48);

        // #977264 = rgb(151, 114, 100) → normalised (0.592, 0.447, 0.392)
        this.material = new THREE.ShaderMaterial({
            uniforms: {
                glowColor: { value: new THREE.Vector3(0.592, 0.447, 0.392) },
                coeff:     { value: 0.6 },   // controls glow spread (0→1)
                power:     { value: 4.0 },   // controls falloff sharpness
            },

            vertexShader: /* glsl */`
                varying vec3 vVertexNormal;
                varying vec3 vVertexWorldPosition;
                void main() {
                    vVertexNormal = normalize(normalMatrix * normal);
                    vec4 worldPos = modelMatrix * vec4(position, 1.0);
                    vVertexWorldPosition = worldPos.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPos;
                }
            `,

            fragmentShader: /* glsl */`
                uniform vec3  glowColor;
                uniform float coeff;
                uniform float power;

                varying vec3 vVertexNormal;
                varying vec3 vVertexWorldPosition;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vVertexWorldPosition);
                    float intensity = pow(coeff - dot(vVertexNormal, viewDir), power);
                    gl_FragColor = vec4(glowColor, 1.0) * intensity;
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
    setPlanetCenter(c) {}

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Glow slightly stronger during atmospheric entry
        this.material.uniforms.coeff.value =
            THREE.MathUtils.lerp(0.6, 0.7, density) * this.intensityScale;

        this._fogDensity = THREE.MathUtils.lerp(0, 0.00003, density);
    }

    getFog() { return { color: this._fogColor, density: this._fogDensity }; }
    getDensity() { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
