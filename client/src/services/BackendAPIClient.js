/**
 * BackendAPIClient.js
 * Centralized client for all backend API communications
 * Handles requests to server endpoints with automatic fallback mechanism
 */

export class BackendAPIClient {
    constructor(config = {}) {
        this.baseURL = config.baseURL || window.location.origin;
        this.timeout = config.timeout || 10000; // 10 seconds default
        this.retryAttempts = config.retryAttempts || 2;
        this.enableFallback = config.enableFallback !== false; // Default true

        // Track backend availability
        this.backendAvailable = true;
        this.lastHealthCheck = null;

        // Request cache for optimization
        this.cache = new Map();
        this.cacheEnabled = config.cacheEnabled !== false;
        this.cacheTTL = config.cacheTTL || 60000; // 1 minute default
    }

    /**
     * Generic request handler with timeout and retry logic
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body || {})}`;

        // Check cache first
        if (this.cacheEnabled && options.method === 'GET') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                console.log(`[BackendAPI] Cache hit: ${endpoint}`);
                return cached;
            }
        }

        // Attempt request with retries
        for (let attempt = 0; attempt <= this.retryAttempts; attempt++) {
            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json',
                        ...options.headers
                    }
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();

                // Cache successful GET requests
                if (this.cacheEnabled && options.method === 'GET') {
                    this.setCache(cacheKey, data);
                }

                this.backendAvailable = true;
                return data;

            } catch (error) {
                console.warn(`[BackendAPI] Attempt ${attempt + 1} failed for ${endpoint}:`, error.message);

                if (attempt === this.retryAttempts) {
                    this.backendAvailable = false;
                    throw error;
                }

                // Wait before retry (exponential backoff)
                await this.delay(Math.pow(2, attempt) * 1000);
            }
        }
    }

    // ==================== TRAJECTORY APIs ====================

    /**
     * Get trajectory data from backend
     * GET /api/trajectories/:filename
     */
    async getTrajectory(filename, options = {}) {
        try {
            const queryParams = new URLSearchParams({
                format: options.format || 'json',
                ...(options.limit && { limit: options.limit }),
                ...(options.offset && { offset: options.offset })
            });

            const data = await this.request(
                `/api/trajectories/${filename}?${queryParams}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get trajectory:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Get trajectory data in a time range
     * GET /api/data/msl-trajectory/range
     */
    async getTrajectoryRange(startTime, endTime, limit = 1000) {
        try {
            const queryParams = new URLSearchParams({
                start: startTime,
                end: endTime,
                limit: limit
            });

            const data = await this.request(
                `/api/data/msl-trajectory/range?${queryParams}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get trajectory range:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Get trajectory data at specific time
     * GET /api/data/msl-trajectory/at-time
     */
    async getTrajectoryAtTime(time) {
        try {
            const data = await this.request(
                `/api/data/msl-trajectory/at-time?time=${time}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get trajectory at time:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Get interpolated trajectory position at specific time
     * GET /api/trajectories/:filename/interpolate
     */
    async getInterpolatedPosition(filename, time) {
        try {
            const data = await this.request(
                `/api/trajectories/${filename}/interpolate?time=${time}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get interpolated position:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Analyze trajectory data
     * POST /api/trajectories/analyze
     */
    async analyzeTrajectory(filename, startTime, endTime) {
        try {
            const data = await this.request(
                '/api/trajectories/analyze',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        filename,
                        startTime,
                        endTime
                    })
                }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to analyze trajectory:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    // ==================== MISSION APIs ====================

    /**
     * Get mission configuration
     * GET /api/missions/:id
     */
    async getMissionConfig(missionId = 'msl') {
        try {
            const data = await this.request(
                `/api/missions/${missionId}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get mission config:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Get mission phases
     * GET /api/missions/:id/phases
     */
    async getMissionPhases(missionId = 'msl') {
        try {
            const data = await this.request(
                `/api/missions/${missionId}/phases`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get mission phases:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    // ==================== TELEMETRY APIs ====================

    /**
     * Send telemetry data to backend
     * POST /api/telemetry
     */
    async sendTelemetry(telemetryData) {
        try {
            const data = await this.request(
                '/api/telemetry',
                {
                    method: 'POST',
                    body: JSON.stringify(telemetryData)
                }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to send telemetry:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    /**
     * Get latest telemetry for mission
     * GET /api/telemetry/mission/:id/latest
     */
    async getLatestTelemetry(missionId = 'msl') {
        try {
            const data = await this.request(
                `/api/telemetry/mission/${missionId}/latest`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.error('[BackendAPI] Failed to get latest telemetry:', error);
            return {
                success: false,
                source: 'backend',
                error: error.message
            };
        }
    }

    // ==================== PHYSICS APIs (Future Implementation) ====================
    // These endpoints don't exist yet on backend, but client is ready

    /**
     * Calculate physics forces (Future backend implementation)
     * POST /api/physics/forces
     */
    async calculatePhysicsForces(vehicleState, planetData, controls) {
        try {
            const data = await this.request(
                '/api/physics/forces',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        vehicleState,
                        planetData,
                        controls
                    })
                }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.warn('[BackendAPI] Physics forces endpoint not available, will use fallback');
            return {
                success: false,
                source: 'backend',
                error: error.message,
                useFallback: true
            };
        }
    }

    /**
     * Calculate atmospheric properties (Future backend implementation)
     * GET /api/physics/atmosphere
     */
    async getAtmosphericProperties(planet, altitude, velocity) {
        try {
            const queryParams = new URLSearchParams({
                planet,
                altitude,
                velocity
            });

            const data = await this.request(
                `/api/physics/atmosphere?${queryParams}`,
                { method: 'GET' }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.warn('[BackendAPI] Atmospheric properties endpoint not available, will use fallback');
            return {
                success: false,
                source: 'backend',
                error: error.message,
                useFallback: true
            };
        }
    }

    /**
     * Modify trajectory with bank angle (Future backend implementation)
     * POST /api/trajectory/modify
     */
    async modifyTrajectoryWithBankAngle(currentTime, bankAngle, liftDirection, trajectoryData) {
        try {
            const data = await this.request(
                '/api/trajectory/modify',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        currentTime,
                        bankAngle,
                        liftDirection,
                        trajectoryData
                    })
                }
            );

            return {
                success: true,
                source: 'backend',
                data: data
            };
        } catch (error) {
            console.warn('[BackendAPI] Trajectory modification endpoint not available, will use fallback');
            return {
                success: false,
                source: 'backend',
                error: error.message,
                useFallback: true
            };
        }
    }

    // ==================== HEALTH & UTILITY ====================

    /**
     * Check backend health
     * GET /api/health
     */
    async healthCheck() {
        try {
            const data = await this.request('/api/health', { method: 'GET' });
            this.lastHealthCheck = Date.now();
            this.backendAvailable = true;
            return {
                success: true,
                data: data
            };
        } catch (error) {
            this.backendAvailable = false;
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check if backend is available
     */
    async isBackendAvailable() {
        // Return cached status if checked recently (within 30 seconds)
        if (this.lastHealthCheck && (Date.now() - this.lastHealthCheck) < 30000) {
            return this.backendAvailable;
        }

        const health = await this.healthCheck();
        return health.success;
    }

    // ==================== CACHE MANAGEMENT ====================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;

        const { data, timestamp } = cached;
        const isExpired = Date.now() - timestamp > this.cacheTTL;

        if (isExpired) {
            this.cache.delete(key);
            return null;
        }

        return data;
    }

    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    // ==================== UTILITIES ====================

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get backend status
     */
    getStatus() {
        return {
            available: this.backendAvailable,
            lastHealthCheck: this.lastHealthCheck,
            cacheSize: this.cache.size,
            baseURL: this.baseURL
        };
    }
}
