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
        const starFieldGeometry = new THREE.SphereGeometry(50, 64, 64);
        
        // Create star texture procedurally if texture not available
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Black background
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add stars
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height;
            const radius = Math.random() * 1.5;
            const opacity = Math.random() * 0.8 + 0.2;
            
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.fill();
        }
        
        const starFieldTexture = new THREE.CanvasTexture(canvas);
        starFieldTexture.wrapS = THREE.RepeatWrapping;
        starFieldTexture.wrapT = THREE.RepeatWrapping;
        starFieldTexture.repeat.set(4, 2);

        const starMaterial = new THREE.MeshBasicMaterial({ 
            map: starFieldTexture,
            side: THREE.BackSide,
            fog: false
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

        const marsGeometry = new THREE.SphereGeometry(3.39, 64, 64); // Mars radius ~3,390 km
        const marsMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xCD5C5C),
            roughness: 0.9,
            metalness: 0.1,
            emissive: new THREE.Color(0x220000),
            emissiveIntensity: 0.02,
        });
        
        // Try to load textures, but use fallback if not available
        textureLoader.load(
            '/assets/textures/Mars/Mars.jpg',
            (texture) => {
                texture.colorSpace = THREE.SRGBEncoding;
                marsMaterial.map = texture;
                marsMaterial.needsUpdate = true;
            },
            undefined,
            () => console.log('Mars color texture not found, using default color')
        );
        
        textureLoader.load(
            '/assets/textures/Mars/mars_normal.jpg',
            (texture) => {
                marsMaterial.normalMap = texture;
                marsMaterial.normalScale = new THREE.Vector2(1.0, 1.0);
                marsMaterial.needsUpdate = true;
            },
            undefined,
            () => console.log('Mars normal map not found')
        );
        
        const mars = new THREE.Mesh(marsGeometry, marsMaterial);
        mars.position.set(0, -4, -5); // Position below spacecraft path
        marsScene.add(mars);
        this.planets.mars = mars;

        // Earth Scene
        const earthScene = new THREE.Scene();
        earthScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        const earthStarfield = this.starfield.clone();
        earthScene.add(earthStarfield);

        const earthGeometry = new THREE.SphereGeometry(6.37, 64, 64); // Earth radius ~6,371 km
        const earthMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0x2E8B57),
            roughness: 0.5,
            metalness: 0.1,
            clearcoat: 0.3,
            clearcoatRoughness: 0.1,
        });
        
        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.position.set(0, -8, -10);
        earthScene.add(earth);
        this.planets.earth = earth;

        // Add cloud layer for Earth
        const cloudGeometry = new THREE.SphereGeometry(6.4, 64, 64);
        const cloudMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffffff),
            transparent: true,
            opacity: 0.4,
            roughness: 1.0,
            metalness: 0.0,
            depthWrite: false,
        });
        
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        clouds.position.copy(earth.position);
        earthScene.add(clouds);
        this.planets.earthClouds = clouds;

        // Jupiter Scene
        const jupiterScene = new THREE.Scene();
        jupiterScene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        const jupiterStarfield = this.starfield.clone();
        jupiterScene.add(jupiterStarfield);

        const jupiterGeometry = new THREE.SphereGeometry(14.3, 64, 64); // Jupiter radius ~71,492 km (scaled)
        const jupiterMaterial = new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xDAA520),
            roughness: 0.8,
            metalness: 0.0,
            emissive: new THREE.Color(0x332200),
            emissiveIntensity: 0.01,
        });
        
        const jupiter = new THREE.Mesh(jupiterGeometry, jupiterMaterial);
        jupiter.position.set(0, -20, -30);
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
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        scene.add(ambientLight);
        
        // Main directional light (sun)
        const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
        sunLight.position.set(100, 50, 75);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.1;
        sunLight.shadow.camera.far = 200;
        sunLight.shadow.camera.left = -50;
        sunLight.shadow.camera.right = 50;
        sunLight.shadow.camera.top = 50;
        sunLight.shadow.camera.bottom = -50;
        scene.add(sunLight);
        
        // Fill light
        const fillLight = new THREE.DirectionalLight(0x4a4a6a, 0.5);
        fillLight.position.set(-50, -25, -50);
        scene.add(fillLight);
        
        // Rim light for better planet visibility
        const rimLight = new THREE.DirectionalLight(0xffffff, 0.8);
        rimLight.position.set(-50, 20, -50);
        scene.add(rimLight);
        
        // Store lights reference for this scene
        if (!this.lights[planetName]) {
            this.lights[planetName] = {};
        }
        this.lights[planetName].sun = sunLight;
        this.lights[planetName].fill = fillLight;
        this.lights[planetName].rim = rimLight;
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
        // Rotate current planet
        if (this.planets[this.currentScene]) {
            this.planets[this.currentScene].rotation.y += 0.001 * deltaTime * 60;
        }
        
        // Special handling for Earth clouds
        if (this.currentScene === 'earth' && this.planets.earthClouds) {
            this.planets.earthClouds.rotation.y += 0.0008 * deltaTime * 60;
            this.planets.earthClouds.rotation.x += 0.0001 * deltaTime * 60;
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