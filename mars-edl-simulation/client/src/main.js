
// client/src/main.js
import { SceneManager } from './core/SceneManager.js';
import { AssetLoader } from './core/AssetLoader.js';
import { CameraController } from './core/CameraController.js';
import { SimulationManager } from './simulation/SimulationManager.js';
import { DataManager } from './data/DataManager.js';
import { UI } from './ui/UI.js';

/**
 * Main application class that orchestrates all components
 */
class MarsEDLApplication {
    constructor() {
        this.container = document.getElementById('app-container');
        this.isRunning = false;
        
        // Configuration from environment
        this.config = {
            apiEndpoint: process.env.REACT_APP_API_ENDPOINT || 'http://localhost:3001/api',
            wsEndpoint: process.env.REACT_APP_WS_ENDPOINT || 'ws://localhost:3001',
            defaultMission: 'perseverance-2021'
        };
        
        this.init();
    }
    
    async init() {
        try {
            // Show loading screen
            this.showLoading();
            
            // Initialize core systems
            this.sceneManager = new SceneManager(this.container);
            this.assetLoader = new AssetLoader();
            this.dataManager = new DataManager(this.config.apiEndpoint);
            
            // Load assets
            await this.loadAssets();
            
            // Initialize simulation
            this.simulation = new SimulationManager(
                this.sceneManager,
                this.dataManager
            );
            
            // Setup camera controls
            this.cameraController = new CameraController(
                this.sceneManager.camera,
                this.sceneManager.renderer.domElement
            );
            
            // Initialize UI
            this.ui = new UI(this.simulation, this.dataManager);
            
            // Load default mission
            await this.loadMission(this.config.defaultMission);
            
            // Setup WebSocket for real-time updates
            this.setupRealtimeConnection();
            
            // Hide loading screen
            this.hideLoading();
            
            // Start render loop
            this.start();
            
        } catch (error) {
            console.error('Failed to initialize application:', error);
            this.showError(error.message);
        }
    }
    
    async loadAssets() {
        // Define all assets to preload
        const assets = [
            { type: 'model', name: 'cruiseStage', url: '/assets/models/cruise_stage.glb' },
            { type: 'model', name: 'rover', url: '/assets/models/rover.glb' },
            { type: 'texture', name: 'marsColor', url: '/assets/textures/mars_color.jpg' },
            { type: 'texture', name: 'marsNormal', url: '/assets/textures/mars_normal.jpg' },
            // ... more assets
        ];
        
        // Load with progress tracking
        let loaded = 0;
        for (const asset of assets) {
            await this.assetLoader.load(asset);
            loaded++;
            this.updateLoadingProgress(loaded / assets.length);
        }
    }
    
    async loadMission(missionId) {
        // Fetch mission data from server/database
        const missionData = await this.dataManager.fetchMissionData(missionId);
        
        // Fetch trajectory data
        const trajectoryData = await this.dataManager.fetchTrajectoryData(missionId);
        
        // Initialize simulation with data
        this.simulation.loadMission(missionData, trajectoryData);
        
        // Update UI
        this.ui.updateMissionInfo(missionData);
    }
    
    setupRealtimeConnection() {
        // Connect to WebSocket for live telemetry
        this.dataManager.setupWebSocket(this.config.wsEndpoint);
        
        // Listen for updates
        window.addEventListener('telemetryUpdate', (event) => {
            this.simulation.updateTelemetry(event.detail);
            this.ui.updateTelemetry(event.detail);
        });
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
        
        // Update all systems
        this.simulation.update(deltaTime);
        this.cameraController.update(deltaTime);
        this.ui.update(deltaTime);
        
        // Render scene
        this.sceneManager.render();
    }
    
    // UI Helper methods
    showLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.display = 'flex';
    }
    
    hideLoading() {
        const loadingScreen = document.getElementById('loading-screen');
        loadingScreen.style.display = 'none';
    }
    
    updateLoadingProgress(progress) {
        const progressBar = document.getElementById('loading-progress');
        progressBar.style.width = `${progress * 100}%`;
    }
    
    showError(message) {
        const errorScreen = document.getElementById('error-screen');
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = message;
        errorScreen.style.display = 'flex';
    }
    
    // Public API for external control
    play() {
        this.simulation.play();
    }
    
    pause() {
        this.simulation.pause();
    }
    
    seekTo(time) {
        this.simulation.seekTo(time);
    }
    
    setPlaybackSpeed(speed) {
        this.simulation.setPlaybackSpeed(speed);
    }
    
    // Cleanup
    dispose() {
        this.stop();
        this.simulation.dispose();
        this.sceneManager.dispose();
        this.ui.dispose();
        
        // Close WebSocket
        if (this.dataManager.websocket) {
            this.dataManager.websocket.close();
        }
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.marsEDL = new MarsEDLApplication();
});

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.marsEDL) {
        window.marsEDL.dispose();
    }
});