/**
 * Main Entry Point for Mars EDL Simulation
 */

import { SimulationManager } from './simulation/SimulationManager.js';

// Global application state
window.EDLApp = {
    simulation: null,
    isInitialized: false
};

// Application initialization
async function initializeApp() {
    try {
        console.log('🚀 Initializing Mars EDL Simulation...');
        
        // Create simulation manager
        window.EDLApp.simulation = new SimulationManager();
        
        // Initialize the simulation
        await window.EDLApp.simulation.init();
        
        window.EDLApp.isInitialized = true;
        console.log('✅ Simulation initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize simulation:', error);
        showError('Failed to initialize simulation: ' + error.message);
    }
}

// Error display function
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 0, 0, 0.9);
        color: white;
        padding: 20px;
        border-radius: 10px;
        z-index: 10000;
        text-align: center;
        max-width: 400px;
    `;
    errorDiv.innerHTML = `
        <h3>Simulation Error</h3>
        <p>${message}</p>
        <button onclick="this.parentElement.remove(); location.reload();" 
                style="margin-top: 10px; padding: 5px 15px; background: white; color: red; border: none; border-radius: 5px; cursor: pointer;">
            Reload
        </button>
    `;
    document.body.appendChild(errorDiv);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (window.EDLApp.simulation) {
        if (document.hidden) {
            window.EDLApp.simulation.pause();
        }
    }
});

// Handle window resize
window.addEventListener('resize', () => {
    if (window.EDLApp.simulation?.sceneManager) {
        window.EDLApp.simulation.sceneManager.handleResize();
    }
});

// Keyboard controls
document.addEventListener('keydown', (event) => {
    if (!window.EDLApp.simulation) return;
    
    switch (event.code) {
        case 'Space':
            event.preventDefault();
            window.EDLApp.simulation.togglePlayPause();
            break;
        case 'KeyR':
            if (event.ctrlKey) {
                event.preventDefault();
                window.EDLApp.simulation.reset();
            }
            break;
        case 'KeyF':
            window.EDLApp.simulation.sceneManager.toggleFullscreen();
            break;
        case 'Escape':
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
            break;
    }
});

// Export for global access
window.EDLApp.initializeApp = initializeApp;