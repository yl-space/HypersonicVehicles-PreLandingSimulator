/**
 * SceneManager.js
 * Handles Three.js scene setup with planet rendering
 */

import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';

export class SceneManager {
    constructor(container) {
        this.container = container || document.body;
        this.scenes = {};
        this.currentScene = 'mars';
        this.renderer = null;
        this.camera = null;
        this.lights = {};
        this.planets = {};
        this.starfield = null;
        
        this.init();
    }
    
    init() {
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
            powerPreference: "high-performance",
            logarithmicDepthBuffer: true
        });
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 0.8;
        
        this.container.appendChild(this.renderer.domElement);

        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            45,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 10;

        // Create starfield
        this.createStarfield();
        
        // Create planet scenes
        this.createPlanetScenes();
        
        // Setup post-processing
        this.setupPostProcessing();
    }
    
    createStarfield() {
        const textureLoader = new THREE.TextureLoader();
        const starFieldGeometry = new THREE.SphereGeometry(30, 64, 64);
        const starFieldTexture = textureLoader.load('/assets/textures/starfield.png');
        starFieldTexture.colorSpace = THREE.SRGBColorSpace;
        starFieldTexture.wrapS = THREE.RepeatWrapping;
        starFieldTexture.wrapT = THREE.RepeatWrapping;
        starFieldTexture.repeat.set(8, 4);

        const starMaterial = new THREE.MeshBasicMaterial({ 
            map: starFieldTexture,
            side: THREE.DoubleSide
        });

        this.starfield = new THREE.Mesh(starFieldGeometry, starMaterial);
    }
    
    createPlanetScenes() {
        const textureLoader = new THREE.TextureLoader();

        // Mars Scene
        const marsScene = new THREE.Scene();
        marsScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        marsScene.add(this.starfield.clone());

        const marsGeometry = new THREE.SphereGeometry(1, 64, 64);
        const marsMaterial = new THREE.MeshPhysicalMaterial({
            map: textureLoader.load('/assets/textures/Mars/Mars.jpg'),
            normalMap: textureLoader.load('/assets/textures/Mars/mars_normal.jpg'),
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 1.0,
            metalness: 0.0,
            color: new THREE.Color(0xffffff),
            emissiveIntensity: 0.02,
        });
        const mars = new THREE.Mesh(marsGeometry, marsMaterial);
        mars.position.set(0, 0, 0);
        marsScene.add(mars);
        this.planets.mars = mars;

        // Earth Scene
        const earthScene = new THREE.Scene();
        earthScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        earthScene.add(this.starfield.clone());

        const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
        const earthMaterial = new THREE.MeshPhysicalMaterial({
            map: textureLoader.load('/assets/textures/Earth/earthmap_color.jpg'),
            normalMap: textureLoader.load('/assets/textures/Earth/earthmap_bump.jpg'),
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughness: 0.9,
            metalness: 0.02,
            color: new THREE.Color(0xffffff),
        });
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.position.set(0, 0, 0);
        earthScene.add(earth);
        this.planets.earth = earth;

        // Jupiter Scene
        const jupiterScene = new THREE.Scene();
        jupiterScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        jupiterScene.add(this.starfield.clone());

        const jupiterGeometry = new THREE.SphereGeometry(2, 64, 64);
        const jupiterMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffa500),
            roughness: 0.8,
            metalness: 0.0,
        });
        const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
        jupiter.position.set(0, 0, 0);
        jupiterScene.add(jupiter);
        this.planets.jupiter = jupiter;

        // Add lighting to each scene and store
        this.scenes = {
            mars: marsScene,
            earth: earthScene,
            jupiter: jupiterScene
        };

        // Setup lighting for each scene
        Object.values(this.scenes).forEach(scene => {
            this.setupLighting(scene);
        });

        // Set default scene
        this.scene = this.scenes.mars;
    }
    
    setupLighting(scene) {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        scene.add(ambientLight);
        
        // Main directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
        sunLight.position.set(100, 50, 75);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -10;
        sunLight.shadow.camera.right = 10;
        sunLight.shadow.camera.top = 10;
        sunLight.shadow.camera.bottom = -10;
        scene.add(sunLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x4a4a6a, 0.3);
        fillLight.position.set(-50, -25, -50);
        scene.add(fillLight);
        
        // Rim light
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.5);
        rimLight.position.set(-50, 20, -50);
        scene.add(rimLight);
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5, // strength
            0.4, // radius
            0.85  // threshold
        );
        this.composer.addPass(bloomPass);
    }
    
    switchPlanet(planetName) {
        if (this.scenes[planetName]) {
            this.currentScene = planetName;
            this.scene = this.scenes[planetName];
            
            // Update render pass
            const renderPass = new RenderPass(this.scene, this.camera);
            this.composer.passes[0] = renderPass;
        }
    }
    
    addToCurrentScene(object) {
        this.scene.add(object);
    }
    
    addToAllScenes(object) {
        Object.values(this.scenes).forEach(scene => {
            scene.add(object.clone());
        });
    }
    
    updatePlanetRotation(deltaTime) {
        if (this.planets[this.currentScene]) {
            this.planets[this.currentScene].rotation.y += 0.002;
        }
        
        // Special handling for Earth clouds if implemented
        if (this.currentScene === 'earth' && this.planets.earthClouds) {
            this.planets.earthClouds.rotation.y += 0.0015;
        }
    }
    
    render(camera) {
        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, camera || this.camera);
        }
    }
    
    handleResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(width, height);
        
        if (this.composer) {
            this.composer.setSize(width, height);
        }
    }
    
    updateLighting(altitude, phase) {
        // Original lighting update logic
        const intensity = Math.max(0.2, 1 - altitude / 100000);
        
        Object.values(this.lights).forEach(light => {
            if (light.isDirectionalLight) {
                light.intensity = intensity * 2;
            }
        });
    }
    
    dispose() {
        this.renderer.dispose();
        if (this.composer) {
            this.composer.dispose();
        }
    }
}