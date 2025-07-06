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
                keyEvents: ["Atmospheric entry begins", "Peak heating expected"],
                color: "#ff6600"
            },
            {
                name: "Guidance Start",
                time: 26,
                altitude: 90,
                velocity: 19200,
                description: "As it begins to descend through the atmosphere, the spacecraft encounters pockets of air that are more or less dense, which can nudge it off course. To compensate, it fires small thrusters on its backshell that adjust its angle and direction of lift.",
                keyEvents: ["Guidance system activated", "Thruster corrections begin"],
                color: "#ff8800"
            },
            {
                name: "Heading Alignment",
                time: 87,
                altitude: 30,
                velocity: 3200,
                description: "The guided entry algorithm corrects any remaining cross-range error.",
                keyEvents: ["Cross-range correction", "Final trajectory adjustments"],
                color: "#ffaa00"
            },
            {
                name: "Begin SUFR",
                time: 174,
                altitude: 21,
                velocity: 1900,
                description: "The spacecraft executes the 'Straighten Up and Fly Right' maneuver, ejecting six more balance masses and setting the angle of attack to zero.",
                keyEvents: ["SUFR maneuver initiated", "Balance masses ejected"],
                color: "#ffcc00"
            },
            {
                name: "Parachute Deploy",
                time: 240,
                altitude: 13.463,
                velocity: 1512,
                description: "The parachute is triggered by calculating the distance to the landing site, and opening at the optimum time to hit a smaller target area. This is called a 'Range Trigger.'",
                keyEvents: ["Parachute deployment", "Velocity reduction begins"],
                color: "#00ff00"
            }
        ];
        
        this.currentPhaseIndex = 0;
        this.nextPhaseCallbacks = [];
    }
    
    getCurrentPhase(time) {
        // Find the current phase based on time
        let phaseIndex = 0;
        
        for (let i = this.phases.length - 1; i >= 0; i--) {
            if (time >= this.phases[i].time) {
                phaseIndex = i;
                break;
            }
        }
        
        // Check if phase has changed
        if (phaseIndex !== this.currentPhaseIndex) {
            const previousPhase = this.currentPhaseIndex;
            this.currentPhaseIndex = phaseIndex;
            this.onPhaseChange(previousPhase, phaseIndex);
        }
        
        return phaseIndex;
    }
    
    getPhase(index) {
        return this.phases[index] || null;
    }
    
    getCurrentPhaseData(time) {
        const phaseIndex = this.getCurrentPhase(time);
        const phase = this.phases[phaseIndex];
        const nextPhase = this.phases[phaseIndex + 1];
        
        // Calculate progress within current phase
        let phaseProgress = 0;
        if (nextPhase) {
            const phaseDuration = nextPhase.time - phase.time;
            const timeInPhase = time - phase.time;
            phaseProgress = Math.min(timeInPhase / phaseDuration, 1);
        }
        
        return {
            current: phase,
            next: nextPhase,
            progress: phaseProgress,
            index: phaseIndex,
            totalPhases: this.phases.length
        };
    }
    
    onPhaseChange(fromIndex, toIndex) {
        const fromPhase = this.phases[fromIndex];
        const toPhase = this.phases[toIndex];
        
        console.log(`Phase transition: ${fromPhase.name} → ${toPhase.name}`);
        
        // Execute phase change callbacks
        this.nextPhaseCallbacks.forEach(callback => {
            callback(fromPhase, toPhase, toIndex);
        });
    }
    
    onNextPhase(callback) {
        this.nextPhaseCallbacks.push(callback);
    }
    
    getTimeToNextPhase(currentTime) {
        const currentPhaseIndex = this.getCurrentPhase(currentTime);
        const nextPhase = this.phases[currentPhaseIndex + 1];
        
        if (nextPhase) {
            return nextPhase.time - currentTime;
        }
        
        return null;
    }
    
    getPhaseAtTime(time) {
        for (let i = this.phases.length - 1; i >= 0; i--) {
            if (time >= this.phases[i].time) {
                return this.phases[i];
            }
        }
        return this.phases[0];
    }
    
    // Get interpolated values between phases
    getInterpolatedData(time) {
        const currentPhaseIndex = this.getCurrentPhase(time);
        const currentPhase = this.phases[currentPhaseIndex];
        const nextPhase = this.phases[currentPhaseIndex + 1];
        
        if (!nextPhase) {
            return {
                altitude: currentPhase.altitude,
                velocity: currentPhase.velocity
            };
        }
        
        // Interpolate between phases
        const phaseDuration = nextPhase.time - currentPhase.time;
        const timeInPhase = time - currentPhase.time;
        const t = timeInPhase / phaseDuration;
        
        return {
            altitude: currentPhase.altitude + (nextPhase.altitude - currentPhase.altitude) * t,
            velocity: currentPhase.velocity + (nextPhase.velocity - currentPhase.velocity) * t
        };
    }
    
    // Set custom phases (for different missions)
    setPhases(phases) {
        this.phases = phases;
        this.currentPhaseIndex = 0;
    }
    
    // Get all phase times for timeline markers
    getPhaseTimes() {
        return this.phases.map(phase => ({
            time: phase.time,
            name: phase.name,
            color: phase.color
        }));
    }
    
    // Check if a specific event should trigger
    shouldTriggerEvent(time, eventName) {
        const phase = this.getPhaseAtTime(time);
        return phase.keyEvents && phase.keyEvents.includes(eventName);
    }
    
    // Get mission statistics
    getMissionStats() {
        return {
            totalDuration: this.phases[this.phases.length - 1].time,
            entryVelocity: this.phases[0].velocity,
            deployVelocity: this.phases[this.phases.length - 1].velocity,
            entryAltitude: this.phases[0].altitude,
            deployAltitude: this.phases[this.phases.length - 1].altitude,
            totalPhases: this.phases.length
        };
    }
}