/**
 * PhaseController.js
 * Manages mission phases and transitions
 */

export class PhaseController {
    constructor() {
        this.phases = [];
        this.currentPhase = null;
        this.currentPhaseIndex = -1;
        this.listeners = {};
    }
    
    setMissionPhases(phases) {
        this.phases = phases.sort((a, b) => a.startTime - b.startTime);
        this.reset();
    }
    
    reset() {
        this.currentPhaseIndex = -1;
        this.currentPhase = null;
        if (this.phases.length > 0) {
            this.transitionToPhase(0);
        }
    }
    
    update(currentTime) {
        if (this.phases.length === 0) return;
        
        // Check if we need to transition to next phase
        for (let i = this.currentPhaseIndex + 1; i < this.phases.length; i++) {
            if (currentTime >= this.phases[i].startTime) {
                this.transitionToPhase(i);
            } else {
                break;
            }
        }
    }
    
    transitionToPhase(index) {
        if (index < 0 || index >= this.phases.length) return;
        if (index === this.currentPhaseIndex) return;
        
        const previousPhase = this.currentPhase;
        this.currentPhaseIndex = index;
        this.currentPhase = this.phases[index];
        
        // Emit phase change event
        this.emit('phasechange', {
            current: this.currentPhase,
            previous: previousPhase,
            index: this.currentPhaseIndex
        });
    }
    
    getPhaseAtTime(time) {
        let phase = null;
        for (let i = 0; i < this.phases.length; i++) {
            if (time >= this.phases[i].startTime) {
                phase = this.phases[i];
            } else {
                break;
            }
        }
        return phase;
    }
    
    getPhaseProgress(currentTime) {
        if (!this.currentPhase) return 0;
        
        const nextPhase = this.phases[this.currentPhaseIndex + 1];
        if (!nextPhase) return 1;
        
        const phaseDuration = nextPhase.startTime - this.currentPhase.startTime;
        const timeInPhase = currentTime - this.currentPhase.startTime;
        
        return Math.min(1, timeInPhase / phaseDuration);
    }
    
    // Event system
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }
}

export default PhaseController;