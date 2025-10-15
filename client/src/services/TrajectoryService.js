/**
 * TrajectoryService.js
 * Backend-only trajectory calculation service
 * Communicates with sim-server FastAPI backend on port 3010
 */

import * as THREE from 'three';

export class TrajectoryService {
    constructor(config = {}) {
        this.config = {
            backendUrl: config.backendUrl || 'http://localhost:3010',
            timeout: config.timeout || 30000, // 30 seconds for physics calculations
            marsRadius: 3390000, // meters
            scaleFactorVisualization: 0.00001, // Convert meters to visualization units
            ...config
        };

        // Store current simulation parameters
        this.currentParams = {
            planet: { planet_name: 'mars' },
            init: {
                h0: 124999,                    // [m] Entry altitude
                vel0: 6083.6,                  // [m/s] Entry velocity
                theta0: -1.376,                // [rad] Longitude (-78.8618°)
                phi0: 0.473,                   // [rad] Latitude (27.1050°)
                gamma0: -0.270,                // [rad] Flight path angle (-15.5°)
                psi0: 0.0                      // [rad] Heading angle
            },
            vehicle: { vehicle_name: 'default' },
            control: { bank_angle: 0.0 }       // [rad] Bank angle
        };
    }

    /**
     * Calculate complete trajectory from backend
     * @param {Object} params - Simulation parameters 
     * @returns {Promise<Array>} Trajectory points array
     */
    async calculateTrajectory(params = {}) {
        // Merge provided params with current params
        if (params.init) {
            this.currentParams.init = { ...this.currentParams.init, ...params.init };
        }
        if (params.control) {
            this.currentParams.control = { ...this.currentParams.control, ...params.control };
        }
        if (params.planet) {
            this.currentParams.planet = { ...this.currentParams.planet, ...params.planet };
        }
        if (params.vehicle) {
            this.currentParams.vehicle = { ...this.currentParams.vehicle, ...params.vehicle };
        }

        console.log('[TrajectoryService] Calling backend with params:', this.currentParams);

        try {
            const response = await fetch(`${this.config.backendUrl}/high-fidelity/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...this.currentParams,
                    serialize_arrow: false  // Use JSON format, not Arrow
                }),
                signal: AbortSignal.timeout(this.config.timeout)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Backend returned ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            console.log('[TrajectoryService] Received backend data:', {
                points: data.time_s?.length || 0,
                duration: data.time_s?.[data.time_s.length - 1] || 0
            });

            // Transform backend format to frontend format
            const trajectory = this.transformBackendResponse(data);

            return trajectory;

        } catch (error) {
            console.error('[TrajectoryService] Backend call failed:', error);
            throw new Error(`Failed to calculate trajectory from backend: ${error.message}`);
        }
    }

    /**
     * Modify trajectory with new bank angle
     * Recalculates entire trajectory from backend with new control parameters
     * @param {number} bankAngleDeg - Bank angle in degrees
     * @returns {Promise<Array>} New trajectory with modified bank angle
     */
    async modifyTrajectoryWithBankAngle(bankAngleDeg) {
        // Convert degrees to radians for backend
        const bankAngleRad = THREE.MathUtils.degToRad(bankAngleDeg);

        console.log(`[TrajectoryService] Modifying trajectory with bank angle: ${bankAngleDeg}° (${bankAngleRad.toFixed(4)} rad)`);

        // Update control parameters and recalculate
        return await this.calculateTrajectory({
            control: { bank_angle: bankAngleRad }
        });
    }

    /**
     * Transform backend response format to frontend trajectory format
     * Backend format: { time_s, x_m, y_m, z_m, vx_m_s, vy_m_s, vz_m_s }
     * Frontend format: Array of { time, position: Vector3, velocity: Vector3, ... }
     * @param {Object} data - Backend response data
     * @returns {Array} Transformed trajectory points
     */
    transformBackendResponse(data) {
        if (!data || !data.time_s || !data.x_m) {
            throw new Error('Invalid backend response format');
        }

        const trajectory = [];
        const numPoints = data.time_s.length;

        for (let i = 0; i < numPoints; i++) {
            // Position in meters (Mars-centered J2000 inertial)
            const posMeters = new THREE.Vector3(
                data.x_m[i],
                data.y_m[i],
                data.z_m[i]
            );

            // Velocity in m/s
            const velMetersPerSec = new THREE.Vector3(
                data.vx_m_s[i],
                data.vy_m_s[i],
                data.vz_m_s[i]
            );

            // Calculate derived quantities
            const distanceFromCenter = posMeters.length();
            const altitude = (distanceFromCenter - this.config.marsRadius) / 1000; // km
            const velocityMagnitude = velMetersPerSec.length();

            // Scale position for visualization
            const posScaled = posMeters.clone().multiplyScalar(this.config.scaleFactorVisualization);

            trajectory.push({
                time: data.time_s[i],
                position: posScaled,                    // Scaled for Three.js rendering
                velocity: velMetersPerSec,              // m/s
                altitude: altitude,                     // km above surface
                velocityMagnitude: velocityMagnitude,   // m/s
                distanceToLanding: altitude,            // km (approximate)
                bankAngle: this.currentParams.control.bank_angle * (180 / Math.PI), // degrees

                positionMeters: posMeters
            });
        }

        console.log('[TrajectoryService] Transformed trajectory:', {
            points: trajectory.length,
            duration: trajectory[trajectory.length - 1].time.toFixed(2) + 's',
            initialAltitude: trajectory[0].altitude.toFixed(2) + 'km',
            finalAltitude: trajectory[trajectory.length - 1].altitude.toFixed(2) + 'km',
            initialVelocity: (trajectory[0].velocityMagnitude / 1000).toFixed(2) + 'km/s',
            finalVelocity: (trajectory[trajectory.length - 1].velocityMagnitude / 1000).toFixed(2) + 'km/s'
        });

        return trajectory;
    }

    /**
     * Update initial conditions
     * @param {Object} initParams - Initial condition parameters
     */
    setInitialConditions(initParams) {
        this.currentParams.init = { ...this.currentParams.init, ...initParams };
        console.log('[TrajectoryService] Updated initial conditions:', this.currentParams.init);
    }

    /**
     * Get current simulation parameters
     * @returns {Object} Current parameters
     */
    getCurrentParams() {
        return { ...this.currentParams };
    }

    /**
     * Check backend health/availability
     * @returns {Promise<boolean>}
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.config.backendUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            return response.ok;
        } catch (error) {
            console.warn('[TrajectoryService] Backend health check failed:', error.message);
            return false;
        }
    }

    /**
     * Get backend status information
     * @returns {Promise<Object>} Status information
     */
    async getBackendStatus() {
        const isAvailable = await this.checkBackendHealth();
        return {
            available: isAvailable,
            backendUrl: this.config.backendUrl,
            currentBankAngle: this.currentParams.control.bank_angle * (180 / Math.PI), // degrees
            message: isAvailable ?
                'Backend connected' :
                `Backend not available at ${this.config.backendUrl}`
        };
    }
}
