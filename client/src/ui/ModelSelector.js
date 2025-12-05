/**
 * ModelSelector.js
 * Compact UI component for switching between spacecraft models
 */

const MODEL_OPTIONS = [
    {
        id: 'primary',
        label: 'Dragon',
        badge: 'Primary',
        description: 'Detailed GLTF model from SOLIDWORKS',
        requiresAssetLoader: true
    },
    {
        id: 'backup',
        label: 'Buran',
        badge: 'Backup',
        description: 'Buran GLTF model',
        requiresAssetLoader: true
    }
];

export class ModelSelector {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onModelChange = options.onModelChange || null;
        this.entryVehicle = options.entryVehicle || null;
        this.hasAssetLoader = !!(this.entryVehicle && this.entryVehicle.assetLoader);

        this.models = MODEL_OPTIONS;
        this.modelLookup = new Map(this.models.map(model => [model.id, model]));
        this.currentModel = options.defaultModel || 'primary';
        this.isSwitching = false;

        this.element = null;
        this.statusEl = null;
        this.selectEl = null;

        this.init();
    }

    init() {
        this.createElement();
        this.setupEventListeners();
        this.refreshAvailability();
        this.updateSelection(this.currentModel);
        this.setStatus(`${this.getModelLabel(this.currentModel)} ready`, 'ready');
    }

    createElement() {
        const wrapper = document.createElement('div');
        wrapper.className = 'model-selector-compact';
        wrapper.innerHTML = `
            <div class="selector-header">
                <span class="control-label">SPACECRAFT</span>
                <span class="model-status" aria-live="polite">Select vehicle</span>
            </div>
            <label class="sr-only" for="spacecraft-dropdown">Choose spacecraft</label>
            <div class="model-dropdown">
                <select id="spacecraft-dropdown">
                    ${this.models.map(model => `
                        <option value="${model.id}">
                            ${model.label} • ${model.badge}
                        </option>
                    `).join('')}
                </select>
            </div>
        `;

        this.container.appendChild(wrapper);
        this.element = wrapper;
        this.statusEl = wrapper.querySelector('.model-status');
        this.selectEl = wrapper.querySelector('#spacecraft-dropdown');
        if (this.selectEl) {
            this.selectEl.value = this.currentModel;
        }
    }

    setupEventListeners() {
        if (!this.selectEl) return;

        this.selectEl.addEventListener('change', (event) => {
            const value = event.target.value;
            if (this.isSwitching) {
                event.target.value = this.currentModel;
                return;
            }
            this.selectModel(value);
        });
    }

    refreshAvailability() {
        this.hasAssetLoader = !!(this.entryVehicle && this.entryVehicle.assetLoader);
        if (!this.selectEl) return;

        Array.from(this.selectEl.options).forEach(option => {
            const config = this.modelLookup.get(option.value);
            const unavailable = config.requiresAssetLoader && !this.hasAssetLoader;
            option.disabled = unavailable;
            option.dataset.disabled = unavailable ? 'true' : 'false';
        });

        // If no asset loader, disable all (we require GLTF for both models)
        if (!this.hasAssetLoader) {
            this.setStatus('GLTF loader unavailable', 'error');
        }
    }

    async selectModel(modelId) {
        if (!this.modelLookup.has(modelId) || modelId === this.currentModel) {
            return;
        }

        const selected = this.modelLookup.get(modelId);
        if (selected.requiresAssetLoader && !this.hasAssetLoader) {
            this.setStatus('GLTF loader unavailable', 'error');
            return;
        }

        this.isSwitching = true;
        this.updateSelection(modelId);
        this.setStatus(`Loading ${selected.label}...`, 'loading');

        try {
            if (this.entryVehicle && typeof this.entryVehicle.switchModel === 'function') {
                await this.entryVehicle.switchModel(modelId);
            }

            this.currentModel = modelId;
            if (this.selectEl) {
                this.selectEl.value = modelId;
            }
            this.setStatus(`${selected.label} ready`, 'ready');

            if (this.onModelChange) {
                this.onModelChange(modelId);
            }
        } catch (error) {
            console.error('Error switching model:', error);
            this.setStatus(`Failed to load ${selected.label}`, 'error');
            this.updateSelection(this.currentModel);
        } finally {
            this.isSwitching = false;
        }
    }

    updateSelection(modelId) {
        if (this.selectEl) {
            this.selectEl.value = modelId;
        }
    }

    setStatus(message, state = 'ready') {
        if (!this.statusEl) return;

        this.statusEl.textContent = message;
        this.statusEl.dataset.state = state;
    }

    getModelLabel(modelId) {
        return this.modelLookup.get(modelId)?.label || 'Spacecraft';
    }

    setEntryVehicle(entryVehicle) {
        this.entryVehicle = entryVehicle;
        this.refreshAvailability();
    }

    show() {
        if (this.element) {
            this.element.hidden = false;
        }
    }

    hide() {
        if (this.element) {
            this.element.hidden = true;
        }
    }

    dispose() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
    }
}
