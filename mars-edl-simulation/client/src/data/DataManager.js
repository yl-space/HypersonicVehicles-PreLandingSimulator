
// client/src/data/DataManager.js

/**
 * DataManager handles all data operations including:
 * - Fetching trajectory data from server
 * - Caching for performance
 * - Real-time updates via WebSocket
 */
export class DataManager {
    constructor(apiEndpoint) {
        this.apiEndpoint = apiEndpoint;
        this.cache = new Map();
        this.websocket = null;
        
        // IndexedDB for offline support
        this.dbName = 'MarsEDLSimulation';
        this.dbVersion = 1;
        this.initDatabase();
    }
    
    async initDatabase() {
        // Open IndexedDB for local storage
        const request = indexedDB.open(this.dbName, this.dbVersion);
        
        request.onerror = () => {
            console.error('Failed to open IndexedDB');
        };
        
        request.onsuccess = (event) => {
            this.db = event.target.result;
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            // Create object stores
            if (!db.objectStoreNames.contains('trajectories')) {
                const trajectoryStore = db.createObjectStore('trajectories', { 
                    keyPath: 'id' 
                });
                trajectoryStore.createIndex('missionId', 'missionId', { unique: false });
            }
            
            if (!db.objectStoreNames.contains('missions')) {
                db.createObjectStore('missions', { keyPath: 'id' });
            }
        };
    }
    
    async fetchMissionData(missionId) {
        // Check cache first
        const cacheKey = `mission_${missionId}`;
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        try {
            // Try to fetch from server
            const response = await fetch(`${this.apiEndpoint}/missions/${missionId}`);
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            
            // Cache the result
            this.cache.set(cacheKey, data);
            
            // Store in IndexedDB for offline use
            await this.storeInDB('missions', data);
            
            return data;
        } catch (error) {
            // Fall back to IndexedDB if offline
            console.warn('Fetching from network failed, trying local storage:', error);
            return await this.getFromDB('missions', missionId);
        }
    }
    
    async fetchTrajectoryData(missionId, options = {}) {
        const { 
            startTime = 0, 
            endTime = Infinity, 
            resolution = 1 
        } = options;
        
        try {
            const params = new URLSearchParams({
                missionId,
                startTime,
                endTime,
                resolution
            });
            
            const response = await fetch(
                `${this.apiEndpoint}/trajectories?${params}`
            );
            
            if (!response.ok) throw new Error('Network response was not ok');
            
            const data = await response.json();
            
            // Process trajectory data
            const processed = this.processTrajectoryData(data);
            
            // Store for offline use
            await this.storeInDB('trajectories', {
                id: `${missionId}_${startTime}_${endTime}`,
                missionId,
                data: processed
            });
            
            return processed;
        } catch (error) {
            console.error('Failed to fetch trajectory data:', error);
            throw error;
        }
    }
    
    processTrajectoryData(rawData) {
        // Convert raw data to Three.js friendly format
        return rawData.map(point => ({
            position: new THREE.Vector3(
                point.x * 0.0001,  // Scale to scene units
                point.y * 0.0001,
                point.z * 0.0001
            ),
            velocity: point.velocity,
            altitude: point.altitude,
            time: point.time,
            phase: point.phase
        }));
    }
    
    setupWebSocket(url) {
        // Real-time updates for live missions
        this.websocket = new WebSocket(url);
        
        this.websocket.onopen = () => {
            console.log('WebSocket connected');
        };
        
        this.websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleRealtimeUpdate(data);
        };
        
        this.websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        this.websocket.onclose = () => {
            console.log('WebSocket disconnected');
            // Implement reconnection logic
            setTimeout(() => this.setupWebSocket(url), 5000);
        };
    }
    
    handleRealtimeUpdate(data) {
        // Emit event for components to react
        window.dispatchEvent(new CustomEvent('telemetryUpdate', { 
            detail: data 
        }));
    }
    
    async storeInDB(storeName, data) {
        if (!this.db) return;
        
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        store.put(data);
    }
    
    async getFromDB(storeName, key) {
        if (!this.db) return null;
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);
            
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}