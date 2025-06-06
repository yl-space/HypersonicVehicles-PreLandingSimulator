
// client/src/core/SceneManager.js
import * as THREE from 'three';

/**
 * SceneManager handles the core Three.js setup and rendering loop
 * This is our foundation - everything 3D starts here
 */
export class SceneManager {
    constructor(container) {
        this.container = container;
        
        // Step 1: Create the Scene
        // The scene is like a 3D stage where we place all our objects
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x000000, 0.00001);
        
        // Step 2: Create the Camera
        // The camera is our "eye" into the 3D world
        // FOV: Field of View (in degrees) - how wide we can see
        // Aspect: width/height ratio
        // Near/Far: rendering distance limits
        this.camera = new THREE.PerspectiveCamera(
            60,                                     // FOV
            window.innerWidth / window.innerHeight, // Aspect ratio
            0.1,                                   // Near clipping plane
            100000                                 // Far clipping plane
        );
        
        // Position camera in 3D space (x, y, z)
        this.camera.position.set(0, 50, 100);
        
        // Step 3: Create the Renderer
        // The renderer draws our 3D scene onto a 2D canvas
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,      // Smooth edges
            alpha: true,          // Transparent background
            powerPreference: "high-performance"
        });
        
        // Configure renderer for best quality
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Add canvas to DOM
        this.container.appendChild(this.renderer.domElement);
        
        // Step 4: Add Lighting
        this.setupLighting();
        
        // Step 5: Handle window resizing
        this.setupEventListeners();
        
        // Performance monitoring
        this.stats = this.setupStats();
    }
    
    setupLighting() {
        // Ambient light: general illumination (no shadows)
        // Think of it as the general brightness in a room
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light: simulates sunlight
        // Parallel rays from a specific direction
        const sunLight = new THREE.DirectionalLight(0xffffff, 1);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        
        // Shadow configuration for performance
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        
        this.scene.add(sunLight);
        this.sunLight = sunLight;
    }
    
    setupEventListeners() {
        window.addEventListener('resize', () => {
            // Update camera aspect ratio
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            
            // Update renderer size
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
    
    setupStats() {
        // Performance monitoring in development
        if (process.env.NODE_ENV === 'development') {
            const stats = new Stats();
            stats.showPanel(0); // 0: fps, 1: ms, 2: mb
            document.body.appendChild(stats.dom);
            return stats;
        }
        return null;
    }
    
    render() {
        if (this.stats) this.stats.begin();
        
        // The actual rendering happens here
        this.renderer.render(this.scene, this.camera);
        
        if (this.stats) this.stats.end();
    }
    
    dispose() {
        // Clean up resources (important for production)
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}