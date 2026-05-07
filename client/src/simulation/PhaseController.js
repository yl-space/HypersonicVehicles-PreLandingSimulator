/**
 * PhaseController.js
 * Manages mission phases and transitions
 */

export class PhaseController {
    constructor() {
        // Five EDL phases.  Names + descriptions match the team's
        // physics-driven scheme; transition times come from the
        // backend's phases_entry (t12, t23, t34, t45) via
        // setPhaseTimestamps().  Hardcoded times here are MSL nominal
        // fallbacks used until the first backend trajectory loads.
        this.phases = [
            {
                name: "Gravity-dominated motion in a rarefied atmosphere",
                time: 0,
                altitude: 125,
                velocity: 5845, // m/s
                description: "The vehicle enters the Martian atmosphere, where the upper atmosphere is still too rarefied to generate significant aerodynamic forces and heating.",
                nextPhase: "Aerothermal build-up",
                nextPhaseTime: 26.1
            },
            {
                name: "Aerothermal build-up",
                time: 26.1,
                altitude: 90,
                velocity: 5500,
                description: "As atmospheric density increases, aerodynamic drag and heating rise rapidly, marking the onset of significant aerothermal effects.",
                nextPhase: "Peak heating and aerodynamic load",
                nextPhaseTime: 53.7
            },
            {
                name: "Peak heating and aerodynamic load",
                time: 53.7,
                altitude: 60,
                velocity: 4500,
                description: "The vehicle encounters its most severe thermal environment and largest aerodynamic loads as velocity remains high in denser layers of the atmosphere.",
                nextPhase: "Hypersonic glide control phase",
                nextPhaseTime: 84.0
            },
            {
                name: "Hypersonic glide control phase",
                time: 84.0,
                altitude: 35,
                velocity: 2500,
                description: "The vehicle uses bank-angle control during hypersonic flight to shape its trajectory, manage energy, and maximize parachute deployment altitude.",
                nextPhase: "SUFR: “Straighten Up and Fly Right”",
                nextPhaseTime: 318.2
            },
            {
                name: "SUFR: “Straighten Up and Fly Right”",
                time: 318.2,
                altitude: 11,
                velocity: 425,
                description: "The vehicle ejects balance masses to achieve near-zero angle of attack and reorients for safe parachute deployment and onboard radar altimeter ground acquisition.",
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

    /**
     * Override phase transition times from backend-computed values.
     * Backend returns phases_entry = {12_e, 23_e, 34_e, 45_e}
     * representing transitions 1→2, 2→3, 3→4, 4→5.
     * NaN / undefined values are ignored (hardcoded defaults remain).
     *
     * @param {Object} phasesEntry - backend phases_entry object
     */
    setPhaseTimestamps(phasesEntry) {
        if (!phasesEntry) return;

        const isValid = t => typeof t === 'number' && Number.isFinite(t);

        const t12 = phasesEntry['12_e'];
        const t23 = phasesEntry['23_e'];
        const t34 = phasesEntry['34_e'];
        const t45 = phasesEntry['45_e'];

        // Apply to phases.  Index 0 stays at t=0 (entry interface).
        // 1 = Aerothermal build-up         (start time = t12)
        // 2 = Peak heating / aero load     (start time = t23)
        // 3 = Hypersonic glide control     (start time = t34)
        // 4 = SUFR                         (start time = t45)
        if (isValid(t12) && this.phases[1]) {
            this.phases[1].time = t12;
            if (this.phases[0]) this.phases[0].nextPhaseTime = t12;
        }
        if (isValid(t23) && this.phases[2]) {
            this.phases[2].time = t23;
            if (this.phases[1]) this.phases[1].nextPhaseTime = t23;
        }
        if (isValid(t34) && this.phases[3]) {
            this.phases[3].time = t34;
            if (this.phases[2]) this.phases[2].nextPhaseTime = t34;
        }
        if (isValid(t45) && this.phases[4]) {
            this.phases[4].time = t45;
            if (this.phases[3]) this.phases[3].nextPhaseTime = t45;
        }

        console.log('[PhaseController] Backend phase timestamps applied:', {
            t12, t23, t34, t45,
            updatedPhases: this.phases.map(p => ({ name: p.name, time: p.time }))
        });
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
        if (phaseDuration <= 0) return 1; // Guard against identical phase timestamps
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
    
    // Phase-specific configurations keyed to the 5-phase scheme.
    // SUFR's name uses typographic quotes; we match by prefix to be safe.
    getPhaseConfig(phaseName) {
        const configs = {
            "Gravity-dominated motion in a rarefied atmosphere": {
                cameraDistance: 200,
                heatShieldGlow: 0.2,        // negligible heating still
                atmosphericDrag: 0.05,
                thrusterActivity: false
            },
            "Aerothermal build-up": {
                cameraDistance: 150,
                heatShieldGlow: 0.7,        // heating ramping
                atmosphericDrag: 0.4,
                thrusterActivity: true
            },
            "Peak heating and aerodynamic load": {
                cameraDistance: 130,
                heatShieldGlow: 1.0,        // maximum
                atmosphericDrag: 0.9,
                thrusterActivity: true
            },
            "Hypersonic glide control phase": {
                cameraDistance: 120,
                heatShieldGlow: 0.5,
                atmosphericDrag: 0.7,
                thrusterActivity: true
            },
        };
        if (configs[phaseName]) return configs[phaseName];
        if (phaseName && phaseName.startsWith('SUFR')) {
            return {
                cameraDistance: 100,
                heatShieldGlow: 0.2,
                atmosphericDrag: 0.85,
                thrusterActivity: false
            };
        }
        return {};
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
            "Gravity-dominated motion in a rarefied atmosphere": "#ff6600",
            "Aerothermal build-up":                              "#ff8800",
            "Peak heating and aerodynamic load":                 "#ffcc00",
            "Hypersonic glide control phase":                    "#ffaa00",
        };
        if (colors[phaseName]) return colors[phaseName];
        if (phaseName && phaseName.startsWith('SUFR')) return "#00ccff";
        return "#ffffff";
    }
    
    // Reset controller
    reset() {
        this.currentPhaseIndex = 0;
        this.notifyPhaseChange(null, this.phases[0]);
    }
}