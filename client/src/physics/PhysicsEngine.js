/**
 * PhysicsEngine.js
 * Abstraction layer for Mars EDL physics calculations
 * Provides consistent interface for frontend, backend, and hybrid modes
 */

import * as THREE from '/node_modules/three/build/three.module.js';
import { BackendAPIClient } from '../services/BackendAPIClient.js';

export class PhysicsEngine {
    constructor(config = {}) {
        this.config = {
            // Mars physical constants
            marsRadius: 3390000, // meters
            scaleHeight: 11.1,   // km, atmospheric scale height
            surfaceDensity: 0.020, // kg/m³, atmospheric density at surface

            // MSL mission parameters
            liftToDragRatio: 0.13,  // L/D ratio for MSL capsule
            capsuleMass: 899,       // kg
            referenceArea: 15.9,    // m², MSL capsule reference area

            // Coordinate system
            coordinateSystem: 'J2000_mars_centered',
            timeStep: 0.1,

            // Visualization scale
            SCALE_FACTOR: 0.00001, // Convert meters to visualization units

            ...config
        };

        // Pre-calculated constants for performance
        this.constants = {
            gravityMars: 3.71,     // m/s²
            gravityConstant: 6.67430e-11, // m³/kg/s²
            marsMass: 6.4171e23,   // kg
            atmosphericScale: this.config.scaleHeight * 1000 // convert to meters
        };

        // Backend integration
        this.preferBackend = true;
        this.backendAvailable = true;
        this.backendAPI = new BackendAPIClient({
            baseURL: config.backendUrl || window.location.origin,
            timeout: 10000,
            retryAttempts: 2,
            cacheEnabled: true,
            enableFallback: true
        });
    }

    /**
     * Calculate trajectory points based on initial conditions and bank angle profile
     * Now tries backend first, falls back to local calculation
     * @param {Object} parameters - Initial conditions and trajectory parameters
     * @returns {Array} Array of trajectory points with position, velocity, and physics data
     */
    async calculateTrajectory(parameters = {}) {
        // Try backend first if available and preferred
        if (this.preferBackend && this.backendAvailable) {
            try {
                console.log('[PhysicsEngine] Attempting backend trajectory calculation');
                const backendResult = await this.calculateTrajectoryFromBackend(parameters);
                if (backendResult) {
                    console.log('[PhysicsEngine] Using backend trajectory');
                    return backendResult;
                }
            } catch (error) {
                console.warn('[PhysicsEngine] Backend calculation failed, falling back to local:', error.message);
                this.backendAvailable = false;
            }
        }

        // Fallback to local calculation
        console.log('[PhysicsEngine] Using local trajectory calculation');
        return this.calculateTrajectoryLocal(parameters);
    }

    /**
     * Calculate trajectory from backend server
     * @param {Object} parameters - Trajectory parameters
     * @returns {Array|null} Backend trajectory or null if failed
     */
    async calculateTrajectoryFromBackend(parameters) {
        try {
            const response = await fetch(`${this.backendAPI.baseURL}/api/trajectory/calculate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...parameters,
                    coordinate_system: 'J2000_mars_centered',
                    physics_model: 'mars_edl',
                    time_step: parameters.timeStep || this.config.timeStep,
                    mars_radius: this.config.marsRadius,
                    scale_factor: this.config.SCALE_FACTOR
                })
            });

            if (!response.ok) {
                throw new Error(`Backend returned ${response.status}`);
            }

            const data = await response.json();

            // Transform backend data to expected format
            if (data.trajectory && Array.isArray(data.trajectory)) {
                return data.trajectory.map(point => ({
                    time: point.time,
                    position: new THREE.Vector3(point.position.x, point.position.y, point.position.z),
                    velocity: new THREE.Vector3(point.velocity.x, point.velocity.y, point.velocity.z),
                    altitude: point.altitude,
                    velocityMagnitude: point.velocityMagnitude,
                    distanceToLanding: point.distanceToLanding,
                    bankAngle: point.bankAngle,
                    ...point.physics
                }));
            }

            return null;
        } catch (error) {
            console.warn('[PhysicsEngine] Backend trajectory calculation error:', error);
            return null;
        }
    }

    /**
     * Local trajectory calculation (original implementation)
     * @param {Object} parameters - Initial conditions and trajectory parameters
     * @returns {Array} Array of trajectory points
     */
    calculateTrajectoryLocal(parameters = {}) {
        const {
            initialPosition = new THREE.Vector3(0, 50, 0),
            initialVelocity = new THREE.Vector3(0, -1, 0),
            duration = 260.65,
            timeStep = this.config.timeStep,
            bankAngleProfile = null
        } = parameters;

        const trajectory = [];
        const totalSteps = Math.floor(duration / timeStep);

        let position = initialPosition.clone();
        let velocity = initialVelocity.clone();

        for (let i = 0; i <= totalSteps; i++) {
            const time = i * timeStep;
            const bankAngle = this.getBankAngleAtTime(time, bankAngleProfile);

            // Calculate physics at current state
            const physicsData = this.calculatePhysicsAtPoint(position, velocity, bankAngle, time);

            // Store trajectory point
            trajectory.push({
                time,
                position: position.clone().multiplyScalar(this.config.SCALE_FACTOR),
                velocity: velocity.clone(),
                altitude: physicsData.altitude,
                velocityMagnitude: velocity.length(),
                distanceToLanding: physicsData.distanceToSurface,
                bankAngle,
                ...physicsData
            });

            // Integrate motion for next step
            if (i < totalSteps) {
                const acceleration = this.calculateAcceleration(position, velocity, bankAngle, physicsData);

                // Verlet integration for better stability
                velocity.add(acceleration.clone().multiplyScalar(timeStep));
                position.add(velocity.clone().multiplyScalar(timeStep));
            }
        }

        return trajectory;
    }

    /**
     * Modify existing trajectory with new bank angle from current time
     * Now tries backend first, falls back to local modification
     * @param {Array} baseTrajectory - Original trajectory points
     * @param {Object} parameters - Modification parameters
     * @returns {Array} Modified trajectory
     */
    async modifyTrajectory(baseTrajectory, parameters = {}) {
        // Try backend modification first
        if (this.preferBackend && this.backendAvailable) {
            try {
                console.log('[PhysicsEngine] Attempting backend trajectory modification');
                const backendResult = await this.modifyTrajectoryFromBackend(baseTrajectory, parameters);
                if (backendResult) {
                    console.log('[PhysicsEngine] Using backend modified trajectory');
                    return backendResult;
                }
            } catch (error) {
                console.warn('[PhysicsEngine] Backend modification failed, falling back to local:', error.message);
                this.backendAvailable = false;
            }
        }

        // Fallback to local modification
        console.log('[PhysicsEngine] Using local trajectory modification');
        return this.modifyTrajectoryLocal(baseTrajectory, parameters);
    }

    /**
     * Modify trajectory using backend server
     * @param {Array} baseTrajectory - Original trajectory
     * @param {Object} parameters - Modification parameters
     * @returns {Array|null} Modified trajectory or null if failed
     */
    async modifyTrajectoryFromBackend(baseTrajectory, parameters) {
        const result = await this.backendAPI.modifyTrajectoryWithBankAngle(
            parameters.currentTime || 0,
            parameters.bankAngle || 0,
            parameters.liftForceDirection,
            { trajectory: baseTrajectory, ...parameters }
        );

        if (result.success && result.data && result.data.trajectory) {
            // Transform backend data to expected format
            return result.data.trajectory.map(point => ({
                ...point,
                position: new THREE.Vector3(point.position.x, point.position.y, point.position.z),
                velocity: new THREE.Vector3(point.velocity.x, point.velocity.y, point.velocity.z)
            }));
        }

        return null;
    }

    /**
     * Local trajectory modification (original implementation)
     * @param {Array} baseTrajectory - Original trajectory points
     * @param {Object} parameters - Modification parameters
     * @returns {Array} Modified trajectory
     */
    modifyTrajectoryLocal(baseTrajectory, parameters = {}) {
        const {
            currentTime = 0,
            bankAngle = 0,
            liftForceDirection = null,
            realTimeModifications = true
        } = parameters;

        if (!baseTrajectory || baseTrajectory.length === 0) {
            return baseTrajectory;
        }

        // Find current index in trajectory
        let currentIndex = 0;
        for (let i = 0; i < baseTrajectory.length - 1; i++) {
            if (baseTrajectory[i].time <= currentTime && baseTrajectory[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }

        // Calculate lift force direction if not provided
        let liftDirection = liftForceDirection;
        if (!liftDirection && baseTrajectory[currentIndex]) {
            liftDirection = this.calculateLiftDirection(
                baseTrajectory[currentIndex].position,
                baseTrajectory[currentIndex].velocity,
                bankAngle
            );
        }

        // Apply physics-based modification
        return this.applyBankAngleEffect(baseTrajectory, currentIndex, bankAngle, liftDirection, realTimeModifications);
    }

    /**
     * Calculate physics parameters at a specific point
     * @param {THREE.Vector3} position - Position in Mars-centered coordinates (meters)
     * @param {THREE.Vector3} velocity - Velocity vector (m/s)
     * @param {number} bankAngle - Bank angle in degrees
     * @param {number} time - Current time
     * @returns {Object} Physics data including forces, density, etc.
     */
    calculatePhysicsAtPoint(position, velocity, bankAngle, time) {
        const distanceFromCenter = position.length();
        const altitude = (distanceFromCenter - this.config.marsRadius) / 1000; // km

        // Atmospheric density (exponential atmosphere model)
        const densityRatio = Math.exp(-Math.max(0, altitude * 1000) / this.constants.atmosphericScale);
        const atmosphericDensity = this.config.surfaceDensity * densityRatio;

        // Dynamic pressure
        const velocityMagnitude = velocity.length();
        const dynamicPressure = 0.5 * atmosphericDensity * velocityMagnitude * velocityMagnitude;

        // Calculate Mach number
        const soundSpeed = this.calculateSoundSpeed(altitude);
        const mach = velocityMagnitude / soundSpeed;

        // Get Mach-dependent aerodynamic coefficients
        const dragCoefficient = this.calculateDragCoefficient(mach);
        const liftCoefficient = this.calculateLiftCoefficient(mach);

        // Aerodynamic forces with proper coefficients
        const dragForce = dynamicPressure * this.config.referenceArea * dragCoefficient;
        const liftForce = dynamicPressure * this.config.referenceArea * liftCoefficient *
                         Math.sin(THREE.MathUtils.degToRad(Math.abs(bankAngle)));

        // Gravity
        const gravityAcceleration = this.constants.gravityMars * Math.pow(this.config.marsRadius / distanceFromCenter, 2);

        return {
            altitude,
            distanceToSurface: altitude,
            atmosphericDensity,
            dynamicPressure,
            dragForce,
            liftForce,
            dragCoefficient,
            liftCoefficient,
            gravityAcceleration,
            mach,
            densityRatio
        };
    }

    /**
     * Calculate drag coefficient based on Mach number
     * Uses realistic Mars entry vehicle aerodynamics
     * @param {number} mach - Mach number
     * @returns {number} Drag coefficient
     */
    calculateDragCoefficient(mach) {
        // MSL-type blunt body aerodynamics
        if (mach < 0.5) {
            // Subsonic - low drag
            return 0.5;
        } else if (mach < 0.9) {
            // Subsonic approaching transonic
            return 0.5 + (mach - 0.5) * 1.0;
        } else if (mach < 1.2) {
            // Transonic region - drag peak
            const t = (mach - 0.9) / 0.3;
            return 0.9 + t * 0.5; // Peak at ~1.4
        } else if (mach < 5.0) {
            // Supersonic - drag decreases
            return 1.4 - (mach - 1.2) / 3.8 * 0.5;
        } else {
            // Hypersonic - relatively constant (MSL regime)
            // MSL entry at Mach 24: Cd ≈ 1.7
            return 1.7;
        }
    }

    /**
     * Calculate lift coefficient based on Mach number and angle of attack
     * For MSL-type lifting body at trim AoA
     * @param {number} mach - Mach number
     * @returns {number} Lift coefficient
     */
    calculateLiftCoefficient(mach) {
        // At trim AoA (-16°), L/D = 0.24 for MSL
        const dragCoeff = this.calculateDragCoefficient(mach);
        const liftToDragRatio = this.config.liftToDragRatio; // 0.13 for simplified model

        // Cl = (L/D) * Cd
        return liftToDragRatio * dragCoeff;
    }

    /**
     * Calculate total acceleration at current state
     * @param {THREE.Vector3} position - Current position
     * @param {THREE.Vector3} velocity - Current velocity
     * @param {number} bankAngle - Current bank angle
     * @param {Object} physicsData - Pre-calculated physics data
     * @returns {THREE.Vector3} Total acceleration vector
     */
    calculateAcceleration(position, velocity, bankAngle, physicsData) {
        const acceleration = new THREE.Vector3();

        // Gravity (toward Mars center)
        const gravityDirection = position.clone().normalize().multiplyScalar(-1);
        const gravityAccel = gravityDirection.multiplyScalar(physicsData.gravityAcceleration);
        acceleration.add(gravityAccel);

        // Atmospheric drag (opposite to velocity)
        if (velocity.length() > 0) {
            const dragDirection = velocity.clone().normalize().multiplyScalar(-1);
            const dragAccel = dragDirection.multiplyScalar(physicsData.dragForce / this.config.capsuleMass);
            acceleration.add(dragAccel);

            // Lift force (perpendicular to velocity, affected by bank angle)
            if (Math.abs(bankAngle) > 0.001) {
                const liftDirection = this.calculateLiftDirection(position, velocity, bankAngle);
                const liftAccel = liftDirection.multiplyScalar(physicsData.liftForce / this.config.capsuleMass);
                acceleration.add(liftAccel);
            }
        }

        return acceleration;
    }

    /**
     * Calculate lift force direction based on bank angle
     * @param {THREE.Vector3} position - Current position
     * @param {THREE.Vector3} velocity - Current velocity
     * @param {number} bankAngle - Bank angle in degrees
     * @returns {THREE.Vector3} Normalized lift direction vector
     */
    calculateLiftDirection(position, velocity, bankAngle) {
        if (velocity.length() < 0.001) {
            return new THREE.Vector3(0, 1, 0); // Default upward
        }

        // Calculate orbital angular momentum vector (h = r × v)
        const angularMomentum = new THREE.Vector3();
        angularMomentum.crossVectors(position, velocity).normalize();

        // Base lift direction (perpendicular to velocity in orbital plane)
        const velocityNorm = velocity.clone().normalize();
        let liftDirection = new THREE.Vector3();
        liftDirection.crossVectors(angularMomentum, velocityNorm).normalize();

        // Apply bank angle rotation around velocity axis
        if (Math.abs(bankAngle) > 0.001) {
            const bankQuaternion = new THREE.Quaternion();
            bankQuaternion.setFromAxisAngle(velocityNorm, THREE.MathUtils.degToRad(bankAngle));
            liftDirection.applyQuaternion(bankQuaternion);
        }

        return liftDirection;
    }

    /**
     * Apply bank angle effect to trajectory
     * @param {Array} trajectory - Original trajectory points
     * @param {number} currentIndex - Index where modification starts
     * @param {number} bankAngle - Bank angle in degrees
     * @param {THREE.Vector3} liftDirection - Lift force direction
     * @param {boolean} realTime - Whether to apply real-time enhanced effects
     * @returns {Array} Modified trajectory
     */
    applyBankAngleEffect(trajectory, currentIndex, bankAngle, liftDirection, realTime = false) {
        const modifiedTrajectory = trajectory.map((point, i) => {
            if (i <= currentIndex) {
                return { ...point, position: point.position.clone() };
            }

            // Calculate effect magnitude
            const timeDelta = point.time - trajectory[currentIndex].time;
            const timeWeight = realTime ?
                Math.min(1.0, timeDelta / 30.0) :  // Faster effect for real-time
                Math.min(1.0, timeDelta / 60.0);   // Normal physics timing

            // Atmospheric effect - stronger in denser atmosphere
            const altitudeFactor = Math.exp(-Math.max(0, point.altitude) / this.config.scaleHeight);

            // Velocity-dependent effect
            const velocityFactor = Math.min(1.0, point.velocityMagnitude / 5000);

            // Bank angle effect magnitude
            const bankAngleFactor = Math.sin(THREE.MathUtils.degToRad(Math.abs(bankAngle))) *
                (realTime ? 5.0 : 2.0); // Enhanced for real-time visibility

            // Combined effect magnitude
            const effectMagnitude = timeWeight * altitudeFactor * velocityFactor * bankAngleFactor *
                (realTime ? 0.03 : 0.01); // Stronger effect for real-time

            // Apply lateral displacement
            const displacement = liftDirection.clone().multiplyScalar(effectMagnitude);

            return {
                ...point,
                position: point.position.clone().add(displacement)
            };
        });

        // Recompute derived properties for modified points
        this.recomputeTrajectoryProperties(modifiedTrajectory, currentIndex);

        return modifiedTrajectory;
    }

    /**
     * Recompute velocity and physics properties for modified trajectory
     * @param {Array} trajectory - Trajectory to recompute
     * @param {number} startIndex - Index to start recomputation from
     */
    recomputeTrajectoryProperties(trajectory, startIndex) {
        for (let i = startIndex + 1; i < trajectory.length; i++) {
            const current = trajectory[i];
            const previous = trajectory[i - 1];

            // Recalculate altitude and distance
            const unscaledPos = current.position.clone().multiplyScalar(1 / this.config.SCALE_FACTOR);
            const rawDistance = unscaledPos.length();
            current.altitude = (rawDistance - this.config.marsRadius) * 0.001; // km
            current.distanceToLanding = rawDistance * 0.001; // km

            // Recalculate velocity
            const dt = current.time - previous.time;
            if (dt > 0) {
                current.velocity = current.position.clone().sub(previous.position).divideScalar(dt);
                current.velocityMagnitude = current.velocity.length() / this.config.SCALE_FACTOR;
            } else {
                current.velocity = previous.velocity.clone();
                current.velocityMagnitude = previous.velocityMagnitude;
            }
        }
    }

    /**
     * Get bank angle at specific time from bank angle profile
     * @param {number} time - Current time
     * @param {Array|Function|null} bankAngleProfile - Bank angle profile
     * @returns {number} Bank angle in degrees
     */
    getBankAngleAtTime(time, bankAngleProfile) {
        if (!bankAngleProfile) return 0;

        if (typeof bankAngleProfile === 'function') {
            return bankAngleProfile(time);
        }

        if (Array.isArray(bankAngleProfile)) {
            // Linear interpolation between profile points
            for (let i = 0; i < bankAngleProfile.length - 1; i++) {
                const curr = bankAngleProfile[i];
                const next = bankAngleProfile[i + 1];

                if (time >= curr.time && time <= next.time) {
                    const t = (time - curr.time) / (next.time - curr.time);
                    return THREE.MathUtils.lerp(curr.bankAngle, next.bankAngle, t);
                }
            }

            // Return last value if time exceeds profile
            return bankAngleProfile[bankAngleProfile.length - 1].bankAngle;
        }

        return 0;
    }

    /**
     * Calculate speed of sound at given altitude (for Mach number)
     * @param {number} altitude - Altitude in km
     * @returns {number} Speed of sound in m/s
     */
    calculateSoundSpeed(altitude) {
        // Simplified Mars atmosphere model
        const temperature = 218 - 2.0 * altitude; // K, rough approximation
        const gasConstant = 192; // J/(kg·K) for CO2
        return Math.sqrt(1.3 * gasConstant * Math.max(150, temperature)); // m/s
    }

    /**
     * Update physics parameters for real-time modifications
     * @param {Object} parameters - New physics parameters
     * @returns {boolean} Success status
     */
    updateParameters(parameters) {
        Object.assign(this.config, parameters);

        // Recalculate derived constants if needed
        if (parameters.scaleHeight) {
            this.constants.atmosphericScale = this.config.scaleHeight * 1000;
        }

        return true;
    }

    /**
     * Get current physics configuration
     * @returns {Object} Current configuration
     */
    getConfiguration() {
        return { ...this.config, constants: { ...this.constants } };
    }

    /**
     * Validate trajectory data for physics consistency
     * @param {Array} trajectory - Trajectory to validate
     * @returns {Object} Validation result with warnings/errors
     */
    validateTrajectory(trajectory) {
        const warnings = [];
        const errors = [];

        if (!trajectory || trajectory.length === 0) {
            errors.push('Empty trajectory data');
            return { valid: false, warnings, errors };
        }

        for (let i = 0; i < trajectory.length; i++) {
            const point = trajectory[i];

            // Check required fields
            if (!point.position || !point.velocity) {
                errors.push(`Missing position or velocity at index ${i}`);
                continue;
            }

            // Check physical constraints
            if (point.altitude < -10) {
                warnings.push(`Below surface at index ${i}: altitude = ${point.altitude} km`);
            }

            if (point.velocityMagnitude > 10000) {
                warnings.push(`Very high velocity at index ${i}: ${point.velocityMagnitude} m/s`);
            }
        }

        return {
            valid: errors.length === 0,
            warnings,
            errors
        };
    }

    /**
     * Export trajectory in standardized format
     * @param {Array} trajectory - Trajectory data
     * @param {string} format - Export format ('csv', 'json')
     * @returns {string} Formatted trajectory data
     */
    exportTrajectory(trajectory, format = 'json') {
        if (format === 'csv') {
            const headers = ['time', 'x', 'y', 'z', 'vx', 'vy', 'vz', 'altitude', 'bankAngle'];
            const rows = trajectory.map(point => [
                point.time,
                point.position.x / this.config.SCALE_FACTOR,
                point.position.y / this.config.SCALE_FACTOR,
                point.position.z / this.config.SCALE_FACTOR,
                point.velocity.x,
                point.velocity.y,
                point.velocity.z,
                point.altitude,
                point.bankAngle || 0
            ]);

            return [headers, ...rows].map(row => row.join(',')).join('\n');
        }

        return JSON.stringify({
            metadata: {
                coordinate_system: this.config.coordinateSystem,
                physics_model: 'mars_edl',
                scale_factor: this.config.SCALE_FACTOR,
                generated: new Date().toISOString()
            },
            trajectory
        }, null, 2);
    }

    /**
     * Check backend availability and health
     * @returns {Promise<Object>} Health check result
     */
    async checkBackendHealth() {
        const health = await this.backendAPI.healthCheck();
        this.backendAvailable = health.success;
        return health;
    }

    /**
     * Get backend status information
     * @returns {Object} Status information
     */
    getBackendStatus() {
        return {
            available: this.backendAvailable,
            preferBackend: this.preferBackend,
            apiStatus: this.backendAPI.getStatus()
        };
    }

    /**
     * Set backend preference (enable/disable backend)
     * @param {boolean} prefer - Whether to prefer backend
     */
    setBackendPreference(prefer) {
        this.preferBackend = prefer;
        console.log(`[PhysicsEngine] Backend preference set to: ${prefer}`);
    }

    /**
     * Force update backend availability status
     * @returns {Promise<boolean>} Whether backend is available
     */
    async updateBackendAvailability() {
        const isAvailable = await this.backendAPI.isBackendAvailable();
        this.backendAvailable = isAvailable;
        console.log(`[PhysicsEngine] Backend availability updated: ${isAvailable}`);
        return isAvailable;
    }

    /**
     * Calculate atmospheric properties (supports backend)
     * @param {string} planet - Planet name
     * @param {number} altitude - Altitude in km
     * @param {number} velocity - Velocity magnitude in m/s
     * @returns {Promise<Object>} Atmospheric properties
     */
    async getAtmosphericProperties(planet, altitude, velocity) {
        // Try backend first
        if (this.preferBackend && this.backendAvailable) {
            const result = await this.backendAPI.getAtmosphericProperties(planet, altitude, velocity);
            if (result.success) {
                return result.data;
            }
        }

        // Fallback to local calculation
        const soundSpeed = this.calculateSoundSpeed(altitude);
        const densityRatio = Math.exp(-Math.max(0, altitude * 1000) / this.constants.atmosphericScale);
        const atmosphericDensity = this.config.surfaceDensity * densityRatio;
        const dynamicPressure = 0.5 * atmosphericDensity * velocity * velocity;
        const mach = velocity / soundSpeed;

        return {
            density: atmosphericDensity,
            pressure: dynamicPressure,
            soundSpeed,
            mach,
            temperature: 218 - 2.0 * altitude,
            source: 'local'
        };
    }
}