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
        console.log(`Phase changed to: ${phase.name}`);
        
        const phaseTitle = document.getElementById('phase-title');
        const phaseDescription = document.getElementById('phase-description');
        const currentPhaseSpan = document.getElementById('current-phase');
        
        if (phaseTitle) phaseTitle.textContent = phase.name;
        if (phaseDescription) phaseDescription.textContent = phase.description;
        if (currentPhaseSpan) currentPhaseSpan.textContent = phase.name;
    }
    
    getCurrentPhase() {
        return this.currentPhase;
    }
}
