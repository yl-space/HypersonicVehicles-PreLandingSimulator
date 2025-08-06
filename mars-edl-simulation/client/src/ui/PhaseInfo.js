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
                        <span class="cell-label">G-Force</span>
                        <span class="cell-value" id="gforce-value">0.0g</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">Heat Shield</span>
                        <span class="cell-value" id="heat-value">0°C</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">Mach</span>
                        <span class="cell-value" id="mach-value">0.0</span>
                    </div>
                    <div class="telemetry-cell">
                        <span class="cell-label">Drag</span>
                        <span class="cell-value" id="drag-value">0.0 kN</span>
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
            heat: document.getElementById('heat-value'),
            mach: document.getElementById('mach-value'),
            drag: document.getElementById('drag-value'),
            scrollIndicator: document.getElementById('scroll-indicator')
        };
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .phase-info {
                animation: fadeIn 0.5s ease-out;
            }
            
            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
            
            .phase-title {
                font-size: 36px;
                font-weight: 300;
                margin-bottom: 20px;
                letter-spacing: -0.5px;
                animation: slideIn 0.6s ease-out;
            }
            
            @keyframes slideIn {
                from { transform: translateX(-30px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            
            .telemetry {
                margin: 20px 0;
            }
            
            .telemetry-item {
                margin: 10px 0;
                font-size: 16px;
                display: flex;
                align-items: baseline;
                gap: 8px;
            }
            
            .telemetry-label {
                font-weight: 600;
                color: #ccc;
            }
            
            .telemetry-value {
                font-family: 'Courier New', monospace;
                font-size: 20px;
                font-weight: bold;
                color: #fff;
                min-width: 100px;
                display: inline-block;
            }
            
            .phase-description {
                margin: 25px 0;
                line-height: 1.7;
                color: #aaa;
                font-size: 15px;
            }
            
            .countdown {
                margin: 25px 0;
                padding: 15px;
                background: rgba(255, 102, 0, 0.1);
                border-left: 3px solid #f60;
                border-radius: 0 5px 5px 0;
            }
            
            .countdown-label {
                font-size: 14px;
                color: #999;
                margin-right: 10px;
            }
            
            .countdown-value {
                font-size: 24px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
                color: #f60;
            }
            
            .next-phase {
                margin: 20px 0;
                font-size: 14px;
                color: #888;
            }
            
            .next-phase-label {
                margin-bottom: 5px;
            }
            
            .next-phase-info {
                color: #ccc;
            }
            
            #next-phase-name {
                color: #fff;
                font-weight: 600;
            }
            
            #next-phase-time {
                font-family: 'Courier New', monospace;
                color: #f60;
            }
            
            .phase-progress {
                margin: 30px 0 20px;
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
                background: linear-gradient(90deg, #f60, #ff8800);
                border-radius: 2px;
                width: 0%;
                transition: width 0.3s ease-out;
            }
            
            .progress-label {
                font-size: 11px;
                color: #666;
                text-transform: uppercase;
                letter-spacing: 1px;
            }
            
            .additional-telemetry {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid rgba(255, 255, 255, 0.1);
            }
            
            .telemetry-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 15px;
            }
            
            .telemetry-cell {
                background: rgba(0, 0, 0, 0.3);
                padding: 12px 15px;
                border-radius: 5px;
                display: flex;
                flex-direction: column;
                gap: 5px;
            }
            
            .cell-label {
                font-size: 11px;
                color: #888;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .cell-value {
                font-size: 18px;
                font-weight: bold;
                font-family: 'Courier New', monospace;
            }
            
            .scroll-indicator {
                position: absolute;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 12px;
                color: #666;
                animation: bounce 2s infinite;
                cursor: pointer;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateX(-50%) translateY(0); }
                50% { transform: translateX(-50%) translateY(5px); }
            }
            
            .scroll-indicator:hover {
                color: #999;
            }
            
            /* Responsive */
            @media (max-width: 768px) {
                .phase-title {
                    font-size: 28px;
                }
                
                .telemetry-value {
                    font-size: 18px;
                }
                
                .telemetry-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
        document.head.appendChild(style);
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
            this.elements.scrollIndicator.style.display = 'none';
        }
    }
    
    animatePhaseChange(phase) {
        // Fade out and in effect
        this.elements.title.style.animation = 'none';
        this.elements.description.style.animation = 'none';
        
        setTimeout(() => {
            this.elements.title.textContent = phase.name;
            this.elements.description.textContent = phase.description;
            this.elements.title.style.animation = 'slideIn 0.6s ease-out';
            this.elements.description.style.animation = 'fadeIn 0.6s ease-out 0.2s both';
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
        
        // G-Force calculation (simplified)
        const gForce = Math.min(velocity / 5000, 8);
        this.elements.gforce.textContent = isNaN(gForce) ? '0.0g' : `${gForce.toFixed(1)}g`;
        
        // Heat shield temperature (based on velocity)
        const temp = Math.min(velocity * 0.15, 2000);
        this.elements.heat.textContent = isNaN(temp) ? '0°C' : `${Math.round(temp)}°C`;
        
        // Mach number (simplified)
        const mach = velocity / 343; // Speed of sound approximation
        this.elements.mach.textContent = isNaN(mach) ? '0.0' : mach.toFixed(1);
        
        // Drag force (simplified)
        const altitude = vehicleData.altitude || 0;
        const drag = (velocity / 100) * (1 - altitude / 132);
        this.elements.drag.textContent = isNaN(drag) ? '0.0 kN' : `${drag.toFixed(1)} kN`;
        
        // Color code values based on severity
        this.colorCodeValue(this.elements.gforce, gForce, 4, 6);
        this.colorCodeValue(this.elements.heat, temp, 1000, 1500);
        this.colorCodeValue(this.elements.mach, mach, 10, 20);
    }
    
    colorCodeValue(element, value, warningThreshold, dangerThreshold) {
        if (!element || isNaN(value)) return;
        
        element.style.color = value > dangerThreshold ? '#ff3333' :
                             value > warningThreshold ? '#ff9933' : '#00ff66';
    }
    
    updatePhaseProgress(phase, currentTime) {
        if (!phase.nextPhaseTime) {
            this.elements.progressBar.style.width = '100%';
            return;
        }
        
        const phaseDuration = phase.nextPhaseTime - phase.time;
        const timeInPhase = currentTime - phase.time;
        const progress = Math.max(0, Math.min(100, (timeInPhase / phaseDuration) * 100));
        
        this.elements.progressBar.style.width = `${progress}%`;
        this.elements.progressLabel.textContent = `Phase Progress - ${Math.round(progress)}%`;
    }
    
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `phase-alert alert-${type}`;
        alert.textContent = message;
        alert.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            background: ${type === 'warning' ? '#ff6600' : '#00ccff'};
            color: #fff;
            padding: 15px 25px;
            border-radius: 5px;
            font-weight: bold;
            animation: alertSlide 0.5s ease-out;
            z-index: 1000;
        `;
        
        this.options.container.appendChild(alert);
        
        setTimeout(() => {
            alert.style.animation = 'alertSlide 0.5s ease-out reverse';
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