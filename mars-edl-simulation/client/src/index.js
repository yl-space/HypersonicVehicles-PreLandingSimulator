/**
 * index.js
 * Client library exports for Mars EDL Simulation
 * Use this if you want to integrate the simulation into another application
 */

// Core exports
export { SceneManager } from './core/SceneManager.js';
export { AssetLoader } from './core/AssetLoader.js';
export { CameraController } from './core/CameraController.js';

// Component exports
export { EntryVehicle } from './components/spacecraft/EntryVehicle.js';
export { Parachute } from './components/spacecraft/Parachute.js';
export { Mars } from './components/environment/Mars.js';
export { Stars } from './components/environment/Stars.js';

// Simulation exports
export { SimulationManager } from './simulation/SimulationManager.js';
export { TrajectoryManager } from './simulation/TrajectoryManager.js';
export { PhaseController } from './simulation/PhaseController.js';

// UI exports
export { Timeline } from './ui/Timeline.js';
export { PhaseInfo } from './ui/PhaseInfo.js';
export { Controls } from './ui/Controls.js';

// Data exports
export { DataManager } from './data/DataManager.js';

// Main initialization function
export function createMarsEDLSimulation(options = {}) {
    const {
        container = document.getElementById('app-container'),
        trajectoryData = null,
        autoStart = true,
        config = {}
    } = options;
    
    // Create simulation manager with options
    const simulation = new SimulationManager();
    
    // Load trajectory data if provided
    if (trajectoryData) {
        simulation.trajectoryManager.loadTrajectoryData(trajectoryData);
    }
    
    // Auto-start if requested
    if (autoStart) {
        simulation.init();
    }
    
    return simulation;
}

// Convenience function to create a basic simulation
export function quickStart() {
    // Ensure DOM is loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => quickStart());
        return;
    }
    
    // Create container if it doesn't exist
    let container = document.getElementById('app-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'app-container';
        container.style.width = '100vw';
        container.style.height = '100vh';
        container.style.position = 'fixed';
        container.style.top = '0';
        container.style.left = '0';
        
        // Add required structure
        container.innerHTML = `
            <div id="canvas-container"></div>
            <div id="ui-overlay"></div>
            <div id="loading-screen" style="position: fixed; inset: 0; background: #000; display: flex; align-items: center; justify-content: center; color: white;">
                <div>Loading Mars EDL Simulation...</div>
            </div>
            <div id="error-screen" style="display: none;"></div>
        `;
        
        document.body.appendChild(container);
    }
    
    // Create and return simulation
    return createMarsEDLSimulation({ container, autoStart: true });
}

// Export Three.js for convenience
export * as THREE from 'three';

// Version info
export const VERSION = '1.0.0';

// Default export for convenience
export default {
    createMarsEDLSimulation,
    quickStart,
    SimulationManager,
    TrajectoryManager,
    VERSION
};