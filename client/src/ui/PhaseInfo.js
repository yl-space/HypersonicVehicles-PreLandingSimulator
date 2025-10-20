/**
 * PhaseInfo.js
 * Displays current phase information and telemetry
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
                    <span class="telemetry-value" id="altitude-value">58.10 miles</span>
                </div>
                <div class="telemetry-item">
                    <span class="telemetry-label">Velocity:</span>
                    <span class="telemetry-value" id="velocity-value">11,984.75 mph</span>
                </div>
            </div>
            
            <div class="phase-description" id="phase-description">
                The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.
            </div>
            
            <div class="countdown">
                <span class="countdown-label">Touchdown in</span>
                <span class="countdown-value" id="countdown-value">0:06:22</span>
            </div>
            
            <div class="next-phase">
                <div class="next-phase-label">Next phase:</div>
                <div class="next-phase-info">
                    <span id="next-phase-name">Guidance Start</span> in 
                    <span id="next-phase-time">0:26</span>
                </div>
            </div>
            
            <div class="phase-progress">
                <div class="progress-bar">
                    <div class="progress-fill" id="phase-progress-bar"></div>
                </div>
                <div class="progress-label" id="phase-progress-label">Phase Progress</div>
            </div>
            
            <div class="additional-telemetry">
                <div class="telemetry-grid">
                    <div class="telemetry-cell">
                        <span class="cell-label">Angle of Attack</span>
                        <span class="cell-value" id="aoa-value">-16.0°</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">Bank Angle</span>
                        <span class="cell-value" id="bank-value">0.0°</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">Mach</span>
                        <span class="cell-value" id="mach-value">0.0</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">G-Force</span>
                        <span class="cell-value" id="gforce-value">0.0g</span>
                    </div>
                </div>
            </div>
            
            <div class="scroll-indicator" id="scroll-indicator">
                <span>Scroll for next phase</span>
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M7 10l5 5 5-5z" fill="currentColor"/>
                </svg>
            </div>
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
            progressBar: document.getElementById('phase-progress-bar'),
            progressLabel: document.getElementById('phase-progress-label'),
            gforce: document.getElementById('gforce-value'),
            aoa: document.getElementById('aoa-value'),
            bank: document.getElementById('bank-value'),
            mach: document.getElementById('mach-value'),
            scrollIndicator: document.getElementById('scroll-indicator')
        };
    }
    
    
    update(phase, vehicleData, currentTime, totalTime) {
        if (!phase) return;
        
        // Update phase title with animation if changed
        if (this.currentPhase !== phase.name) {
            this.currentPhase = phase.name;
            this.animatePhaseChange(phase);
        }
        
        // Update telemetry with proper NaN and velocity handling
        if (vehicleData) {
            // Distance - handle NaN
            const distanceMiles = (vehicleData.distanceToLanding || 0) * 0.621371;
            this.elements.distance.textContent = isNaN(distanceMiles) ? '0.00' : distanceMiles.toFixed(2);
            
            // Altitude - handle NaN
            const altitudeMiles = (vehicleData.altitude || 0) * 0.621371;
            this.elements.altitude.textContent = isNaN(altitudeMiles) ? '0.00 miles' : `${altitudeMiles.toFixed(2)} miles`;
            
            // Velocity - handle different formats (Vector3, scalar, or velocityMagnitude)
            let velocityValue = 0;
            
            // First check for velocityMagnitude property (preferred)
            if (typeof vehicleData.velocityMagnitude === 'number' && !isNaN(vehicleData.velocityMagnitude)) {
                velocityValue = vehicleData.velocityMagnitude;
            }
            // Then check if velocity is a scalar number
            else if (typeof vehicleData.velocity === 'number' && !isNaN(vehicleData.velocity)) {
                velocityValue = Math.abs(vehicleData.velocity);
            }
            // Check if velocity is a Vector3 object
            else if (vehicleData.velocity && typeof vehicleData.velocity === 'object') {
                if (typeof vehicleData.velocity.length === 'function') {
                    velocityValue = vehicleData.velocity.length() * 100000; // Scale up if Vector3
                } else if (typeof vehicleData.velocity.x === 'number') {
                    // Calculate magnitude manually if needed
                    const v = vehicleData.velocity;
                    velocityValue = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 100000;
                }
            }
            
            const velocityMph = velocityValue * 0.621371;
            this.elements.velocity.textContent = isNaN(velocityMph) ? '0 mph' : `${Math.round(velocityMph).toLocaleString()} mph`;
            
            // Additional telemetry
            this.updateAdditionalTelemetry(vehicleData, phase);
        }
        
        // Update countdown
        const timeRemaining = totalTime - currentTime;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        this.elements.countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update next phase info
        if (phase.nextPhase) {
            this.elements.nextPhaseName.textContent = phase.nextPhase;
            const timeToNext = phase.nextPhaseTime - currentTime;
            if (timeToNext > 0) {
                const nextMinutes = Math.floor(timeToNext / 60);
                const nextSeconds = Math.floor(timeToNext % 60);
                this.elements.nextPhaseTime.textContent = 
                    `${nextMinutes}:${nextSeconds.toString().padStart(2, '0')}`;
            }
        } else {
            this.elements.nextPhaseName.textContent = 'Landing';
            this.elements.nextPhaseTime.textContent = 'Soon';
        }
        
        // Update phase progress
        this.updatePhaseProgress(phase, currentTime);
        
        // Hide scroll indicator after first phase
        if (currentTime > 30) {
            this.elements.scrollIndicator.classList.add('hidden');
        }
    }
    
    animatePhaseChange(phase) {
        // Fade out and in effect
        this.elements.title.classList.add('no-animation');
        this.elements.description.classList.add('no-animation');
        
        setTimeout(() => {
            this.elements.title.textContent = phase.name;
            this.elements.description.textContent = phase.description;
            this.elements.title.classList.remove('no-animation');
            this.elements.description.classList.remove('no-animation');
            this.elements.title.classList.add('slide-in-animation');
            this.elements.description.classList.add('fade-in-delayed-animation');
        }, 50);
    }
    
    updateAdditionalTelemetry(vehicleData, phase) {
        // Extract velocity magnitude properly
        let velocity = 0;

        if (typeof vehicleData.velocityMagnitude === 'number' && !isNaN(vehicleData.velocityMagnitude)) {
            velocity = vehicleData.velocityMagnitude;
        } else if (typeof vehicleData.velocity === 'number' && !isNaN(vehicleData.velocity)) {
            velocity = Math.abs(vehicleData.velocity);
        } else if (vehicleData.velocity && typeof vehicleData.velocity === 'object') {
            if (typeof vehicleData.velocity.length === 'function') {
                velocity = vehicleData.velocity.length() * 100000;
            }
        }

        // Angle of Attack - get from vehicle attitude state if available
        const aoa = vehicleData.angleOfAttack !== undefined ? vehicleData.angleOfAttack : -16;
        this.elements.aoa.textContent = `${aoa.toFixed(1)}°`;

        // Bank Angle - get from vehicle attitude state if available
        const bankAngle = vehicleData.bankAngle !== undefined ? vehicleData.bankAngle : 0;
        this.elements.bank.textContent = `${bankAngle.toFixed(1)}°`;

        // Mach number - use actual calculation if available, otherwise simplified
        let mach = 0;
        if (vehicleData.mach !== undefined && !isNaN(vehicleData.mach)) {
            mach = vehicleData.mach;
        } else {
            // Speed of sound on Mars varies with altitude, approximate 240 m/s at surface
            const altitude = vehicleData.altitude || 0;
            const soundSpeed = 240 - (altitude * 0.5); // Rough approximation
            mach = velocity / Math.max(soundSpeed, 150);
        }
        this.elements.mach.textContent = isNaN(mach) ? '0.0' : mach.toFixed(1);

        // G-Force calculation (simplified based on deceleration)
        const gForce = Math.min(velocity / 5000, 8);
        this.elements.gforce.textContent = isNaN(gForce) ? '0.0g' : `${gForce.toFixed(1)}g`;

        // Color code values based on severity
        this.colorCodeValue(this.elements.gforce, gForce, 4, 6);
        this.colorCodeValue(this.elements.mach, mach, 10, 20);

        // Highlight AoA when it changes (SUFR maneuver)
        if (Math.abs(aoa) < 1) {
            this.elements.aoa.style.color = '#00ff00'; // Green for zero AoA
        } else {
            this.elements.aoa.style.color = '#ffffff'; // White for trim AoA
        }

        // Highlight bank angle when non-zero
        if (Math.abs(bankAngle) > 5) {
            this.elements.bank.style.color = '#ffaa00'; // Orange for active banking
        } else {
            this.elements.bank.style.color = '#ffffff'; // White for wings level
        }
    }
    
    colorCodeValue(element, value, warningThreshold, dangerThreshold) {
        if (!element || isNaN(value)) return;
        
        element.classList.remove('value-normal', 'value-warning', 'value-danger');
        
        if (value > dangerThreshold) {
            element.classList.add('value-danger');
        } else if (value > warningThreshold) {
            element.classList.add('value-warning');
        } else {
            element.classList.add('value-normal');
        }
    }
    
    updatePhaseProgress(phase, currentTime) {
        if (!phase.nextPhaseTime) {
            this.elements.progressBar.style.setProperty('--progress-width', '100%');
            return;
        }
        
        const phaseDuration = phase.nextPhaseTime - phase.time;
        const timeInPhase = currentTime - phase.time;
        const progress = Math.max(0, Math.min(100, (timeInPhase / phaseDuration) * 100));
        
        this.elements.progressBar.style.setProperty('--progress-width', `${progress}%`);
        this.elements.progressLabel.textContent = `Phase Progress - ${Math.round(progress)}%`;
    }
    
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `phase-alert alert-${type}`;
        alert.textContent = message;
        alert.classList.add('alert-slide-in');
        
        this.options.container.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('alert-slide-out');
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    }
    
    dispose() {
        // Clean up event listeners and DOM
        if (this.options.container) {
            this.options.container.innerHTML = '';
        }
        
        // Clear references
        this.elements = {};
        this.currentPhase = null;
    }
}