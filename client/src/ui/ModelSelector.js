/**
 * ModelSelector.js
 * Read-only display showing the selected vehicle and trajectory for the simulation.
 * Vehicle selection is done in the startup dialog.
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
        label: 'High-L/D system',
        badge: 'Backup',
        description: 'High Lift-to-Drag ratio vehicle GLTF model',
        requiresAssetLoader: true
    }
];

const TRAJECTORY_OPTIONS = {
    'msl': 'MSL (Curiosity)'
};

export class ModelSelector {
    constructor(options = {}) {
        this.container = options.container || document.body;
        this.onModelChange = options.onModelChange || null;
        this.entryVehicle = options.entryVehicle || null;
        this.hasAssetLoader = !!(this.entryVehicle && this.entryVehicle.assetLoader);

        this.models = MODEL_OPTIONS;
        this.modelLookup = new Map(this.models.map(model => [model.id, model]));
        this.currentModel = options.defaultModel || (window.MarsEDL?.config?.vehicle || 'primary');
        this.currentTrajectory = window.MarsEDL?.config?.trajectory || 'msl';
        this.isSwitching = false;

        this.element = null;

        this.init();
    }

    init() {
        this.createElement();
        this.refreshAvailability();
    }

    createElement() {
        const wrapper = document.createElement('div');
        wrapper.className = 'sim-info-display';

        const vehicleLabel = this.getModelLabel(this.currentModel);
        const trajectoryLabel = TRAJECTORY_OPTIONS[this.currentTrajectory] || this.currentTrajectory;

        wrapper.innerHTML = `
            <h3 class="control-label">SIMULATION</h3>
            <div class="sim-info-row">
                <span class="sim-info-key">Vehicle</span>
                <span class="sim-info-value" id="sim-info-vehicle">${vehicleLabel}</span>
            </div>
            <div class="sim-info-row">
                <span class="sim-info-key">Trajectory</span>
                <span class="sim-info-value" id="sim-info-trajectory">${trajectoryLabel}</span>
            </div>
        `;

        this.container.appendChild(wrapper);
        this.element = wrapper;
    }

    refreshAvailability() {
        this.hasAssetLoader = !!(this.entryVehicle && this.entryVehicle.assetLoader);
    }

    async selectModel(modelId) {
        if (!this.modelLookup.has(modelId) || modelId === this.currentModel) {
            return;
        }

        const selected = this.modelLookup.get(modelId);
        if (selected.requiresAssetLoader && !this.hasAssetLoader) {
            return;
        }

        this.isSwitching = true;

        try {
            if (this.entryVehicle && typeof this.entryVehicle.switchModel === 'function') {
                await this.entryVehicle.switchModel(modelId);
            }

            this.currentModel = modelId;

            // Update display
            const vehicleEl = this.element?.querySelector('#sim-info-vehicle');
            if (vehicleEl) {
                vehicleEl.textContent = selected.label;
            }

            if (this.onModelChange) {
                this.onModelChange(modelId);
            }
        } catch (error) {
            console.error('Error switching model:', error);
        } finally {
            this.isSwitching = false;
        }
    }

    getModelLabel(modelId) {
        return this.modelLookup.get(modelId)?.label || 'Spacecraft';
    }

    static getPrimaryModel() {
        return MODEL_OPTIONS.find(m => m.id === 'primary');
    }

    static getBackupModel() {
        return MODEL_OPTIONS.find(m => m.id === 'backup');
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
