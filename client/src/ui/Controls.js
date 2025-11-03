/**
 * UI controls for camera modes, zoom, and other interactions
 */

export class Controls {
    constructor(options) {
        this.options = {
            onCameraMode: () => {},
            onZoom: () => {},
            onSettings: () => {},
            onBankAngle: () => {},
            ...options
        };
        
        this.lastSliderValue = 0;
        this.elements = {};
        this.activeCamera = 'FOLLOW';
        
        this.init();
    }
    
    init() {
        this.createCameraControls();
        this.createBankAngleControls();
        // this.createZoomControls(); // Disabled - using HTML zoom controls instead
        this.createSettingsPanel();
        this.createKeyboardShortcuts();
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
                <button class="camera-mode" data-mode="ORBIT">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                    </svg>
                    ORBIT
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
    
    createBankAngleControls() {
        const container = document.createElement('div');
        container.className = 'bank-angle-controls';
        container.innerHTML = `
            <div class="control-group">
                <h3 class="control-label">BANK ANGLE</h3>
                <div class="bank-slider-row bank-slider-relative">
                    <input type="range" min="-90" max="90" value="0" step="1" class="bank-slider" id="bank-angle-slider">
                    <span class="bank-angle-value" id="bank-angle-value">0°</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(container);

        // Event listener for slider
        const slider = container.querySelector('#bank-angle-slider');
        const valueLabel = container.querySelector('#bank-angle-value');
        this.lastSliderValue = slider.value;
        slider.addEventListener('input', () => {
            valueLabel.textContent = `${slider.value}°`;
        });
        slider.addEventListener('change', () => {
            if (this.options.onBankAngle) {
                const newValue = Number(slider.value);
                // Prevent redundant calls if value hasn't changed
                if (newValue === this.lastSliderValue) return;
                this.options.onBankAngle(this.lastSliderValue, newValue);
                this.lastSliderValue = newValue;
            }
        });

        this.elements.bankAngleControls = container;
        this.elements.bankAngleSlider = slider;
        this.elements.bankAngleValue = valueLabel;
    }

    updateBankAngleRelative(adjustment) {
        const currentValue = Number(this.elements.bankAngleSlider.value);
        this.elements.bankAngleSlider.value = currentValue + adjustment;
        this.elements.bankAngleValue.textContent = `${this.elements.bankAngleSlider.value}°`;
        if (this.options.onBankAngle) {
            const newValue = Number(this.elements.bankAngleSlider.value);
            // Prevent redundant calls if value hasn't changed
            if (newValue === this.lastSliderValue) return;
            this.options.onBankAngle(this.lastSliderValue, newValue);
            this.lastSliderValue = newValue;
        }
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
                        <input type="checkbox" id="show-vectors">
                        Orientation Vectors
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
            showVectors: container.querySelector('#show-vectors'),
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
                    <dt>2</dt><dd>Orbit Camera</dd>
                    <dt>←/→</dt><dd>Skip 5 seconds</dd>
                    <dt>↑/↓</dt><dd>Zoom In/Out</dd>
                    <dt>A/D</dt><dd>Adjust Bank Angle</dd>
                    <dt>V</dt><dd>Toggle Vectors</dd>
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
        notification.classList.add('notification-slide-in');
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('notification-slide-out');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}