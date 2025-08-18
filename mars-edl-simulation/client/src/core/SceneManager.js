/**
 * SceneManager.js - FIXED VERSION
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

        // Create planet scenes FIRST
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

        // ============ MARS SCENE ============
        const marsScene = new THREE.Scene();
        marsScene.fog = new THREE.FogExp2(0x000000, 0.00001);

        // Fixed texture paths (remove 'textures' subfolder)
        const marsColorTex = textureLoader.load('/assets/textures/Mars/Mars.jpg');
        const marsNormalTex = textureLoader.load('/assets/textures/Mars/mars_normal.jpg');

        const marsGeometry = new THREE.SphereGeometry(3, 64, 64);
        const marsMaterial = new THREE.MeshPhysicalMaterial({
            map: marsColorTex,
            normalMap: marsNormalTex,
            normalScale: new THREE.Vector2(1.0, 1.0),
            roughness: 1.0,
            metalness: 0.0,
            color: new THREE.Color(0xd99559) // Mars orange tint
        });
        
        const mars = new THREE.Mesh(marsGeometry, marsMaterial);
        // Position Mars below the trajectory path
        mars.position.set(0, -100, 0);
        marsScene.add(mars);
        this.planets.mars = mars;

        // ============ EARTH SCENE ============
        const earthScene = new THREE.Scene();
        earthScene.fog = new THREE.FogExp2(0x000000, 0.00001);

        // Earth textures
        const earthColorTex = textureLoader.load('/assets/textures/Earth/earthmap_color.jpg');
        const earthBumpTex = textureLoader.load('/assets/textures/Earth/earthmap_bump.jpg');
        const earthSpecularTex = textureLoader.load('/assets/textures/Earth/earthmap_specular.jpg');
        const earthCloudTex = textureLoader.load('/assets/textures/Earth/earthmap_cloud.jpg');
        const earthCloudAlpha = textureLoader.load('/assets/textures/Earth/earthcloudmap_transperancy.jpg');

        // Earth with similar scale to Mars
        const earthRadius = 100;
        const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
        const earthMaterial = new THREE.MeshStandardMaterial({
            map: earthColorTex,
            bumpMap: earthBumpTex,
            bumpScale: 0.5,
            metalnessMap: earthSpecularTex,
            roughness: 0.7,
            metalness: 0.1
        });
        
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.position.set(0, -100, 0);
        earthScene.add(earth);
        this.planets.earth = earth;

        // Earth cloud layer
        const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.01, 64, 64);
        const cloudMaterial = new THREE.MeshStandardMaterial({
            map: earthCloudTex,
            alphaMap: earthCloudAlpha,
            transparent: true,
            opacity: 0.4,
            depthWrite: false
        });
        
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        clouds.position.copy(earth.position);
        earthScene.add(clouds);
        this.planets.earthClouds = clouds;

        // ============ JUPITER SCENE ============
        const jupiterScene = new THREE.Scene();
        jupiterScene.fog = new THREE.FogExp2(0x000000, 0.00001);

        // Jupiter (larger than Earth and Mars)
        const jupiterRadius = 150;
        const jupiterGeometry = new THREE.SphereGeometry(jupiterRadius, 64, 64);
        const jupiterMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0xc88b3f),
            roughness: 0.8,
            metalness: 0.0
        });
        
        const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
        jupiter.position.set(0, -150, 0);
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

        // Set default scene to Mars
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

        // Ambient light for visibility
        const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
        scene.add(ambientLight);
        
        // Hemisphere light for natural lighting
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.5);
        hemiLight.position.set(0, 100, 0);
        scene.add(hemiLight);
        
        // Store lights
        if (!this.lights[planetName]) {
            this.lights[planetName] = {};
        }
        this.lights[planetName].sun = sunLight;
        this.lights[planetName].ambient = ambientLight;
        this.lights[planetName].hemisphere = hemiLight;
    }
    
    setupPostProcessing() {
        this.composer = new EffectComposer(this.renderer);
        
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);
        
        const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.3, // reduced strength
            0.4,
            0.85
        );
        this.composer.addPass(bloomPass);
    }
    
    switchPlanet(planetName) {
        if (this.scenes[planetName]) {
            this.currentScene = planetName;
            this.scene = this.scenes[planetName];
            
            // Update render pass
            if (this.composer && this.composer.passes[0]) {
                this.composer.passes[0].scene = this.scene;
            }
            
            // Re-add shared objects
            this.sharedObjects.forEach(obj => {
                if (!this.scene.getObjectById(obj.id)) {
                    this.scene.add(obj.clone ? obj.clone() : obj);
                }
            });
        }
    }
    
    addToCurrentScene(object) {
        if (this.scene) {
            this.scene.add(object);
        }
    }
    
    addToAllScenes(object) {
        this.sharedObjects.push(object);
        
        Object.values(this.scenes).forEach(scene => {
            // Clone if possible, otherwise add directly
            const objToAdd = object.clone ? object.clone() : object;
            scene.add(objToAdd);
        });
    }
    
    removeFromAllScenes(object) {
        const index = this.sharedObjects.indexOf(object);
        if (index > -1) {
            this.sharedObjects.splice(index, 1);
        }
        
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
        const sceneLights = this.lights[this.currentScene];
        if (!sceneLights) return;
        
        const atmosphereEffect = Math.max(0.2, 1 - altitude / 100000);
        
        if (sceneLights.sun) {
            sceneLights.sun.intensity = 1.5 + (0.5 * atmosphereEffect);
        }
        
        if (sceneLights.ambient) {
            sceneLights.ambient.intensity = 0.8 + (0.2 * atmosphereEffect);
        }
    }
    
    dispose() {
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