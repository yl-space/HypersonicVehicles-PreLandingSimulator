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

    createDOM() {
        const html = `
            <div class="rate-drawer expanded cockpit-drawer" id="rate-drawer">
                <!-- Sci-fi arc gauges -->
                <div class="hud-gauge" id="hud-alt">
                    <svg viewBox="0 0 80 50" class="hud-gauge-svg">
                        <path class="hud-arc-bg" d="M 8 46 A 34 34 0 0 1 72 46"/>
                        <path class="hud-arc-fill" id="hud-alt-arc" d="M 8 46 A 34 34 0 0 1 72 46"/>
                    </svg>
                    <div class="hud-gauge-readout">
                        <span class="hud-gauge-value" id="cockpit-alt-val">---</span>
                        <span class="hud-gauge-unit">mi</span>
                    </div>
                    <span class="hud-gauge-label">ALT</span>
                </div>

                <div class="hud-gauge" id="hud-vel">
                    <svg viewBox="0 0 80 50" class="hud-gauge-svg">
                        <path class="hud-arc-bg" d="M 8 46 A 34 34 0 0 1 72 46"/>
                        <path class="hud-arc-fill hud-arc-cyan" id="hud-vel-arc" d="M 8 46 A 34 34 0 0 1 72 46"/>
                    </svg>
                    <div class="hud-gauge-readout">
                        <span class="hud-gauge-value" id="cockpit-vel-val">---</span>
                        <span class="hud-gauge-unit">mph</span>
                    </div>
                    <span class="hud-gauge-label">VEL</span>
                </div>

                <div class="hud-gauge" id="hud-range">
                    <svg viewBox="0 0 80 50" class="hud-gauge-svg">
                        <path class="hud-arc-bg" d="M 8 46 A 34 34 0 0 1 72 46"/>
                        <path class="hud-arc-fill hud-arc-orange" id="hud-range-arc" d="M 8 46 A 34 34 0 0 1 72 46"/>
                    </svg>
                    <div class="hud-gauge-readout">
                        <span class="hud-gauge-value" id="cockpit-dist-val">---</span>
                        <span class="hud-gauge-unit">mi</span>
                    </div>
                    <span class="hud-gauge-label">RANGE</span>
                </div>

                <!-- Compact readouts for Mach & G -->
                <div class="hud-compact-group">
                    <div class="hud-compact">
                        <span class="hud-compact-label">MACH</span>
                        <span class="hud-compact-value" id="cockpit-mach-val">---</span>
                    </div>
                    <div class="hud-compact">
                        <span class="hud-compact-label">G</span>
                        <span class="hud-compact-value" id="cockpit-g-val">---</span>
                    </div>
                </div>

                <!-- Mode indicator -->
                <div class="hud-mode-indicator" id="hud-mode-indicator">
                    <span class="hud-mode-dot" id="hud-mode-dot"></span>
                    <span class="hud-mode-label" id="hud-mode-label">SIMULATION</span>
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
                        <button class="stepper-btn" data-control="bankAngle" data-delta="-5">‹</button>
                        <span class="stepper-val" id="timeline-bank-val">0.0°</span>
                        <button class="stepper-btn" data-control="bankAngle" data-delta="5">›</button>
                    </div>
                </div>

                <div class="cockpit-divider"></div>

                <div class="timeline-control-stepper" id="aoa-stepper">
                    <span class="rate-label">AoA</span>
                    <div class="stepper-group">
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="-1">‹</button>
                        <span class="stepper-val" id="timeline-aoa-val">-16.0°</span>
                        <button class="stepper-btn" data-control="angleOfAttack" data-delta="1">›</button>
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
            // HUD gauge readouts + arcs
            cockpitAlt:   this.options.container.querySelector('#cockpit-alt-val'),
            cockpitVel:   this.options.container.querySelector('#cockpit-vel-val'),
            cockpitDist:  this.options.container.querySelector('#cockpit-dist-val'),
            cockpitMach:  this.options.container.querySelector('#cockpit-mach-val'),
            cockpitG:     this.options.container.querySelector('#cockpit-g-val'),
            hudAltArc:    this.options.container.querySelector('#hud-alt-arc'),
            hudVelArc:    this.options.container.querySelector('#hud-vel-arc'),
            hudRangeArc:  this.options.container.querySelector('#hud-range-arc'),
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
            this.elements.bankVal.textContent = `${fixed}°`;
        } else if (controlId === 'angleOfAttack' && this.elements.aoaVal) {
            this.elements.aoaVal.textContent = `${fixed}°`;
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
     * Update HUD gauge readouts with live telemetry.
     * @param {object} data - { altitudeMiles, velocityMph, distanceMiles, mach, gForce }
     */
    setTelemetry(data) {
        // The SVG arc has a total path length we use for dashoffset animation.
        // Arc path "M 8 46 A 34 34 0 0 1 72 46" ≈ 106.8 length
        const ARC_LEN = 106.8;

        if (this.elements.cockpitAlt && data.altitudeMiles !== undefined) {
            this.elements.cockpitAlt.textContent = data.altitudeMiles.toFixed(1);
            // Altitude gauge: 0–82 mi (0–132 km entry interface)
            const pct = Math.min(1, data.altitudeMiles / 82);
            this._setArc(this.elements.hudAltArc, pct, ARC_LEN);
        }
        if (this.elements.cockpitVel && data.velocityMph !== undefined) {
            this.elements.cockpitVel.textContent = Math.round(data.velocityMph).toLocaleString();
            // Velocity gauge: 0–13,000 mph (entry speed)
            const pct = Math.min(1, data.velocityMph / 13000);
            this._setArc(this.elements.hudVelArc, pct, ARC_LEN);
        }
        if (this.elements.cockpitDist && data.distanceMiles !== undefined) {
            this.elements.cockpitDist.textContent = data.distanceMiles.toFixed(1);
            // Range gauge: 0–320 mi
            const pct = Math.min(1, data.distanceMiles / 320);
            this._setArc(this.elements.hudRangeArc, pct, ARC_LEN);
        }
        if (this.elements.cockpitMach && data.mach !== undefined) {
            const mach = data.mach;
            this.elements.cockpitMach.textContent = isNaN(mach) ? '0.0' : mach.toFixed(1);
            this.elements.cockpitMach.classList.toggle('cockpit-danger', mach > 15);
            this.elements.cockpitMach.classList.toggle('cockpit-warning', mach > 5 && mach <= 15);
        }
        if (this.elements.cockpitG && data.gForce !== undefined) {
            const g = data.gForce;
            this.elements.cockpitG.textContent = isNaN(g) ? '0.0' : `${g.toFixed(1)}g`;
            this.elements.cockpitG.classList.toggle('cockpit-danger', g > 5);
            this.elements.cockpitG.classList.toggle('cockpit-warning', g > 3 && g <= 5);
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

    /** Animate an SVG arc fill via stroke-dashoffset. */
    _setArc(el, pct, arcLen) {
        if (!el) return;
        el.style.strokeDasharray  = `${arcLen}`;
        el.style.strokeDashoffset = `${arcLen * (1 - pct)}`;
    }
}
