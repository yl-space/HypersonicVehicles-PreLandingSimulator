// client/src/main.js
import * as THREE from 'three';
import { Mars2020EDLSimulation } from './simulation/Mars2020EDLSimulation.js';
import { Mars2020EDLUI } from './ui/Mars2020EDLUI.js';

/**
 * Main application class for Mars 2020 EDL Simulation
 * Uses real MSL trajectory data from CSV files
 */
class Mars2020EDLApplication {
    constructor() {
        this.container = document.getElementById('scene-container');
        this.isRunning = false;
        
        // Configuration
        this.config = {
            dataFile: '/api/data/msl-trajectory',
            defaultPlaybackSpeed: 1.0
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Initialize Three.js scene
            this.setupScene();
            
            // Initialize Mars 2020 EDL simulation
            this.simulation = new Mars2020EDLSimulation(
                this.scene,
                this.camera,
                this.renderer
            );
            
            // Initialize UI
            this.ui = new Mars2020EDLUI(this.simulation);
            
            // Load MSL trajectory data
            await this.loadMSLData();
            
            // Hide loading screen
            this.hideLoading();
            
            // Start render loop
            this.start();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError(error.message);
        }
    }
    
    setupScene() {
        // Create scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000011);
        
        // Create camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            1000,
            100000000
        );
        
        // Create renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize());
    }
    
    async loadMSLData() {
        try {
            // Load MSL trajectory data from server
            const response = await fetch(this.config.dataFile);
            if (!response.ok) {
                throw new Error(`Failed to load trajectory data: ${response.status}`);
            }
            
            const csvData = await response.text();
            const success = await this.simulation.loadTrajectoryData(csvData);
            
            if (!success) {
                throw new Error('Failed to parse trajectory data');
            }
            
            console.log('MSL trajectory data loaded successfully');
            
        } catch (error) {
            console.error('Error loading MSL data:', error);
            // Fallback to sample data if server data fails
            await this.loadSampleData();
        }
    }
    
    async loadSampleData() {
        console.log('Loading sample trajectory data...');
        
        // Generate sample MSL-like trajectory data
        const sampleData = this.generateSampleMSLData();
        await this.simulation.loadTrajectoryData(sampleData);
    }
    
    generateSampleMSLData() {
        // Generate realistic MSL trajectory data based on the format we saw
        const data = [];
        const timeStep = 0.05; // 50ms intervals for smooth animation
        
        // MSL entry parameters (approximate)
        const entryAltitude = 132000; // meters
        const entryVelocity = 5500; // m/s
        const parachuteDeploymentAltitude = 13462.9; // meters
        const parachuteDeploymentTime = 260.65; // seconds
        
        for (let time = 0; time <= parachuteDeploymentTime; time += timeStep) {
            // Simplified trajectory model based on MSL parameters
            const altitude = entryAltitude * Math.exp(-time / 100) + parachuteDeploymentAltitude;
            const velocity = entryVelocity * Math.exp(-time / 80) + 100;
            
            // Convert to J2000 coordinates (simplified model)
            // This is a basic approximation - real data would be more complex
            const x = -600000 - time * 1000; // Approximate x position
            const y = altitude; // Altitude as y coordinate
            const z = time * 600; // Approximate z position
            
            data.push(`${time.toFixed(2)},${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`);
        }
        
        return 'Time,x,y,z\n' + data.join('\n');
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.animate();
    }
    
    stop() {
        this.isRunning = false;
    }
    
    animate() {
        if (!this.isRunning) return;
        
        requestAnimationFrame(() => this.animate());
        
        // Calculate delta time
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Update simulation
        this.simulation.update(deltaTime);
        
        // Update UI
        this.ui.update(deltaTime);
        
        // Render scene
        this.renderer.render(this.scene, this.camera);
    }
    
    // UI Helper methods
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }
    
    showError(message) {
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');
        if (errorScreen && errorMessage) {
            errorMessage.textContent = message;
            errorScreen.style.display = 'flex';
        }
    }
    
    // Cleanup
    dispose() {
        this.stop();
        if (this.simulation) {
            this.simulation.dispose();
        }
        if (this.ui) {
            this.ui.dispose();
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mars2020App = new Mars2020EDLApplication();
});

// Handle page unload
window.addEventListener('beforeunload', () => {
    if (window.mars2020App) {
        window.mars2020App.dispose();
    }
});