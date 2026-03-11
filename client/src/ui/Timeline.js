export class Timeline {
    constructor(options) {
        this.options = {
            container: document.getElementById('timeline-container'),
            totalTime: 260.65,
            onTimeUpdate: () => {},
            onPlayPause: () => {},
            onSpeedChange: null,
            onReset: () => {},
            onControlAdjust: null,   // fn(controlId, delta) — called when a stepper button is clicked
            ...options
        };

        this.elements = {};
        this.state = {
            currentTime: 0,
            isPlaying: false,
            isScrubbing: false,
            playbackSpeed: 1,
            scrubbingEnabled: false
        };

        this.activePointerId = null;
        this.phaseData = null;
        // Cached attitude values for smooth rendering
        this._bankDeg = 0;
        this._aoaDeg = -16;

        this.init();
    }

    init() {
        this.createDOM();
        this.setupEventListeners();
        this.setScrubbingEnabled(false);
    }

    /**
     * Build the SVG artificial horizon (attitude indicator).
     * The horizon rotates with bank angle and translates with pitch (AoA).
     */
    _buildAttitudeIndicator() {
        const CX = 150, CY = 150, R = 115;
        const PPD = 3.2; // pixels per degree of pitch

        // ── Bank-angle scale ticks (fixed on bezel) ──
        const bankAngles = [
            { deg: 0,    len: 14, sw: 2.5 },
            { deg: 10,   len: 6,  sw: 1 },   { deg: -10,   len: 6,  sw: 1 },
            { deg: 20,   len: 6,  sw: 1 },   { deg: -20,   len: 6,  sw: 1 },
            { deg: 30,   len: 12, sw: 2 },   { deg: -30,   len: 12, sw: 2 },
            { deg: 45,   len: 6,  sw: 1 },   { deg: -45,   len: 6,  sw: 1 },
            { deg: 60,   len: 12, sw: 2 },   { deg: -60,   len: 12, sw: 2 },
            { deg: 90,   len: 14, sw: 2.5 }, { deg: -90,   len: 14, sw: 2.5 },
            { deg: 120,  len: 12, sw: 2 },   { deg: -120,  len: 12, sw: 2 },
            { deg: 150,  len: 6,  sw: 1 },   { deg: -150,  len: 6,  sw: 1 },
            { deg: 180,  len: 14, sw: 2.5 },
        ];
        let bankTicks = '';
        bankAngles.forEach(({ deg, len, sw }) => {
            const rad = (deg - 90) * Math.PI / 180;
            const x1 = CX + (R - 1) * Math.cos(rad);
            const y1 = CY + (R - 1) * Math.sin(rad);
            const x2 = CX + (R + len) * Math.cos(rad);
            const y2 = CY + (R + len) * Math.sin(rad);
            const isMajor = Math.abs(deg) % 30 === 0;
            const opacity = isMajor ? 0.85 : 0.6;
            const color = Math.abs(deg) >= 90 ? `rgba(255,200,100,${opacity})` : `rgba(255,255,255,${opacity})`;
            bankTicks += `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${color}" stroke-width="${sw}"/>`;
        });

        // ── Pitch ladder lines (move with the horizon) ──
        let pitchLines = '';
        for (let deg = -90; deg <= 90; deg += 5) {
            if (deg === 0) continue;
            const y = CY - deg * PPD;
            const absDeg = Math.abs(deg);
            const isMajor = deg % 10 === 0;

            let halfW;
            if (absDeg % 30 === 0) {
                halfW = 40;
            } else if (isMajor) {
                halfW = 30;
            } else {
                halfW = 15;
            }

            const gap = 6;
            const sw = isMajor ? 1.5 : 1;
            const color = deg > 0 ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.55)';
            const dashAttr = deg < 0 ? ' stroke-dasharray="4,3"' : '';

            // Left segment
            pitchLines += `<line x1="${CX - halfW}" y1="${y}" x2="${CX - gap}" y2="${y}" stroke="${color}" stroke-width="${sw}"${dashAttr}/>`;
            // Right segment
            pitchLines += `<line x1="${CX + gap}" y1="${y}" x2="${CX + halfW}" y2="${y}" stroke="${color}" stroke-width="${sw}"${dashAttr}/>`;
            // Degree labels on major lines
            if (isMajor) {
                pitchLines += `<text x="${CX - halfW - 6}" y="${y + 3.5}" fill="white" font-size="9" font-family="'Courier New',monospace" text-anchor="end" opacity="0.7">${absDeg}</text>`;
                pitchLines += `<text x="${CX + halfW + 6}" y="${y + 3.5}" fill="white" font-size="9" font-family="'Courier New',monospace" text-anchor="start" opacity="0.7">${absDeg}</text>`;
            }
        }

        return `
            <svg viewBox="0 0 300 300" class="attitude-svg" aria-label="Attitude Indicator">
                <defs>
                    <clipPath id="ai-clip">
                        <circle cx="${CX}" cy="${CY}" r="${R}"/>
                    </clipPath>
                    <radialGradient id="ai-bezel-grad" cx="50%" cy="40%" r="60%">
                        <stop offset="0%" stop-color="#3a3a3a"/>
                        <stop offset="100%" stop-color="#1a1a1a"/>
                    </radialGradient>
                    <linearGradient id="mars-sky" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stop-color="#1a0a08"/>
                        <stop offset="30%"  stop-color="#3d1f1a"/>
                        <stop offset="65%"  stop-color="#c4836a"/>
                        <stop offset="85%"  stop-color="#d4a083"/>
                        <stop offset="100%" stop-color="#e8c4a0"/>
                    </linearGradient>
                    <linearGradient id="mars-ground" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stop-color="#a0522d"/>
                        <stop offset="20%"  stop-color="#8b3a1a"/>
                        <stop offset="50%"  stop-color="#6b2a12"/>
                        <stop offset="100%" stop-color="#3a150a"/>
                    </linearGradient>
                </defs>

                <!-- Bezel ring -->
                <circle cx="${CX}" cy="${CY}" r="${R + 8}" fill="url(#ai-bezel-grad)" stroke="#555" stroke-width="1.5"/>
                <circle cx="${CX}" cy="${CY}" r="${R + 1}" fill="none" stroke="#222" stroke-width="2"/>

                <!-- Bank-angle scale ticks (fixed) -->
                ${bankTicks}

                <!-- Fixed reference triangle at top (index mark) -->
                <polygon points="${CX},${CY - R + 2} ${CX - 7},${CY - R - 10} ${CX + 7},${CY - R - 10}" fill="#e8a830" opacity="0.9"/>

                <!-- Attitude ball (clipped to circle, rotates for bank) -->
                <g clip-path="url(#ai-clip)">
                    <g id="ai-bank-rotate" style="transform-origin: ${CX}px ${CY}px; transition: transform 0.1s ease-out;">
                        <g id="ai-pitch-translate" style="transition: transform 0.1s ease-out;">
                            <!-- Sky -->
                            <rect x="-100" y="${CY - 500}" width="500" height="500" fill="url(#mars-sky)"/>
                            <!-- Ground -->
                            <rect x="-100" y="${CY}" width="500" height="500" fill="url(#mars-ground)"/>
                            <!-- Horizon line -->
                            <line x1="-100" y1="${CY}" x2="400" y2="${CY}" stroke="#e8c4a0" stroke-width="2.5"/>
                            <!-- Sub-horizon accent line -->
                            <line x1="-100" y1="${CY + 1.5}" x2="400" y2="${CY + 1.5}" stroke="rgba(60,20,10,0.5)" stroke-width="1"/>

                            <!-- Pitch ladder -->
                            ${pitchLines}
                        </g>

                        <!-- Rotating bank pointer (triangle at top, inside clip) -->
                        <polygon points="${CX},${CY - R + 5} ${CX - 6},${CY - R + 15} ${CX + 6},${CY - R + 15}" fill="white" opacity="0.85"/>
                    </g>
                </g>

                <!-- Fixed aircraft reference symbol -->
                <line x1="${CX - 55}" y1="${CY}" x2="${CX - 18}" y2="${CY}" stroke="#e8a830" stroke-width="3.5" stroke-linecap="round"/>
                <line x1="${CX + 18}" y1="${CY}" x2="${CX + 55}" y2="${CY}" stroke="#e8a830" stroke-width="3.5" stroke-linecap="round"/>
                <line x1="${CX - 18}" y1="${CY}" x2="${CX - 18}" y2="${CY + 8}" stroke="#e8a830" stroke-width="3.5" stroke-linecap="round"/>
                <line x1="${CX + 18}" y1="${CY}" x2="${CX + 18}" y2="${CY + 8}" stroke="#e8a830" stroke-width="3.5" stroke-linecap="round"/>
                <rect x="${CX - 3}" y="${CY - 2}" width="6" height="4" fill="#e8a830" rx="1"/>

                <!-- Digital readout windows on the AI face -->
                <!-- Bank angle (top) -->
                <rect x="${CX - 22}" y="${CY - R + 18}" width="44" height="15" rx="2" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
                <text id="ai-bank-text" x="${CX}" y="${CY - R + 29}" text-anchor="middle" fill="#e8a830" font-size="10" font-family="'Courier New',monospace">0.0\u00B0</text>

                <!-- AoA (bottom) -->
                <rect x="${CX - 22}" y="${CY + R - 33}" width="44" height="15" rx="2" fill="rgba(0,0,0,0.7)" stroke="rgba(255,255,255,0.15)" stroke-width="0.5"/>
                <text id="ai-aoa-text" x="${CX}" y="${CY + R - 22}" text-anchor="middle" fill="#33ccff" font-size="10" font-family="'Courier New',monospace">-16.0\u00B0</text>

                <!-- Subtle glass glare -->
                <ellipse cx="${CX - 15}" cy="${CY - 30}" rx="${R - 30}" ry="${R - 55}" fill="rgba(255,255,255,0.04)"/>
            </svg>
        `;
    }

    createDOM() {
        const ai = this._buildAttitudeIndicator();

        // ── Floating PFD panel (independent of timeline container) ──
        this._pfdPanel = document.createElement('div');
        this._pfdPanel.id = 'pfd-panel';
        this._pfdPanel.className = 'pfd-panel';
        this._pfdPanel.innerHTML = `
            <div class="ai-container">
                ${ai}
            </div>
            <div class="flight-data-panel">
                <div class="fd-item">
                    <span class="fd-label">ALT</span>
                    <span class="fd-value" id="fd-alt">---</span>
                    <span class="fd-unit">mi</span>
                </div>
                <div class="fd-item">
                    <span class="fd-label">VEL</span>
                    <span class="fd-value" id="fd-vel">---</span>
                    <span class="fd-unit">mph</span>
                </div>
                <div class="fd-item">
                    <span class="fd-label">RNG</span>
                    <span class="fd-value" id="fd-range">---</span>
                    <span class="fd-unit">mi</span>
                </div>
                <div class="fd-divider"></div>
                <div class="fd-item">
                    <span class="fd-label">MACH</span>
                    <span class="fd-value" id="fd-mach">---</span>
                    <span class="fd-unit"></span>
                </div>
                <div class="fd-item">
                    <span class="fd-label">G</span>
                    <span class="fd-value" id="fd-g">---</span>
                    <span class="fd-unit"></span>
                </div>
                <div class="fd-divider"></div>
                <div class="hud-mode-indicator" id="hud-mode-indicator">
                    <span class="hud-mode-dot" id="hud-mode-dot"></span>
                    <span class="hud-mode-label" id="hud-mode-label">SIMULATION</span>
                </div>
            </div>
        `;
        const overlay = document.getElementById('ui-overlay') || document.body;
        overlay.appendChild(this._pfdPanel);

        // ── Timeline container (original rate drawer + controls + progress bar) ──
        const html = `
            <div class="rate-drawer expanded" id="rate-drawer">
                <div class="playback-rate">
                    <span class="rate-label">RATE</span>
                    <div class="rate-buttons" id="rate-buttons">
                        <button class="rate-button" data-rate="0.25">0.25</button>
                        <button class="rate-button" data-rate="0.5">0.5</button>
                        <button class="rate-button active" data-rate="1">1</button>
                        <button class="rate-button" data-rate="2">2</button>
                        <button class="rate-button" data-rate="3">3</button>
                    </div>
                    <span class="rate-label">SEC(S)/SEC</span>
                </div>

                <div class="timeline-ctrl-divider"></div>

                <div class="timeline-control-stepper" id="bank-angle-stepper">
                    <span class="rate-label">BANK</span>
                    <div class="stepper-group">
                        <button class="stepper-btn" data-control="bankAngle" data-delta="-5">&#8249;</button>
                        <span class="stepper-val" id="timeline-bank-val">0.0&deg;</span>
                        <button class="stepper-btn" data-control="bankAngle" data-delta="5">&#8250;</button>
                    </div>
                </div>

                <div class="timeline-ctrl-divider"></div>

                <div class="timeline-control-stepper" id="aoa-stepper">
                    <span class="rate-label">AoA</span>
                    <div class="stepper-group">
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="-1">&#8249;</button>
                        <span class="stepper-val" id="timeline-aoa-val">-16.0&deg;</span>
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="1">&#8250;</button>
                    </div>
                </div>
            </div>
            <div class="timeline-controls">
                <button class="play-button" id="play-button">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path class="play-icon" d="M8 5v14l11-7z" fill="currentColor"></path>
                        <g class="pause-icon" style="display: none;">
                            <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                            <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
                        </g>
                    </svg>
                </button>
                <button class="timeline-reset-button" id="timeline-reset" disabled>
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 5V2L8 6l4 4V7c2.76 0 5 2.24 5 5 0 2.21-1.79 4-4 4-1.38 0-2.6-.7-3.32-1.76l-1.66.96C9 17.91 10.39 19 12 19c3.31 0 6-2.69 6-6s-2.69-6-6-6z" fill="currentColor"></path>
                    </svg>
                </button>

                <div class="timeline-info">
                    <span class="current-time" id="current-time">Feb 18, 2021 03:48:41 pm</span>
                </div>
            </div>

            <div class="timeline-progress-bar is-disabled" id="timeline-progress-bar" aria-disabled="true">
                <div class="timeline-track">
                    <div class="timeline-progress" id="timeline-progress"></div>
                    <div class="timeline-handle" id="timeline-handle"></div>
                    <div class="timeline-markers" id="timeline-markers"></div>
                </div>
                <div class="timeline-tooltip" id="timeline-tooltip">
                    <span class="tooltip-time">00:00</span>
                    <span class="tooltip-phase"></span>
                </div>
            </div>
        `;

        this.options.container.innerHTML = html;

        this.elements = {
            playButton: this.options.container.querySelector('#play-button'),
            playIcon: this.options.container.querySelector('.play-icon'),
            pauseIcon: this.options.container.querySelector('.pause-icon'),
            currentTime: this.options.container.querySelector('#current-time'),
            rateButtons: this.options.container.querySelector('#rate-buttons'),
            rateDrawer: this.options.container.querySelector('#rate-drawer'),
            progressBar: this.options.container.querySelector('#timeline-progress-bar'),
            progress: this.options.container.querySelector('#timeline-progress'),
            handle: this.options.container.querySelector('#timeline-handle'),
            markers: this.options.container.querySelector('#timeline-markers'),
            tooltip: this.options.container.querySelector('#timeline-tooltip'),
            tooltipTime: this.options.container.querySelector('.tooltip-time'),
            tooltipPhase: this.options.container.querySelector('.tooltip-phase'),
            scrubber: this.options.container.querySelector('.timeline-track'),
            resetButton: this.options.container.querySelector('#timeline-reset'),
            bankStepper: this.options.container.querySelector('#bank-angle-stepper'),
            aoaStepper:  this.options.container.querySelector('#aoa-stepper'),
            bankVal:     this.options.container.querySelector('#timeline-bank-val'),
            aoaVal:      this.options.container.querySelector('#timeline-aoa-val'),
            // Attitude indicator (in floating PFD panel)
            aiBankRotate:    this._pfdPanel.querySelector('#ai-bank-rotate'),
            aiPitchTranslate: this._pfdPanel.querySelector('#ai-pitch-translate'),
            aiBankText:      this._pfdPanel.querySelector('#ai-bank-text'),
            aiAoaText:       this._pfdPanel.querySelector('#ai-aoa-text'),
            // Flight data readouts (in floating PFD panel)
            fdAlt:    this._pfdPanel.querySelector('#fd-alt'),
            fdVel:    this._pfdPanel.querySelector('#fd-vel'),
            fdRange:  this._pfdPanel.querySelector('#fd-range'),
            fdMach:   this._pfdPanel.querySelector('#fd-mach'),
            fdG:      this._pfdPanel.querySelector('#fd-g'),
            modeDot:  this._pfdPanel.querySelector('#hud-mode-dot'),
            modeLabel: this._pfdPanel.querySelector('#hud-mode-label'),
        };

        if (this.elements.handle) {
            this.elements.handle.setAttribute('role', 'slider');
            this.elements.handle.setAttribute('aria-label', 'Playback position');
            this.elements.handle.setAttribute('aria-valuemin', '0');
            this.elements.handle.setAttribute('aria-valuemax', String(this.options.totalTime));
            this.elements.handle.setAttribute('aria-valuenow', '0');
            this.elements.handle.setAttribute('tabindex', '-1');
            this.elements.handle.setAttribute('aria-disabled', 'true');
        }
    }

    setupEventListeners() {
        this.elements.playButton.addEventListener('click', () => {
            this.options.onPlayPause();
        });

        if (this.elements.resetButton) {
            this.elements.resetButton.addEventListener('click', () => {
                if (this.elements.resetButton.disabled) return;
                if (typeof this.options.onReset === 'function') {
                    this.options.onReset();
                }
            });
        }

        this.elements.rateButtons.addEventListener('click', (event) => {
            if (event.target.classList.contains('rate-button')) {
                this.elements.rateButtons.querySelectorAll('.rate-button')
                    .forEach(btn => btn.classList.remove('active'));
                event.target.classList.add('active');
                this.state.playbackSpeed = parseFloat(event.target.dataset.rate);
                if (typeof this.options.onSpeedChange === 'function') {
                    this.options.onSpeedChange(this.state.playbackSpeed);
                }
            }
        });

        const progressBar = this.elements.progressBar;
        progressBar.addEventListener('pointerdown', (event) => this.handlePointerDown(event));
        progressBar.addEventListener('pointermove', (event) => this.handlePointerMove(event));
        progressBar.addEventListener('pointerup', (event) => this.handlePointerUp(event));
        progressBar.addEventListener('pointercancel', (event) => this.handlePointerUp(event));
        progressBar.addEventListener('pointerleave', () => this.handlePointerLeave());

        if (this.elements.handle) {
            this.elements.handle.addEventListener('keydown', (event) => this.handleHandleKeydown(event));
        }

        document.addEventListener('keydown', (event) => {
            if (event.key === ' ') {
                event.preventDefault();
                this.options.onPlayPause();
            }
        });

        // Stepper button clicks — forward to SimulationManager via callback
        this.elements.rateDrawer.addEventListener('click', (event) => {
            const btn = event.target.closest('.stepper-btn');
            if (!btn) return;
            const controlId = btn.dataset.control;
            const delta     = parseFloat(btn.dataset.delta);
            if (controlId && !isNaN(delta) && typeof this.options.onControlAdjust === 'function') {
                this.options.onControlAdjust(controlId, delta);
            }
        });
    }

    handlePointerDown(event) {
        if (!this.state.scrubbingEnabled) return;

        this.state.isScrubbing = true;
        this.activePointerId = event.pointerId;
        this.elements.progressBar.classList.add('scrubbing');
        this.elements.progressBar.setPointerCapture?.(event.pointerId);
        this.scrubToEvent(event);
    }

    handlePointerMove(event) {
        if (!this.state.scrubbingEnabled) return;

        if (this.state.isScrubbing && event.pointerId === this.activePointerId) {
            event.preventDefault();
            this.scrubToEvent(event);
        } else {
            this.updateHoverTooltip(event.clientX);
        }
    }

    handlePointerUp(event) {
        if (!this.state.isScrubbing || event.pointerId !== this.activePointerId) return;

        this.scrubToEvent(event);
        this.state.isScrubbing = false;
        this.activePointerId = null;
        this.elements.progressBar.classList.remove('scrubbing');
        this.elements.progressBar.releasePointerCapture?.(event.pointerId);
        this.hideTooltip();
    }

    handlePointerLeave() {
        if (!this.state.isScrubbing) {
            this.hideTooltip();
        }
    }

    handleHandleKeydown(event) {
        if (!this.state.scrubbingEnabled) return;

        let delta = 0;
        const fineStep = event.shiftKey ? 5 : 1;

        if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            delta = fineStep;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
            delta = -fineStep;
        } else if (event.key === 'Home') {
            this.scrubToTime(0);
            event.preventDefault();
            return;
        } else if (event.key === 'End') {
            this.scrubToTime(this.options.totalTime);
            event.preventDefault();
            return;
        } else {
            return;
        }

        event.preventDefault();
        this.scrubToTime(this.state.currentTime + delta);
    }

    scrubToEvent(event) {
        const { offset, time } = this.getRelativePosition(event.clientX);
        this.showTooltip(offset, time);
        this.scrubToTime(time);
    }

    scrubToTime(time) {
        const clamped = Math.max(0, Math.min(time, this.options.totalTime));
        this.state.currentTime = clamped;
        this.renderScrubPosition(clamped);
        if (typeof this.options.onTimeUpdate === 'function') {
            this.options.onTimeUpdate(clamped);
        }
    }

    getRelativePosition(clientX) {
        const rect = this.elements.scrubber.getBoundingClientRect();
        const offset = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const fraction = rect.width ? offset / rect.width : 0;
        return {
            offset,
            time: fraction * this.options.totalTime
        };
    }

    updateHoverTooltip(clientX) {
        if (!this.elements.tooltip || !this.state.scrubbingEnabled) return;
        const { offset, time } = this.getRelativePosition(clientX);
        this.showTooltip(offset, time);
    }

    showTooltip(offset, time) {
        if (!this.elements.tooltip) return;
        this.elements.tooltip.style.left = `${offset}px`;
        this.elements.tooltip.classList.add('visible');
        this.elements.tooltipTime.textContent = this.formatRelativeTime(time);

        if (this.phaseData) {
            const phase = this.getPhaseAtTime(time);
            this.elements.tooltipPhase.textContent = phase ? phase.name : '';
        }
    }

    hideTooltip() {
        if (this.elements.tooltip) {
            this.elements.tooltip.classList.remove('visible');
        }
    }

    update(currentTime, isPlaying) {
        this.state.currentTime = currentTime;
        this.state.isPlaying = isPlaying;

        if (isPlaying) {
            this.elements.playIcon.style.display = 'none';
            this.elements.pauseIcon.style.display = 'block';
            this.elements.playButton.classList.add('playing');
        } else {
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
            this.elements.playButton.classList.remove('playing');
        }

        this.renderScrubPosition(currentTime);
    }

    renderScrubPosition(time) {
        const clamped = Math.max(0, Math.min(time, this.options.totalTime));
        const percentage = this.options.totalTime
            ? (clamped / this.options.totalTime) * 100
            : 0;

        this.elements.progress.style.width = `${percentage}%`;
        if (this.elements.handle) {
            this.elements.handle.style.left = `${percentage}%`;
            this.elements.handle.setAttribute('aria-valuenow', clamped.toFixed(2));
        }

        this.updateTimeDisplay(clamped);
    }

    updateTimeDisplay(time) {
        const date = new Date('2021-02-18T15:48:41');
        date.setSeconds(date.getSeconds() + time);

        const timeStr = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });

        this.elements.currentTime.textContent = timeStr;
    }

    formatRelativeTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    setPhases(phases) {
        this.phaseData = phases;
        this.addPhaseMarkers();
    }

    addPhaseMarkers() {
        if (!this.elements.markers) return;
        this.elements.markers.innerHTML = '';

        if (!this.phaseData) return;

        this.phaseData.forEach(phase => {
            let percentage = this.options.totalTime
                ? (phase.time / this.options.totalTime) * 100
                : 0;
            percentage = Math.max(0, Math.min(percentage, 100));
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${percentage}%`;
            marker.title = phase.name;
            this.elements.markers.appendChild(marker);
        });
    }

    getPhaseAtTime(time) {
        if (!this.phaseData || this.phaseData.length === 0) return null;

        for (let i = this.phaseData.length - 1; i >= 0; i--) {
            if (time >= this.phaseData[i].time) {
                return this.phaseData[i];
            }
        }
        return this.phaseData[0];
    }

    setPlaying(playing) {
        this.state.isPlaying = playing;
    }

    setTime(time) {
        this.state.currentTime = Math.max(0, Math.min(time, this.options.totalTime));
        this.renderScrubPosition(this.state.currentTime);
    }

    setPlaybackSpeed(speed) {
        this.state.playbackSpeed = speed;
        this.elements.rateButtons.querySelectorAll('.rate-button').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.rate) === speed);
        });
    }

    setScrubbingEnabled(enabled) {
        this.state.scrubbingEnabled = enabled;

        if (this.elements.progressBar) {
            this.elements.progressBar.classList.toggle('is-disabled', !enabled);
            this.elements.progressBar.setAttribute('aria-disabled', String(!enabled));
        }

        if (this.elements.handle) {
            this.elements.handle.setAttribute('tabindex', enabled ? '0' : '-1');
            this.elements.handle.setAttribute('aria-disabled', String(!enabled));
        }

        if (!enabled) {
            this.state.isScrubbing = false;
            this.activePointerId = null;
            if (this.elements.progressBar) {
                this.elements.progressBar.classList.remove('scrubbing');
            }
            this.hideTooltip();
        }
    }

    setTotalTime(totalTime) {
        this.options.totalTime = totalTime;
        if (this.elements.handle) {
            this.elements.handle.setAttribute('aria-valuemax', String(totalTime));
        }
        if (this.phaseData) {
            this.addPhaseMarkers();
        }
        this.state.currentTime = Math.min(this.state.currentTime, totalTime);
        this.renderScrubPosition(this.state.currentTime);
    }

    setReplayAvailable(isAvailable) {
        if (!this.elements.resetButton) return;
        this.elements.resetButton.disabled = !isAvailable;
    }

    /**
     * The rate drawer is always visible in both simulation and playback modes.
     * This method is kept for API compatibility but never collapses the drawer.
     * @param {boolean} isPlayback - unused; drawer stays expanded regardless
     */
    setPlaybackMode(isPlayback) {
        if (this.elements.rateDrawer) {
            // Always keep expanded — speed control is available in both modes
            this.elements.rateDrawer.classList.add('expanded');
        }
    }

    // ── Attitude indicator updates ──

    /**
     * Update the attitude indicator from bank angle or angle of attack.
     * Called by SimulationManager via setControlValue().
     */
    _updateAttitude() {
        const PPD = 3.2; // pixels per degree of pitch (matches SVG build)

        // Rotate the entire sky/ground by bank angle
        if (this.elements.aiBankRotate) {
            this.elements.aiBankRotate.style.transform = `rotate(${-this._bankDeg}deg)`;
        }

        // Translate the pitch ladder (positive AoA = nose up = horizon drops = translateY positive)
        if (this.elements.aiPitchTranslate) {
            const offset = this._aoaDeg * PPD;
            this.elements.aiPitchTranslate.style.transform = `translateY(${offset}px)`;
        }

        // Update digital readouts on the AI face
        if (this.elements.aiBankText) {
            this.elements.aiBankText.textContent = `${this._bankDeg.toFixed(1)}\u00B0`;
        }
        if (this.elements.aiAoaText) {
            this.elements.aiAoaText.textContent = `${this._aoaDeg.toFixed(1)}\u00B0`;
        }
    }

    /**
     * Update a control stepper display value + drive the attitude indicator.
     * @param {'bankAngle'|'angleOfAttack'} controlId
     * @param {number} value - Current numeric value
     */
    setControlValue(controlId, value) {
        const fixed = typeof value === 'number' ? value.toFixed(1) : '0.0';
        if (controlId === 'bankAngle') {
            if (this.elements.bankVal) this.elements.bankVal.textContent = `${fixed}\u00B0`;
            this._bankDeg = typeof value === 'number' ? value : 0;
        } else if (controlId === 'angleOfAttack') {
            if (this.elements.aoaVal) this.elements.aoaVal.textContent = `${fixed}\u00B0`;
            this._aoaDeg = typeof value === 'number' ? value : -16;
        }
        this._updateAttitude();
    }

    /**
     * Enable or disable the Bank Angle / AoA stepper buttons.
     * @param {boolean} enabled
     */
    setControlSteppersEnabled(enabled) {
        [this.elements.bankStepper, this.elements.aoaStepper].forEach(el => {
            if (!el) return;
            el.classList.toggle('stepper-disabled', !enabled);
            el.querySelectorAll('.stepper-btn').forEach(btn => {
                btn.disabled = !enabled;
            });
        });
    }

    // ── Flight data readouts ──

    /**
     * Update the digital flight-data readout strip.
     */
    setTelemetry(data) {
        if (this.elements.fdAlt && data.altitudeMiles !== undefined) {
            this.elements.fdAlt.textContent = data.altitudeMiles.toFixed(1);
            this.elements.fdAlt.classList.toggle('fd-warn', data.altitudeMiles < 12);
            this.elements.fdAlt.classList.toggle('fd-danger', data.altitudeMiles < 5);
        }
        if (this.elements.fdVel && data.velocityMph !== undefined) {
            this.elements.fdVel.textContent = Math.round(data.velocityMph).toLocaleString();
        }
        if (this.elements.fdRange && data.distanceMiles !== undefined) {
            this.elements.fdRange.textContent = data.distanceMiles.toFixed(1);
        }
        if (this.elements.fdMach && data.mach !== undefined) {
            const m = isNaN(data.mach) ? 0 : data.mach;
            this.elements.fdMach.textContent = m.toFixed(1);
            this.elements.fdMach.classList.toggle('fd-warn', m > 5 && m <= 15);
            this.elements.fdMach.classList.toggle('fd-danger', m > 15);
        }
        if (this.elements.fdG && data.gForce !== undefined) {
            const g = isNaN(data.gForce) ? 0 : data.gForce;
            this.elements.fdG.textContent = `${g.toFixed(1)}g`;
            this.elements.fdG.classList.toggle('fd-warn', g > 3 && g <= 5);
            this.elements.fdG.classList.toggle('fd-danger', g > 5);
        }
    }

    // ── Mode indicator ──

    setMode(mode) {
        if (this.elements.modeDot) {
            const color = mode === 'PLAYBACK' ? '#3498db' : '#2ecc71';
            this.elements.modeDot.style.background = color;
            this.elements.modeDot.style.boxShadow = `0 0 6px ${color}`;
        }
        if (this.elements.modeLabel) {
            this.elements.modeLabel.textContent = mode === 'PLAYBACK' ? 'PLAYBACK' : 'SIMULATION';
        }
    }
}
