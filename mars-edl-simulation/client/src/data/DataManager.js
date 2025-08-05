/**
 * DataManager.js
 * Handles data loading, caching, and API communication
 */

export class DataManager {
    constructor() {
        this.cache = new Map();
        this.baseURL = window.location.origin;
        this.apiEndpoints = {
            trajectories: '/api/trajectories',
            missions: '/api/missions',
            telemetry: '/api/telemetry'
        };
    }
    
    /**
     * Load trajectory data from CSV file
     */
    async loadTrajectoryCSV(filename) {
        const cacheKey = `trajectory_${filename}`;
        
        // Check cache first
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
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
            
            console.log(`Loaded trajectory from: ${successPath}`);
            const csvText = await response.text();
            const data = this.parseCSV(csvText);
            
            // Cache the parsed data
            this.cache.set(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Error loading trajectory CSV:', error);
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
     */
    async loadMissionConfig(missionId = 'msl') {
        const cacheKey = `mission_${missionId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`${this.apiEndpoints.missions}/${missionId}`);
            if (!response.ok) {
                // Return default configuration if API fails
                return this.getDefaultMissionConfig();
            }
            
            const config = await response.json();
            this.cache.set(cacheKey, config);
            
            return config;
        } catch (error) {
            console.warn('Failed to load mission config from API, using defaults:', error);
            return this.getDefaultMissionConfig();
        }
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
     */
    async saveTelemetry(telemetryData) {
        try {
            const response = await fetch(this.apiEndpoints.telemetry, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(telemetryData)
            });
            
            if (!response.ok) {
                throw new Error('Failed to save telemetry');
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error saving telemetry:', error);
            // Store locally if API fails
            this.storeLocalTelemetry(telemetryData);
        }
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
}