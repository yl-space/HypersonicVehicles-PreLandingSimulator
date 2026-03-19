/**
 * Atmosphere.js
 * Mars atmospheric haze — angular limb-band with radial gradient.
 *
 * Technique: for each fragment, compute the viewing angle relative to the
 * planet limb.  The atmosphere is only visible in the narrow angular band
 * between the planet's silhouette edge and the atmosphere shell edge.
 * Within that band, density falls off from opaque (planet edge) to
 * transparent (atmosphere edge), giving a natural radial gradient.
 *
 * The planet mesh renders with depth, so atmosphere fragments behind
 * the planet disk are automatically occluded.
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
        // Shell 5% larger than planet — defines the outer edge of visible haze
        const atmRadius = this.planetRadius * 1.05;
        const geometry = new THREE.SphereGeometry(atmRadius, 128, 80);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:  { value: new THREE.Vector3() },
                planetRadius:  { value: this.planetRadius },
                atmRadius:     { value: atmRadius },
                // Reddish-brown Mars atmosphere
                glowColor:     { value: new THREE.Vector3(0.62, 0.32, 0.18) },
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
                    vec3 rayDir = normalize(vWorldPos - cameraPosition);
                    vec3 toPlanet = planetCenter - cameraPosition;
                    float camDist = length(toPlanet);

                    // Camera at planet center — skip
                    if (camDist < 0.01) { discard; }

                    vec3 toPlanetDir = toPlanet / camDist;

                    // Cosine of angle from camera to planet limb (silhouette edge)
                    float ratioP = min(planetRadius / camDist, 0.9999);
                    float cosLimb = sqrt(1.0 - ratioP * ratioP);

                    // Cosine of angle from camera to atmosphere outer edge
                    float ratioA = min(atmRadius / camDist, 0.9999);
                    float cosAtmEdge = sqrt(1.0 - ratioA * ratioA);

                    // Angle of this fragment relative to planet center direction
                    float cosViewAngle = dot(toPlanetDir, rayDir);

                    // The atmosphere band spans from cosLimb (inner = planet edge)
                    // to cosAtmEdge (outer = atmosphere edge).
                    // cosLimb > cosAtmEdge since the planet is smaller than the atm shell.
                    float bandWidth = cosLimb - cosAtmEdge;
                    if (bandWidth < 0.0001) { discard; }

                    // t = 0 at planet limb (inner), t = 1 at atmosphere edge (outer)
                    float t = (cosLimb - cosViewAngle) / bandWidth;
                    t = clamp(t, 0.0, 1.0);

                    // Radial gradient: opaque at inner edge, transparent at outer edge
                    // Cubic falloff for natural density decrease
                    float density = 1.0 - t;
                    density = density * density * density;

                    // Slight boost near the limb for visible definition
                    density += 0.15 * (1.0 - t) * (1.0 - t);

                    float alpha = density * intensity;

                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.7));
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

        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Intensity ramps from 1.0 → 2.0 as spacecraft descends
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(1.0, 2.0, density) * this.intensityScale;
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
