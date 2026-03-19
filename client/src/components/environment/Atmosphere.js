/**
 * Atmosphere.js
 * Mars atmospheric limb haze — purely cosmetic, no distinct shell visible.
 *
 * The atmosphere is a FrontSide sphere slightly smaller than the planet that
 * uses ray-sphere intersection math in the fragment shader to compute optical
 * depth through a virtual atmosphere layer. This produces a smooth gradient
 * that fades to zero at the top and blends seamlessly into the planet surface
 * at the bottom — no hard edges anywhere.
 *
 * Scene-wide colour grading (tint + exposure) is computed from spacecraft
 * altitude and read by SimulationManager each frame.
 */

import * as THREE from 'three';

export class Atmosphere {
    constructor(planetRadius = 33.9) {
        this.planetRadius = planetRadius;
        this.referenceAltitudeKm = 250;
        this.intensityScale = 1.0;
        this.mesh = null;
        this.material = null;

        this._sceneTint = { r: 0, g: 0, b: 0 };
        this._exposure  = 1.2;
        this._density   = 0;

        this.init();
    }

    init() {
        // Use a large sphere rendered FrontSide — the shader discards fragments
        // that don't intersect the virtual atmosphere shell, so no visible edge.
        const shellRadius = this.planetRadius * 1.04;
        const geometry = new THREE.SphereGeometry(shellRadius, 64, 48);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter:   { value: new THREE.Vector3() },
                planetRadius:   { value: this.planetRadius },
                atmTopRadius:   { value: this.planetRadius * 1.008 }, // thin 0.8% shell
                intensity:      { value: 0.0 },
                hazeDensity:    { value: 0.0 },
                hazeColor:      { value: new THREE.Vector3(0.85, 0.65, 0.50) },
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
                uniform float atmTopRadius;
                uniform float intensity;
                uniform float hazeDensity;
                uniform vec3  hazeColor;

                varying vec3 vWorldPos;

                // Intersect ray with sphere, return (tNear, tFar). Negative = miss.
                vec2 raySphere(vec3 ro, vec3 rd, vec3 center, float r) {
                    vec3 oc = ro - center;
                    float b = dot(oc, rd);
                    float c = dot(oc, oc) - r * r;
                    float disc = b * b - c;
                    if (disc < 0.0) return vec2(-1.0);
                    float s = sqrt(disc);
                    return vec2(-b - s, -b + s);
                }

                void main() {
                    vec3 ro = cameraPosition;
                    vec3 rd = normalize(vWorldPos - cameraPosition);

                    // Intersect view ray with the atmosphere top sphere
                    vec2 atmHit = raySphere(ro, rd, planetCenter, atmTopRadius);
                    if (atmHit.x < 0.0 && atmHit.y < 0.0) discard;

                    // Intersect with planet surface
                    vec2 surfHit = raySphere(ro, rd, planetCenter, planetRadius);

                    // Compute path length through atmosphere
                    float pathStart = max(atmHit.x, 0.0);
                    float pathEnd;
                    if (surfHit.x > 0.0) {
                        // Ray hits planet — atmosphere path ends at surface
                        pathEnd = surfHit.x;
                    } else {
                        // Ray misses planet — full atmosphere traversal (limb)
                        pathEnd = atmHit.y;
                    }

                    float pathLen = max(pathEnd - pathStart, 0.0);

                    // Normalize by atmosphere thickness
                    float atmThickness = atmTopRadius - planetRadius;
                    float opticalDepth = pathLen / atmThickness;

                    // Exponential falloff — thin atmosphere = mostly transparent
                    float haze = 1.0 - exp(-opticalDepth * 0.15 * (1.0 + hazeDensity * 2.0));

                    float alpha = haze * intensity;

                    // Slight warm shift at limb (longer path)
                    vec3 color = hazeColor + vec3(0.05, 0.01, 0.0) * smoothstep(2.0, 8.0, opticalDepth);

                    gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.30));
                }
            `,

            transparent: true,
            side: THREE.FrontSide,
            blending: THREE.NormalBlending,
            depthWrite: false,
            depthTest: true,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
        this.mesh.renderOrder = 10;
    }

    setIntensity(v) { this.intensityScale = THREE.MathUtils.clamp(v, 0, 1); }

    setPlanetCenter(c) {
        if (this.material && c?.isVector3) this.material.uniforms.planetCenter.value.copy(c);
    }

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;
        if (planetCenter?.isVector3) this.material.uniforms.planetCenter.value.copy(planetCenter);

        const alt = Number.isFinite(spacecraftAltitudeKm) ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        // Smooth hermite — atmosphere becomes visible gradually
        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Shader intensity: invisible at high alt, moderate at surface
        this.material.uniforms.intensity.value  = THREE.MathUtils.lerp(0.0, 0.6, density) * this.intensityScale;
        this.material.uniforms.hazeDensity.value = density;

        // Scene colour grade
        this._sceneTint.r = density * 0.14;
        this._sceneTint.g = density * 0.05;
        this._sceneTint.b = density * 0.02;
        this._exposure = THREE.MathUtils.lerp(1.2, 1.45, density);
    }

    getSceneTint()  { return this._sceneTint; }
    getExposure()   { return this._exposure; }
    getDensity()    { return this._density; }
    getObject3D()   { return this.mesh; }

    dispose() {
        if (this.mesh) { this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
    }
}
