export class PhaseController {
    constructor() {
        this.phases = [];
        this.currentPhase = null;
        this.currentPhaseIndex = 0;
    }
    
    setMissionPhases(phases) {
        this.phases = phases.sort((a, b) => a.startTime - b.startTime);
        this.currentPhaseIndex = 0;
        this.currentPhase = this.phases[0];
    }
    
    updatePhase(currentTime) {
        if (this.phases.length === 0) return;
        
        for (let i = this.phases.length - 1; i >= 0; i--) {
            if (currentTime >= this.phases[i].startTime) {
                if (this.currentPhaseIndex !== i) {
                    this.currentPhaseIndex = i;
                    this.currentPhase = this.phases[i];
                    this.onPhaseChange(this.currentPhase);
                }
                break;
            }
        }
    }
    
    onPhaseChange(phase) {
        const elements = {
            'phase-title': phase.name,
            'phase-description': phase.description,
            'current-phase': phase.name
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
    }
    
    getCurrentPhase() {
        return this.currentPhase;
    }
}