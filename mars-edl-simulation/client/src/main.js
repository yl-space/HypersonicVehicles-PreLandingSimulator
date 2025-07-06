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
        
        // Update loading progress
        updateLoadingProgress(10, 'Starting simulation...');
        
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

// Loading progress helper
function updateLoadingProgress(progress, message) {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    
    if (loadingText) {
        loadingText.textContent = message;
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
        background: linear-gradient(135deg, #ff4444, #cc0000);
        color: white;
        padding: 2rem;
        border-radius: 12px;
        z-index: 20000;
        text-align: center;
        max-width: 400px;
        box-shadow: 0 8px 32px rgba(255, 68, 68, 0.3);
    `;
    errorDiv.innerHTML = `
        <h3 style="margin-bottom: 1rem;">🚨 Simulation Error</h3>
        <p style="margin-bottom: 1.5rem; line-height: 1.5;">${message}</p>
        <button onclick="this.parentElement.remove(); location.reload();" 
                style="padding: 0.75rem 1.5rem; background: white; color: #cc0000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
            🔄 Reload Application
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
            if (window.EDLApp.simulation.sceneManager) {
                window.EDLApp.simulation.sceneManager.toggleFullscreen();
            }
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
window.updateLoadingProgress = updateLoadingProgress;