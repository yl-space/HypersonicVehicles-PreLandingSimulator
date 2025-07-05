/**
 * SceneManager.js - Core Three.js scene management
 */

import * as THREE from 'three';
import { CameraController } from './CameraController.js';

export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.cameraController = null;
        this.clock = new THREE.Clock();
        this.isRendering = false;
        
        this.init();
    }
    
    init() {
        // Setup renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        this.container.appendChild(this.renderer.domElement);
        
        // Setup camera controller
        this.cameraController = new CameraController(this.container);
        
        // Setup scene
        this.scene.background = new THREE.Color(0x000005);
        this.scene.fog = new THREE.FogExp2(0x000005, 0.00001);
        
        // Lighting
        this.setupLighting();
        
        // Start render loop
        this.startRenderLoop();
    }
    
    setupLighting() {
        // Sun light (directional)
        const sunLight = new THREE.DirectionalLight(0xffeaa7, 2.5);
        sunLight.position.set(-1000000, 500000, 1000000);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 500;
        sunLight.shadow.camera.far = 4000;
        sunLight.shadow.camera.left = -1000;
        sunLight.shadow.camera.right = 1000;
        sunLight.shadow.camera.top = 1000;
        sunLight.shadow.camera.bottom = -1000;
        this.scene.add(sunLight);
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Mars atmosphere glow
        const atmosphereLight = new THREE.PointLight(0xff6b35, 0.8, 200000);
        atmosphereLight.position.set(0, 0, 0);
        this.scene.add(atmosphereLight);
    }
    
    startRenderLoop() {
        this.isRendering = true;
        this.render();
    }
    
    render() {
        if (!this.isRendering) return;
        
        requestAnimationFrame(() => this.render());
        
        const deltaTime = this.clock.getDelta();
        
        // Update camera
        this.cameraController.update(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.cameraController.camera);
    }
    
    stopRenderLoop() {
        this.isRendering = false;
    }
    
    addToScene(object) {
        if (object.mesh) {
            this.scene.add(object.mesh);
        } else if (object.isObject3D || object.type) {
            this.scene.add(object);
        }
    }
    
    removeFromScene(object) {
        if (object.mesh) {
            this.scene.remove(object.mesh);
        } else if (object.isObject3D || object.type) {
            this.scene.remove(object);
        }
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.cameraController.camera.aspect = width / height;
        this.cameraController.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen().catch(err => {
                console.warn('Could not enter fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }
    
    setBackgroundColor(color) {
        this.scene.background = new THREE.Color(color);
    }
    
    getCamera() {
        return this.cameraController.camera;
    }
    
    getRenderer() {
        return this.renderer;
    }
    
    getScene() {
        return this.scene;
    }
    
    dispose() {
        this.stopRenderLoop();
        
        if (this.renderer) {
            this.renderer.dispose();
            this.container.removeChild(this.renderer.domElement);
        }
        
        if (this.cameraController) {
            this.cameraController.dispose();
        }
    }
}