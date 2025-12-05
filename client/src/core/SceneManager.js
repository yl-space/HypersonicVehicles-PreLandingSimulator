import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';

export class SceneManager {
    constructor(container) {
        this.container = container || document.body;
        this.scenes = {};
        this.currentScene = null;
        this.renderer = null;
        this.camera = null;
        this.composer = null;
        this.stats = null;
        
        // Performance monitoring
        this.performanceMonitor = {
            drawCalls: 0,
            triangles: 0,
            points: 0,
            lines: 0
        };
        

        this.USE_WEBGPU = false; // Set to true when WebGPU is stable
        this.USE_PMREM = true; // Use PMREM for better environment maps
        
        this.init();
    }
    
    init() {
        this.setupRenderer();
        this.setupCamera();
        this.setupPostProcessing();
        this.createScenes();
        this.setupEventListeners();
        this.setupPerformanceMonitoring();
    }
    
    setupRenderer() {
        // Modern renderer with optimizations
        const params = {
            antialias: true,
            powerPreference: "high-performance",
            alpha: false,
            stencil: false,
            depth: true,
            logarithmicDepthBuffer: true, // Better depth precision for large scenes
            preserveDrawingBuffer: false
        };
        
        // Use standard WebGLRenderer for production stability
        this.renderer = new THREE.WebGLRenderer(params);
        
        // Modern renderer settings - reduced pixel ratio for better performance
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1)); // Cap at 1 for better performance
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.shadowMap.enabled = false;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        // Enable modern features
        this.renderer.useLegacyLights = false; 
        this.renderer.shadowMap.autoUpdate = false; 
        
        this.container.appendChild(this.renderer.domElement);
    }
    
    setupCamera() {
        const aspect = this.container.clientWidth / this.container.clientHeight;
        
        this.camera = new THREE.PerspectiveCamera(
            50,
            aspect,
            0.000001,  // Extremely close near plane for meter-scale spacecraft (~0.1 m)
            10000   // Far plane for large scale scenes
        );
        
        this.camera.position.set(150, 100, 150);
        this.camera.lookAt(0, 0, 0);
        
        // Add camera layers for selective rendering
        this.camera.layers.enableAll();
    }
    
    setupPostProcessing() {
        // Simplified post-processing pipeline for better performance
        this.composer = new EffectComposer(this.renderer);

        // Render pass - will be updated with scene later
        this.renderPass = new RenderPass(null, this.camera);
        this.composer.addPass(this.renderPass);

        // Disable SMAA temporarily for better performance
        // const smaaPass = new SMAAPass(
        //     this.container.clientWidth * this.renderer.getPixelRatio(),
        //     this.container.clientHeight * this.renderer.getPixelRatio()
        // );
        // this.composer.addPass(smaaPass);

        // Output pass for correct color space
        const outputPass = new OutputPass();
        this.composer.addPass(outputPass);
    }
    
    createScenes() {
        // Mars Scene with bright, even lighting
        const marsScene = new THREE.Scene();
        marsScene.background = null; // Allow starfield skybox to define the background
        
        // Use environment map for better lighting
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        
        // Uniform ambient/hemisphere lighting (no directional shadows)
        const ambientLight = new THREE.AmbientLight(0xfff8e6, 1.4);
        marsScene.add(ambientLight);

        const hemiLight = new THREE.HemisphereLight(0xffffff, 0xffc592, 1.1);
        marsScene.add(hemiLight);
        
        // Create earth and jupiter scenes as placeholders
        const earthScene = marsScene.clone();
        const jupiterScene = marsScene.clone();
        
        this.scenes = { 
            mars: marsScene,
            earth: earthScene,
            jupiter: jupiterScene
        };
        this.currentScene = marsScene;
        
        // Update render pass with the current scene
        if (this.renderPass) {
            this.renderPass.scene = this.currentScene;
        }
        
        pmremGenerator.dispose();
    }
    
    setupPerformanceMonitoring() {
        // Disable performance monitoring to avoid GPU stalls
        // this.renderer.info.autoReset = false;

        // Optional: Stats.js integration
        if (typeof Stats !== 'undefined') {
            this.stats = new Stats();
            this.container.appendChild(this.stats.dom);
        }
    }

    updatePerformanceMetrics() {
        // Temporarily disabled to fix GPU stall issues with ReadPixels
        // const info = this.renderer.info;
        // this.performanceMonitor.drawCalls = info.render.calls;
        // this.performanceMonitor.triangles = info.render.triangles;
        // this.performanceMonitor.points = info.render.points;
        // this.performanceMonitor.lines = info.render.lines;

        // Reset for next frame
        // this.renderer.info.reset();
    }
    
    addToAllScenes(object) {
        // Add object to current scene only to avoid cloning issues
        if (this.currentScene) {
            this.currentScene.add(object);
        }
    }
    
    switchPlanet(planetName) {
        if (this.scenes[planetName]) {
            this.currentScene = this.scenes[planetName];
            
            // Update render pass with new scene
            if (this.renderPass) {
                this.renderPass.scene = this.currentScene;
            }
        }
    }
    
    updatePlanetRotation(deltaTime) {
        // This method kept for compatibility but does nothing
    }
    
    updateLighting(altitude, phase) {
        // Lighting is static and uniform (no day/night cycle)
        return;
    }
    
    render(camera) {
        if (this.currentScene && camera) {
            // Use composer for post-processing
            this.composer.render();
            
            // Update performance metrics
            this.updatePerformanceMetrics();
            
            if (this.stats) {
                this.stats.update();
            }
        }
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        
        // Update post-processing passes
        const smaaPass = this.composer.passes.find(pass => pass instanceof SMAAPass);
        if (smaaPass) {
            smaaPass.setSize(width * this.renderer.getPixelRatio(), height * this.renderer.getPixelRatio());
        }
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
        
        // Handle visibility change for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.renderer.setAnimationLoop(null);
            }
        });
    }
    
    dispose() {
        this.renderer.dispose();
        this.composer.dispose();
        
        // Dispose all geometries and materials
        Object.values(this.scenes).forEach(scene => {
            scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
    }
    
    getPerformanceStats() {
        return this.performanceMonitor;
    }
}
