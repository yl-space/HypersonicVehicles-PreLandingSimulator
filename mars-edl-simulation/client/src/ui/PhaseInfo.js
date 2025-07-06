/**
 * PhaseInfo.js
 * UI component for displaying phase information
 */

export class PhaseInfo {
    constructor(options) {
        this.options = {
            container: document.getElementById('phase-info'),
            ...options
        };
        
        this.elements = {};
        this.currentPhase = null;
        
        this.init();
    }
    
    init() {
        this.createDOM();
        this.addStyles();
    }
    
    createDOM() {
        const html = `
            <h1 class="phase-title" id="phase-title">Entry Interface Point</h1>
            
            <div class="telemetry">
                <div class="telemetry-item">
                    <span class="telemetry-value" id="distance-value">307.92</span>
                    <span class="telemetry-label">miles from landing site.</span>
                </div>
                <div class="telemetry-item">
                    <span class="telemetry-label">Altitude:</span>
                    <span class="telemetry-value" id="altitude-value">58.10</span>
                    <span class="telemetry-unit">miles</span>
                </div>
                <div class="telemetry-item">
                    <span class="telemetry-label">Velocity:</span>
                    <span class="telemetry-value" id="velocity-value">11,984.75</span>
                    <span class="telemetry-unit">mph</span>
                </div>
            </div>
            
            <div class="phase-description" id="phase-description">
                The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.
            </div>
            
            <div class="phase-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="phase-progress"></div>
                </div>
                <div class="progress-label" id="progress-label">Phase Progress</div>
            </div>
            
            <div class="countdown">
                <div class="countdown-main">
                    Touchdown in <span id="countdown-value">0:06:22</span>
                </div>
                <div class="next-phase">
                    <span class="next-label">Next phase:</span>
                    <span id="next-phase-name">Guidance Start</span>
                    <span class="next-time">in <span id="next-phase-time">0:26</span></span>
                </div>
            </div>
            
            <div class="phase-indicators">
                <div class="indicator heat-indicator">
                    <div class="indicator-label">HEAT</div>
                    <div class="indicator-bar">
                        <div class="indicator-fill" id="heat-level"></div>
                    </div>
                </div>
                <div class="indicator g-force-indicator">
                    <div class="indicator-label">G-FORCE</div>
                    <div class="indicator-value" id="g-force-value">1.0g</div>
                </div>
                <div class="indicator comm-indicator">
                    <div class="indicator-label">COMM</div>
                    <div class="indicator-status" id="comm-status">NOMINAL</div>
                </div>
            </div>
            
            <button class="phase-scroll-button" id="scroll-for-next">
                <span>Scroll for next phase</span>
                <svg width="16" height="16" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" fill="currentColor"/>
                </svg>
            </button>
        `;
        
        this.options.container.innerHTML = html;
        
        // Cache elements
        this.elements = {
            title: document.getElementById('phase-title'),
            distance: document.getElementById('distance-value'),
            altitude: document.getElementById('altitude-value'),
            velocity: document.getElementById('velocity-value'),
            description: document.getElementById('phase-description'),
            countdown: document.getElementById('countdown-value'),
            nextPhaseName: document.getElementById('next-phase-name'),
            nextPhaseTime: document.getElementById('next-phase-time'),
            phaseProgress: document.getElementById('phase-progress'),
            progressLabel: document.getElementById('progress-label'),
            heatLevel: document.getElementById('heat-level'),
            gForceValue: document.getElementById('g-force-value'),
            commStatus: document.getElementById('comm-status'),
            scrollButton: document.getElementById('scroll-for-next')
        };
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .telemetry {
                margin: 20px 0;
            }
            
            .telemetry-item {
                margin: 10px 0;
                font-size: 16px;
                font-family: 'Arial', sans-serif;
            }
            
            .telemetry-label {
                font-weight: bold;
                color: #ccc;
                margin-right: 8px;
            }
            
            .telemetry-value {
                font-family: 'Courier New', monospace;
                font-size: 18px;
                color: #fff;
                font-weight: bold;
            }
            
            .telemetry-unit {
                color: #999;
                font-size: 14px;
                margin-left: 4px;
            }
            
            .phase-progress {
                margin: 25px 0;
            }
            
            .progress-bar {
                height: 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
                margin-bottom: 8px;
            }
            
            .progress-fill {
                height: 100%;
                background: #f60;
                border-radius: 2px;
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .progress-label {
                font-size: 12px;
                color: #999;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .countdown {
                margin: 25px 0;
            }
            
            .countdown-main {
                font-size: 18px;
                margin-bottom: 10px;
            }
            
            #countdown-value {
                font-family: 'Courier New', monospace;
                font-weight: bold;
                color: #f60;
            }
            
            .next-phase {
                font-size: 14px;
                color: #aaa;
                line-height: 1.6;
            }
            
            .next-label {
                display: block;
                margin-bottom: 4px;
            }
            
            #next-phase-name {
                color: #fff;
                font-weight: bold;
            }
            
            .next-time {
                color: #999;
            }
            
            .phase-indicators {
                display: flex;
                gap: 20px;
                margin: 25px 0;
                padding: 15px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 5px;
            }
            
            .indicator {
                flex: 1;
            }
            
            .indicator-label {
                font-size: 11px;
                color: #999;
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 5px;
            }
            
            .indicator-bar {
                height: 4px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 2px;
                overflow: hidden;
            }
            
            .indicator-fill {
                height: 100%;
                background: linear-gradient(to right, #f60, #ff0);
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .indicator-value,
            .indicator-status {
                font-family: 'Courier New', monospace;
                font-size: 14px;
                color: #0f0;
                font-weight: bold;
            }
            
            .indicator-status.warning {
                color: #ff0;
            }
            
            .indicator-status.critical {
                color: #f00;
            }
            
            .phase-scroll-button {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: none;
                border: 1px solid #666;
                color: #999;
                padding: 8px 16px;
                border-radius: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 1px;
                transition: all 0.3s ease;
                animation: pulse 2s ease-in-out infinite;
            }
            
            .phase-scroll-button:hover {
                color: #fff;
                border-color: #f60;
            }
            
            @keyframes pulse {
                0%, 100% { opacity: 0.7; }
                50% { opacity: 1; }
            }
            
            /* Responsive adjustments */
            @media (max-width: 768px) {
                .phase-indicators {
                    flex-direction: column;
                    gap: 15px;
                }
                
                .telemetry-value {
                    font-size: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    update(phase, vehicleData, currentTime, totalTime) {
        if (!phase || !vehicleData) return;
        
        // Update phase info
        this.elements.title.textContent = phase.name;
        this.elements.description.textContent = phase.description;
        
        // Update telemetry
        this.updateTelemetry(vehicleData);
        
        // Update countdown
        this.updateCountdown(currentTime, totalTime);
        
        // Update next phase info
        this.updateNextPhase(phase, currentTime);
        
        // Update indicators
        this.updateIndicators(vehicleData, phase);
        
        // Update phase progress
        this.updatePhaseProgress(phase, currentTime);
        
        // Update scroll button visibility
        const timeRemaining = totalTime - currentTime;
        this.elements.scrollButton.style.display = timeRemaining > 10 ? 'flex' : 'none';
    }
    
    updateTelemetry(data) {
        // Distance to landing site (simplified calculation)
        const distanceKm = data.distanceToLanding || data.altitude * 2;
        const distanceMiles = distanceKm * 0.621371;
        this.elements.distance.textContent = distanceMiles.toFixed(2);
        
        // Altitude
        const altitudeMiles = data.altitude * 0.621371;
        this.elements.altitude.textContent = altitudeMiles.toFixed(2);
        
        // Velocity (convert km/h to mph)
        const velocityMph = data.velocity * 0.621371;
        this.elements.velocity.textContent = velocityMph.toLocaleString('en-US', {
            maximumFractionDigits: 2
        });
    }
    
    updateCountdown(currentTime, totalTime) {
        const timeRemaining = Math.max(0, totalTime - currentTime);
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        
        this.elements.countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    updateNextPhase(currentPhase, currentTime) {
        // This should come from PhaseController
        const nextPhase = currentPhase.next;
        
        if (nextPhase) {
            this.elements.nextPhaseName.textContent = nextPhase.name;
            
            const timeToNext = Math.max(0, nextPhase.time - currentTime);
            const minutes = Math.floor(timeToNext / 60);
            const seconds = Math.floor(timeToNext % 60);
            
            this.elements.nextPhaseTime.textContent = 
                `${minutes}:${seconds.toString().padStart(2, '0')}`;
        } else {
            this.elements.nextPhaseName.textContent = 'Landing';
            this.elements.nextPhaseTime.textContent = 'Soon';
        }
    }
    
    updateIndicators(data, phase) {
        // Heat level (based on velocity and altitude)
        const heatIntensity = Math.min((data.velocity / 20000) * (50 / (data.altitude + 1)), 1);
        this.elements.heatLevel.style.width = `${heatIntensity * 100}%`;
        
        // G-Force (simplified calculation)
        const gForce = 1 + (data.velocity / 5000) * Math.exp(-data.altitude / 50);
        this.elements.gForceValue.textContent = `${gForce.toFixed(1)}g`;
        
        // Communications status
        const commBlackout = heatIntensity > 0.7;
        this.elements.commStatus.textContent = commBlackout ? 'BLACKOUT' : 'NOMINAL';
        this.elements.commStatus.className = 'indicator-status' + 
            (commBlackout ? ' critical' : '');
    }
    
    updatePhaseProgress(phase, currentTime) {
        // This needs phase duration info from PhaseController
        // For now, use a simple calculation
        const phaseProgress = Math.min((currentTime - phase.time) / 60, 1) * 100;
        this.elements.phaseProgress.style.width = `${phaseProgress}%`;
    }
    
    // Animation methods
    showPhaseTransition(fromPhase, toPhase) {
        // Add transition animation
        this.options.container.classList.add('phase-transition');
        
        setTimeout(() => {
            this.options.container.classList.remove('phase-transition');
        }, 500);
    }
    
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `phase-alert ${type}`;
        alert.textContent = message;
        
        this.options.container.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('show');
        }, 10);
        
        setTimeout(() => {
            alert.classList.remove('show');
            setTimeout(() => alert.remove(), 300);
        }, 3000);
    }
}