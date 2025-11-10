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
        label: 'Generic RV',
        badge: 'Backup',
        description: 'Alternative GLTF model',
        requiresAssetLoader: true
    },
    {
        id: 'cone',
        label: 'Simple Cone',
        badge: 'Fallback',
        description: 'Procedural geometry',
        requiresAssetLoader: false
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
        this.currentModel = options.defaultModel || (this.hasAssetLoader ? 'primary' : 'cone');
        this.isSwitching = false;

        this.element = null;
        this.statusEl = null;
        this.buttons = [];

        this.init();
    }

    init() {
        this.createElement();
        this.setupEventListeners();
        this.refreshAvailability();
        this.updateActiveButton(this.currentModel);
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
            <div class="model-toggle" role="group" aria-label="Spacecraft model">
                ${this.models.map(model => `
                    <button 
                        type="button" 
                        class="model-chip" 
                        data-model="${model.id}"
                        aria-pressed="${model.id === this.currentModel}"
                        title="${model.description}">
                        <span class="chip-label">${model.label}</span>
                        <span class="chip-badge">${model.badge}</span>
                    </button>
                `).join('')}
            </div>
        `;

        this.container.appendChild(wrapper);
        this.element = wrapper;
        this.statusEl = wrapper.querySelector('.model-status');

        this.buttons = Array.from(wrapper.querySelectorAll('.model-chip'));
    }

    setupEventListeners() {
        this.buttons.forEach(button => {
            button.addEventListener('click', () => {
                if (this.isSwitching || button.disabled) return;
                this.selectModel(button.dataset.model);
            });

            button.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    button.click();
                }
            });
        });
    }

    refreshAvailability() {
        this.hasAssetLoader = !!(this.entryVehicle && this.entryVehicle.assetLoader);
        this.buttons.forEach(button => {
            const config = this.modelLookup.get(button.dataset.model);
            const unavailable = config.requiresAssetLoader && !this.hasAssetLoader;
            button.disabled = unavailable;
            button.setAttribute('aria-disabled', unavailable ? 'true' : 'false');
            button.classList.toggle('is-disabled', unavailable);
            if (unavailable) {
                button.setAttribute('title', `${config.description} (requires GLTF support)`);
            } else {
                button.setAttribute('title', config.description);
            }
        });

        if (!this.hasAssetLoader && this.currentModel !== 'cone') {
            this.currentModel = 'cone';
            this.updateActiveButton(this.currentModel);
            this.setStatus(`${this.getModelLabel(this.currentModel)} ready`, 'ready');
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
        this.updateActiveButton(modelId);
        this.setStatus(`Loading ${selected.label}...`, 'loading');

        try {
            if (this.entryVehicle && typeof this.entryVehicle.switchModel === 'function') {
                await this.entryVehicle.switchModel(modelId);
            }

            this.currentModel = modelId;
            this.setStatus(`${selected.label} ready`, 'ready');

            if (this.onModelChange) {
                this.onModelChange(modelId);
            }
        } catch (error) {
            console.error('Error switching model:', error);
            this.setStatus(`Failed to load ${selected.label}`, 'error');
            this.updateActiveButton(this.currentModel);
        } finally {
            this.isSwitching = false;
        }
    }

    updateActiveButton(modelId) {
        this.buttons.forEach(button => {
            const isActive = button.dataset.model === modelId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
        });
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
