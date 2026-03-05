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

        this.init();
    }

    init() {
        this.createDOM();
        this.setupEventListeners();
        this.setScrubbingEnabled(false);
    }

    /**
     * Build a single round-dial gauge SVG.
     * @param {string} id        — unique prefix
     * @param {string} label     — instrument label (e.g. "ALT")
     * @param {string} unit      — unit text (e.g. "mi")
     * @param {number} maxVal    — full-scale value
     * @param {number} majorDiv  — number of major divisions
     * @param {string} color     — accent color for needle + ticks
     */
    _gaugeHTML(id, label, unit, maxVal, majorDiv, color, size = 'main') {
        const CX = 72;
        const CY = 72;
        const R = 56;
        const START_ANGLE = -130;
        const SWEEP = 260;

        let ticks = '';
        const minorPerMajor = 5;
        const totalMinor = Math.max(1, majorDiv * minorPerMajor);
        for (let i = 0; i <= totalMinor; i++) {
            const angle = START_ANGLE + (SWEEP * i / totalMinor);
            const rad = angle * Math.PI / 180;
            const isMajor = i % minorPerMajor === 0;
            const tickLength = isMajor ? 10 : 5;
            const innerR = R - tickLength;
            const x1 = CX + innerR * Math.cos(rad);
            const y1 = CY + innerR * Math.sin(rad);
            const x2 = CX + R * Math.cos(rad);
            const y2 = CY + R * Math.sin(rad);

            ticks += `<line class="${isMajor ? 'dial-tick-major' : 'dial-tick-minor'}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;

            if (isMajor) {
                const value = Math.round((maxVal / majorDiv) * (i / minorPerMajor));
                const labelR = R - 16;
                const lx = CX + labelR * Math.cos(rad);
                const ly = CY + labelR * Math.sin(rad);
                ticks += `<text class="dial-scale-number" x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="central">${value}</text>`;
            }
        }

        return `
            <div class="dial-gauge dial-gauge-${size}" id="dial-${id}">
                <div class="dial-chassis">
                    <svg viewBox="0 0 144 144" class="dial-svg" aria-hidden="true">
                        <defs>
                            <radialGradient id="dial-face-grad-${id}" cx="50%" cy="45%" r="65%">
                                <stop offset="0%" stop-color="#10161c"/>
                                <stop offset="65%" stop-color="#080c10"/>
                                <stop offset="100%" stop-color="#020406"/>
                            </radialGradient>
                            <linearGradient id="dial-glare-grad-${id}" x1="0" y1="0" x2="1" y2="1">
                                <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
                                <stop offset="60%" stop-color="rgba(255,255,255,0.03)"/>
                                <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
                            </linearGradient>
                        </defs>

                        <circle class="dial-outer-ring" cx="${CX}" cy="${CY}" r="${R + 6}"/>
                        <circle class="dial-inner-ring" cx="${CX}" cy="${CY}" r="${R + 2}"/>
                        <circle class="dial-face" cx="${CX}" cy="${CY}" r="${R}" fill="url(#dial-face-grad-${id})"/>

                        <g id="${id}-gyro" class="dial-gyro" style="transform-origin: ${CX}px ${CY}px; transform: rotate(0deg); transition: transform 0.12s ease-out;">
                            <circle class="dial-gyro-ring" cx="${CX}" cy="${CY}" r="${R - 22}"/>
                            <line class="dial-gyro-axis" x1="${CX - (R - 24)}" y1="${CY}" x2="${CX + (R - 24)}" y2="${CY}"/>
                            <line class="dial-gyro-axis" x1="${CX}" y1="${CY - (R - 24)}" x2="${CX}" y2="${CY + (R - 24)}"/>
                        </g>

                        <g class="dial-scale">${ticks}</g>
                        <line class="dial-reference-line" x1="${CX - R + 8}" y1="${CY}" x2="${CX + R - 8}" y2="${CY}"/>

                        <g id="${id}-needle" class="dial-needle-group" style="transform-origin: ${CX}px ${CY}px; transform: rotate(${START_ANGLE}deg); transition: transform 0.12s ease-out;">
                            <line class="dial-needle-tail" x1="${CX - 14}" y1="${CY}" x2="${CX - 2}" y2="${CY}"/>
                            <line class="dial-needle-main" x1="${CX}" y1="${CY}" x2="${CX + R - 12}" y2="${CY}" stroke="${color}"/>
                            <circle class="dial-needle-tip" cx="${CX + R - 12}" cy="${CY}" r="2.2" fill="${color}"/>
                        </g>

                        <circle class="dial-center-cap" cx="${CX}" cy="${CY}" r="6"/>
                        <circle class="dial-center-core" cx="${CX}" cy="${CY}" r="2.8" fill="${color}"/>

                        <rect class="dial-digital-window" x="${CX - 26}" y="${CY + 18}" width="52" height="16" rx="2.5"/>
                        <text id="${id}-digital" class="dial-digital-value" x="${CX}" y="${CY + 30}" text-anchor="middle" fill="${color}">---</text>
                        <text class="dial-unit-text" x="${CX}" y="${CY + 44}" text-anchor="middle">${unit || ''}</text>
                        <ellipse class="dial-glare" cx="${CX - 10}" cy="${CY - 18}" rx="${R - 18}" ry="${R - 30}" fill="url(#dial-glare-grad-${id})"/>
                    </svg>
                    <span class="dial-label">${label}</span>
                </div>
            </div>
        `;
    }

    createDOM() {
        const gauges = [
            this._gaugeHTML('alt', 'ALT', 'mi', 80, 8, '#7dff8a', 'main'),
            this._gaugeHTML('vel', 'VEL', 'x1000 mph', 13, 13, '#68d9ff', 'main'),
            this._gaugeHTML('range', 'RNG', 'mi', 320, 8, '#ffad66', 'main'),
        ];

        const smallGauges = [
            this._gaugeHTML('mach', 'MACH', '', 30, 6, '#ffd45b', 'aux'),
            this._gaugeHTML('gforce', 'G', 'g', 10, 10, '#ff687c', 'aux'),
        ];

        const html = `
            <div class="rate-drawer expanded cockpit-drawer" id="rate-drawer">
                <div class="cockpit-instrument-cluster">
                    <div class="dial-panel">
                        <div class="dial-row-main">
                            ${gauges.join('')}
                        </div>
                        <div class="dial-row-aux">
                            ${smallGauges.join('')}
                            <div class="hud-mode-indicator" id="hud-mode-indicator">
                                <span class="hud-mode-dot" id="hud-mode-dot"></span>
                                <span class="hud-mode-label" id="hud-mode-label">SIMULATION</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="cockpit-divider-thick"></div>

                <!-- Playback rate controls -->
                <div class="playback-rate">
                    <span class="rate-label">RATE</span>
                    <div class="rate-buttons" id="rate-buttons">
                        <button class="rate-button" data-rate="0.25">0.25</button>
                        <button class="rate-button" data-rate="0.5">0.5</button>
                        <button class="rate-button active" data-rate="1">1</button>
                        <button class="rate-button" data-rate="2">2</button>
                        <button class="rate-button" data-rate="3">3</button>
                    </div>
                    <span class="rate-label">SEC/S</span>
                </div>

                <div class="cockpit-divider-thick"></div>

                <!-- Control steppers -->
                <div class="timeline-control-stepper" id="bank-angle-stepper">
                    <span class="rate-label">BANK</span>
                    <div class="stepper-group">
                        <button class="stepper-btn" data-control="bankAngle" data-delta="-5">&#8249;</button>
                        <span class="stepper-val" id="timeline-bank-val">0.0&deg;</span>
                        <button class="stepper-btn" data-control="bankAngle" data-delta="5">&#8250;</button>
                    </div>
                </div>

                <div class="cockpit-divider"></div>

                <div class="timeline-control-stepper" id="aoa-stepper">
                    <span class="rate-label">AoA</span>
                    <div class="stepper-group">
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="-1">&#8249;</button>
                        <span class="stepper-val" id="timeline-aoa-val">-16.0&deg;</span>
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="1">&#8250;</button>
                    </div>
                </div>

                <!-- Timeline row (play, time, progress bar) -->
                <div class="drawer-timeline-row">
                    <div class="timeline-info">
                        <span class="current-time" id="current-time">Feb 18, 2021 03:48:41 pm</span>
                    </div>
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
            altGauge:     this.options.container.querySelector('#dial-alt'),
            velGauge:     this.options.container.querySelector('#dial-vel'),
            rangeGauge:   this.options.container.querySelector('#dial-range'),
            machGauge:    this.options.container.querySelector('#dial-mach'),
            gGauge:       this.options.container.querySelector('#dial-gforce'),
            altNeedle:    this.options.container.querySelector('#alt-needle'),
            altGyro:      this.options.container.querySelector('#alt-gyro'),
            altDigital:   this.options.container.querySelector('#alt-digital'),
            velNeedle:    this.options.container.querySelector('#vel-needle'),
            velGyro:      this.options.container.querySelector('#vel-gyro'),
            velDigital:   this.options.container.querySelector('#vel-digital'),
            rangeNeedle:  this.options.container.querySelector('#range-needle'),
            rangeGyro:    this.options.container.querySelector('#range-gyro'),
            rangeDigital: this.options.container.querySelector('#range-digital'),
            machNeedle:   this.options.container.querySelector('#mach-needle'),
            machGyro:     this.options.container.querySelector('#mach-gyro'),
            machDigital:  this.options.container.querySelector('#mach-digital'),
            gNeedle:      this.options.container.querySelector('#gforce-needle'),
            gGyro:        this.options.container.querySelector('#gforce-gyro'),
            gDigital:     this.options.container.querySelector('#gforce-digital'),
            modeDot:      this.options.container.querySelector('#hud-mode-dot'),
            modeLabel:    this.options.container.querySelector('#hud-mode-label'),
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

    /**
     * Update a control stepper display value.
     * @param {'bankAngle'|'angleOfAttack'} controlId
     * @param {number} value - Current numeric value
     */
    setControlValue(controlId, value) {
        const fixed = typeof value === 'number' ? value.toFixed(1) : '0.0';
        if (controlId === 'bankAngle' && this.elements.bankVal) {
            this.elements.bankVal.textContent = `${fixed}\u00B0`;
        } else if (controlId === 'angleOfAttack' && this.elements.aoaVal) {
            this.elements.aoaVal.textContent = `${fixed}\u00B0`;
        }
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

    /**
     * Rotate a dial needle to represent a 0–1 fraction of full scale.
     * Sweep is 240° from –120° (min) to +120° (max).
     */
    _setNeedle(needleEl, fraction, gyroEl = null) {
        if (!needleEl) return;
        const START = -130;
        const SWEEP = 260;
        const clamped = Math.max(0, Math.min(1, fraction));
        const angle = START + SWEEP * clamped;
        needleEl.style.transform = `rotate(${angle}deg)`;

        if (gyroEl) {
            const gyroAngle = -18 + clamped * 36;
            gyroEl.style.transform = `rotate(${gyroAngle}deg)`;
        }
    }

    _setGaugeAlertState(gaugeEl, value, warnAt, dangerAt, mode = 'high') {
        if (!gaugeEl) return;

        gaugeEl.classList.remove('dial-warning', 'dial-danger');
        if (typeof value !== 'number' || isNaN(value)) return;

        const warning = mode === 'low' ? value <= warnAt : value >= warnAt;
        const danger = mode === 'low' ? value <= dangerAt : value >= dangerAt;

        if (danger) {
            gaugeEl.classList.add('dial-danger');
        } else if (warning) {
            gaugeEl.classList.add('dial-warning');
        }
    }

    /**
     * Update cockpit dial gauges with live telemetry.
     * @param {object} data - { altitudeMiles, velocityMph, distanceMiles, mach, gForce }
     */
    setTelemetry(data) {
        if (data.altitudeMiles !== undefined) {
            this._setNeedle(this.elements.altNeedle, data.altitudeMiles / 80, this.elements.altGyro);
            if (this.elements.altDigital) {
                this.elements.altDigital.textContent = data.altitudeMiles.toFixed(1);
            }
            this._setGaugeAlertState(this.elements.altGauge, data.altitudeMiles, 12, 5, 'low');
        }
        if (data.velocityMph !== undefined) {
            this._setNeedle(this.elements.velNeedle, data.velocityMph / 13000, this.elements.velGyro);
            if (this.elements.velDigital) {
                this.elements.velDigital.textContent = (data.velocityMph / 1000).toFixed(1);
            }
            this._setGaugeAlertState(this.elements.velGauge, data.velocityMph, 10000, 12000);
        }
        if (data.distanceMiles !== undefined) {
            this._setNeedle(this.elements.rangeNeedle, data.distanceMiles / 320, this.elements.rangeGyro);
            if (this.elements.rangeDigital) {
                this.elements.rangeDigital.textContent = data.distanceMiles.toFixed(0);
            }
            this._setGaugeAlertState(this.elements.rangeGauge, data.distanceMiles, 20, 8, 'low');
        }
        if (data.mach !== undefined) {
            const mach = isNaN(data.mach) ? 0 : data.mach;
            this._setNeedle(this.elements.machNeedle, mach / 30, this.elements.machGyro);
            if (this.elements.machDigital) {
                this.elements.machDigital.textContent = mach.toFixed(1);
            }
            this._setGaugeAlertState(this.elements.machGauge, mach, 18, 24);
        }
        if (data.gForce !== undefined) {
            const g = isNaN(data.gForce) ? 0 : data.gForce;
            this._setNeedle(this.elements.gNeedle, g / 10, this.elements.gGyro);
            if (this.elements.gDigital) {
                this.elements.gDigital.textContent = g.toFixed(1);
            }
            this._setGaugeAlertState(this.elements.gGauge, g, 4, 6.5);
        }
    }

    /**
     * Update the mode indicator in the HUD drawer.
     * @param {'SIMULATION'|'PLAYBACK'} mode
     */
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
