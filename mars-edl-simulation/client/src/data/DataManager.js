/**
 * DataManager.js
 * Handles loading and caching of mission data
 */

export class DataManager {
    constructor() {
        this.cache = new Map();
        this.apiBaseUrl = '/api';
    }
    
    async loadMissionConfig(missionId) {
        const cacheKey = `mission-config-${missionId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/missions/${missionId}/config`);
            if (!response.ok) throw new Error(`Failed to load mission config: ${response.statusText}`);
            
            const config = await response.json();
            this.cache.set(cacheKey, config);
            return config;
            
        } catch (error) {
            console.error('Error loading mission config:', error);
            // Return default config
            return this.getDefaultMissionConfig(missionId);
        }
    }
    
    async loadTrajectoryData(missionId) {
        const cacheKey = `trajectory-${missionId}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/trajectories/${missionId}`);
            if (!response.ok) throw new Error(`Failed to load trajectory: ${response.statusText}`);
            
            const csvData = await response.text();
            this.cache.set(cacheKey, csvData);
            return csvData;
            
        } catch (error) {
            console.error('Error loading trajectory data:', error);
            throw error;
        }
    }
    
    async loadVehicleModel(vehicleType) {
        const cacheKey = `model-${vehicleType}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`/assets/models/${vehicleType}.glb`);
            if (!response.ok) throw new Error(`Failed to load model: ${response.statusText}`);
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            this.cache.set(cacheKey, url);
            return url;
            
        } catch (error) {
            console.error('Error loading vehicle model:', error);
            return null;
        }
    }
    
    async loadTexture(textureName) {
        const cacheKey = `texture-${textureName}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            const response = await fetch(`/assets/textures/${textureName}`);
            if (!response.ok) throw new Error(`Failed to load texture: ${response.statusText}`);
            
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            this.cache.set(cacheKey, url);
            return url;
            
        } catch (error) {
            console.error('Error loading texture:', error);
            return null;
        }
    }
    
    getDefaultMissionConfig(missionId) {
        const configs = {
            msl: {
                name: "Mars Science Laboratory",
                vehicle: "msl_aeroshell",
                planet: "mars",
                entryInterface: {
                    altitude: 132000,
                    velocity: 5800,
                    angle: -15.5
                },
                phases: [
                    { name: "Entry Interface", startTime: 0, altitude: 132000 },
                    { name: "Peak Heating", startTime: 80, altitude: 60000 },
                    { name: "Peak Deceleration", startTime: 150, altitude: 25000 },
                    { name: "Parachute Deploy", startTime: 260.65, altitude: 13462.9 }
                ],
                landingSite: {
                    name: "Gale Crater",
                    latitude: -5.4,
                    longitude: 137.8
                }
            },
            perseverance: {
                name: "Mars 2020 Perseverance",
                vehicle: "m2020_aeroshell",
                planet: "mars",
                entryInterface: {
                    altitude: 132000,
                    velocity: 5400,
                    angle: -15.0
                },
                phases: [
                    { name: "Entry Interface", startTime: 0, altitude: 132000 },
                    { name: "Peak Heating", startTime: 75, altitude: 65000 },
                    { name: "Peak Deceleration", startTime: 145, altitude: 28000 },
                    { name: "Parachute Deploy", startTime: 255, altitude: 11000 }
                ],
                landingSite: {
                    name: "Jezero Crater",
                    latitude: 18.38,
                    longitude: 77.58
                }
            }
        };
        
        return configs[missionId] || configs.msl;
    }
    
    clearCache() {
        // Clean up blob URLs
        this.cache.forEach((value, key) => {
            if (typeof value === 'string' && value.startsWith('blob:')) {
                URL.revokeObjectURL(value);
            }
        });
        
        this.cache.clear();
    }
    
    preloadAssets(missionId) {
        const promises = [];
        
        // Preload mission config
        promises.push(this.loadMissionConfig(missionId));
        
        // Preload common textures
        const textures = ['mars_surface.jpg', 'stars_milkyway.jpg', 'heat_gradient.png'];
        textures.forEach(texture => {
            promises.push(this.loadTexture(texture).catch(() => null));
        });
        
        return Promise.all(promises);
    }
}

export default DataManager;