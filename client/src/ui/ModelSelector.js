/**
 * ModelSelector.js
 * UI component for switching between spacecraft models
 */

import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';

export class ModelSelector {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onModelChange = options.onModelChange || null;
        this.entryVehicle = options.entryVehicle || null;

        this.element = null;
        this.currentModel = 'primary';

        this.init();
    }

    init() {
        this.createElement();
        this.setupEventListeners();
    }

    createElement() {
        // Create container
        const div = document.createElement('div');
        div.className = 'model-selector';
        div.innerHTML = `
            <div class="model-selector-content">
                <h3>Spacecraft Model</h3>
                <div class="model-options">
                    <label class="model-option">
                        <input type="radio" name="spacecraft-model" value="primary" checked>
                        <span>Dragon (Primary)</span>
                        <small>Detailed GLTF model from SOLIDWORKS</small>
                    </label>
                    <label class="model-option">
                        <input type="radio" name="spacecraft-model" value="backup">
                        <span>Generic RV (Backup)</span>
                        <small>Alternative GLTF model</small>
                    </label>
                    <label class="model-option">
                        <input type="radio" name="spacecraft-model" value="cone">
                        <span>Simple Cone</span>
                        <small>Procedural geometry (fallback)</small>
                    </label>
                </div>
                <div class="model-info">
                    <p id="model-status">Loading primary model...</p>
                    <div class="axis-info" id="axis-info" style="display: none;">
                        <h4>Axis Configuration</h4>
                        <div id="axis-details"></div>
                    </div>
                </div>
                <button class="toggle-selector" title="Toggle Model Selector">🚀</button>
            </div>
        `;

        this.element = div;
        this.container.appendChild(div);

        // Add styles
        this.addStyles();
    }

    addStyles() {
        if (document.getElementById('model-selector-styles')) return;

        const style = document.createElement('style');
        style.id = 'model-selector-styles';
        style.textContent = `
            .model-selector {
                position: fixed;
                top: 80px;
                right: 20px;
                background: rgba(0, 0, 0, 0.9);
                border: 1px solid rgba(255, 165, 0, 0.3);
                border-radius: 8px;
                padding: 15px;
                color: white;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                max-width: 300px;
                z-index: 1000;
                transition: transform 0.3s ease;
            }

            .model-selector.collapsed {
                transform: translateX(calc(100% - 50px));
            }

            .model-selector h3 {
                margin: 0 0 15px 0;
                color: #ffa500;
                font-size: 16px;
                text-transform: uppercase;
                letter-spacing: 1px;
            }

            .model-options {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 15px;
            }

            .model-option {
                display: block;
                padding: 10px;
                background: rgba(255, 165, 0, 0.1);
                border: 1px solid transparent;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .model-option:hover {
                background: rgba(255, 165, 0, 0.2);
                border-color: rgba(255, 165, 0, 0.5);
            }

            .model-option input[type="radio"] {
                margin-right: 8px;
            }

            .model-option span {
                font-weight: bold;
                display: block;
                margin-bottom: 4px;
            }

            .model-option small {
                color: #aaa;
                font-size: 12px;
                display: block;
            }

            .model-option input[type="radio"]:checked + span {
                color: #ffa500;
            }

            .model-info {
                padding: 10px;
                background: rgba(0, 0, 0, 0.5);
                border-radius: 4px;
                font-size: 12px;
                color: #aaa;
            }

            .model-info p {
                margin: 0 0 10px 0;
            }

            #model-status {
                color: #4CAF50;
                font-weight: bold;
            }

            #model-status.loading {
                color: #ffa500;
            }

            #model-status.error {
                color: #f44336;
            }

            .axis-info {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid rgba(255, 165, 0, 0.3);
            }

            .axis-info h4 {
                margin: 0 0 8px 0;
                font-size: 12px;
                color: #ffa500;
                text-transform: uppercase;
            }

            #axis-details {
                font-family: 'Courier New', monospace;
                font-size: 11px;
                line-height: 1.4;
            }

            .toggle-selector {
                position: absolute;
                top: 10px;
                right: 10px;
                background: transparent;
                border: none;
                color: white;
                font-size: 20px;
                cursor: pointer;
                padding: 5px;
                transition: transform 0.3s ease;
            }

            .toggle-selector:hover {
                transform: rotate(20deg);
            }

            @media (max-width: 768px) {
                .model-selector {
                    top: auto;
                    bottom: 100px;
                    right: 10px;
                    max-width: 250px;
                }
            }
        `;

        document.head.appendChild(style);
    }

    setupEventListeners() {
        // Model selection
        const radios = this.element.querySelectorAll('input[type="radio"]');
        radios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectModel(e.target.value);
            });
        });

        // Toggle button
        const toggleBtn = this.element.querySelector('.toggle-selector');
        toggleBtn.addEventListener('click', () => {
            this.element.classList.toggle('collapsed');
        });
    }

    async selectModel(modelId) {
        this.currentModel = modelId;

        const statusEl = document.getElementById('model-status');
        const axisInfoEl = document.getElementById('axis-info');
        const axisDetailsEl = document.getElementById('axis-details');

        statusEl.textContent = `Loading ${modelId} model...`;
        statusEl.className = 'loading';

        try {
            if (this.entryVehicle) {
                // Switch the model
                await this.entryVehicle.switchModel(modelId);

                // Update status
                statusEl.textContent = `${modelId} model loaded successfully`;
                statusEl.className = '';

                // Show axis information if GLTF model
                if (modelId !== 'cone' && this.entryVehicle.modelMetadata) {
                    const metadata = this.entryVehicle.modelMetadata;
                    axisDetailsEl.innerHTML = `
                        <strong>Original Axes:</strong><br>
                        Forward: ${metadata.originalAxes?.forward || 'Unknown'}<br>
                        Up: ${metadata.originalAxes?.up || 'Unknown'}<br>
                        Right: ${metadata.originalAxes?.right || 'Unknown'}<br>
                        <br>
                        <strong>Transformations Applied:</strong><br>
                        Rotation: X=${metadata.transformations?.rotation?.x || 0}°,
                                 Y=${metadata.transformations?.rotation?.y || 0}°,
                                 Z=${metadata.transformations?.rotation?.z || 0}°<br>
                        Scale: ${metadata.transformations?.scale || 1}<br>
                        ${metadata.notes ? `<br><strong>Notes:</strong> ${metadata.notes}` : ''}
                    `;
                    axisInfoEl.style.display = 'block';
                } else {
                    axisInfoEl.style.display = 'none';
                }

                // Callback
                if (this.onModelChange) {
                    this.onModelChange(modelId);
                }
            }
        } catch (error) {
            console.error('Error switching model:', error);
            statusEl.textContent = `Failed to load ${modelId} model`;
            statusEl.className = 'error';
        }
    }

    setEntryVehicle(entryVehicle) {
        this.entryVehicle = entryVehicle;
    }

    show() {
        this.element.style.display = 'block';
    }

    hide() {
        this.element.style.display = 'none';
    }

    dispose() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}