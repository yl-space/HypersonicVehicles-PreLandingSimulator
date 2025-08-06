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
        this.sharedObjects = []; // Track objects that need to be in all scenes
        
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
            10000
        );
        // Position camera to see trajectory from side
        this.camera.position.set(50, 20, 50);
        this.camera.lookAt(0, 0, 0);

        // Create starfield
        this.createStarfield();
        
        // Create planet scenes
        this.createPlanetScenes();
        
        // Setup post-processing
        this.setupPostProcessing();
    }
    
    createStarfield() {
        const starFieldGeometry = new THREE.SphereGeometry(30, 64, 64);
        const starFieldTexture = new THREE.TextureLoader().load('/assets/textures/starfield.png');
        starFieldTexture.colorSpace = THREE.SRGBColorSpace;
        starFieldTexture.wrapS = THREE.RepeatWrapping;
        starFieldTexture.wrapT = THREE.RepeatWrapping;
        starFieldTexture.magFilter = THREE.LinearFilter;
        starFieldTexture.minFilter = THREE.LinearMipmapLinearFilter;
        starFieldTexture.anisotropy = 16;
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
        
        const marsStarfield = this.starfield.clone();
        marsScene.add(marsStarfield);

        // Load Mars textures exactly as in planet-renders branch
        const marsColorTex = textureLoader.load('/assets/textures/Mars/Mars.jpg');
        marsColorTex.colorSpace = THREE.SRGBColorSpace;
        marsColorTex.wrapS = THREE.RepeatWrapping;
        marsColorTex.wrapT = THREE.RepeatWrapping;

        const marsNormalTex = textureLoader.load('/assets/textures/Mars/mars_normal.jpg');
        marsNormalTex.wrapS = THREE.RepeatWrapping;
        marsNormalTex.wrapT = THREE.RepeatWrapping;

        const marsGeometry = new THREE.SphereGeometry(3, 64, 64);
        const marsMaterial = new THREE.MeshPhysicalMaterial({
            map: marsColorTex,
            normalMap: marsNormalTex,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 1.0,
            metalness: 0.0,
            color: new THREE.Color(0xffffff),
            emissiveIntensity: 0.02,
        });
        
        const mars = new THREE.Mesh(marsGeometry, marsMaterial);
        mars.position.set(0, 0, 0);
        mars.rotation.x = Math.PI / 2;
        marsScene.add(mars);
        this.planets.mars = mars;

        // Earth Scene
        const earthScene = new THREE.Scene();
        earthScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        const earthStarfield = this.starfield.clone();
        earthScene.add(earthStarfield);

        // Load all Earth textures
        const earthColorTex = textureLoader.load('/assets/textures/Earth/earthmap_color.jpg');
        earthColorTex.colorSpace = THREE.SRGBColorSpace;
        earthColorTex.wrapS = THREE.RepeatWrapping;
        earthColorTex.wrapT = THREE.RepeatWrapping;
        earthColorTex.magFilter = THREE.LinearFilter;
        earthColorTex.minFilter = THREE.LinearMipmapLinearFilter;
        earthColorTex.anisotropy = 16;

        const earthBumpTex = textureLoader.load('/assets/textures/Earth/earthmap_bump.jpg');
        earthBumpTex.wrapS = THREE.RepeatWrapping;
        earthBumpTex.wrapT = THREE.RepeatWrapping;

        const earthSpecularTex = textureLoader.load('/assets/textures/Earth/earthmap_specular.jpg');
        // const earthNightTex = textureLoader.load('/assets/textures/Earth/earthmap_lights.jpg');
        const earthCloudTex = textureLoader.load('/assets/textures/Earth/earthmap_cloud.jpg');
        const earthCloudAlpha = textureLoader.load('/assets/textures/Earth/earthcloudmap_transperancy.jpg');

        const earthGeometry = new THREE.SphereGeometry(1, 64, 64);
        const earthMaterial = new THREE.MeshPhysicalMaterial({
            map: earthColorTex,
            normalMap: earthBumpTex,
            normalScale: new THREE.Vector2(0.3, 0.3),
            roughnessMap: earthSpecularTex,
            roughness: 0.9,
            metalness: 0.02,
            // emissiveMap: earthNightTex,
            emissiveIntensity: 1.5,
            color: new THREE.Color(0xffffff),
            clearcoat: 0.1,
            clearcoatRoughness: 0.1,
        });
        
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.position.set(0, 0, 0);
        earthScene.add(earth);
        this.planets.earth = earth;

        // Earth cloud layer
        const cloudGeometry = new THREE.SphereGeometry(1.005, 64, 64);
        const cloudMaterial = new THREE.MeshPhysicalMaterial({
            map: earthCloudTex,
            alphaMap: earthCloudAlpha,
            transparent: true,
            opacity: 0.6,
            roughness: 1.0,
            metalness: 0.0,
            depthWrite: false,
            side: THREE.DoubleSide,
        });
        
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        clouds.position.set(0, 0, 0);
        earthScene.add(clouds);
        this.planets.earthClouds = clouds;

        // Jupiter Scene
        const jupiterScene = new THREE.Scene();
        jupiterScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        const jupiterStarfield = this.starfield.clone();
        jupiterScene.add(jupiterStarfield);

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

        // Store scenes
        this.scenes = {
            mars: marsScene,
            earth: earthScene,
            jupiter: jupiterScene
        };

        // Setup lighting for each scene
        Object.entries(this.scenes).forEach(([name, scene]) => {
            this.setupLighting(scene, name);
        });

        // Set default scene
        this.scene = this.scenes.mars;
        this.currentScene = 'mars';
    }
    
    setupLighting(scene, planetName) {
        // Main Sun light - brighter for Earth visibility
        const sunLight = new THREE.DirectionalLight(0xffffff, 3.0);
        sunLight.position.set(100, 50, 75);
        sunLight.target.position.set(0, 0, 0);
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

        // Increased ambient light for better visibility
        const ambientLight = new THREE.AmbientLight(0x404040, 0.8);
        scene.add(ambientLight);
        
        // Store lights reference
        if (!this.lights[planetName]) {
            this.lights[planetName] = {};
        }
        this.lights[planetName].sun = sunLight;
        this.lights[planetName].ambient = ambientLight;
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
            
            // Update render pass for new scene
            this.composer.passes[0].scene = this.scene;
            
            // Re-add shared objects to new scene
            this.sharedObjects.forEach(obj => {
                if (!this.scene.getObjectById(obj.id)) {
                    this.scene.add(obj);
                }
            });
        }
    }
    
    addToCurrentScene(object) {
        this.scene.add(object);
    }
    
    addToAllScenes(object) {
        // Add object to shared objects list
        this.sharedObjects.push(object);
        
        // Add to all scenes
        Object.values(this.scenes).forEach(scene => {
            scene.add(object);
        });
    }
    
    removeFromAllScenes(object) {
        // Remove from shared objects list
        const index = this.sharedObjects.indexOf(object);
        if (index > -1) {
            this.sharedObjects.splice(index, 1);
        }
        
        // Remove from all scenes
        Object.values(this.scenes).forEach(scene => {
            scene.remove(object);
        });
    }
    
    updatePlanetRotation(deltaTime) {
        if (this.planets[this.currentScene]) {
            this.planets[this.currentScene].rotation.y += 0.002;
        }
        
        // Rotate Earth clouds at different speed for realism
        if (this.currentScene === 'earth' && this.planets.earthClouds) {
            this.planets.earthClouds.rotation.y += 0.0015;
            this.planets.earthClouds.rotation.x += 0.0002;
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
        // Get current scene lights
        const sceneLights = this.lights[this.currentScene];
        if (!sceneLights) return;
        
        // Adjust lighting based on altitude and phase
        const atmosphereEffect = Math.max(0.2, 1 - altitude / 100000);
        
        if (sceneLights.sun) {
            sceneLights.sun.intensity = 2.0 * atmosphereEffect;
        }
        
        if (sceneLights.ambient) {
            sceneLights.ambient.intensity = 0.5 + (0.3 * atmosphereEffect);
        }
    }
    
    dispose() {
        // Clean up all scenes
        Object.values(this.scenes).forEach(scene => {
            scene.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        });
        
        this.renderer.dispose();
        if (this.composer) {
            this.composer.dispose();
        }
    }
}