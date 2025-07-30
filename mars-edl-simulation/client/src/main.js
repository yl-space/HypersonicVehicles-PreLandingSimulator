/**
 * main.js
 * Main entry point for Jupiter EDL Simulation
 */

import { SimulationManager } from './simulation/SimulationManager.js';

// Global app state
window.JupiterEDL = {
    simulation: null,
    config: {
        debug: false,
        quality: 'medium',
        units: 'imperial'
    }
};

/**
 * Initialize the application
 */
async function init() {
    try {
        // Show loading screen
        showLoadingScreen();
        
        // Check WebGL support
        if (!checkWebGLSupport()) {
            showError('WebGL is not supported in your browser. Please use a modern browser.');
            return;
        }
        
        // Initialize simulation
        const simulation = new SimulationManager({
            container: document.getElementById('canvas-container'),
            dataPath: '/data/MSL_position_J2000.csv',
            autoStart: false,
            showStats: getUrlParam('stats') === 'true',
            
            // Event handlers
            onPhaseChange: (phase) => {
                console.log('Phase changed:', phase.name);
                logEvent('phase_change', { phase: phase.name });
            },
            
            onSimulationComplete: () => {
                console.log('Simulation complete!');
                showCompletionDialog();
            }
        });
        
        // Store reference
        window.JupiterEDL.simulation = simulation;
        
        // Setup global controls
        setupGlobalControls();
        
        // Hide loading screen
        hideLoadingScreen();
        
        // Show welcome dialog
        if (!hasSeenWelcome()) {
            showWelcomeDialog();
        }
        
        // Auto-play if specified
        if (getUrlParam('autoplay') === 'true') {
            simulation.play();
        }
        
    } catch (error) {
        console.error('Failed to initialize simulation:', error);
        showError('Failed to initialize simulation. Please refresh the page.');
    }
}

/**
 * Check WebGL support
 */
function checkWebGLSupport() {
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        return !!gl;
    } catch (e) {
        return false;
    }
}

/**
 * Show loading screen
 */
function showLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.display = 'flex';
    }
}

/**
 * Hide loading screen
 */
function hideLoadingScreen() {
    const loader = document.getElementById('loading-screen');
    if (loader) {
        loader.style.transition = 'opacity 0.5s';
        loader.style.opacity = '0';
        setTimeout(() => {
            loader.style.display = 'none';
        }, 500);
    }
}

/**
 * Show error message
 */
function showError(message) {
    hideLoadingScreen();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
        <div class="error-content">
            <h2>Error</h2>
            <p>${message}</p>
            <button id="reload-page-btn">Reload Page</button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    // CSP-safe event handler
    const reloadBtn = document.getElementById('reload-page-btn');
    if (reloadBtn) reloadBtn.addEventListener('click', () => window.location.reload());
}

/**
 * Show welcome dialog
 */
function showWelcomeDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'welcome-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <h2>Jupiter Entry, Descent & Landing Simulation</h2>
            <p>Experience the "7 Minutes of Terror" as we simulate the Jupiter Science Laboratory's entry into the Martian atmosphere.</p>
            
            <div class="dialog-features">
                <div class="feature">
                    <strong>🚀 Real Trajectory Data</strong>
                    <p>Based on actual MSL mission data</p>
                </div>
                <div class="feature">
                    <strong>🎮 Interactive Controls</strong>
                    <p>Multiple camera modes and playback controls</p>
                </div>
                <div class="feature">
                    <strong>📊 Live Telemetry</strong>
                    <p>Real-time altitude, velocity, and phase data</p>
                </div>
            </div>
            
            <div class="dialog-controls">
                <h3>Controls:</h3>
                <ul>
                    <li><kbd>Space</kbd> - Play/Pause</li>
                    <li><kbd>1/2/3</kbd> - Camera Modes</li>
                    <li><kbd>←/→</kbd> - Skip 5 seconds</li>
                    <li><kbd>Mouse Wheel</kbd> - Zoom</li>
                </ul>
            </div>
            
            <div class="dialog-actions">
                <button class="btn-primary" id="start-sim-btn">Start Simulation</button>
                <label>
                    <input type="checkbox" id="dont-show-again"> Don't show again
                </label>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    // CSP-safe event handler
    const startBtn = document.getElementById('start-sim-btn');
    if (startBtn) startBtn.addEventListener('click', () => window.closeWelcomeDialog());
    // Animate in
    setTimeout(() => {
        dialog.classList.add('visible');
    }, 100);
}

/**
 * Close welcome dialog
 */
window.closeWelcomeDialog = function() {
    const dialog = document.querySelector('.welcome-dialog');
    const dontShowAgain = document.getElementById('dont-show-again').checked;
    
    if (dontShowAgain) {
        localStorage.setItem('jupiterEDL_hideWelcome', 'true');
    }
    
    dialog.classList.remove('visible');
    setTimeout(() => {
        dialog.remove();
        window.JupiterEDL.simulation.play();
    }, 300);
};

/**
 * Check if user has seen welcome
 */
function hasSeenWelcome() {
    return localStorage.getItem('jupiterEDL_hideWelcome') === 'true';
}

/**
 * Show completion dialog
 */
function showCompletionDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'completion-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <h2>🎉 Landing Successful!</h2>
            <p>The spacecraft has successfully completed its entry, descent, and landing sequence.</p>
            
            <div class="completion-stats">
                <div class="stat">
                    <span class="stat-label">Total Time</span>
                    <span class="stat-value">4:20</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Max Velocity</span>
                    <span class="stat-value">19,300 km/h</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Peak G-Force</span>
                    <span class="stat-value">8.2g</span>
                </div>
            </div>
            
            <div class="dialog-actions">
                <button class="btn-primary" id="replay-btn">Replay</button>
                <button class="btn-secondary" id="export-btn">Export Data</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    // CSP-safe event handlers
    setTimeout(() => dialog.classList.add('visible'), 100);
    const replayBtn = document.getElementById('replay-btn');
    if (replayBtn) replayBtn.addEventListener('click', () => window.replaySimulation());
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => window.exportTelemetry());
}

/**
 * Setup global controls
 */
function setupGlobalControls() {
    // Fullscreen toggle
    document.addEventListener('keydown', (e) => {
        if (e.key === 'f' || e.key === 'F') {
            toggleFullscreen();
        }
    });
    
    // Performance monitoring
    if (window.JupiterEDL.config.debug) {
        setupPerformanceMonitor();
    }
    
    // Window resize handling
    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            console.log('Window resized');
        }, 300);
    });
    
    // Visibility change handling
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && window.JupiterEDL.simulation) {
            window.JupiterEDL.simulation.pause();
        }
    });
}

/**
 * Toggle fullscreen
 */
function toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error('Error attempting to enable fullscreen:', err);
        });
    } else {
        document.exitFullscreen();
    }
}

/**
 * Setup performance monitor
 */
function setupPerformanceMonitor() {
    const monitor = document.createElement('div');
    monitor.id = 'performance-monitor';
    monitor.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0,0,0,0.8);
        color: #0f0;
        font-family: monospace;
        font-size: 12px;
        padding: 10px;
        z-index: 10000;
        pointer-events: none;
    `;
    document.body.appendChild(monitor);
    
    let frameCount = 0;
    let lastTime = performance.now();
    
    function updateStats() {
        frameCount++;
        const currentTime = performance.now();
        const deltaTime = currentTime - lastTime;
        
        if (deltaTime >= 1000) {
            const fps = Math.round((frameCount * 1000) / deltaTime);
            const memory = performance.memory 
                ? `${Math.round(performance.memory.usedJSHeapSize / 1048576)}MB`
                : 'N/A';
            
            monitor.innerHTML = `
                FPS: ${fps}<br>
                Memory: ${memory}<br>
                Time: ${window.JupiterEDL.simulation?.state.currentTime.toFixed(1)}s
            `;
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(updateStats);
    }
    
    updateStats();
}

/**
 * Replay simulation
 */
window.replaySimulation = function() {
    if (window.JupiterEDL.simulation) {
        window.JupiterEDL.simulation.seekTo(0);
        window.JupiterEDL.simulation.play();
        
        // Close dialog
        const dialog = document.querySelector('.completion-dialog');
        if (dialog) {
            dialog.classList.remove('visible');
            setTimeout(() => dialog.remove(), 300);
        }
    }
};

/**
 * Export telemetry data
 */
window.exportTelemetry = function() {
    if (window.JupiterEDL.simulation) {
        const data = window.JupiterEDL.simulation.dataManager.exportSimulationData(
            window.JupiterEDL.simulation.getState(),
            'json'
        );
        
        window.JupiterEDL.simulation.dataManager.downloadData(
            data,
            `jupiter_edl_telemetry_${Date.now()}.json`,
            'application/json'
        );
    }
};

/**
 * Get URL parameter
 */
function getUrlParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

/**
 * Log analytics event
 */
function logEvent(eventName, data = {}) {
    // Send to analytics service if configured
    if (window.gtag) {
        window.gtag('event', eventName, data);
    }
    
    // Console log in debug mode
    if (window.JupiterEDL.config.debug) {
        console.log('Event:', eventName, data);
    }
}

// Add styles for dialogs
const styles = document.createElement('style');
styles.textContent = `
    .error-message {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
    }
    
    .error-content {
        background: #222;
        padding: 30px;
        border-radius: 10px;
        text-align: center;
        max-width: 400px;
    }
    
    .error-content h2 {
        color: #ff3333;
        margin-bottom: 20px;
    }
    
    .error-content button {
        margin-top: 20px;
        padding: 10px 20px;
        background: #f60;
        border: none;
        color: #fff;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
    }
    
    .welcome-dialog,
    .completion-dialog {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s;
    }
    
    .welcome-dialog.visible,
    .completion-dialog.visible {
        opacity: 1;
        visibility: visible;
    }
    
    .dialog-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(5px);
    }
    
    .dialog-content {
        position: relative;
        background: #1a1a1a;
        padding: 40px;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        transform: scale(0.9);
        transition: transform 0.3s;
    }
    
    .visible .dialog-content {
        transform: scale(1);
    }
    
    .dialog-content h2 {
        margin-bottom: 20px;
        font-size: 28px;
        color: #fff;
    }
    
    .dialog-content h3 {
        margin: 20px 0 10px;
        color: #f60;
        font-size: 18px;
    }
    
    .dialog-features {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 20px;
        margin: 30px 0;
    }
    
    .feature {
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }
    
    .feature strong {
        display: block;
        margin-bottom: 10px;
        color: #f60;
    }
    
    .dialog-controls ul {
        list-style: none;
        padding: 0;
    }
    
    .dialog-controls li {
        margin: 10px 0;
        color: #ccc;
    }
    
    .dialog-controls kbd {
        display: inline-block;
        padding: 3px 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        font-family: monospace;
        margin-right: 10px;
    }
    
    .dialog-actions {
        margin-top: 30px;
        display: flex;
        gap: 15px;
        align-items: center;
        justify-content: space-between;
    }
    
    .btn-primary,
    .btn-secondary {
        padding: 12px 30px;
        border: none;
        border-radius: 5px;
        cursor: pointer;
        font-size: 16px;
        font-weight: 500;
        transition: all 0.2s;
    }
    
    .btn-primary {
        background: #f60;
        color: #fff;
    }
    
    .btn-primary:hover {
        background: #ff7722;
        transform: translateY(-2px);
    }
    
    .btn-secondary {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.2);
    }
    
    .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
    }
    
    .completion-stats {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 20px;
        margin: 30px 0;
    }
    
    .stat {
        text-align: center;
        padding: 20px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 8px;
    }
    
    .stat-label {
        display: block;
        font-size: 14px;
        color: #888;
        margin-bottom: 10px;
    }
    
    .stat-value {
        display: block;
        font-size: 24px;
        font-weight: bold;
        color: #f60;
    }
`;
document.head.appendChild(styles);

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}