/**
 * Controls.js
 * UI controls for camera modes, zoom, and other interactions
 */

export class Controls {
    constructor(options) {
        this.options = {
            onCameraMode: () => {},
            onZoom: () => {},
            onSettings: () => {},
            ...options
        };
        
        this.elements = {};
        this.activeCamera = 'FOLLOW';
        
        this.init();
    }
    
    init() {
        this.createCameraControls();
        this.createZoomControls();
        this.createSettingsPanel();
        this.createKeyboardShortcuts();
        this.addStyles();
    }
    
    createCameraControls() {
        const container = document.createElement('div');
        container.className = 'camera-controls';
        container.innerHTML = `
            <div class="control-group">
                <h3 class="control-label">CAMERA</h3>
                <button class="camera-mode active" data-mode="FOLLOW">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="currentColor"/>
                    </svg>
                    FOLLOW
                </button>
                <button class="camera-mode" data-mode="FREE">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="currentColor"/>
                    </svg>
                    FREE
                </button>
                <button class="camera-mode" data-mode="CINEMATIC">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z" fill="currentColor"/>
                    </svg>
                    CINEMATIC
                </button>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Event listeners
        container.querySelectorAll('.camera-mode').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveCamera(button.dataset.mode);
                this.options.onCameraMode(button.dataset.mode);
            });
        });
        
        this.elements.cameraControls = container;
    }
    
    createZoomControls() {
        const container = document.createElement('div');
        container.className = 'zoom-controls';
        container.innerHTML = `
            <button class="zoom-button" id="zoom-in" title="Zoom In (Mouse Wheel)">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" fill="currentColor"/>
                </svg>
            </button>
            <div class="zoom-indicator">
                <span id="zoom-level">75°</span>
            </div>
            <button class="zoom-button" id="zoom-out" title="Zoom Out (Mouse Wheel)">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M19 13H5v-2h14v2z" fill="currentColor"/>
                </svg>
            </button>
        `;
        
        document.body.appendChild(container);
        
        // Event listeners
        container.querySelector('#zoom-in').addEventListener('click', () => {
            this.options.onZoom('in');
        });
        
        container.querySelector('#zoom-out').addEventListener('click', () => {
            this.options.onZoom('out');
        });
        
        this.elements.zoomControls = container;
        this.elements.zoomLevel = container.querySelector('#zoom-level');
    }
    
    createSettingsPanel() {
        const container = document.createElement('div');
        container.className = 'settings-panel';
        container.innerHTML = `
            <button class="settings-toggle" id="settings-toggle" title="Settings">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" fill="currentColor"/>
                </svg>
            </button>
            
            <div class="settings-content" id="settings-content">
                <h3>Display Settings</h3>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="show-trajectory" checked>
                        Show Trajectory Path
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="show-telemetry" checked>
                        Show Telemetry Data
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="show-effects" checked>
                        Visual Effects
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="show-landing-site" checked>
                        Landing Site Marker
                    </label>
                </div>
                
                <div class="setting-item">
                    <label>
                        <input type="checkbox" id="auto-rotate" unchecked>
                        Auto-rotate Mars
                    </label>
                </div>
                
                <div class="setting-separator"></div>
                
                <div class="setting-item">
                    <label>Quality</label>
                    <select id="quality-setting">
                        <option value="low">Low</option>
                        <option value="medium" selected>Medium</option>
                        <option value="high">High</option>
                        <option value="ultra">Ultra</option>
                    </select>
                </div>
                
                <div class="setting-item">
                    <label>Units</label>
                    <select id="units-setting">
                        <option value="imperial" selected>Imperial (mi, mph)</option>
                        <option value="metric">Metric (km, km/h)</option>
                    </select>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);
        
        // Toggle settings panel
        const toggle = container.querySelector('#settings-toggle');
        const content = container.querySelector('#settings-content');
        
        toggle.addEventListener('click', () => {
            content.classList.toggle('visible');
            toggle.classList.toggle('active');
        });
        
        // Settings event listeners
        const settings = {
            showTrajectory: container.querySelector('#show-trajectory'),
            showTelemetry: container.querySelector('#show-telemetry'),
            showEffects: container.querySelector('#show-effects'),
            showLandingSite: container.querySelector('#show-landing-site'),
            autoRotate: container.querySelector('#auto-rotate'),
            quality: container.querySelector('#quality-setting'),
            units: container.querySelector('#units-setting')
        };
        
        Object.entries(settings).forEach(([key, element]) => {
            element.addEventListener('change', () => {
                this.options.onSettings({
                    type: key,
                    value: element.type === 'checkbox' ? element.checked : element.value
                });
            });
        });
        
        this.elements.settingsPanel = container;
        this.elements.settings = settings;
    }
    
    createKeyboardShortcuts() {
        const shortcutsPanel = document.createElement('div');
        shortcutsPanel.className = 'shortcuts-panel';
        shortcutsPanel.innerHTML = `
            <button class="shortcuts-toggle" title="Keyboard Shortcuts">?</button>
            <div class="shortcuts-content">
                <h3>Keyboard Shortcuts</h3>
                <dl>
                    <dt>Space</dt><dd>Play/Pause</dd>
                    <dt>1</dt><dd>Follow Camera</dd>
                    <dt>2</dt><dd>Free Camera</dd>
                    <dt>3</dt><dd>Cinematic Camera</dd>
                    <dt>←/→</dt><dd>Skip 5 seconds</dd>
                    <dt>↑/↓</dt><dd>Zoom In/Out</dd>
                    <dt>R</dt><dd>Restart Simulation</dd>
                    <dt>F</dt><dd>Fullscreen</dd>
                    <dt>S</dt><dd>Toggle Settings</dd>
                    <dt>?</dt><dd>Toggle Help</dd>
                </dl>
            </div>
        `;
        
        document.body.appendChild(shortcutsPanel);
        
        const toggle = shortcutsPanel.querySelector('.shortcuts-toggle');
        const content = shortcutsPanel.querySelector('.shortcuts-content');
        
        toggle.addEventListener('click', () => {
            content.classList.toggle('visible');
        });
        
        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!shortcutsPanel.contains(e.target)) {
                content.classList.remove('visible');
            }
        });
        
        this.elements.shortcutsPanel = shortcutsPanel;
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Camera Controls */
            .camera-controls {
                position: absolute;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                background: rgba(0, 0, 0, 0.8);
                padding: 15px;
                border-radius: 8px;
                backdrop-filter: blur(10px);
                z-index: 100;
            }
            
            .control-group {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .control-label {
                font-size: 11px;
                color: #888;
                letter-spacing: 1px;
                margin: 0 0 10px 0;
                text-align: center;
            }
            
            .camera-mode {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 20px;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                color: #ccc;
                cursor: pointer;
                border-radius: 5px;
                font-size: 13px;
                font-weight: 500;
                letter-spacing: 0.5px;
                transition: all 0.2s;
                width: 140px;
            }
            
            .camera-mode:hover {
                background: rgba(255, 255, 255, 0.1);
                color: #fff;
                transform: translateX(-2px);
            }
            
            .camera-mode.active {
                background: #f60;
                border-color: #f60;
                color: #fff;
            }
            
            /* Zoom Controls */
            .zoom-controls {
                position: absolute;
                right: 20px;
                bottom: 120px;
                display: flex;
                flex-direction: column;
                gap: 5px;
                z-index: 100;
            }
            
            .zoom-button {
                width: 44px;
                height: 44px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                cursor: pointer;
                border-radius: 5px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                backdrop-filter: blur(10px);
            }
            
            .zoom-button:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.05);
            }
            
            .zoom-indicator {
                text-align: center;
                font-size: 12px;
                color: #888;
                padding: 5px;
                font-family: 'Courier New', monospace;
            }
            
            /* Settings Panel */
            .settings-panel {
                position: absolute;
                top: 20px;
                right: 20px;
                z-index: 101;
            }
            
            .settings-toggle {
                width: 44px;
                height: 44px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                cursor: pointer;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                backdrop-filter: blur(10px);
            }
            
            .settings-toggle:hover,
            .settings-toggle.active {
                background: rgba(255, 255, 255, 0.1);
                transform: rotate(90deg);
            }
            
            .settings-content {
                position: absolute;
                top: 60px;
                right: 0;
                background: rgba(0, 0, 0, 0.9);
                padding: 20px;
                border-radius: 8px;
                width: 250px;
                max-height: 400px;
                overflow-y: auto;
                opacity: 0;
                visibility: hidden;
                transform: translateY(-10px);
                transition: all 0.3s;
                backdrop-filter: blur(20px);
            }
            
            .settings-content.visible {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            
            .settings-content h3 {
                margin: 0 0 15px 0;
                font-size: 14px;
                color: #fff;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .setting-item {
                margin: 15px 0;
            }
            
            .setting-item label {
                display: flex;
                align-items: center;
                gap: 10px;
                color: #ccc;
                font-size: 13px;
                cursor: pointer;
            }
            
            .setting-item input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
            }
            
            .setting-item select {
                width: 100%;
                padding: 8px;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                border-radius: 4px;
                margin-top: 5px;
                cursor: pointer;
            }
            
            .setting-separator {
                height: 1px;
                background: rgba(255, 255, 255, 0.1);
                margin: 20px 0;
            }
            
            /* Shortcuts Panel */
            .shortcuts-panel {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 101;
            }
            
            .shortcuts-toggle {
                width: 36px;
                height: 36px;
                background: rgba(0, 0, 0, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                cursor: pointer;
                border-radius: 50%;
                font-size: 18px;
                font-weight: bold;
                transition: all 0.2s;
            }
            
            .shortcuts-toggle:hover {
                background: rgba(255, 255, 255, 0.1);
                transform: scale(1.1);
            }
            
            .shortcuts-content {
                position: absolute;
                bottom: 50px;
                right: 0;
                background: rgba(0, 0, 0, 0.95);
                padding: 20px;
                border-radius: 8px;
                width: 250px;
                opacity: 0;
                visibility: hidden;
                transform: translateY(10px);
                transition: all 0.3s;
            }
            
            .shortcuts-content.visible {
                opacity: 1;
                visibility: visible;
                transform: translateY(0);
            }
            
            .shortcuts-content h3 {
                margin: 0 0 15px 0;
                font-size: 14px;
                color: #fff;
            }
            
            .shortcuts-content dl {
                margin: 0;
            }
            
            .shortcuts-content dt {
                display: inline-block;
                width: 60px;
                font-family: 'Courier New', monospace;
                background: rgba(255, 255, 255, 0.1);
                padding: 4px 8px;
                border-radius: 3px;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .shortcuts-content dd {
                display: inline;
                margin-left: 10px;
                color: #aaa;
                font-size: 13px;
            }
            
            .shortcuts-content dd::after {
                content: '\\\\A';
                white-space: pre;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .camera-controls {
                    top: auto;
                    bottom: 80px;
                    transform: none;
                }
                
                .zoom-controls {
                    flex-direction: row;
                    bottom: 20px;
                }
                
                .settings-panel {
                    top: auto;
                    bottom: 20px;
                    left: 20px;
                    right: auto;
                }
                
                .settings-content {
                    left: 0;
                    right: auto;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    setActiveCamera(mode) {
        this.activeCamera = mode;
        document.querySelectorAll('.camera-mode').forEach(button => {
            button.classList.toggle('active', button.dataset.mode === mode);
        });
    }
    
    updateZoomLevel(fov) {
        if (this.elements.zoomLevel) {
            this.elements.zoomLevel.textContent = `${Math.round(fov)}°`;
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `control-notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 80px;
            right: 20px;
            background: ${type === 'success' ? '#00cc44' : '#f60'};
            color: #fff;
            padding: 15px 25px;
            border-radius: 5px;
            font-weight: 500;
            animation: slideInRight 0.3s ease-out;
            z-index: 1000;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}