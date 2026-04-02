/**
 * Stars.js
 * Realistic sparse point-star field matching NASA Eyes Mars 2020.
 *
 * NASA's reference shows very few, very small, dim white dots on pure black.
 * No dense clouds or colourful variation — just subtle pinpoints.
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
        // Sparse: NASA reference shows ~200-400 visible stars at any time
        const starCount = 3000;
        const radius = 5000;

        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);

        for (let i = 0; i < starCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);

            positions[i * 3]     = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);

            // Mostly dim, a few brighter — realistic magnitude distribution
            const brightness = Math.pow(Math.random(), 2.5) * 0.7 + 0.3;
            colors[i * 3]     = brightness;
            colors[i * 3 + 1] = brightness;
            colors[i * 3 + 2] = brightness;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        const material = new THREE.PointsMaterial({
            size: 1.2,               // Small — individual pinpoints
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.85,
            depthWrite: false,
            depthTest: true,
            fog: true,               // Stars fade with atmospheric fog during entry
            toneMapped: false,
        });

        const points = new THREE.Points(geometry, material);
        points.renderOrder = -10;
        this.group.add(points);
    }

    update(deltaTime) {
        // Imperceptible rotation
        this.group.rotation.y += deltaTime * 0.00001;
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
