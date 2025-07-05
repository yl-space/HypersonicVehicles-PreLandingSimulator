/**
 * main.js
 * Application entry point
 */

import { SimulationManager } from './simulation/SimulationManager.js';

// Check WebGL support
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    } catch (e) {
        return false;
    }
}

// Initialize application
async function init() {
    // Check browser compatibility
    if (!checkWebGLSupport()) {
        document.getElementById('error-message').textContent = 
            'Your browser does not support WebGL. Please use a modern browser.';
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('loading-screen').style.display = 'none';
        return;
    }
    
    try {
        // Initialize simulation
        window.simulation = new SimulationManager();
        
        // Setup error handling
        window.addEventListener('error', (e) => {
            console.error('Application error:', e);
            document.getElementById('error-message').textContent = e.message;
            document.getElementById('error-screen').style.display = 'flex';
        });
        
        // Handle visibility change for performance
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.simulation?.pause();
            }
        });
        
    } catch (error) {
        console.error('Failed to initialize application:', error);
        document.getElementById('error-message').textContent = error.message;
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('loading-screen').style.display = 'none';
    }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Hot module replacement for development
if (import.meta.hot) {
    import.meta.hot.accept();
}