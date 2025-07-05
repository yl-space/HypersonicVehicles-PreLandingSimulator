/**
 * Phase Controller
 * 
 * Handles:
 * 1. Mission phase management
 * 2. Phase-specific events and triggers
 * 3. Phase transitions and validation
 * 4. Mission success/failure conditions
 */
export class PhaseController {
    constructor() {
        this.trajectoryManager = null;
        
        // Phase definitions
        this.phases = {
            cruise: {
                name: 'Cruise Phase',
                description: 'Interplanetary travel to target planet',
                startConditions: ['vehicle_launched'],
                endConditions: ['atmosphere_entry'],
                events: ['course_corrections', 'solar_radiation', 'micrometeoroids'],
                duration: { min: 180, max: 300 }, // days
                criticalEvents: []
            },
            entry: {
                name: 'Atmospheric Entry',
                description: 'High-speed entry into planetary atmosphere',
                startConditions: ['atmosphere_contact'],
                endConditions: ['velocity_reduction', 'altitude_drop'],
                events: ['plasma_heating', 'g_force_peak', 'communications_blackout'],
                duration: { min: 60, max: 300 }, // seconds
                criticalEvents: ['heat_shield_failure', 'excessive_g_force', 'trajectory_deviation']
            },
            descent: {
                name: 'Descent Phase',
                description: 'Controlled descent through atmosphere',
                startConditions: ['subsonic_velocity'],
                endConditions: ['near_surface'],
                events: ['parachute_deployment', 'heat_shield_ejection', 'terrain_scanning'],
                duration: { min: 300, max: 600 }, // seconds
                criticalEvents: ['parachute_failure', 'wind_shear', 'terrain_hazards']
            },
            landing: {
                name: 'Landing Phase',
                description: 'Final approach and touchdown',
                startConditions: ['low_altitude'],
                endConditions: ['surface_contact'],
                events: ['landing_leg_deployment', 'final_approach', 'touchdown'],
                duration: { min: 30, max: 120 }, // seconds
                criticalEvents: ['landing_leg_failure', 'excessive_velocity', 'rough_terrain']
            }
        };
        
        // Current phase state
        this.currentPhase = 'cruise';
        this.phaseStartTime = 0;
        this.phaseDuration = 0;
        
        // Phase events
        this.phaseEvents = [];
        this.completedEvents = [];
        
        // Mission status
        this.missionStatus = 'active'; // active, success, failure
        this.failureReason = null;
        
        // Event handlers
        this.eventHandlers = new Map();
        
        // Initialize event handlers
        this.initializeEventHandlers();
    }
    
    init(trajectoryManager) {
        this.trajectoryManager = trajectoryManager;
        this.phaseStartTime = Date.now();
        console.log('Phase Controller initialized');
    }
    
    /**
     * Initialize event handlers for each phase
     */
    initializeEventHandlers() {
        // Cruise phase events
        this.eventHandlers.set('course_corrections', () => {
            console.log('Course correction maneuver executed');
            this.addPhaseEvent('course_correction', 'Course correction completed');
        });
        
        this.eventHandlers.set('solar_radiation', () => {
            console.log('Solar radiation event detected');
            this.addPhaseEvent('solar_radiation', 'Solar radiation levels monitored');
        });
        
        // Entry phase events
        this.eventHandlers.set('plasma_heating', () => {
            console.log('Plasma heating initiated');
            this.addPhaseEvent('plasma_heating', 'Atmospheric entry heating');
        });
        
        this.eventHandlers.set('g_force_peak', () => {
            console.log('G-force peak reached');
            this.addPhaseEvent('g_force_peak', 'Maximum G-force experienced');
        });
        
        this.eventHandlers.set('communications_blackout', () => {
            console.log('Communications blackout period');
            this.addPhaseEvent('communications_blackout', 'Radio blackout due to plasma');
        });
        
        // Descent phase events
        this.eventHandlers.set('parachute_deployment', () => {
            console.log('Parachute deployment sequence');
            this.addPhaseEvent('parachute_deployment', 'Parachute successfully deployed');
        });
        
        this.eventHandlers.set('heat_shield_ejection', () => {
            console.log('Heat shield ejection');
            this.addPhaseEvent('heat_shield_ejection', 'Heat shield jettisoned');
        });
        
        this.eventHandlers.set('terrain_scanning', () => {
            console.log('Terrain scanning active');
            this.addPhaseEvent('terrain_scanning', 'Landing site analysis');
        });
        
        // Landing phase events
        this.eventHandlers.set('landing_leg_deployment', () => {
            console.log('Landing leg deployment');
            this.addPhaseEvent('landing_leg_deployment', 'Landing legs extended');
        });
        
        this.eventHandlers.set('final_approach', () => {
            console.log('Final approach initiated');
            this.addPhaseEvent('final_approach', 'Final descent to surface');
        });
        
        this.eventHandlers.set('touchdown', () => {
            console.log('Touchdown achieved');
            this.addPhaseEvent('touchdown', 'Vehicle landed successfully');
            this.missionStatus = 'success';
        });
    }
    
    /**
     * Get current phase
     */
    getCurrentPhase() {
        return this.currentPhase;
    }
    
    /**
     * Get current phase information
     */
    getCurrentPhaseInfo() {
        return this.phases[this.currentPhase];
    }
    
    /**
     * Handle phase events based on vehicle state
     */
    handlePhaseEvents(phase, vehicleState) {
        const phaseInfo = this.phases[phase];
        if (!phaseInfo) return;
        
        // Check for phase-specific events
        for (const event of phaseInfo.events) {
            if (!this.completedEvents.includes(event)) {
                this.checkEventConditions(event, vehicleState);
            }
        }
        
        // Check for critical events
        for (const criticalEvent of phaseInfo.criticalEvents) {
            this.checkCriticalEventConditions(criticalEvent, vehicleState);
        }
        
        // Update phase duration
        this.phaseDuration = (Date.now() - this.phaseStartTime) / 1000;
    }
    
    /**
     * Check if event conditions are met
     */
    checkEventConditions(event, vehicleState) {
        switch (event) {
            case 'plasma_heating':
                if (vehicleState.altitude < 100000 && vehicleState.velocity.length() > 3000) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'g_force_peak':
                if (vehicleState.gForce > 5) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'communications_blackout':
                if (vehicleState.altitude < 80000 && vehicleState.velocity.length() > 4000) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'parachute_deployment':
                if (vehicleState.altitude < 10000 && vehicleState.velocity.length() < 1000) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'heat_shield_ejection':
                if (vehicleState.altitude < 5000 && vehicleState.velocity.length() < 500) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'landing_leg_deployment':
                if (vehicleState.altitude < 1000) {
                    this.triggerEvent(event);
                }
                break;
                
            case 'touchdown':
                if (vehicleState.altitude <= 0 && vehicleState.velocity.length() < 10) {
                    this.triggerEvent(event);
                }
                break;
        }
    }
    
    /**
     * Check critical event conditions
     */
    checkCriticalEventConditions(criticalEvent, vehicleState) {
        switch (criticalEvent) {
            case 'heat_shield_failure':
                if (vehicleState.temperature > 2000) {
                    this.handleCriticalEvent(criticalEvent, 'Heat shield failure due to excessive temperature');
                }
                break;
                
            case 'excessive_g_force':
                if (vehicleState.gForce > 15) {
                    this.handleCriticalEvent(criticalEvent, 'Excessive G-force detected');
                }
                break;
                
            case 'parachute_failure':
                if (vehicleState.altitude < 5000 && vehicleState.velocity.length() > 1000) {
                    this.handleCriticalEvent(criticalEvent, 'Parachute deployment failure');
                }
                break;
                
            case 'landing_leg_failure':
                if (vehicleState.altitude < 100 && !vehicleState.landingLegs) {
                    this.handleCriticalEvent(criticalEvent, 'Landing leg deployment failure');
                }
                break;
        }
    }
    
    /**
     * Trigger a phase event
     */
    triggerEvent(eventName) {
        const handler = this.eventHandlers.get(eventName);
        if (handler) {
            handler();
        }
        
        this.completedEvents.push(eventName);
        console.log(`Phase event triggered: ${eventName}`);
    }
    
    /**
     * Handle critical events
     */
    handleCriticalEvent(eventName, reason) {
        console.error(`Critical event: ${eventName} - ${reason}`);
        this.missionStatus = 'failure';
        this.failureReason = reason;
        
        this.addPhaseEvent('critical_failure', reason);
        
        // Emit failure event
        window.dispatchEvent(new CustomEvent('missionFailure', {
            detail: { event: eventName, reason: reason }
        }));
    }
    
    /**
     * Add phase event to history
     */
    addPhaseEvent(type, description) {
        const event = {
            type: type,
            description: description,
            timestamp: Date.now(),
            phase: this.currentPhase
        };
        
        this.phaseEvents.push(event);
        
        // Emit event
        window.dispatchEvent(new CustomEvent('phaseEvent', {
            detail: event
        }));
    }
    
    /**
     * Validate phase transition
     */
    validatePhaseTransition(fromPhase, toPhase, vehicleState) {
        const fromPhaseInfo = this.phases[fromPhase];
        const toPhaseInfo = this.phases[toPhase];
        
        if (!fromPhaseInfo || !toPhaseInfo) {
            return { valid: false, reason: 'Invalid phase' };
        }
        
        // Check if all end conditions for current phase are met
        for (const condition of fromPhaseInfo.endConditions) {
            if (!this.checkEndCondition(condition, vehicleState)) {
                return { valid: false, reason: `End condition not met: ${condition}` };
            }
        }
        
        // Check if all start conditions for new phase are met
        for (const condition of toPhaseInfo.startConditions) {
            if (!this.checkStartCondition(condition, vehicleState)) {
                return { valid: false, reason: `Start condition not met: ${condition}` };
            }
        }
        
        return { valid: true, reason: 'Phase transition valid' };
    }
    
    /**
     * Check end condition for current phase
     */
    checkEndCondition(condition, vehicleState) {
        switch (condition) {
            case 'atmosphere_entry':
                return vehicleState.altitude < 100000;
                
            case 'velocity_reduction':
                return vehicleState.velocity.length() < 2000;
                
            case 'altitude_drop':
                return vehicleState.altitude < 50000;
                
            case 'subsonic_velocity':
                return vehicleState.velocity.length() < 343; // Speed of sound
                
            case 'near_surface':
                return vehicleState.altitude < 1000;
                
            case 'surface_contact':
                return vehicleState.altitude <= 0;
                
            default:
                return true;
        }
    }
    
    /**
     * Check start condition for new phase
     */
    checkStartCondition(condition, vehicleState) {
        switch (condition) {
            case 'vehicle_launched':
                return vehicleState.altitude > 0;
                
            case 'atmosphere_contact':
                return vehicleState.altitude < 100000;
                
            case 'low_altitude':
                return vehicleState.altitude < 1000;
                
            default:
                return true;
        }
    }
    
    /**
     * Get phase progress
     */
    getPhaseProgress() {
        const phaseInfo = this.phases[this.currentPhase];
        const maxDuration = phaseInfo.duration.max;
        
        return Math.min(1, this.phaseDuration / maxDuration);
    }
    
    /**
     * Get mission status
     */
    getMissionStatus() {
        return {
            status: this.missionStatus,
            failureReason: this.failureReason,
            currentPhase: this.currentPhase,
            phaseProgress: this.getPhaseProgress(),
            phaseDuration: this.phaseDuration,
            completedEvents: this.completedEvents.length,
            totalEvents: this.phases[this.currentPhase].events.length
        };
    }
    
    /**
     * Get phase events
     */
    getPhaseEvents() {
        return [...this.phaseEvents];
    }
    
    /**
     * Reset phase controller
     */
    reset() {
        this.currentPhase = 'cruise';
        this.phaseStartTime = Date.now();
        this.phaseDuration = 0;
        this.phaseEvents = [];
        this.completedEvents = [];
        this.missionStatus = 'active';
        this.failureReason = null;
    }
    
    /**
     * Export phase data
     */
    exportPhaseData() {
        return {
            currentPhase: this.currentPhase,
            phaseStartTime: this.phaseStartTime,
            phaseDuration: this.phaseDuration,
            phaseEvents: this.phaseEvents,
            completedEvents: this.completedEvents,
            missionStatus: this.missionStatus,
            failureReason: this.failureReason
        };
    }
    
    /**
     * Import phase data
     */
    importPhaseData(data) {
        this.currentPhase = data.currentPhase || 'cruise';
        this.phaseStartTime = data.phaseStartTime || Date.now();
        this.phaseDuration = data.phaseDuration || 0;
        this.phaseEvents = data.phaseEvents || [];
        this.completedEvents = data.completedEvents || [];
        this.missionStatus = data.missionStatus || 'active';
        this.failureReason = data.failureReason || null;
    }
    
    /**
     * Cleanup
     */
    dispose() {
        this.trajectoryManager = null;
        this.phaseEvents = [];
        this.completedEvents = [];
        this.eventHandlers.clear();
    }
}
