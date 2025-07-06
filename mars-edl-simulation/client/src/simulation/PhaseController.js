/**
 * PhaseController.js
 * Manages mission phases and transitions
 */

export class PhaseController {
    constructor() {
        this.phases = [
            {
                name: "Entry Interface Point",
                time: 0,
                altitude: 132, // km
                velocity: 19300, // km/h
                description: "The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.",
                nextPhase: "Guidance Start",
                nextPhaseTime: 26
            },
            {
                name: "Guidance Start", 
                time: 26,
                altitude: 90,
                velocity: 19200,
                description: "As it begins to descend through the atmosphere, the spacecraft encounters pockets of air that are more or less dense, which can nudge it off course. To compensate, it fires small thrusters on its backshell that adjust its angle and direction of lift.",
                nextPhase: "Heading Alignment",
                nextPhaseTime: 87
            },
            {
                name: "Heading Alignment",
                time: 87,
                altitude: 55,
                velocity: 8500,
                description: "The guided entry algorithm corrects any remaining cross-range error.",
                nextPhase: "Begin SUFR",
                nextPhaseTime: 174
            },
            {
                name: "Begin SUFR",
                time: 174,
                altitude: 21,
                velocity: 1900,
                description: "The spacecraft executes the \"Straighten Up and Fly Right\" maneuver, ejecting six more balance masses and setting the angle of attack to zero.",
                nextPhase: "Parachute Deploy",
                nextPhaseTime: 240
            },
            {
                name: "Parachute Deploy",
                time: 240,
                altitude: 13.463,
                velocity: 1450,
                description: "The parachute is triggered by calculating the distance to the landing site, and opening at the optimum time to hit a smaller target area. This is called a \"Range Trigger.\"",
                nextPhase: "Heat Shield Separation",
                nextPhaseTime: 260
            },
            {
                name: "Heat Shield Separation",
                time: 260,
                altitude: 10,
                velocity: 580,
                description: "The heat shield separates to expose the rover and landing system.",
                nextPhase: null,
                nextPhaseTime: null
            }
        ];
        
        this.currentPhaseIndex = 0;
        this.phaseListeners = [];
    }
    
    setPhases(customPhases) {
        if (customPhases && Array.isArray(customPhases)) {
            this.phases = customPhases;
        }
    }
    
    getCurrentPhase(time) {
        let phaseIndex = 0;
        
        for (let i = this.phases.length - 1; i >= 0; i--) {
            if (time >= this.phases[i].time) {
                phaseIndex = i;
                break;
            }
        }
        
        // Check if phase changed
        if (phaseIndex !== this.currentPhaseIndex) {
            const oldPhase = this.phases[this.currentPhaseIndex];
            const newPhase = this.phases[phaseIndex];
            this.currentPhaseIndex = phaseIndex;
            
            // Notify listeners
            this.notifyPhaseChange(oldPhase, newPhase);
        }
        
        return phaseIndex;
    }
    
    getPhaseByIndex(index) {
        return this.phases[index] || null;
    }
    
    getPhaseByName(name) {
        return this.phases.find(phase => phase.name === name) || null;
    }
    
    getNextPhase(currentTime) {
        const currentPhase = this.getCurrentPhase(currentTime);
        if (currentPhase < this.phases.length - 1) {
            return this.phases[currentPhase + 1];
        }
        return null;
    }
    
    getTimeToNextPhase(currentTime) {
        const nextPhase = this.getNextPhase(currentTime);
        if (nextPhase) {
            return nextPhase.time - currentTime;
        }
        return null;
    }
    
    getPhaseProgress(currentTime) {
        const phaseIndex = this.getCurrentPhase(currentTime);
        const currentPhase = this.phases[phaseIndex];
        const nextPhase = this.phases[phaseIndex + 1];
        
        if (!nextPhase) {
            return 1; // Last phase
        }
        
        const phaseDuration = nextPhase.time - currentPhase.time;
        const timeInPhase = currentTime - currentPhase.time;
        
        return Math.min(timeInPhase / phaseDuration, 1);
    }
    
    // Event handling
    addPhaseChangeListener(callback) {
        this.phaseListeners.push(callback);
    }
    
    removePhaseChangeListener(callback) {
        const index = this.phaseListeners.indexOf(callback);
        if (index > -1) {
            this.phaseListeners.splice(index, 1);
        }
    }
    
    notifyPhaseChange(oldPhase, newPhase) {
        this.phaseListeners.forEach(listener => {
            listener({
                oldPhase,
                newPhase,
                phaseIndex: this.currentPhaseIndex,
                timestamp: Date.now()
            });
        });
    }
    
    // Phase-specific configurations
    getPhaseConfig(phaseName) {
        const configs = {
            "Entry Interface Point": {
                cameraDistance: 200,
                heatShieldGlow: 0.8,
                atmosphericDrag: 0.1,
                thrusterActivity: false
            },
            "Guidance Start": {
                cameraDistance: 150,
                heatShieldGlow: 1.0,
                atmosphericDrag: 0.3,
                thrusterActivity: true
            },
            "Heading Alignment": {
                cameraDistance: 120,
                heatShieldGlow: 0.7,
                atmosphericDrag: 0.5,
                thrusterActivity: true
            },
            "Begin SUFR": {
                cameraDistance: 100,
                heatShieldGlow: 0.4,
                atmosphericDrag: 0.7,
                thrusterActivity: true
            },
            "Parachute Deploy": {
                cameraDistance: 150,
                heatShieldGlow: 0.1,
                atmosphericDrag: 0.9,
                thrusterActivity: false
            },
            "Heat Shield Separation": {
                cameraDistance: 100,
                heatShieldGlow: 0,
                atmosphericDrag: 0.95,
                thrusterActivity: false
            }
        };
        
        return configs[phaseName] || {};
    }
    
    // Telemetry calculations
    calculateTelemetry(phaseData, interpolatedData) {
        const telemetry = {
            ...phaseData,
            distanceToLanding: interpolatedData?.distanceToLanding || 0,
            actualAltitude: interpolatedData?.altitude || phaseData.altitude,
            actualVelocity: interpolatedData?.velocity || phaseData.velocity,
            timeInPhase: 0,
            phaseProgress: 0
        };
        
        // Convert units
        telemetry.altitudeMiles = telemetry.actualAltitude * 0.621371;
        telemetry.velocityMph = telemetry.actualVelocity * 0.621371;
        telemetry.distanceMiles = telemetry.distanceToLanding * 0.621371;
        
        return telemetry;
    }
    
    // Export phase data for timeline markers
    getPhaseMarkers() {
        return this.phases.map(phase => ({
            time: phase.time,
            name: phase.name,
            color: this.getPhaseColor(phase.name)
        }));
    }
    
    getPhaseColor(phaseName) {
        const colors = {
            "Entry Interface Point": "#ff6600",
            "Guidance Start": "#ff8800",
            "Heading Alignment": "#ffaa00",
            "Begin SUFR": "#ffcc00",
            "Parachute Deploy": "#00ccff",
            "Heat Shield Separation": "#00ffcc"
        };
        
        return colors[phaseName] || "#ffffff";
    }
    
    // Reset controller
    reset() {
        this.currentPhaseIndex = 0;
        this.notifyPhaseChange(null, this.phases[0]);
    }
}