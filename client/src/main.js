/**
 * Main entry point for Simulation
 */

import { SimulationManager } from './simulation/SimulationManager.js';

// Register Service Worker for tile caching
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw-tiles.js', {
                scope: '/'
            });
            console.log('[Main] Service Worker registered:', registration.scope);

            // Check for updates periodically
            setInterval(() => {
                registration.update();
            }, 60 * 60 * 1000); // Check every hour

        } catch (error) {
            console.warn('[Main] Service Worker registration failed:', error);
            // Continue without service worker - tile caching will still work via IndexedDB
        }
    });
}

// Global app state
window.MarsEDL = {
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
                showCompletionToast();
            }
        });
        
        // Store reference
        window.MarsEDL.simulation = simulation;

        // Setup global controls
        setupGlobalControls();

        // Initialize zoom controls now that simulation is ready
        if (window.initializeZoomControls) {
            window.initializeZoomControls();
            console.log('Zoom controls initialized');
        }

        // Hide loading screen
        hideLoadingScreen();

        // Show welcome dialog (always show for user to configure simulation)
        showWelcomeDialog();
        
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
    // Available simulation options (only show what's actually implemented)
    const planets = [
        { value: 'mars', label: 'Mars' }
    ];
    const trajectories = [
        { value: 'msl', label: 'MSL (Curiosity) - Real Data' }
    ];
    const vehicles = [
        { value: 'primary', label: 'Dragon' },
        { value: 'backup', label: 'High-L/D System' }
    ];

    const dialog = document.createElement('div');
    dialog.className = 'welcome-dialog';
    dialog.innerHTML = `
        <div class="dialog-overlay"></div>
        <div class="dialog-content">
            <h2>Hypersonic Flight Simulator</h2>
            <p class="dialog-subtitle">FULL PHYSICS-BASED MODELING</p>
            <p>Configure simulation parameters and launch.</p>

            <div class="dialog-inputs">
                <div class="input-group">
                    <label for="sim-planet">Planet</label>
                    <select id="sim-planet">
                        ${planets.map((p, i) => `<option value="${p.value}"${i === 0 ? ' selected' : ''}>${p.label}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="sim-trajectory">Trajectory</label>
                    <select id="sim-trajectory">
                        ${trajectories.map((t, i) => `<option value="${t.value}"${i === 0 ? ' selected' : ''}>${t.label}</option>`).join('')}
                    </select>
                </div>
                <div class="input-group">
                    <label for="sim-vehicle">Vehicle Type</label>
                    <select id="sim-vehicle">
                        ${vehicles.map((v, i) => `<option value="${v.value}"${i === 0 ? ' selected' : ''}>${v.label}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="dialog-controls">
                <h3>Controls:</h3>
                <ul>
                    <li><kbd>Space</kbd> - Play/Pause</li>
                    <li><kbd>1/2/3</kbd> - Camera Modes</li>
                    <li><kbd>←/→</kbd> - Skip 5 seconds</li>
                    <li><kbd>A/D</kbd> - Adjust Bank Angle</li>
                    <li><kbd>Mouse Wheel</kbd> - Zoom</li>
                </ul>
            </div>

            <div class="dialog-actions">
                <button class="btn-primary" id="start-sim-btn">Launch Simulation</button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);
    const startBtn = document.getElementById('start-sim-btn');
    if (startBtn) startBtn.addEventListener('click', () => window.closeWelcomeDialog());
    setTimeout(() => {
        dialog.classList.add('visible');
    }, 100);
}

/**
 * Close welcome dialog
 */
window.closeWelcomeDialog = function() {
    const dialog = document.querySelector('.welcome-dialog');

    // Read user selections
    const planet = document.getElementById('sim-planet')?.value || 'mars';
    const trajectory = document.getElementById('sim-trajectory')?.value || 'msl';
    const vehicle = document.getElementById('sim-vehicle')?.value || 'primary';

    // Store selections in global config
    window.MarsEDL.config.planet = planet;
    window.MarsEDL.config.trajectory = trajectory;
    window.MarsEDL.config.vehicle = vehicle;

    // Apply vehicle selection if simulation is ready
    if (window.MarsEDL.simulation && window.MarsEDL.simulation.entryVehicle) {
        window.MarsEDL.simulation.entryVehicle.switchModel(vehicle);
    }

    dialog.classList.remove('visible');
    setTimeout(() => {
        dialog.remove();
        window.MarsEDL.simulation.play();
    }, 300);
};

/**
 * Show completion dialog
 */
function showCompletionToast() {
    if (document.querySelector('.completion-toast')) {
        return;
    }

    const toast = document.createElement('div');
    toast.className = 'completion-toast';
    toast.innerHTML = `
        <span>Trajectory complete. Use Reset to replay with full controls.</span>
        <button type="button" aria-label="Dismiss completion message">Dismiss</button>
    `;
    const dismissBtn = toast.querySelector('button');
    dismissBtn.addEventListener('click', () => toast.remove());

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
        });
    }, 0);

    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 6000);
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
    if (window.MarsEDL.config.debug) {
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
        if (document.hidden && window.MarsEDL.simulation) {
            window.MarsEDL.simulation.pause();
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
                Time: ${window.MarsEDL.simulation?.state.currentTime.toFixed(1)}s
            `;
            
            frameCount = 0;
            lastTime = currentTime;
        }
        
        requestAnimationFrame(updateStats);
    }
    
    updateStats();
}

/**
 * Rerun simulation with banking history
 */
/**
 * Export telemetry data
 */
window.exportTelemetry = function() {
    if (window.MarsEDL.simulation) {
        const data = window.MarsEDL.simulation.dataManager.exportSimulationData(
            window.MarsEDL.simulation.getState(),
            'json'
        );
        
        window.MarsEDL.simulation.dataManager.downloadData(
            data,
            `Mars_edl_telemetry_${Date.now()}.json`,
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
    if (window.MarsEDL.config.debug) {
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
        margin-bottom: 4px;
        font-size: 28px;
        color: #fff;
    }

    .dialog-subtitle {
        font-size: 12px;
        color: #888;
        letter-spacing: 2px;
        text-transform: uppercase;
        margin-bottom: 16px;
    }

    .dialog-content h3 {
        margin: 20px 0 10px;
        color: #f60;
        font-size: 18px;
    }
    
    .dialog-inputs {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        margin: 24px 0;
    }

    .input-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .input-group label {
        font-size: 13px;
        font-weight: 600;
        color: #f60;
        text-transform: uppercase;
        letter-spacing: 0.5px;
    }

    .input-group select {
        padding: 10px 14px;
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        font-size: 14px;
        cursor: pointer;
        appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999' viewBox='0 0 16 16'%3E%3Cpath d='M8 11L3 6h10z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 12px center;
    }

    .input-group select:hover {
        border-color: rgba(255, 102, 0, 0.5);
    }

    .input-group select:focus {
        outline: none;
        border-color: #f60;
        box-shadow: 0 0 0 2px rgba(255, 102, 0, 0.2);
    }

    .input-group select option {
        background: #1a1a1a;
        color: #fff;
    }

    .input-group select option:disabled {
        color: #666;
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

