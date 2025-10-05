import * as THREE from '/node_modules/three/build/three.module.js';

/**
 * Physics Engine for Hypersonic Vehicle Simulation
 * 
 * Handles:
 * 1. Gravitational forces from planets
 * 2. Atmospheric drag and heating
 * 3. Thrust forces from engines
 * 4. Orbital mechanics calculations
 * 5. Real-time trajectory predictions
 */
export class PhysicsEngine {
    constructor() {
        // Physics constants
        this.G = 6.67430e-11; // Gravitational constant
        this.UNIVERSAL_GAS_CONSTANT = 8.314; // J/(mol·K)
        
        // Current planet data
        this.currentPlanet = null;
        
        // Physics state
        this.timeStep = 1/60; // 60 FPS
        this.maxTimeStep = 0.1; // Maximum time step for stability
        
        // Integration method
        this.integrationMethod = 'rk4'; // Runge-Kutta 4th order
        
        // Debug
        this.debugMode = false;
        this.debugInfo = {
            forces: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            atmosphericDensity: 0,
            dragCoefficient: 0,
            liftCoefficient: 0
        };
    }
    
    async init() {
        console.log('Physics Engine initialized');
    }
    
    setPlanet(planet) {
        this.currentPlanet = planet;
        console.log(`Physics engine set for planet: ${planet.name}`);
    }
    
    /**
     * Calculate all forces acting on the vehicle
     */
    calculateForces(vehicleState, planet, controls) {
        const totalForce = new THREE.Vector3();
        
        // 1. Gravitational force
        const gravityForce = this.calculateGravityForce(vehicleState, planet);
        totalForce.add(gravityForce);
        
        // 2. Atmospheric drag (if in atmosphere)
        if (vehicleState.altitude < planet.atmosphereHeight) {
            const dragForce = this.calculateDragForce(vehicleState, planet);
            totalForce.add(dragForce);
        }
        
        // 3. Thrust forces
        const thrustForce = this.calculateThrustForce(vehicleState, controls);
        totalForce.add(thrustForce);
        
        // 4. Lift force (if applicable)
        if (vehicleState.altitude < planet.atmosphereHeight) {
            const liftForce = this.calculateLiftForce(vehicleState, planet);
            totalForce.add(liftForce);
        }
        
        // Store debug info
        this.debugInfo.forces.copy(totalForce);
        this.debugInfo.acceleration.copy(totalForce).divideScalar(vehicleState.mass);
        
        return totalForce;
    }
    
    /**
     * Calculate gravitational force
     */
    calculateGravityForce(vehicleState, planet) {
        const distance = vehicleState.position.length();
        const gravityMagnitude = this.G * planet.mass * vehicleState.mass / (distance * distance);
        
        // Gravity always points toward planet center
        const gravityDirection = vehicleState.position.clone().normalize().negate();
        
        return gravityDirection.multiplyScalar(gravityMagnitude);
    }
    
    /**
     * Calculate atmospheric drag force
     */
    calculateDragForce(vehicleState, planet) {
        const altitude = vehicleState.altitude;
        const velocity = vehicleState.velocity.length();
        
        // Get atmospheric density at current altitude
        const density = planet.getAtmosphericDensity(altitude);
        
        // Calculate drag coefficient (simplified)
        const dragCoefficient = this.calculateDragCoefficient(vehicleState, planet);
        
        // Calculate drag force: F = 0.5 * ρ * v² * Cd * A
        const crossSectionalArea = this.calculateCrossSectionalArea(vehicleState);
        const dragMagnitude = 0.5 * density * velocity * velocity * dragCoefficient * crossSectionalArea;
        
        // Drag opposes velocity
        const dragDirection = vehicleState.velocity.clone().normalize().negate();
        
        this.debugInfo.atmosphericDensity = density;
        this.debugInfo.dragCoefficient = dragCoefficient;
        
        return dragDirection.multiplyScalar(dragMagnitude);
    }
    
    /**
     * Calculate lift force
     */
    calculateLiftForce(vehicleState, planet) {
        const altitude = vehicleState.altitude;
        const velocity = vehicleState.velocity.length();
        
        // Only generate lift if we have significant velocity
        if (velocity < 100) return new THREE.Vector3();
        
        const density = planet.getAtmosphericDensity(altitude);
        const liftCoefficient = this.calculateLiftCoefficient(vehicleState, planet);
        const wingArea = this.calculateWingArea(vehicleState);
        
        // Lift force: F = 0.5 * ρ * v² * Cl * A
        const liftMagnitude = 0.5 * density * velocity * velocity * liftCoefficient * wingArea;
        
        // Lift direction depends on vehicle orientation and velocity
        const liftDirection = this.calculateLiftDirection(vehicleState);
        
        this.debugInfo.liftCoefficient = liftCoefficient;
        
        return liftDirection.multiplyScalar(liftMagnitude);
    }
    
    /**
     * Calculate thrust force from engines
     */
    calculateThrustForce(vehicleState, controls) {
        const totalThrust = new THREE.Vector3();
        
        // Main engine thrust (points in vehicle's forward direction)
        if (controls.mainThrust > 0) {
            const mainThrustMagnitude = controls.mainThrust * this.getMainEngineThrust();
            const mainThrustDirection = new THREE.Vector3(0, 1, 0);
            mainThrustDirection.applyQuaternion(vehicleState.orientation);
            
            totalThrust.add(mainThrustDirection.multiplyScalar(mainThrustMagnitude));
        }
        
        // RCS thrust (for attitude control)
        if (controls.rcsThrust > 0) {
            const rcsThrust = this.calculateRCSThrust(vehicleState, controls);
            totalThrust.add(rcsThrust);
        }
        
        return totalThrust;
    }
    
    /**
     * Calculate RCS thrust for attitude control
     */
    calculateRCSThrust(vehicleState, controls) {
        const rcsThrust = new THREE.Vector3();
        const rcsMagnitude = controls.rcsThrust * this.getRCSEngineThrust();
        
        // Apply RCS based on pitch, yaw, roll inputs
        if (controls.pitch !== 0) {
            const pitchAxis = new THREE.Vector3(1, 0, 0);
            pitchAxis.applyQuaternion(vehicleState.orientation);
            rcsThrust.add(pitchAxis.multiplyScalar(controls.pitch * rcsMagnitude));
        }
        
        if (controls.yaw !== 0) {
            const yawAxis = new THREE.Vector3(0, 0, 1);
            yawAxis.applyQuaternion(vehicleState.orientation);
            rcsThrust.add(yawAxis.multiplyScalar(controls.yaw * rcsMagnitude));
        }
        
        if (controls.roll !== 0) {
            const rollAxis = new THREE.Vector3(0, 1, 0);
            rollAxis.applyQuaternion(vehicleState.orientation);
            rcsThrust.add(rollAxis.multiplyScalar(controls.roll * rcsMagnitude));
        }
        
        return rcsThrust;
    }
    
    /**
     * Calculate drag coefficient based on vehicle state and planet
     */
    calculateDragCoefficient(vehicleState, planet) {
        const velocity = vehicleState.velocity.length();
        const altitude = vehicleState.altitude;
        
        // Base drag coefficient for capsule shape
        let dragCoefficient = 1.5;
        
        // Reduce drag if heat shield is ejected (simplified)
        if (!vehicleState.heatShield) {
            dragCoefficient *= 0.8;
        }
        
        // Increase drag if parachute is deployed
        if (vehicleState.parachute) {
            dragCoefficient *= 2.0;
        }
        
        // Mach number effects (simplified)
        const machNumber = velocity / planet.speedOfSound;
        if (machNumber > 1) {
            // Supersonic drag rise
            dragCoefficient *= (1 + 0.1 * (machNumber - 1));
        }
        
        return dragCoefficient;
    }
    
    /**
     * Calculate lift coefficient
     */
    calculateLiftCoefficient(vehicleState, planet) {
        // Capsule shapes have minimal lift
        let liftCoefficient = 0.1;
        
        // Increase lift if heat shield is ejected (exposes more aerodynamic surface)
        if (!vehicleState.heatShield) {
            liftCoefficient *= 1.5;
        }
        
        return liftCoefficient;
    }
    
    /**
     * Calculate cross-sectional area for drag
     */
    calculateCrossSectionalArea(vehicleState) {
        // Base area for capsule
        let area = Math.PI * 4; // π * r² where r = 2m
        
        // Increase area if parachute is deployed
        if (vehicleState.parachute) {
            area += Math.PI * 64; // Additional parachute area
        }
        
        return area;
    }
    
    /**
     * Calculate wing area for lift
     */
    calculateWingArea(vehicleState) {
        // Minimal wing area for capsule
        return Math.PI * 2; // π * r * h where r = 2m, h = 1m
    }
    
    /**
     * Calculate lift direction
     */
    calculateLiftDirection(vehicleState) {
        // Simplified lift direction (perpendicular to velocity and gravity)
        const velocity = vehicleState.velocity.clone().normalize();
        const gravity = vehicleState.position.clone().normalize().negate();
        
        const liftDirection = new THREE.Vector3();
        liftDirection.crossVectors(velocity, gravity).normalize();
        
        return liftDirection;
    }
    
    /**
     * Get main engine thrust (N)
     */
    getMainEngineThrust() {
        return 50000; // 50 kN main engine
    }
    
    /**
     * Get RCS engine thrust (N)
     */
    getRCSEngineThrust() {
        return 1000; // 1 kN per RCS thruster
    }
    
    /**
     * Predict trajectory using current state
     */
    predictTrajectory(vehicleState, planet, timeHorizon = 300) {
        const trajectory = [];
        const timeStep = 1; // 1 second steps
        
        // Clone current state for prediction
        let predictedState = {
            position: vehicleState.position.clone(),
            velocity: vehicleState.velocity.clone(),
            orientation: vehicleState.orientation.clone(),
            mass: vehicleState.mass,
            fuel: vehicleState.fuel,
            altitude: vehicleState.altitude
        };
        
        // Simulate forward in time
        for (let time = 0; time < timeHorizon; time += timeStep) {
            // Calculate forces (assume no control inputs for prediction)
            const forces = this.calculateForces(predictedState, planet, {
                mainThrust: 0,
                rcsThrust: 0,
                pitch: 0,
                yaw: 0,
                roll: 0
            });
            
            // Update state using simple Euler integration
            const acceleration = forces.clone().divideScalar(predictedState.mass);
            predictedState.velocity.add(acceleration.clone().multiplyScalar(timeStep));
            predictedState.position.add(predictedState.velocity.clone().multiplyScalar(timeStep));
            predictedState.altitude = predictedState.position.length() - planet.radius;
            
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
            
            if (predictedState.altitude > planet.atmosphereHeight * 2) {
                break; // Escaped atmosphere
            }
        }
        
        return trajectory;
    }
    
    /**
     * Calculate orbital parameters
     */
    calculateOrbitalParameters(vehicleState, planet) {
        const position = vehicleState.position;
        const velocity = vehicleState.velocity;
        const mu = this.G * planet.mass;
        
        // Specific angular momentum
        const h = new THREE.Vector3();
        h.crossVectors(position, velocity);
        
        // Eccentricity vector
        const vSquared = velocity.lengthSq();
        const rSquared = position.lengthSq();
        const rDotV = position.dot(velocity);
        
        const eccentricityVector = new THREE.Vector3();
        eccentricityVector.copy(velocity).multiplyScalar(vSquared);
        eccentricityVector.sub(position.clone().multiplyScalar(mu / position.length()));
        eccentricityVector.add(position.clone().multiplyScalar(rDotV * mu / rSquared));
        eccentricityVector.divideScalar(mu);
        
        const eccentricity = eccentricityVector.length();
        
        // Semi-major axis
        const energy = vSquared / 2 - mu / position.length();
        const semiMajorAxis = -mu / (2 * energy);
        
        // Orbital period
        const period = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxis, 3) / mu);
        
        return {
            eccentricity: eccentricity,
            semiMajorAxis: semiMajorAxis,
            period: period,
            specificAngularMomentum: h.length(),
            energy: energy
        };
    }
    
    /**
     * Calculate atmospheric entry parameters
     */
    calculateEntryParameters(vehicleState, planet) {
        const altitude = vehicleState.altitude;
        const velocity = vehicleState.velocity.length();
        
        // Entry angle (angle between velocity and local horizontal)
        const velocityDirection = vehicleState.velocity.clone().normalize();
        const positionDirection = vehicleState.position.clone().normalize();
        const entryAngle = Math.acos(velocityDirection.dot(positionDirection)) * 180 / Math.PI;
        
        // Atmospheric density
        const density = planet.getAtmosphericDensity(altitude);
        
        // Dynamic pressure
        const dynamicPressure = 0.5 * density * velocity * velocity;
        
        // Heating rate (simplified)
        const heatingRate = Math.pow(density, 0.5) * Math.pow(velocity, 3);
        
        return {
            entryAngle: entryAngle,
            dynamicPressure: dynamicPressure,
            heatingRate: heatingRate,
            atmosphericDensity: density
        };
    }
    
    /**
     * Calculate time to landing
     */
    calculateTimeToLanding(vehicleState, planet) {
        const trajectory = this.predictTrajectory(vehicleState, planet, 600); // 10 minutes
        
        for (let i = 0; i < trajectory.length; i++) {
            if (trajectory[i].altitude <= 0) {
                return trajectory[i].time;
            }
        }
        
        return null; // No landing predicted
    }
    
    /**
     * Calculate distance to target
     */
    calculateDistanceToTarget(vehicleState, targetPosition) {
        return vehicleState.position.distanceTo(targetPosition);
    }
    
    /**
     * Enable/disable debug mode
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
    }
    
    /**
     * Get debug information
     */
    getDebugInfo() {
        return this.debugInfo;
    }
    
    /**
     * Cleanup
     */
    dispose() {
        // Cleanup any resources
        this.currentPlanet = null;
    }
} 