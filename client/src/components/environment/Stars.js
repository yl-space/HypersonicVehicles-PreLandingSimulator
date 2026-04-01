/**
 * Stars.js
 * Procedural point-star field matching NASA Eyes Mars 2020 reference.
 *
 * Replaces the texture-based skybox (which had visible repeating patterns)
 * with thousands of individual point sprites at random positions on a
 * large sphere. Each star has randomised brightness for a natural look.
 */

import * as THREE from 'three';

export class Stars {
    constructor() {
        this.group = new THREE.Group();
        this.init();
    }

    init() {
        this.createPointStars();
    }

    createPointStars() {
        const starCount = 8000;
        const radius = 5000; // Far enough to be behind everything

        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);

        for (let i = 0; i < starCount; i++) {
            // Random point on sphere surface
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            const r = radius;

            positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            // Randomised warm-white colour with slight variation
            const brightness = 0.5 + Math.random() * 0.5;
            // Slight colour temperature variation: some bluer, some warmer
            const temp = Math.random();
            if (temp > 0.85) {
                // Blue-white star (~15%)
                colors[i * 3]     = brightness * 0.8;
                colors[i * 3 + 1] = brightness * 0.85;
                colors[i * 3 + 2] = brightness;
            } else if (temp > 0.7) {
                // Yellow-white star (~15%)
                colors[i * 3]     = brightness;
                colors[i * 3 + 1] = brightness * 0.9;
                colors[i * 3 + 2] = brightness * 0.7;
            } else {
                // White star (~70%)
                colors[i * 3]     = brightness;
                colors[i * 3 + 1] = brightness;
                colors[i * 3 + 2] = brightness;
            }

            // Random size: most are tiny, a few are brighter
            sizes[i] = 1.0 + Math.random() * 2.0;
            if (Math.random() > 0.95) sizes[i] *= 2.5; // ~5% brighter stars
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

        const material = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthWrite: false,
            depthTest: true,
            fog: false,
            toneMapped: false,
        });

        const points = new THREE.Points(geometry, material);
        points.renderOrder = -10;
        this.group.add(points);
    }

    update(deltaTime) {
        // Very slow rotation — barely perceptible, adds life
        this.group.rotation.y += deltaTime * 0.00002;
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}
