/**
 * SimulationDataProvider.js
 * Flexible abstraction layer for simulation data sources
 * Supports both frontend calculations and backend server integration
 */

import { BackendAPIClient } from '../services/BackendAPIClient.js';

export class SimulationDataProvider {
    constructor(config = {}) {
        this.config = {
            source: config.source || 'backend', // Default to 'backend' now, falls back to 'frontend'
            backendUrl: config.backendUrl || window.location.origin,
            fallbackToFrontend: config.fallbackToFrontend !== false, // Default true
            cacheResults: config.cacheResults !== false, // Default true
            ...config
        };

        this.cache = new Map();
        this.physicsEngine = null; // Will be injected

        // Initialize backend API client
        this.backendAPI = new BackendAPIClient({
            baseURL: this.config.backendUrl,
            timeout: 10000,
            retryAttempts: 2,
            cacheEnabled: this.config.cacheResults
        });
    }

    /**
     * Initialize the data provider with physics engine
     */
    initialize(physicsEngine) {
        this.physicsEngine = physicsEngine;
        console.log(`SimulationDataProvider initialized with source: ${this.config.source}`);
    }

    /**
     * Get trajectory data with flexible source
     */
    async getTrajectoryData(parameters = {}) {
        const cacheKey = JSON.stringify(parameters);

        if (this.config.cacheResults && this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        let trajectoryData;

        try {
            switch (this.config.source) {
                case 'backend':
                    trajectoryData = await this.getTrajectoryFromBackend(parameters);
                    break;
                case 'frontend':
                    trajectoryData = await this.getTrajectoryFromFrontend(parameters);
                    break;
                case 'hybrid':
                    trajectoryData = await this.getTrajectoryHybrid(parameters);
                    break;
                default:
                    throw new Error(`Unknown source: ${this.config.source}`);
            }

            if (this.config.cacheResults) {
                this.cache.set(cacheKey, trajectoryData);
            }

            return trajectoryData;
        } catch (error) {
            console.error('Error getting trajectory data:', error);

            if (this.config.fallbackToFrontend && this.config.source !== 'frontend') {
                console.log('Falling back to frontend calculations');
                return this.getTrajectoryFromFrontend(parameters);
            }

            throw error;
        }
    }

    /**
     * Backend-driven trajectory calculation
     * Now uses BackendAPIClient for better error handling
     */
    async getTrajectoryFromBackend(parameters) {
        console.log('[SimulationDataProvider] Requesting trajectory from backend with params:', parameters);

        // If filename provided, use the trajectory API
        if (parameters.filename) {
            const result = await this.backendAPI.getTrajectory(parameters.filename, {
                format: 'json',
                limit: parameters.limit,
                offset: parameters.offset
            });

            if (result.success) {
                return this.normalizeTrajectoryData(result.data);
            } else {
                throw new Error(result.error || 'Backend trajectory request failed');
            }
        }

        // If time range provided, use range API
        if (parameters.startTime !== undefined && parameters.endTime !== undefined) {
            const result = await this.backendAPI.getTrajectoryRange(
                parameters.startTime,
                parameters.endTime,
                parameters.limit || 1000
            );

            if (result.success) {
                return this.normalizeTrajectoryData(result.data);
            } else {
                throw new Error(result.error || 'Backend trajectory range request failed');
            }
        }

        // For physics-based trajectory calculations (future backend implementation)
        try {
            const response = await fetch(`${this.config.backendUrl}/api/trajectory/calculate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...parameters,
                    coordinate_system: 'J2000_mars_centered',
                    physics_model: 'mars_edl',
                    time_step: 0.1
                })
            });

            if (!response.ok) {
                throw new Error(`Backend request failed: ${response.status}`);
            }

            const data = await response.json();
            return this.normalizeTrajectoryData(data);
        } catch (error) {
            console.warn('[SimulationDataProvider] Backend calculation endpoint not available:', error.message);
            throw error;
        }
    }

    /**
     * Frontend calculation (current approach)
     */
    async getTrajectoryFromFrontend(parameters) {
        // Use existing physics engine
        if (!this.physicsEngine) {
            throw new Error('Physics engine not initialized');
        }

        return await this.physicsEngine.calculateTrajectory(parameters);
    }

    /**
     * Hybrid approach: Backend for physics, frontend for real-time modifications
     */
    async getTrajectoryHybrid(parameters) {
        // Get base trajectory from backend
        const baseTrajectory = await this.getTrajectoryFromBackend({
            ...parameters,
            modifications: false // Get unmodified trajectory
        });

        // Apply real-time modifications on frontend
        if (parameters.bankAngle || parameters.realTimeModifications) {
            return this.applyFrontendModifications(baseTrajectory, parameters);
        }

        return baseTrajectory;
    }

    /**
     * Apply real-time modifications to backend trajectory
     */
    async applyFrontendModifications(baseTrajectory, parameters) {
        if (!this.physicsEngine) {
            console.warn('Physics engine not available for modifications');
            return baseTrajectory;
        }

        return await this.physicsEngine.modifyTrajectory(baseTrajectory, parameters);
    }

    /**
     * Normalize trajectory data format for consistent interface
     */
    normalizeTrajectoryData(data) {
        // Ensure consistent data structure regardless of source
        return {
            points: data.points || data.trajectory || [],
            metadata: {
                source: data.source || this.config.source,
                coordinate_system: data.coordinate_system || 'J2000_mars_centered',
                timestamp: data.timestamp || Date.now(),
                parameters: data.parameters || {}
            },
            // Standardized point format
            format: {
                time: 'seconds',
                position: 'THREE.Vector3', // Mars-centered units
                velocity: 'THREE.Vector3', // units/second
                attitude: 'THREE.Euler',   // radians
                altitude: 'km'
            }
        };
    }

    /**
     * Update calculation parameters (for real-time modifications)
     */
    async updateParameters(parameters) {
        switch (this.config.source) {
            case 'backend':
                return this.sendParameterUpdate(parameters);
            case 'frontend':
            case 'hybrid':
                return this.updateFrontendParameters(parameters);
        }
    }

    /**
     * Send parameter updates to backend
     */
    async sendParameterUpdate(parameters) {
        try {
            const response = await fetch(`${this.config.backendUrl}/parameters`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(parameters)
            });

            if (!response.ok) {
                throw new Error(`Parameter update failed: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Backend parameter update failed:', error);
            if (this.config.fallbackToFrontend) {
                return this.updateFrontendParameters(parameters);
            }
            throw error;
        }
    }

    /**
     * Update frontend physics parameters
     */
    updateFrontendParameters(parameters) {
        if (this.physicsEngine) {
            return this.physicsEngine.updateParameters(parameters);
        }
        console.warn('Physics engine not available for parameter updates');
    }

    /**
     * Switch data source dynamically
     */
    switchSource(newSource) {
        this.config.source = newSource;
        this.cache.clear(); // Clear cache when switching sources
        console.log(`Switched simulation source to: ${newSource}`);
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return { ...this.config };
    }

    /**
     * Clean up resources
     */
    dispose() {
        this.cache.clear();
        this.physicsEngine = null;
    }
}