/**
 * SimulationConfig.js
 * Central configuration management for simulation modes and physics parameters
 * Allows easy switching between frontend, backend, and hybrid modes
 */

export const SimulationModes = {
    FRONTEND: 'frontend',
    BACKEND: 'backend',
    HYBRID: 'hybrid'
};

export const CoordinateSystems = {
    J2000_MARS_CENTERED: 'J2000_mars_centered',
    MARS_FIXED: 'mars_fixed',
    INERTIAL: 'inertial'
};

export class SimulationConfig {
    constructor(initialConfig = {}) {
        // Default configuration
        this.config = {
            // Data source configuration
            dataSource: {
                mode: SimulationModes.FRONTEND,
                backendUrl: 'http://localhost:8000/api',
                fallbackToFrontend: true,
                cacheResults: true,
                timeout: 30000 // 30 seconds
            },

            // Physics configuration
            physics: {
                coordinateSystem: CoordinateSystems.J2000_MARS_CENTERED,
                timeStep: 0.1,
                integrationMethod: 'verlet', // 'euler', 'verlet', 'rk4'

                // Mars physical constants
                marsRadius: 3390000, // meters
                scaleHeight: 11.1,   // km
                surfaceDensity: 0.020, // kg/m³

                // MSL mission parameters
                liftToDragRatio: 0.13,
                capsuleMass: 899,      // kg
                referenceArea: 15.9    // m²
            },

            // Visualization configuration
            visualization: {
                scaleExperience: 100000,  // Scale factor for visualization
                maxTrajectoryPoints: 1000,
                realTimeEffects: true,
                showVectors: false,
                vectorScale: 1.0
            },

            // Camera configuration
            camera: {
                defaultMode: 'follow',
                followDistance: 0.2,
                minDistance: 0.01,
                maxDistance: 80,
                smoothness: 0.15
            },

            // Performance configuration
            performance: {
                useInstancing: true,
                useLOD: true,
                maxRenderDistance: 1000,
                culling: true
            },

            // Development configuration
            debug: {
                showCoordinateAxes: false,
                logPhysicsData: false,
                showPerformanceStats: false,
                enableConsoleCommands: true
            },

            ...initialConfig
        };

        // Configuration observers for reactive updates
        this.observers = new Map();

        // Load saved configuration from localStorage if available
        this.loadFromStorage();
    }

    /**
     * Get configuration value by path (e.g., 'physics.timeStep')
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} defaultValue - Default value if path doesn't exist
     * @returns {*} Configuration value
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;

        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }

        return current;
    }

    /**
     * Set configuration value by path
     * @param {string} path - Dot-separated path to configuration value
     * @param {*} value - Value to set
     * @param {boolean} persist - Whether to save to localStorage
     */
    set(path, value, persist = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;

        // Navigate to parent object
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }

        // Set value
        const oldValue = current[lastKey];
        current[lastKey] = value;

        // Notify observers
        this.notifyObservers(path, value, oldValue);

        // Persist to storage if requested
        if (persist) {
            this.saveToStorage();
        }
    }

    /**
     * Get the entire configuration object
     * @returns {Object} Complete configuration
     */
    getAll() {
        return JSON.parse(JSON.stringify(this.config));
    }

    /**
     * Update multiple configuration values
     * @param {Object} updates - Object with configuration updates
     * @param {boolean} persist - Whether to save to localStorage
     */
    update(updates, persist = true) {
        this.mergeDeep(this.config, updates);

        // Notify observers for each updated path
        this.notifyAllObservers(updates);

        if (persist) {
            this.saveToStorage();
        }
    }

    /**
     * Switch simulation mode (frontend/backend/hybrid)
     * @param {string} mode - New simulation mode
     * @param {Object} modeConfig - Additional configuration for the mode
     */
    switchMode(mode, modeConfig = {}) {
        if (!Object.values(SimulationModes).includes(mode)) {
            console.warn(`Invalid simulation mode: ${mode}`);
            return;
        }

        const modeConfigs = {
            [SimulationModes.FRONTEND]: {
                dataSource: {
                    mode,
                    fallbackToFrontend: false,
                    cacheResults: true
                },
                physics: {
                    integrationMethod: 'verlet'
                },
                performance: {
                    useInstancing: true,
                    useLOD: true
                }
            },

            [SimulationModes.BACKEND]: {
                dataSource: {
                    mode,
                    fallbackToFrontend: true,
                    cacheResults: true,
                    timeout: 30000
                },
                physics: {
                    integrationMethod: 'server_controlled'
                },
                performance: {
                    useInstancing: false, // Server provides optimized data
                    useLOD: false
                }
            },

            [SimulationModes.HYBRID]: {
                dataSource: {
                    mode,
                    fallbackToFrontend: true,
                    cacheResults: true
                },
                physics: {
                    integrationMethod: 'hybrid'
                },
                performance: {
                    useInstancing: true,
                    useLOD: true
                }
            }
        };

        // Merge mode-specific config with user-provided config
        const finalConfig = this.mergeDeep(modeConfigs[mode], modeConfig);

        this.update(finalConfig);

        console.log(`Switched to ${mode} mode`);
    }

    /**
     * Get configuration presets for common scenarios
     * @param {string} preset - Preset name
     * @returns {Object} Preset configuration
     */
    getPreset(preset) {
        const presets = {
            // High performance for real-time applications
            performance: {
                physics: {
                    timeStep: 0.2,
                    integrationMethod: 'euler'
                },
                visualization: {
                    maxTrajectoryPoints: 500,
                    realTimeEffects: false
                },
                performance: {
                    useInstancing: true,
                    useLOD: true,
                    culling: true
                }
            },

            // High accuracy for scientific analysis
            accuracy: {
                physics: {
                    timeStep: 0.05,
                    integrationMethod: 'rk4'
                },
                visualization: {
                    maxTrajectoryPoints: 2000,
                    realTimeEffects: true
                },
                performance: {
                    useInstancing: false,
                    useLOD: false,
                    culling: false
                }
            },

            // Development and debugging
            development: {
                debug: {
                    showCoordinateAxes: true,
                    logPhysicsData: true,
                    showPerformanceStats: true,
                    enableConsoleCommands: true
                },
                visualization: {
                    showVectors: true,
                    vectorScale: 2.0
                }
            },

            // Production deployment
            production: {
                debug: {
                    showCoordinateAxes: false,
                    logPhysicsData: false,
                    showPerformanceStats: false,
                    enableConsoleCommands: false
                },
                performance: {
                    useInstancing: true,
                    useLOD: true,
                    culling: true
                }
            }
        };

        return presets[preset] || {};
    }

    /**
     * Apply a configuration preset
     * @param {string} preset - Preset name
     * @param {boolean} persist - Whether to save to localStorage
     */
    applyPreset(preset, persist = true) {
        const presetConfig = this.getPreset(preset);
        if (Object.keys(presetConfig).length > 0) {
            this.update(presetConfig, persist);
            console.log(`Applied ${preset} preset`);
        } else {
            console.warn(`Unknown preset: ${preset}`);
        }
    }

    /**
     * Register observer for configuration changes
     * @param {string} path - Configuration path to observe
     * @param {Function} callback - Callback function (newValue, oldValue, path) => void
     * @returns {Function} Unsubscribe function
     */
    observe(path, callback) {
        if (!this.observers.has(path)) {
            this.observers.set(path, new Set());
        }

        this.observers.get(path).add(callback);

        // Return unsubscribe function
        return () => {
            const observers = this.observers.get(path);
            if (observers) {
                observers.delete(callback);
                if (observers.size === 0) {
                    this.observers.delete(path);
                }
            }
        };
    }

    /**
     * Notify observers of configuration changes
     * @private
     */
    notifyObservers(path, newValue, oldValue) {
        const observers = this.observers.get(path);
        if (observers) {
            observers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`Error in configuration observer for ${path}:`, error);
                }
            });
        }

        // Also notify wildcard observers
        const wildcardObservers = this.observers.get('*');
        if (wildcardObservers) {
            wildcardObservers.forEach(callback => {
                try {
                    callback(newValue, oldValue, path);
                } catch (error) {
                    console.error(`Error in wildcard configuration observer:`, error);
                }
            });
        }
    }

    /**
     * Notify all observers for batch updates
     * @private
     */
    notifyAllObservers(updates, prefix = '') {
        Object.keys(updates).forEach(key => {
            const fullPath = prefix ? `${prefix}.${key}` : key;
            const value = updates[key];

            if (value && typeof value === 'object' && !Array.isArray(value)) {
                this.notifyAllObservers(value, fullPath);
            } else {
                this.notifyObservers(fullPath, value, undefined);
            }
        });
    }

    /**
     * Deep merge two objects
     * @private
     */
    mergeDeep(target, source) {
        Object.keys(source).forEach(key => {
            if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                if (!target[key] || typeof target[key] !== 'object') {
                    target[key] = {};
                }
                this.mergeDeep(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        });
        return target;
    }

    /**
     * Save configuration to localStorage
     * @private
     */
    saveToStorage() {
        try {
            localStorage.setItem('mars-edl-simulation-config', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Failed to save configuration to localStorage:', error);
        }
    }

    /**
     * Load configuration from localStorage
     * @private
     */
    loadFromStorage() {
        try {
            const stored = localStorage.getItem('mars-edl-simulation-config');
            if (stored) {
                const storedConfig = JSON.parse(stored);
                this.mergeDeep(this.config, storedConfig);
            }
        } catch (error) {
            console.warn('Failed to load configuration from localStorage:', error);
        }
    }

    /**
     * Reset configuration to defaults
     * @param {boolean} persist - Whether to save to localStorage
     */
    reset(persist = true) {
        // Clear localStorage
        if (persist) {
            try {
                localStorage.removeItem('mars-edl-simulation-config');
            } catch (error) {
                console.warn('Failed to clear configuration from localStorage:', error);
            }
        }

        // Reset to defaults
        const defaultConfig = new SimulationConfig().config;
        this.config = JSON.parse(JSON.stringify(defaultConfig));

        // Notify observers
        this.notifyObservers('*', this.config, {});

        console.log('Configuration reset to defaults');
    }

    /**
     * Export configuration as JSON
     * @returns {string} JSON string of configuration
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     * @param {string} jsonString - JSON configuration string
     * @param {boolean} persist - Whether to save to localStorage
     */
    import(jsonString, persist = true) {
        try {
            const importedConfig = JSON.parse(jsonString);
            this.update(importedConfig, persist);
            console.log('Configuration imported successfully');
        } catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error('Invalid configuration JSON');
        }
    }

    /**
     * Validate configuration against schema
     * @returns {Object} Validation result
     */
    validate() {
        const errors = [];
        const warnings = [];

        // Validate data source configuration
        if (!Object.values(SimulationModes).includes(this.get('dataSource.mode'))) {
            errors.push('Invalid dataSource.mode');
        }

        // Validate physics parameters
        if (this.get('physics.timeStep') <= 0) {
            errors.push('physics.timeStep must be positive');
        }

        if (this.get('physics.marsRadius') <= 0) {
            errors.push('physics.marsRadius must be positive');
        }

        // Validate camera configuration
        if (this.get('camera.minDistance') >= this.get('camera.maxDistance')) {
            errors.push('camera.minDistance must be less than camera.maxDistance');
        }

        // Performance warnings
        if (this.get('visualization.maxTrajectoryPoints') > 2000) {
            warnings.push('High trajectory point count may impact performance');
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings
        };
    }
}

// Global configuration instance
export const config = new SimulationConfig();

// Development console commands (if enabled)
if (typeof window !== 'undefined' && config.get('debug.enableConsoleCommands')) {
    window.simConfig = config;
    console.log('Simulation configuration available at window.simConfig');
}