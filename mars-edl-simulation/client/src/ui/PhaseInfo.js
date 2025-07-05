/**
 * PhaseInfo.js
 * Phase information display component
 */

export class PhaseInfo {
    constructor(phaseController) {
        this.phaseController = phaseController;
        this.element = null;
        
        this.create();
        this.setupEventListeners();
    }
    
    create() {
        this.element = document.createElement('div');
        this.element.className = 'phase-info-container';
        this.element.innerHTML = `
            <div class="phase-header">
                <h3>Mission Phase</h3>
            </div>
            <div class="phase-current">
                <div class="phase-name" id="phase-name">Awaiting Launch</div>
                <div class="phase-progress">
                    <div class="phase-progress-bar" id="phase-progress-bar"></div>
                </div>
            </div>
            <div class="phase-details" id="phase-details">
                <div class="detail-item">
                    <span class="detail-label">Duration:</span>
                    <span class="detail-value" id="phase-duration">--</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Altitude Range:</span>
                    <span class="detail-value" id="phase-altitude">--</span>
                </div>
            </div>
        `;
    }
    
    setupEventListeners() {
        this.phaseController.on('phasechange', (data) => {
            this.updatePhase(data.current);
        });
    }
    
    update() {
        const progress = this.phaseController.getPhaseProgress(
            this.phaseController.currentTime
        );
        
        const progressBar = this.element.querySelector('#phase-progress-bar');
        progressBar.style.width = `${progress * 100}%`;
    }
    
    updatePhase(phase) {
        this.element.querySelector('#phase-name').textContent = phase.name;
        
        // Animate phase change
        this.element.classList.add('phase-changing');
        setTimeout(() => {
            this.element.classList.remove('phase-changing');
        }, 500);
        
        // Update details
        this.updatePhaseDetails(phase);
    }
    
    updatePhaseDetails(phase) {
        const details = this.getPhaseDetails(phase.name);
        
        this.element.querySelector('#phase-duration').textContent = details.duration;
        this.element.querySelector('#phase-altitude').textContent = details.altitudeRange;
    }
    
    getPhaseDetails(phaseName) {
        const details = {
            "Entry Interface": {
                duration: "~80s",
                altitudeRange: "132 - 60 km",
                description: "Initial atmospheric entry"
            },
            "Peak Heating": {
                duration: "~70s",
                altitudeRange: "60 - 25 km",
                description: "Maximum thermal load"
            },
            "Peak Deceleration": {
                duration: "~110s",
                altitudeRange: "25 - 13 km",
                description: "Maximum g-forces"
            },
            "Parachute Deploy": {
                duration: "Variable",
                altitudeRange: "< 13 km",
                description: "Supersonic parachute deployment"
            }
        };
        
        return details[phaseName] || {
            duration: "--",
            altitudeRange: "--",
            description: "--"
        };
    }
}

export default PhaseInfo;