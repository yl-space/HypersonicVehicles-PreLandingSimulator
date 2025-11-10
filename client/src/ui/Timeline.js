export class Timeline {
    constructor(options) {
        this.options = {
            container: document.getElementById('timeline-container'),
            totalTime: 260.65,
            onTimeUpdate: () => {},
            onPlayPause: () => {},
            onSpeedChange: null,
            onReset: () => {},
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
            <div class="timeline-controls">
                <button class="timeline-reset-button" id="timeline-reset" disabled>
                    Reset
                </button>
                <button class="play-button" id="play-button">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path class="play-icon" d="M8 5v14l11-7z" fill="currentColor"></path>
                        <g class="pause-icon" style="display: none;">
                            <rect x="6" y="4" width="4" height="16" fill="currentColor"></rect>
                            <rect x="14" y="4" width="4" height="16" fill="currentColor"></rect>
                        </g>
                    </svg>
                </button>

                <div class="timeline-info">
                    <span class="current-time" id="current-time">Feb 18, 2021 03:48:41 pm</span>
                    <span class="separator">|</span>
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
            progressBar: this.options.container.querySelector('#timeline-progress-bar'),
            progress: this.options.container.querySelector('#timeline-progress'),
            handle: this.options.container.querySelector('#timeline-handle'),
            markers: this.options.container.querySelector('#timeline-markers'),
            tooltip: this.options.container.querySelector('#timeline-tooltip'),
            tooltipTime: this.options.container.querySelector('.tooltip-time'),
            tooltipPhase: this.options.container.querySelector('.tooltip-phase'),
            scrubber: this.options.container.querySelector('.timeline-track'),
            resetButton: this.options.container.querySelector('#timeline-reset')
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
            const percentage = this.options.totalTime
                ? (phase.time / this.options.totalTime) * 100
                : 0;
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
}
