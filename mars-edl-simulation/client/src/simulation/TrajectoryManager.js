import * as THREE from 'three';

/**
 * Trajectory Manager
 * 
 * Handles:
 * 1. Real-time trajectory calculations
 * 2. Landing predictions
 * 3. Mission phase transitions
 * 4. Trajectory optimization
 */
export class TrajectoryManager {
    constructor() {
        this.currentPlanet = null;
        this.vehicleState = null;
        
        // Trajectory data
        this.trajectoryHistory = [];
        this.predictedTrajectory = [];
        this.maxHistoryLength = 1000;
        
        // Mission parameters
        this.landingTarget = new THREE.Vector3();
        this.missionPhases = {
            cruise: { startTime: 0, endTime: 0 },
            entry: { startTime: 0, endTime: 0 },
            descent: { startTime: 0, endTime: 0 },
            landing: { startTime: 0, endTime: 0 }
        };
        
        // Current phase
        this.currentPhase = 'cruise';
        
        // Prediction settings
        this.predictionTimeHorizon = 300; // seconds
        this.predictionTimeStep = 1; // seconds
        
        // Optimization parameters
        this.optimalEntryAngle = 15; // degrees
        this.optimalEntryVelocity = 5000; // m/s
        this.maxGForce = 10; // G
        this.maxHeatingRate = 1000; // W/m²
    }
    
    init(vehicleState, planet) {
        this.vehicleState = vehicleState;
        this.currentPlanet = planet;
        
        // Set landing target (opposite side of planet from entry)
        this.setLandingTarget();
        
        // Initialize trajectory history
        this.trajectoryHistory = [];
        
        console.log('Trajectory Manager initialized');
    }
    
    setPlanet(planet) {
        this.currentPlanet = planet;
        this.setLandingTarget();
    }
    
    setLandingTarget() {
        if (!this.currentPlanet) return;
        
        // Set landing target to a point on the planet surface
        // For simplicity, we'll set it to a fixed point
        const targetLatitude = 0; // Equator
        const targetLongitude = 0; // Prime meridian
        
        this.landingTarget.set(
            this.currentPlanet.radius * Math.cos(targetLatitude) * Math.cos(targetLongitude),
            0,
            this.currentPlanet.radius * Math.cos(targetLatitude) * Math.sin(targetLongitude)
        );
    }
    
    /**
     * Update trajectory based on current vehicle state
     */
    updateTrajectory(vehicleState) {
        // Add current state to history
        const trajectoryPoint = {
            timestamp: Date.now(),
            position: vehicleState.position.clone(),
            velocity: vehicleState.velocity.clone(),
            altitude: vehicleState.altitude,
            phase: this.currentPhase
        };
        
        this.trajectoryHistory.push(trajectoryPoint);
        
        // Limit history size
        if (this.trajectoryHistory.length > this.maxHistoryLength) {
            this.trajectoryHistory.shift();
        }
        
        // Update current phase
        this.updateMissionPhase(vehicleState);
        
        // Update predicted trajectory
        this.updatePredictedTrajectory(vehicleState);
    }
    
    /**
     * Update mission phase based on vehicle state
     */
    updateMissionPhase(vehicleState) {
        const altitude = vehicleState.altitude;
        const velocity = vehicleState.velocity.length();
        
        let newPhase = this.currentPhase;
        
        if (this.currentPhase === 'cruise') {
            // Transition to entry when entering atmosphere
            if (altitude < this.currentPlanet.atmosphereHeight) {
                newPhase = 'entry';
                this.missionPhases.entry.startTime = Date.now();
            }
        } else if (this.currentPhase === 'entry') {
            // Transition to descent when velocity drops significantly
            if (velocity < this.optimalEntryVelocity * 0.5) {
                newPhase = 'descent';
                this.missionPhases.descent.startTime = Date.now();
            }
        } else if (this.currentPhase === 'descent') {
            // Transition to landing when close to surface
            if (altitude < 1000) {
                newPhase = 'landing';
                this.missionPhases.landing.startTime = Date.now();
            }
        }
        
        if (newPhase !== this.currentPhase) {
            this.missionPhases[this.currentPhase].endTime = Date.now();
            this.currentPhase = newPhase;
            console.log(`Mission phase changed to: ${newPhase}`);
        }
    }
    
    /**
     * Update predicted trajectory
     */
    updatePredictedTrajectory(vehicleState) {
        this.predictedTrajectory = this.predictTrajectory(vehicleState);
    }
    
    /**
     * Predict trajectory forward in time
     */
    predictTrajectory(vehicleState, timeHorizon = null) {
        if (!timeHorizon) {
            timeHorizon = this.predictionTimeHorizon;
        }
        
        const trajectory = [];
        const timeStep = this.predictionTimeStep;
        
        // Clone current state for prediction
        let predictedState = {
            position: vehicleState.position.clone(),
            velocity: vehicleState.velocity.clone(),
            mass: vehicleState.mass,
            altitude: vehicleState.altitude
        };
        
        // Simulate forward in time
        for (let time = 0; time < timeHorizon; time += timeStep) {
            // Calculate forces (assume no control inputs for prediction)
            const forces = this.calculatePredictedForces(predictedState);
            
            // Update state using simple Euler integration
            const acceleration = forces.clone().divideScalar(predictedState.mass);
            predictedState.velocity.add(acceleration.clone().multiplyScalar(timeStep));
            predictedState.position.add(predictedState.velocity.clone().multiplyScalar(timeStep));
            predictedState.altitude = predictedState.position.length() - this.currentPlanet.radius;
            
            // Store trajectory point
            trajectory.push({
                time: time,
                position: predictedState.position.clone(),
                velocity: predictedState.velocity.clone(),
                altitude: predictedState.altitude
            });
            
            // Check for landing or escape
            if (predictedState.altitude <= 0) {
                break; // Landed
            }
            
            if (predictedState.altitude > this.currentPlanet.atmosphereHeight * 2) {
                break; // Escaped atmosphere
            }
        }
        
        return trajectory;
    }
    
    /**
     * Calculate forces for trajectory prediction
     */
    calculatePredictedForces(vehicleState) {
        const totalForce = new THREE.Vector3();
        
        // Gravitational force
        const distance = vehicleState.position.length();
        const gravityMagnitude = this.currentPlanet.mu * vehicleState.mass / (distance * distance);
        const gravityDirection = vehicleState.position.clone().normalize().negate();
        totalForce.add(gravityDirection.multiplyScalar(gravityMagnitude));
        
        // Atmospheric drag (if in atmosphere)
        if (vehicleState.altitude < this.currentPlanet.atmosphereHeight) {
            const density = this.currentPlanet.calculateAtmosphericDensity(vehicleState.altitude);
            const velocity = vehicleState.velocity.length();
            const dragCoefficient = 1.5; // Simplified
            const crossSectionalArea = Math.PI * 4; // Simplified
            
            const dragMagnitude = 0.5 * density * velocity * velocity * dragCoefficient * crossSectionalArea;
            const dragDirection = vehicleState.velocity.clone().normalize().negate();
            
            totalForce.add(dragDirection.multiplyScalar(dragMagnitude));
        }
        
        return totalForce;
    }
    
    /**
     * Get landing prediction
     */
    getLandingPrediction() {
        if (this.predictedTrajectory.length === 0) {
            return {
                timeToLanding: null,
                distanceToTarget: null,
                entryAngle: null,
                landingLocation: null
            };
        }
        
        // Find landing point in predicted trajectory
        let landingPoint = null;
        for (const point of this.predictedTrajectory) {
            if (point.altitude <= 0) {
                landingPoint = point;
                break;
            }
        }
        
        if (!landingPoint) {
            return {
                timeToLanding: null,
                distanceToTarget: null,
                entryAngle: null,
                landingLocation: null
            };
        }
        
        // Calculate time to landing
        const timeToLanding = landingPoint.time;
        
        // Calculate distance to target
        const distanceToTarget = landingPoint.position.distanceTo(this.landingTarget);
        
        // Calculate entry angle
        const entryAngle = this.calculateEntryAngle();
        
        return {
            timeToLanding: timeToLanding,
            distanceToTarget: distanceToTarget,
            entryAngle: entryAngle,
            landingLocation: landingPoint.position.clone()
        };
    }
    
    /**
     * Calculate current entry angle
     */
    calculateEntryAngle() {
        if (!this.vehicleState) return 0;
        
        const velocityDirection = this.vehicleState.velocity.clone().normalize();
        const positionDirection = this.vehicleState.position.clone().normalize();
        
        const angle = Math.acos(velocityDirection.dot(positionDirection)) * 180 / Math.PI;
        return angle;
    }
    
    /**
     * Get optimal trajectory guidance
     */
    getTrajectoryGuidance() {
        const currentEntryAngle = this.calculateEntryAngle();
        const currentVelocity = this.vehicleState.velocity.length();
        
        const guidance = {
            entryAngleError: currentEntryAngle - this.optimalEntryAngle,
            velocityError: currentVelocity - this.optimalEntryVelocity,
            recommendations: []
        };
        
        // Entry angle guidance
        if (Math.abs(guidance.entryAngleError) > 2) {
            if (guidance.entryAngleError > 0) {
                guidance.recommendations.push('Reduce entry angle - too steep');
            } else {
                guidance.recommendations.push('Increase entry angle - too shallow');
            }
        }
        
        // Velocity guidance
        if (Math.abs(guidance.velocityError) > 500) {
            if (guidance.velocityError > 0) {
                guidance.recommendations.push('Reduce velocity - too fast');
            } else {
                guidance.recommendations.push('Increase velocity - too slow');
            }
        }
        
        // G-force warning
        const currentGForce = this.vehicleState.gForce || 0;
        if (currentGForce > this.maxGForce) {
            guidance.recommendations.push('WARNING: G-force exceeds limits');
        }
        
        // Heating warning
        const heatingRate = this.calculateHeatingRate();
        if (heatingRate > this.maxHeatingRate) {
            guidance.recommendations.push('WARNING: Heating rate exceeds limits');
        }
        
        return guidance;
    }
    
    /**
     * Calculate current heating rate
     */
    calculateHeatingRate() {
        if (!this.vehicleState || !this.currentPlanet) return 0;
        
        const altitude = this.vehicleState.altitude;
        const velocity = this.vehicleState.velocity.length();
        
        if (altitude >= this.currentPlanet.atmosphereHeight) return 0;
        
        const density = this.currentPlanet.calculateAtmosphericDensity(altitude);
        const heatingRate = Math.pow(density, 0.5) * Math.pow(velocity, 3);
        
        return heatingRate;
    }
    
    /**
     * Get total mission time
     */
    getTotalMissionTime() {
        const now = Date.now();
        let totalTime = 0;
        
        for (const [phase, times] of Object.entries(this.missionPhases)) {
            if (times.startTime > 0) {
                const endTime = times.endTime > 0 ? times.endTime : now;
                totalTime += (endTime - times.startTime) / 1000;
            }
        }
        
        return totalTime;
    }
    
    /**
     * Get current phase duration
     */
    getCurrentPhaseDuration() {
        const phase = this.missionPhases[this.currentPhase];
        if (!phase || phase.startTime === 0) return 0;
        
        const endTime = phase.endTime > 0 ? phase.endTime : Date.now();
        return (endTime - phase.startTime) / 1000;
    }
    
    /**
     * Reset trajectory data
     */
    reset() {
        this.trajectoryHistory = [];
        this.predictedTrajectory = [];
        this.currentPhase = 'cruise';
        
        // Reset phase times
        for (const phase of Object.values(this.missionPhases)) {
            phase.startTime = 0;
            phase.endTime = 0;
        }
    }
    
    /**
     * Get trajectory history
     */
    getTrajectoryHistory() {
        return [...this.trajectoryHistory];
    }
    
    /**
     * Get predicted trajectory
     */
    getPredictedTrajectory() {
        return [...this.predictedTrajectory];
    }
    
    /**
     * Get current phase
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Get mission phases
     */
    getMissionPhases() {
        return { ...this.missionPhases };
    }
    
    /**
     * Export trajectory data
     */
    exportTrajectoryData() {
        return {
            planet: this.currentPlanet.name,
            trajectoryHistory: this.trajectoryHistory,
            predictedTrajectory: this.predictedTrajectory,
            missionPhases: this.missionPhases,
            currentPhase: this.currentPhase,
            landingTarget: this.landingTarget.toArray(),
            timestamp: Date.now()
        };
    }
    
    /**
     * Import trajectory data
     */
    importTrajectoryData(data) {
        this.trajectoryHistory = data.trajectoryHistory || [];
        this.predictedTrajectory = data.predictedTrajectory || [];
        this.missionPhases = data.missionPhases || this.missionPhases;
        this.currentPhase = data.currentPhase || 'cruise';
        
        if (data.landingTarget) {
            this.landingTarget.fromArray(data.landingTarget);
        }
    }
    
    /**
     * Cleanup
     */
    dispose() {
        this.trajectoryHistory = [];
        this.predictedTrajectory = [];
        this.currentPlanet = null;
        this.vehicleState = null;
    }
}
