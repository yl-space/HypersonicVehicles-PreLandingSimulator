export class Timeline {
    constructor(options) {
        this.options = {
            container: document.getElementById('timeline-container'),
            totalTime: 260.65,
            onTimeUpdate: () => {},
            onPlayPause: () => {},
            ...options
        };
        
        this.elements = {};
        this.state = {
            currentTime: 0,
            isPlaying: false,
            isScrubbing: false,
            playbackSpeed: 1
        };
        
        this.init();
    }
    
    init() {
        this.createDOM();
        this.setupEventListeners();
    }
    
    createDOM() {
        const html = `
            <div class="timeline-controls">
                <button class="play-button" id="play-button">
                    <svg width="24" height="24" viewBox="0 0 24 24">
                        <path class="play-icon" d="M8 5v14l11-7z" fill="currentColor"/>
                        <g class="pause-icon" style="display: none;">
                            <rect x="6" y="4" width="4" height="16" fill="currentColor"/>
                            <rect x="14" y="4" width="4" height="16" fill="currentColor"/>
                        </g>
                    </svg>
                </button>
                
                <div class="timeline-info">
                    <span class="current-time" id="current-time">Feb 18, 2021 03:48:41 pm</span>
                    <span class="separator">|</span>
                    <span class="playback-rate">
                        RATE 
                        <select id="playback-speed">
                            <option value="0.25">0.25x</option>
                            <option value="0.5">0.5x</option>
                            <option value="1" selected>1x</option>
                            <option value="2">2x</option>
                            <option value="5">5x</option>
                            <option value="10">10x</option>
                        </select>
                        SEC(S)/SEC
                    </span>
                </div>
                
                <button class="replay-button" id="replay-button">
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z" fill="currentColor"/>
                    </svg>
                    REPLAY
                </button>
            </div>
            
            <div class="timeline-scrubber" id="timeline-scrubber">
                <div class="timeline-track">
                    <div class="timeline-buffered" id="timeline-buffered"></div>
                    <div class="timeline-progress" id="timeline-progress">
                        <div class="timeline-handle" id="timeline-handle"></div>
                    </div>
                    <div class="timeline-markers" id="timeline-markers"></div>
                </div>
                <div class="timeline-tooltip" id="timeline-tooltip">
                    <span class="tooltip-time"></span>
                    <span class="tooltip-phase"></span>
                </div>
            </div>
        `;
        
        this.options.container.innerHTML = html;
        
        // Cache elements
        this.elements = {
            playButton: document.getElementById('play-button'),
            playIcon: this.options.container.querySelector('.play-icon'),
            pauseIcon: this.options.container.querySelector('.pause-icon'),
            currentTime: document.getElementById('current-time'),
            playbackSpeed: document.getElementById('playback-speed'),
            replayButton: document.getElementById('replay-button'),
            scrubber: document.getElementById('timeline-scrubber'),
            progress: document.getElementById('timeline-progress'),
            handle: document.getElementById('timeline-handle'),
            tooltip: document.getElementById('timeline-tooltip'),
            markers: document.getElementById('timeline-markers')
        };
        
        // Add CSS
        this.addStyles();
    }
    
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .timeline-scrubber {
                position: relative;
                height: 40px;
                padding: 10px 0;
                cursor: pointer;
            }
            
            .timeline-track {
                position: relative;
                height: 6px;
                background: #333;
                border-radius: 3px;
                overflow: visible;
            }
            
            .timeline-buffered {
                position: absolute;
                height: 100%;
                background: #555;
                border-radius: 3px;
                width: 100%;
            }
            
            .timeline-progress {
                position: absolute;
                height: 100%;
                background: #f60;
                border-radius: 3px;
                width: 0%;
                transition: width 0.1s ease-out;
            }
            
            .timeline-progress.scrubbing {
                transition: none;
            }
            
            .timeline-handle {
                position: absolute;
                right: -8px;
                top: 50%;
                transform: translateY(-50%);
                width: 16px;
                height: 16px;
                background: #fff;
                border-radius: 50%;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                cursor: grab;
                transition: transform 0.1s;
            }
            
            .timeline-handle:hover {
                transform: translateY(-50%) scale(1.2);
            }
            
            .timeline-handle:active {
                cursor: grabbing;
                transform: translateY(-50%) scale(1.1);
            }
            
            .timeline-markers {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 100%;
                pointer-events: none;
            }
            
            .timeline-marker {
                position: absolute;
                width: 2px;
                height: 12px;
                background: rgba(255, 255, 255, 0.3);
                top: -3px;
            }
            
            .timeline-tooltip {
                position: absolute;
                bottom: 100%;
                left: 0;
                background: rgba(0, 0, 0, 0.9);
                color: #fff;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transform: translateY(5px);
                transition: opacity 0.2s, transform 0.2s;
                margin-bottom: 10px;
            }
            
            .timeline-tooltip.visible {
                opacity: 1;
                transform: translateY(0);
            }
            
            .timeline-tooltip::after {
                content: '';
                position: absolute;
                top: 100%;
                left: 50%;
                transform: translateX(-50%);
                border: 5px solid transparent;
                border-top-color: rgba(0, 0, 0, 0.9);
            }
            
            .tooltip-phase {
                display: block;
                color: #f60;
                font-size: 11px;
                margin-top: 2px;
            }
            
            #playback-speed {
                background: transparent;
                border: 1px solid #666;
                color: #fff;
                padding: 2px 5px;
                margin: 0 5px;
                cursor: pointer;
            }
            
            .replay-button {
                display: flex;
                align-items: center;
                gap: 5px;
                background: #444;
                border: none;
                color: #fff;
                padding: 8px 16px;
                border-radius: 4px;
                cursor: pointer;
                font-size: 14px;
                margin-left: auto;
            }
            
            .replay-button:hover {
                background: #555;
            }
        `;
        document.head.appendChild(style);
    }
    
    setupEventListeners() {
        // Play/pause button
        this.elements.playButton.addEventListener('click', () => {
            this.options.onPlayPause();
        });
        
        // Playback speed
        this.elements.playbackSpeed.addEventListener('change', (e) => {
            this.state.playbackSpeed = parseFloat(e.target.value);
            if (this.options.onSpeedChange) {
                this.options.onSpeedChange(this.state.playbackSpeed);
            }
        });
        
        // Replay button
        this.elements.replayButton.addEventListener('click', () => {
            this.options.onTimeUpdate(0);
        });
        
        // Scrubbing
        let scrubbing = false;
        
        const startScrub = (e) => {
            scrubbing = true;
            this.state.isScrubbing = true;
            this.elements.progress.classList.add('scrubbing');
            this.updateTimeFromEvent(e);
        };
        
        const scrub = (e) => {
            if (scrubbing) {
                this.updateTimeFromEvent(e);
            }
            this.updateTooltip(e);
        };
        
        const endScrub = () => {
            scrubbing = false;
            this.state.isScrubbing = false;
            this.elements.progress.classList.remove('scrubbing');
        };
        
        this.elements.scrubber.addEventListener('mousedown', startScrub);
        document.addEventListener('mousemove', scrub);
        document.addEventListener('mouseup', endScrub);
        
        // Touch support
        this.elements.scrubber.addEventListener('touchstart', (e) => {
            startScrub(e.touches[0]);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (scrubbing) {
                scrub(e.touches[0]);
            }
        });
        
        document.addEventListener('touchend', endScrub);
        
        // Tooltip
        this.elements.scrubber.addEventListener('mouseenter', () => {
            this.elements.tooltip.classList.add('visible');
        });
        
        this.elements.scrubber.addEventListener('mouseleave', () => {
            if (!scrubbing) {
                this.elements.tooltip.classList.remove('visible');
            }
        });
    }
    
    updateTimeFromEvent(e) {
        const rect = this.elements.scrubber.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * this.options.totalTime;
        
        this.options.onTimeUpdate(time);
    }
    
    updateTooltip(e) {
        const rect = this.elements.scrubber.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const percentage = x / rect.width;
        const time = percentage * this.options.totalTime;
        
        // Position tooltip
        this.elements.tooltip.style.left = `${x}px`;
        
        // Update tooltip content
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        this.elements.tooltip.querySelector('.tooltip-time').textContent = timeStr;
        
        // Add phase info if available
        if (this.phaseData) {
            const phase = this.getPhaseAtTime(time);
            if (phase) {
                this.elements.tooltip.querySelector('.tooltip-phase').textContent = phase.name;
            }
        }
    }
    
    update(currentTime, isPlaying) {
        this.state.currentTime = currentTime;
        this.state.isPlaying = isPlaying;
        
        // Update play button
        if (isPlaying) {
            this.elements.playIcon.style.display = 'none';
            this.elements.pauseIcon.style.display = 'block';
            this.elements.playButton.classList.add('playing');
        } else {
            this.elements.playIcon.style.display = 'block';
            this.elements.pauseIcon.style.display = 'none';
            this.elements.playButton.classList.remove('playing');
        }
        
        // Update progress bar
        if (!this.state.isScrubbing) {
            const progress = (currentTime / this.options.totalTime) * 100;
            this.elements.progress.style.width = `${progress}%`;
        }
        
        // Update time display
        this.updateTimeDisplay(currentTime);
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
    
    setPhases(phases) {
        this.phaseData = phases;
        this.addPhaseMarkers();
    }
    
    addPhaseMarkers() {
        this.elements.markers.innerHTML = '';
        
        this.phaseData.forEach(phase => {
            const percentage = (phase.time / this.options.totalTime) * 100;
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${percentage}%`;
            marker.title = phase.name;
            this.elements.markers.appendChild(marker);
        });
    }
    
    getPhaseAtTime(time) {
        if (!this.phaseData) return null;
        
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
        this.state.currentTime = time;
        this.update(time, this.state.isPlaying);
    }
    
    setPlaybackSpeed(speed) {
        this.state.playbackSpeed = speed;
        this.elements.playbackSpeed.value = speed;
    }
}