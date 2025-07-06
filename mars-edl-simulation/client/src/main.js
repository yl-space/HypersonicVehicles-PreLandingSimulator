/**
 * Mars EDL Simulation - Main Entry Point
 * Pure Three.js implementation with proper loading management
 */

import { SimulationManager } from './simulation/SimulationManager.js';

// Global application state
window.EDLApp = {
    simulation: null,
    isInitialized: false
};

// Loading progress function - defined globally first
function updateLoadingProgress(progress, message) {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
    
    if (loadingText) {
        loadingText.textContent = message || 'Loading...';
    }
    
    console.log(`Loading: ${progress}% - ${message}`);
}

// Make function globally available
window.updateLoadingProgress = updateLoadingProgress;

// Application initialization
async function initializeApp() {
    try {
        console.log('🚀 Initializing Mars EDL Simulation with Three.js...');
        
        // Check Three.js availability
        if (typeof THREE === 'undefined') {
            throw new Error('Three.js library not loaded. Please check CDN connection.');
        }
        
        updateLoadingProgress(5, 'Three.js loaded successfully...');
        
        // Verify Three.js version and capabilities
        console.log(`Three.js version: ${THREE.REVISION}`);
        updateLoadingProgress(10, 'Initializing simulation manager...');
        
        // Create simulation manager
        window.EDLApp.simulation = new SimulationManager();
        
        updateLoadingProgress(15, 'Starting simulation initialization...');
        
        // Initialize the simulation
        await window.EDLApp.simulation.init();
        
        window.EDLApp.isInitialized = true;
        console.log('✅ Mars EDL Simulation initialized successfully');
        
    } catch (error) {
        console.error('❌ Failed to initialize simulation:', error);
        showError('Simulation initialization failed: ' + error.message);
    }
}

// Error display function
function showError(message) {
    // Hide loading screen
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }
    
    // Create error display
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
        max-width: 500px;
        box-shadow: 0 8px 32px rgba(255, 68, 68, 0.3);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    
    errorDiv.innerHTML = `
        <h3 style="margin-bottom: 1rem;">🚨 Mars EDL Simulation Error</h3>
        <p style="margin-bottom: 1.5rem; line-height: 1.5;">${message}</p>
        <button onclick="location.reload();" 
                style="padding: 0.75rem 1.5rem; background: white; color: #cc0000; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; margin-right: 0.5rem;">
            🔄 Reload Application
        </button>
        <button onclick="this.parentElement.remove();" 
                style="padding: 0.75rem 1.5rem; background: transparent; color: white; border: 2px solid white; border-radius: 6px; cursor: pointer; font-weight: 600;">
            ✕ Close
        </button>
    `;
    
    document.body.appendChild(errorDiv);
}

// DOM ready handler
function onDOMReady() {
    updateLoadingProgress(0, 'Preparing Mars EDL Simulation...');
    
    // Set up intro modal handler
    const startBtn = document.getElementById('start-simulation-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            const modal = document.getElementById('intro-modal');
            if (modal) modal.classList.add('hidden');
        });
    }
    
    // Initialize the simulation
    setTimeout(initializeApp, 100); // Small delay for smooth loading animation
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDOMReady);
} else {
    onDOMReady();
}

// Application lifecycle handlers
document.addEventListener('visibilitychange', () => {
    if (window.EDLApp.simulation) {
        if (document.hidden) {
            window.EDLApp.simulation.pause();
        }
    }
});

window.addEventListener('resize', () => {
    if (window.EDLApp.simulation?.sceneManager) {
        window.EDLApp.simulation.sceneManager.handleResize();
    }
});

// Keyboard controls for Three.js scene
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
        case 'KeyC':
            // Cycle camera modes
            if (window.EDLApp.simulation.sceneManager?.cameraController) {
                const modes = ['FREE', 'FOLLOW', 'CINEMATIC'];
                const controller = window.EDLApp.simulation.sceneManager.cameraController;
                const currentIndex = modes.indexOf(controller.mode);
                const nextMode = modes[(currentIndex + 1) % modes.length];
                controller.setMode(nextMode);
                
                // Update UI
                document.querySelectorAll('.camera-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.mode === nextMode);
                });
            }
            break;
    }
});

// Handle errors globally
window.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
    if (!window.EDLApp.isInitialized) {
        showError(`Application error: ${event.error?.message || 'Unknown error occurred'}`);
    }
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
    if (!window.EDLApp.isInitialized) {
        showError(`Initialization failed: ${event.reason?.message || 'Unknown promise rejection'}`);
    }
});

// Export for debugging
window.EDLApp.initializeApp = initializeApp;
window.EDLApp.updateLoadingProgress = updateLoadingProgress;

console.log('Mars EDL Simulation - Main script loaded, waiting for Three.js...');