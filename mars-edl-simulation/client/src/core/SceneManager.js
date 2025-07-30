/**
 * SceneManager.js
 * Handles Three.js scene setup, lighting, and rendering
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';

export class SceneManager {
    constructor(container) {
        this.container = container || document.body;
        this.scene = null;
        this.renderer = null;
        this.lights = {};
        this.renderer.logarithmicDepthBuffer = true; // For large scale distances
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        this.composer = null;
        this.init();
    }
    
    init() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1;

        
        this.container.appendChild(this.renderer.domElement);

        // Setup post-processing
        this.setupPostProcessing();
        
        // Setup lighting
        this.setupLighting();
        
        // Handle resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    setupLighting() {
        // Ambient light for general illumination
        this.lights.ambient = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(this.lights.ambient);
        
        // Sun light (main directional light)
        this.lights.sun = new THREE.DirectionalLight(0xffffff, 1.2);
        this.lights.sun.position.set(5000, 10000, 5000);
        this.lights.sun.intensity = 2.0; // Increase intensity
        this.lights.sun.shadow.mapSize.width = 4096; // Higher quality shadows
        this.lights.sun.shadow.mapSize.height = 4096;
        this.lights.sun.castShadow = true;
        
        // // Shadow settings for sun
        // this.lights.sun.shadow.mapSize.width = 2048;
        // this.lights.sun.shadow.mapSize.height = 2048;
        // this.lights.sun.shadow.camera.near = 1;
        // this.lights.sun.shadow.camera.far = 50000;
        // this.lights.sun.shadow.camera.left = -5000;
        // this.lights.sun.shadow.camera.right = 5000;
        // this.lights.sun.shadow.camera.top = 5000;
        // this.lights.sun.shadow.camera.bottom = -5000;
        // this.lights.sun.shadow.bias = -0.0005;
        
        this.scene.add(this.lights.sun);
        
        // Jupiter surface reflection light (subtle orange)
        this.lights.jupiterReflection = new THREE.DirectionalLight(0xB87333, 0.2);
        this.lights.jupiterReflection.position.set(-2000, -5000, -2000);
        this.scene.add(this.lights.jupiterReflection);
        // Hemisphere light for ambient effect
        const hemiLight = new THREE.HemisphereLight(0xff6b4a, 0x000033, 0.5);
        this.scene.add(hemiLight); 
        
        // Rim light for spacecraft visibility
        this.lights.rim = new THREE.DirectionalLight(0x8888ff, 0.3);
        this.lights.rim.position.set(-3000, 2000, 3000);
        this.scene.add(this.lights.rim);
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // this.renderer.setSize(width, height);
        if (this.composer) {
            this.composer.setSize(window.innerWidth, window.innerHeight);
        }
    }
    
    render(camera) {
        // this.renderer.render(this.scene, camera);
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
    }
    
    // Update lighting based on altitude and phase
    updateLighting(altitude, phase) {
        // Adjust ambient light based on altitude (darker in space)
        const atmosphereEffect = Math.min(altitude / 100, 1);
        this.lights.ambient.intensity = 0.3 + atmosphereEffect * 0.2;
        
        // Adjust sun intensity based on atmosphere
        this.lights.sun.intensity = 1.2 - atmosphereEffect * 0.2;
        
        // Increase Jupiter reflection when closer to surface
        this.lights.jupiterReflection.intensity = 0.2 + (1 - atmosphereEffect) * 0.3;
    }
    // Post-processing setup
    setupPostProcessing() {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    
    const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.5,  // strength
        0.4,  // radius
        0.85  // threshold
    );
    this.composer.addPass(bloomPass);
    }
    
    dispose() {
        window.removeEventListener('resize', this.handleResize);
        this.renderer.dispose();
        this.renderer.domElement.remove();
    }
}