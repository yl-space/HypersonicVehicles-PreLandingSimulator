/**
 * Handles data loading, caching, and API communication
 */

import { BackendAPIClient } from '../services/BackendAPIClient.js';

export class DataManager {
    constructor() {
        this.cache = new Map();
        this.baseURL = window.location.origin;
        this.apiEndpoints = {
            trajectories: '/api/trajectories',
            missions: '/api/missions',
            telemetry: '/api/telemetry'
        };

        // Initialize Backend API Client
        this.backendAPI = new BackendAPIClient({
            baseURL: this.baseURL,
            timeout: 10000,
            retryAttempts: 2,
            cacheEnabled: true,
            enableFallback: true
        });

        // Track data source preference
        this.preferBackend = true;
        this.backendAvailable = true;
    }
    
    /**
     * Load trajectory data from CSV file
     * Now tries backend API first, then falls back to local file
     */
    async loadTrajectoryCSV(filename) {
        const cacheKey = `trajectory_${filename}`;

        // Check cache first
        if (this.cache.has(cacheKey)) {
            console.log(`[DataManager] Using cached trajectory: ${filename}`);
            return this.cache.get(cacheKey);
        }

        // Try backend API first if preferred and available
        if (this.preferBackend && this.backendAvailable) {
            console.log(`[DataManager] Attempting to load trajectory from backend: ${filename}`);

            const backendResult = await this.backendAPI.getTrajectory(filename);

            if (backendResult.success && backendResult.data) {
                console.log(`[DataManager] Successfully loaded trajectory from backend`);

                // Transform backend data to expected format
                const transformedData = {
                    headers: backendResult.data.metadata?.columns || ['Time', 'x', 'y', 'z'],
                    rows: backendResult.data.points || [],
                    count: backendResult.data.totalPoints || backendResult.data.points?.length || 0,
                    source: 'backend'
                };

                this.cache.set(cacheKey, transformedData);
                return transformedData;
            } else {
                console.warn(`[DataManager] Backend failed, falling back to local file`);
                this.backendAvailable = false;
            }
        }

        // Fallback: Load from local files
        try {
            console.log(`[DataManager] Loading trajectory from local file: ${filename}`);

            // Try multiple paths to find the file
            const paths = [
                `/assets/data/${filename}`,
                `/data/${filename}`,
                `./assets/data/${filename}`,
                `./data/${filename}`,
                filename // Try direct path as fallback
            ];

            let response;
            let successPath;

            for (const path of paths) {
                try {
                    response = await fetch(path);
                    if (response.ok) {
                        successPath = path;
                        break;
                    }
                } catch (e) {
                    // Try next path
                }
            }

            if (!response || !response.ok) {
                throw new Error(`Failed to load trajectory data: ${filename} not found`);
            }

            console.log(`[DataManager] Loaded trajectory from: ${successPath}`);
            const csvText = await response.text();
            const data = this.parseCSV(csvText);
            data.source = 'local';

            // Cache the parsed data
            this.cache.set(cacheKey, data);

            return data;
        } catch (error) {
            console.error('[DataManager] Error loading trajectory CSV:', error);
            throw error;
        }
    }
    
    /**
     * Parse CSV data
     */
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.trim());
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length === headers.length) {
                const row = {};
                headers.forEach((header, index) => {
                    // Convert to number if possible
                    const value = parseFloat(values[index]);
                    row[header] = isNaN(value) ? values[index] : value;
                });
                data.push(row);
            }
        }
        
        return {
            headers,
            rows: data,
            count: data.length
        };
    }
    
    /**
     * Load mission configuration
     * Now tries backend API first with fallback to defaults
     */
    async loadMissionConfig(missionId = 'msl') {
        const cacheKey = `mission_${missionId}`;

        if (this.cache.has(cacheKey)) {
            console.log(`[DataManager] Using cached mission config: ${missionId}`);
            return this.cache.get(cacheKey);
        }

        // Try backend API first
        if (this.preferBackend && this.backendAvailable) {
            console.log(`[DataManager] Attempting to load mission config from backend: ${missionId}`);

            const backendResult = await this.backendAPI.getMissionConfig(missionId);

            if (backendResult.success && backendResult.data) {
                console.log(`[DataManager] Successfully loaded mission config from backend`);
                const config = backendResult.data;
                config.source = 'backend';
                this.cache.set(cacheKey, config);
                return config;
            } else {
                console.warn(`[DataManager] Backend mission config failed, using defaults`);
            }
        }

        // Fallback to default configuration
        console.log(`[DataManager] Using default mission configuration`);
        const defaultConfig = this.getDefaultMissionConfig();
        defaultConfig.source = 'default';
        this.cache.set(cacheKey, defaultConfig);
        return defaultConfig;
    }
    
    /**
     * Get default mission configuration
     */
    getDefaultMissionConfig() {
        return {
            id: 'msl',
            name: 'Mars Science Laboratory',
            vehicle: 'Curiosity Rover',
            launchDate: '2011-11-26',
            landingDate: '2012-08-06',
            landingSite: {
                name: 'Gale Crater',
                latitude: -4.5895,
                longitude: 137.4417
            },
            phases: [
                {
                    name: 'Entry Interface Point',
                    time: 0,
                    altitude: 132,
                    velocity: 19300,
                    description: 'The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.',
                    nextPhase: 'Guidance Start',
                    nextPhaseTime: 26
                },
                {
                    name: 'Guidance Start',
                    time: 26,
                    altitude: 90,
                    velocity: 19200,
                    description: 'As it begins to descend through the atmosphere, the spacecraft encounters pockets of air that are more or less dense, which can nudge it off course.',
                    nextPhase: 'Heading Alignment',
                    nextPhaseTime: 87
                },
                {
                    name: 'Heading Alignment',
                    time: 87,
                    altitude: 55,
                    velocity: 8500,
                    description: 'The guided entry algorithm corrects any remaining cross-range error.',
                    nextPhase: 'Begin SUFR',
                    nextPhaseTime: 174
                },
                {
                    name: 'Begin SUFR',
                    time: 174,
                    altitude: 21,
                    velocity: 1900,
                    description: 'The spacecraft executes the "Straighten Up and Fly Right" maneuver, ejecting six more balance masses and setting the angle of attack to zero.',
                    nextPhase: 'Parachute Deploy',
                    nextPhaseTime: 240
                },
                {
                    name: 'Parachute Deploy',
                    time: 240,
                    altitude: 13.463,
                    velocity: 1450,
                    description: 'The parachute is triggered by calculating the distance to the landing site, and opening at the optimum time to hit a smaller target area.',
                    nextPhase: 'Heat Shield Separation',
                    nextPhaseTime: 260
                },
                {
                    name: 'Heat Shield Separation',
                    time: 260,
                    altitude: 10,
                    velocity: 580,
                    description: 'The heat shield separates to expose the rover and landing system.',
                    nextPhase: null,
                    nextPhaseTime: null
                }
            ],
            vehicle_config: {
                mass: 899, // kg
                heatShieldDiameter: 4.5, // meters
                parachuteDiameter: 21.5, // meters
                entryAngle: -15.5 // degrees
            }
        };
    }
    
    /**
     * Save telemetry data
     * Now uses backend API with local storage fallback
     */
    async saveTelemetry(telemetryData) {
        // Try backend API first
        if (this.preferBackend && this.backendAvailable) {
            const backendResult = await this.backendAPI.sendTelemetry(telemetryData);

            if (backendResult.success) {
                console.log('[DataManager] Telemetry saved to backend successfully');
                return backendResult.data;
            } else {
                console.warn('[DataManager] Failed to save telemetry to backend, storing locally');
            }
        }

        // Fallback: Store locally if backend fails
        this.storeLocalTelemetry(telemetryData);
        return { success: true, source: 'local' };
    }
    
    /**
     * Store telemetry locally
     */
    storeLocalTelemetry(telemetryData) {
        const key = 'Mars_edl_telemetry';
        const existing = this.getLocalTelemetry();
        existing.push({
            ...telemetryData,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 1000 entries
        if (existing.length > 1000) {
            existing.splice(0, existing.length - 1000);
        }
        
        try {
            localStorage.setItem(key, JSON.stringify(existing));
        } catch (e) {
            console.warn('Failed to store telemetry locally:', e);
        }
    }
    
    /**
     * Get local telemetry
     */
    getLocalTelemetry() {
        const key = 'Mars_edl_telemetry';
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : [];
        } catch (e) {
            return [];
        }
    }
    
    /**
     * Load multiple trajectory files
     */
    async loadTrajectoryBatch(filenames) {
        const promises = filenames.map(filename => this.loadTrajectoryCSV(filename));
        
        try {
            const results = await Promise.all(promises);
            return results;
        } catch (error) {
            console.error('Error loading trajectory batch:', error);
            throw error;
        }
    }
    
    /**
     * Export simulation data
     */
    exportSimulationData(simulationState, format = 'json') {
        const data = {
            timestamp: new Date().toISOString(),
            mission: simulationState.mission,
            duration: simulationState.totalTime,
            phases: simulationState.phases,
            telemetry: this.getLocalTelemetry()
        };
        
        if (format === 'json') {
            return JSON.stringify(data, null, 2);
        } else if (format === 'csv') {
            return this.convertToCSV(data.telemetry);
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }
    
    /**
     * Convert telemetry to CSV
     */
    convertToCSV(telemetryData) {
        if (!telemetryData || telemetryData.length === 0) {
            return '';
        }
        
        const headers = Object.keys(telemetryData[0]);
        const csvLines = [headers.join(',')];
        
        telemetryData.forEach(row => {
            const values = headers.map(header => {
                const value = row[header];
                return typeof value === 'string' && value.includes(',') 
                    ? `"${value}"` 
                    : value;
            });
            csvLines.push(values.join(','));
        });
        
        return csvLines.join('\n');
    }
    
    /**
     * Download data as file
     */
    downloadData(data, filename, mimeType = 'application/json') {
        const blob = new Blob([data], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        link.href = url;
        link.download = filename;
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        return {
            size: this.cache.size,
            keys: Array.from(this.cache.keys()),
            memoryUsage: this.estimateCacheMemory()
        };
    }
    
    /**
     * Estimate cache memory usage
     */
    estimateCacheMemory() {
        let totalSize = 0;

        this.cache.forEach((value, key) => {
            // Rough estimation
            totalSize += JSON.stringify(value).length;
            totalSize += key.length;
        });

        return {
            bytes: totalSize,
            kb: (totalSize / 1024).toFixed(2),
            mb: (totalSize / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Check backend availability
     */
    async checkBackendHealth() {
        const health = await this.backendAPI.healthCheck();
        this.backendAvailable = health.success;
        return health;
    }

    /**
     * Get backend status
     */
    getBackendStatus() {
        return {
            available: this.backendAvailable,
            preferBackend: this.preferBackend,
            apiStatus: this.backendAPI.getStatus()
        };
    }

    /**
     * Set backend preference
     */
    setBackendPreference(prefer) {
        this.preferBackend = prefer;
        console.log(`[DataManager] Backend preference set to: ${prefer}`);
    }

    /**
     * Force backend check and update availability
     */
    async updateBackendAvailability() {
        const isAvailable = await this.backendAPI.isBackendAvailable();
        this.backendAvailable = isAvailable;
        console.log(`[DataManager] Backend availability updated: ${isAvailable}`);
        return isAvailable;
    }
}