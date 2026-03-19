/**
 * Atmosphere.js
 * Mars atmospheric limb haze — BackSide rendered sphere with smooth Fresnel.
 *
 * Uses a simple, reliable approach: a BackSide sphere slightly larger than
 * the planet with a high-power Fresnel effect that concentrates glow at
 * the limb. The color matches Mars tile hues for seamless blending.
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
        // BackSide sphere slightly larger than planet — always visible from outside
        const atmRadius = this.planetRadius * 1.015;
        const geometry = new THREE.SphereGeometry(atmRadius, 96, 64);

        this.material = new THREE.ShaderMaterial({
            uniforms: {
                planetCenter: { value: new THREE.Vector3() },
                // Mars dust haze color — warm brownish-tan matching tile hue
                glowColor:    { value: new THREE.Vector3(0.75, 0.55, 0.40) },
                intensity:    { value: 0.5 },
                fresnelPower: { value: 3.5 },
            },

            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPos;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPos = wp.xyz;
                    gl_Position = projectionMatrix * viewMatrix * wp;
                }
            `,

            fragmentShader: `
                uniform vec3  glowColor;
                uniform float intensity;
                uniform float fresnelPower;
                varying vec3  vNormal;
                varying vec3  vWorldPos;

                void main() {
                    vec3 viewDir = normalize(cameraPosition - vWorldPos);
                    // Fresnel: strongest at grazing angles (planet limb)
                    float NdotV = dot(viewDir, vNormal);
                    float fresnel = pow(clamp(1.0 - abs(NdotV), 0.0, 1.0), fresnelPower);
                    float alpha = fresnel * intensity;
                    gl_FragColor = vec4(glowColor, clamp(alpha, 0.0, 0.45));
                }
            `,

            transparent: true,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geometry, this.material);
    }

    setIntensity(v) {
        this.intensityScale = THREE.MathUtils.clamp(v, 0, 1);
    }

    setPlanetCenter(c) {
        if (this.material && c?.isVector3)
            this.material.uniforms.planetCenter.value.copy(c);
    }

    updateDynamics(spacecraftAltitudeKm = this.referenceAltitudeKm, planetCenter = null) {
        if (!this.material) return;
        if (planetCenter?.isVector3)
            this.material.uniforms.planetCenter.value.copy(planetCenter);

        const alt = Number.isFinite(spacecraftAltitudeKm)
            ? Math.max(0, spacecraftAltitudeKm) : this.referenceAltitudeKm;
        const norm = THREE.MathUtils.clamp(alt / this.referenceAltitudeKm, 0, 1);

        // Smooth hermite
        const t = 1 - norm;
        const density = t * t * (3.0 - 2.0 * t);
        this._density = density;

        // Intensity: visible at altitude (0.5), stronger at entry (1.0)
        this.material.uniforms.intensity.value =
            THREE.MathUtils.lerp(0.5, 1.0, density) * this.intensityScale;
        // Fresnel power: tighter at altitude (4.0), wider at entry (2.5)
        this.material.uniforms.fresnelPower.value =
            THREE.MathUtils.lerp(4.0, 2.5, density);
    }

    getDensity()  { return this._density; }
    getObject3D() { return this.mesh; }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
    }
}
