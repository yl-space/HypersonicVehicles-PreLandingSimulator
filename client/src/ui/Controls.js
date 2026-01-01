/**
 * UI controls for camera modes, zoom, and other interactions
 */

import { 
    CONTROLS_CONFIG, 
    ControlTypes,
    normalizeControlValue,
    adjustControlValue,
    getAllControlIds
} from '../config/ControlsConfig.js';

export class Controls {
    constructor(options) {
        this.options = {
            onCameraMode: () => {},
            onZoom: () => {},
            onSettings: () => {},
            onControlChange: () => {}, // Unified callback for all control changes
            onToggleReference: () => {},
            ...options
        };
        
        // Store last values for each control to detect changes
        this.lastControlValues = {};
        
        // Store control elements organized by control ID
        this.controlElements = {};
        
        this.elements = {};
        this.activeCamera = 'FOLLOW';
        this.isVisible = true;
        
        this.init();
    }
    
    init() {
        this.createCameraControls();
        // this.createZoomControls(); // Disabled - using HTML zoom controls instead
        this.createDynamicControls(); 
        this.createSettingsPanel();
        this.createKeyboardShortcuts();
    }
    
    createCameraControls() {
        const wrapper = document.createElement('div');
        wrapper.className = 'camera-controls-wrapper';
        
        const container = document.createElement('div');
        container.className = 'camera-controls';
        container.innerHTML = `
            <div class="camera-controls-header">
                <h3 class="control-label">CAMERA</h3>
                <button class="panel-collapse-toggle" type="button" title="Collapse camera controls">▾</button>
            </div>
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
            <div class="control-group">
                <h3 class="control-label">REFERENCE TRAJECTORY</h3>
                <button class="camera-mode" id="toggle-reference-traj" style="width: 100%; justify-content: center;">
                    SHOW REFERENCE
                </button>
            </div>
        `;
        
        // Create toggle button
        const toggleButton = document.createElement('div');
        toggleButton.className = 'camera-toggle-icon';
        toggleButton.id = 'camera-toggle-icon';
        toggleButton.title = 'Hide controls';
        toggleButton.innerHTML = `
            <svg class="icon-collapse" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="13 17 18 12 13 7"></polyline>
                <polyline points="6 17 11 12 6 7"></polyline>
            </svg>
            <svg class="icon-expand" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                <polyline points="11 17 6 12 11 7"></polyline>
                <polyline points="18 17 13 12 18 7"></polyline>
            </svg>
        `;
        
        wrapper.appendChild(toggleButton);
        wrapper.appendChild(container);
        document.body.appendChild(wrapper);
        
        // Event listeners
        container.querySelectorAll('.camera-mode:not(#toggle-reference-traj)').forEach(button => {
            button.addEventListener('click', () => {
                this.setActiveCamera(button.dataset.mode);
                this.options.onCameraMode(button.dataset.mode);
            });
        });

        const refBtn = container.querySelector('#toggle-reference-traj');
        if (refBtn) {
            refBtn.addEventListener('click', () => {
                refBtn.classList.toggle('active');
                const isActive = refBtn.classList.contains('active');
                refBtn.textContent = isActive ? 'HIDE REFERENCE' : 'SHOW REFERENCE';
                if (this.options.onToggleReference) {
                    this.options.onToggleReference(isActive);
                } else {
                    console.warn('[Controls] No onToggleReference callback provided');
                }
            });
        }
        
        // Toggle button event listener
        toggleButton.addEventListener('click', () => this.toggleVisibility());
        
        this.elements.cameraControlsWrapper = wrapper;
        this.elements.cameraControls = container;
        this.elements.cameraToggleIcon = toggleButton;
        this.elements.iconCollapse = toggleButton.querySelector('.icon-collapse');
        this.elements.iconExpand = toggleButton.querySelector('.icon-expand');
    }
    
    /**
     * Create all interactive controls based on configuration
     */
    createDynamicControls() {
        const controlIds = getAllControlIds();
        
        controlIds.forEach(controlId => {
            const config = CONTROLS_CONFIG[controlId];
            
            switch (config.type) {
                case ControlTypes.NUMBER:
                case ControlTypes.ANGLE:
                    this.createSliderControl(controlId, config);
                    break;
                case ControlTypes.BOOLEAN:
                    this.createToggleControl(controlId, config);
                    break;
                case ControlTypes.SELECT:
                    this.createSelectControl(controlId, config);
                    break;
            }
            
            // Initialize last value
            this.lastControlValues[controlId] = config.defaultValue;
        });
    }
    
    /**
     * Create a slider control (for number/angle types)
     */
    createSliderControl(controlId, config) {
        const controlGroup = document.createElement('div');
        controlGroup.classList = "control-group hidden-control";
        controlGroup.innerHTML = `
            <h3 class="control-label">${config.label}</h3>
            <div class="control-slider-row">
                <input 
                    type="range" 
                    min="${config.min}" 
                    max="${config.max}" 
                    value="${config.defaultValue}" 
                    step="${config.step}" 
                    class="control-slider" 
                    id="${controlId}-slider"
                    data-control-id="${controlId}">
                <span class="control-value" id="${controlId}-value">${config.defaultValue}${config.unit}</span>
            </div>
            ${config.canBeDisabled ? `<p class="control-status" id="${controlId}-status" aria-live="polite"></p>` : ''}
        `;
        
        // Add to camera controls container
        const cameraControls = this.elements.cameraControls;
        if (cameraControls) {
            cameraControls.appendChild(controlGroup);
        } else {
            console.warn('Camera controls container not found, adding to body');
            document.body.appendChild(controlGroup);
        }

        // Store element references
        const slider = controlGroup.querySelector(`#${controlId}-slider`);
        const valueLabel = controlGroup.querySelector(`#${controlId}-value`);
        const statusLabel = config.canBeDisabled ? controlGroup.querySelector(`#${controlId}-status`) : null;
        
        this.controlElements[controlId] = {
            container: controlGroup,
            slider,
            valueLabel,
            statusLabel,
            config
        };

        // Event listeners for slider
        slider.addEventListener('input', () => {
            valueLabel.textContent = `${slider.value}${config.unit}`;
        });
        
        slider.addEventListener('change', () => {
            const newValue = Number(slider.value);
            const lastValue = this.lastControlValues[controlId];
            
            // Prevent redundant calls if value hasn't changed
            if (newValue === lastValue) return;
            
            // Normalize value if needed (e.g., angle wrapping)
            const normalizedValue = normalizeControlValue(controlId, newValue);
            
            // Update slider and label with normalized value (important for angle wrapping)
            if (normalizedValue !== newValue) {
                slider.value = normalizedValue;
                valueLabel.textContent = `${normalizedValue}${config.unit}`;
            }
            
            // Notify change
            this.notifyControlChange(controlId, lastValue, normalizedValue);
            
            this.lastControlValues[controlId] = normalizedValue;
        });
    }
    
    /**
     * Create a toggle control (for boolean types)
     */
    createToggleControl(controlId, config) {
        // Future implementation for boolean controls
        console.log(`Toggle control ${controlId} not yet implemented`);
    }
    
    /**
     * Create a select control (for select types)
     */
    createSelectControl(controlId, config) {
        // Future implementation for select controls
        console.log(`Select control ${controlId} not yet implemented`);
    }
    
    /**
     * Update control value with relative adjustment
     */
    updateControlRelative(controlId, adjustment) {
        const elements = this.controlElements[controlId];
        if (!elements) {
            console.warn(`Control ${controlId} not found`);
            return;
        }
        
        const currentValue = Number(elements.slider.value);
        const newValue = adjustControlValue(controlId, currentValue, adjustment);
        
        elements.slider.value = newValue;
        elements.valueLabel.textContent = `${newValue}${elements.config.unit}`;
        
        const lastValue = this.lastControlValues[controlId];
        if (newValue !== lastValue) {
            this.notifyControlChange(controlId, lastValue, newValue);
            this.lastControlValues[controlId] = newValue;
        }
    }
    
    /**
     * Notify listeners of control change
     */
    notifyControlChange(controlId, oldValue, newValue) {
        if (this.options.onControlChange) {
            this.options.onControlChange({
                controlId,
                oldValue,
                newValue,
                config: CONTROLS_CONFIG[controlId]
            });
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

    getCameraControlsElement() {
        return this.elements.cameraControls;
    }

    /**
     * Enable or disable all dynamic controls
     * @param {boolean} enabled - Whether controls should be enabled
     * @param {string} message - Optional status message to display on all controls
     */
    setControlsEnabled(enabled, message = '') {
        for (const [controlId, elements] of Object.entries(this.controlElements)) {
            const { slider, container, statusLabel } = elements;

            slider.disabled = !enabled;
            container.classList.toggle('control-disabled', !enabled);

            if (statusLabel) {
                statusLabel.textContent = message;
                statusLabel.style.display = message ? 'block' : 'none';
            }
        }
    }
    
    /**
     * Enable or disable a specific control
     * @param {string} controlId - Control identifier
     * @param {boolean} enabled - Whether control should be enabled
     * @param {string} message - Optional status message to display
     */
    setSpecificControlEnabled(controlId, enabled, message = '') {
        const elements = this.controlElements[controlId];
        if (!elements) {
            console.warn(`Control ${controlId} not found`);
            return;
        }

        const { slider, container, statusLabel } = elements;

        slider.disabled = !enabled;
        container.classList.toggle('control-disabled', !enabled);

        if (statusLabel) {
            statusLabel.textContent = message;
            statusLabel.style.display = message ? 'block' : 'none';
        }
    }
    
    /**
     * Legacy method for backward compatibility
     * @deprecated Use setControlsEnabled(enabled, message) instead
     */
    setBankAngleEnabled(enabled, message = '') {
        this.setSpecificControlEnabled('bankAngle', enabled, message);
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
        
        // Build keyboard shortcuts dynamically from control configuration
        let controlShortcuts = '';
        for (const [controlId, config] of Object.entries(CONTROLS_CONFIG)) {
            if (config.keyboardShortcuts) {
                const increaseKeys = config.keyboardShortcuts.increase.join('/').toUpperCase();
                const decreaseKeys = config.keyboardShortcuts.decrease.join('/').toUpperCase();
                controlShortcuts += `<dt>${decreaseKeys}/${increaseKeys}</dt><dd>Adjust ${config.label}</dd>`;
            }
        }
        
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
                    ${controlShortcuts}
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
    
    toggleVisibility() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            // Show panel - slide in from right
            this.elements.cameraControls.classList.remove('slide-out');
            this.elements.cameraControls.classList.add('slide-in');
            this.elements.iconCollapse.style.display = 'block';
            this.elements.iconExpand.style.display = 'none';
            this.elements.cameraToggleIcon.title = 'Hide controls';
        } else {
            // Hide panel - slide out to right
            this.elements.cameraControls.classList.remove('slide-in');
            this.elements.cameraControls.classList.add('slide-out');
            this.elements.iconCollapse.style.display = 'none';
            this.elements.iconExpand.style.display = 'block';
            this.elements.cameraToggleIcon.title = 'Show controls';
        }
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
    
    /**
     * Get current value of a control
     * @param {string} controlId - Control identifier
     * @returns {*} Current control value
     */
    getControlValue(controlId) {
        return this.lastControlValues[controlId];
    }
    
    /**
     * Set value of a control programmatically
     * @param {string} controlId - Control identifier
     * @param {*} value - New value
     * @param {boolean} notify - Whether to trigger change notification
     */
    setControlValue(controlId, value, notify = false) {
        const elements = this.controlElements[controlId];
        if (!elements) {
            console.warn(`Control ${controlId} not found`);
            return;
        }
        
        const normalizedValue = normalizeControlValue(controlId, value);
        elements.slider.value = normalizedValue;
        elements.valueLabel.textContent = `${normalizedValue}${elements.config.unit}`;
        
        if (notify) {
            const oldValue = this.lastControlValues[controlId];
            this.notifyControlChange(controlId, oldValue, normalizedValue);
        }
        
        this.lastControlValues[controlId] = normalizedValue;
    }
    
    /**
     * Handle keyboard input for controls
     * @param {string} key - Key pressed
     * @returns {boolean} Whether key was handled
     */
    handleControlKeyPress(key) {
        for (const [controlId, config] of Object.entries(CONTROLS_CONFIG)) {
            if (!config.keyboardShortcuts) continue;
            
            if (config.keyboardShortcuts.increase.includes(key)) {
                this.updateControlRelative(controlId, config.keyboardStep || 1);
                return true;
            }
            
            if (config.keyboardShortcuts.decrease.includes(key)) {
                this.updateControlRelative(controlId, -(config.keyboardStep || 1));
                return true;
            }
        }
        
        return false;
    }
}
