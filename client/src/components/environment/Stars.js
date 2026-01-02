/**
 * Stars.js
 * Creates a starfield background using texture tiling
 */

import * as THREE from 'three';

export class Stars {
    constructor() {
        this.group = new THREE.Group();
        this.init();
    }

    init() {
        this.createStarfieldSkybox();
    }

    createStarfieldSkybox() {
        const loader = new THREE.TextureLoader();
        const texture = loader.load('/assets/textures/starfield.png');

        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        const size = 100000;
        const geometry = new THREE.BoxGeometry(size, size, size);
        const materials = [];

        for (let i = 0; i < 6; i++) {
            const faceTexture = texture.clone();
            faceTexture.repeat.set(10 + i * 2, 10 + i * 2);
            materials.push(new THREE.MeshBasicMaterial({
                map: faceTexture,
                side: THREE.BackSide,
                depthWrite: false,
                depthTest: true, // keep stars in background; respect depth so they don't overlay everything
                fog: false,
                toneMapped: false,
                transparent: true,
                opacity: 0.95
            }));
        }

        const skybox = new THREE.Mesh(geometry, materials);
        skybox.renderOrder = -10; // render early, behind everything
        this.group.add(skybox);
    }

    update(deltaTime) {
        this.group.rotation.y += deltaTime * 0.00002;
    }

    getObject3D() {
        return this.group;
    }

    dispose() {
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
    }
}
