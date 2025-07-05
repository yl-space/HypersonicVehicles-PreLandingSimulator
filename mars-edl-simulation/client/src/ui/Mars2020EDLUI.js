/**
 * Mars 2020 EDL UI Component
 * 
 * Specialized UI for Mars 2020 Entry, Descent, Landing simulation
 * Matches NASA Eyes on the Solar System style
 * Includes CSV file upload, timeline controls, and real-time telemetry
 */

export class Mars2020EDLUI {
    constructor(simulation) {
        this.simulation = simulation;
        this.isInitialized = false;
        
        // UI elements
        this.elements = {};
        
        // Event handlers
        this.onFileUpload = null;
        this.onPlayPause = null;
        this.onReset = null;
        this.onSpeedChange = null;
        this.onSeek = null;
        
        this.init();
    }
    
    init() {
        this.createUI();
        this.bindEvents();
        this.isInitialized = true;
    }
    
    createUI() {
        // Create main UI container
        this.createMainContainer();
        
        // Create file upload section
        this.createFileUploadSection();
        
        // Create timeline controls
        this.createTimelineControls();
        
        // Create telemetry display
        this.createTelemetryDisplay();
        
        // Create phase indicators
        this.createPhaseIndicators();
        
        // Create camera controls
        this.createCameraControls();
        
        // Create mission info
        this.createMissionInfo();
    }
    
    createMainContainer() {
        // Create overlay container
        const overlay = document.createElement('div');
        overlay.className = 'mars2020-ui-overlay';
        overlay.innerHTML = `
            <div class="ui-container">
                <div class="top-panel">
                    <div class="mission-title">
                        <h1>Mars 2020 EDL Simulation</h1>
                        <p>Entry Interface to Parachute Deployment</p>
                    </div>
                    <div class="mission-status">
                        <span id="mission-status">Ready</span>
                    </div>
                </div>
                
                <div class="left-panel">
                    <div id="file-upload-section"></div>
                    <div id="timeline-controls"></div>
                    <div id="camera-controls"></div>
                </div>
                
                <div class="right-panel">
                    <div id="telemetry-display"></div>
                    <div id="phase-indicators"></div>
                </div>
                
                <div class="bottom-panel">
                    <div id="mission-info"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(overlay);
        this.elements.overlay = overlay;
    }
    
    createFileUploadSection() {
        const container = document.getElementById('file-upload-section');
        container.innerHTML = `
            <div class="panel-section">
                <h3>Trajectory Data</h3>
                <div class="file-upload-area">
                    <input type="file" id="csv-file-input" accept=".csv" style="display: none;">
                    <button id="upload-btn" class="upload-btn">
                        <span class="upload-icon">📁</span>
                        Upload CSV File
                    </button>
                    <div class="file-info" id="file-info" style="display: none;">
                        <span id="file-name"></span>
                        <span id="data-points"></span>
                    </div>
                </div>
                <div class="sample-data">
                    <p>Or use sample data:</p>
                    <button id="load-sample" class="sample-btn">Load Sample Mars 2020 Data</button>
                </div>
            </div>
        `;
    }
    
    createTimelineControls() {
        const container = document.getElementById('timeline-controls');
        container.innerHTML = `
            <div class="panel-section">
                <h3>Timeline Controls</h3>
                <div class="timeline-controls">
                    <div class="control-buttons">
                        <button id="play-pause-btn" class="control-btn" disabled>
                            <span class="play-icon">▶</span>
                            <span class="pause-icon" style="display: none;">⏸</span>
                        </button>
                        <button id="reset-btn" class="control-btn" disabled>⏮</button>
                    </div>
                    
                    <div class="timeline-slider">
                        <input type="range" id="timeline-slider" min="0" max="260.65" step="0.1" value="0" disabled>
                        <div class="timeline-labels">
                            <span>Entry Interface (0s)</span>
                            <span>Parachute Deployment (260.65s)</span>
                        </div>
                    </div>
                    
                    <div class="speed-controls">
                        <label>Speed:</label>
                        <select id="speed-selector" disabled>
                            <option value="0.1">0.1x</option>
                            <option value="0.25">0.25x</option>
                            <option value="0.5">0.5x</option>
                            <option value="1" selected>1x</option>
                            <option value="2">2x</option>
                            <option value="5">5x</option>
                            <option value="10">10x</option>
                        </select>
                    </div>
                    
                    <div class="time-display">
                        <span>Time: </span>
                        <span id="current-time">00:00.0</span>
                        <span> / </span>
                        <span id="total-time">04:20.6</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    createTelemetryDisplay() {
        const container = document.getElementById('telemetry-display');
        container.innerHTML = `
            <div class="panel-section">
                <h3>Real-Time Telemetry</h3>
                <div class="telemetry-grid">
                    <div class="telemetry-item">
                        <span class="label">Altitude:</span>
                        <span id="altitude-value" class="value">-- km</span>
                    </div>
                    <div class="telemetry-item">
                        <span class="label">Velocity:</span>
                        <span id="velocity-value" class="value">-- km/s</span>
                    </div>
                    <div class="telemetry-item">
                        <span class="label">Temperature:</span>
                        <span id="temperature-value" class="value">-- K</span>
                    </div>
                    <div class="telemetry-item">
                        <span class="label">G-Force:</span>
                        <span id="gforce-value" class="value">-- G</span>
                    </div>
                    <div class="telemetry-item">
                        <span class="label">Time to Parachute:</span>
                        <span id="time-to-parachute" class="value">--</span>
                    </div>
                    <div class="telemetry-item">
                        <span class="label">Phase:</span>
                        <span id="current-phase" class="value">Entry Interface</span>
                    </div>
                </div>
                
                <div class="telemetry-charts">
                    <div class="chart-container">
                        <h4>Altitude vs Time</h4>
                        <canvas id="altitude-chart" width="300" height="150"></canvas>
                    </div>
                    <div class="chart-container">
                        <h4>Velocity vs Time</h4>
                        <canvas id="velocity-chart" width="300" height="150"></canvas>
                    </div>
                </div>
            </div>
        `;
    }
    
    createPhaseIndicators() {
        const container = document.getElementById('phase-indicators');
        container.innerHTML = `
            <div class="panel-section">
                <h3>Mission Phases</h3>
                <div class="phase-timeline">
                    <div class="phase-item" data-phase="Entry Interface">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Entry Interface</span>
                        <span class="phase-time">0s</span>
                    </div>
                    <div class="phase-item" data-phase="Early Entry">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Early Entry</span>
                        <span class="phase-time">~10s</span>
                    </div>
                    <div class="phase-item" data-phase="Peak Heating">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Peak Heating</span>
                        <span class="phase-time">~80s</span>
                    </div>
                    <div class="phase-item" data-phase="Peak Deceleration">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Peak Deceleration</span>
                        <span class="phase-time">~100s</span>
                    </div>
                    <div class="phase-item" data-phase="Approach">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Approach</span>
                        <span class="phase-time">~200s</span>
                    </div>
                    <div class="phase-item" data-phase="Parachute Deployment">
                        <div class="phase-marker"></div>
                        <span class="phase-name">Parachute Deployment</span>
                        <span class="phase-time">260.65s</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    createCameraControls() {
        const container = document.getElementById('camera-controls');
        container.innerHTML = `
            <div class="panel-section">
                <h3>Camera Views</h3>
                <div class="camera-buttons">
                    <button id="camera-follow" class="camera-btn active">Follow Vehicle</button>
                    <button id="camera-orbit" class="camera-btn">Orbit View</button>
                    <button id="camera-top" class="camera-btn">Top View</button>
                    <button id="camera-side" class="camera-btn">Side View</button>
                </div>
            </div>
        `;
    }
    
    createMissionInfo() {
        const container = document.getElementById('mission-info');
        container.innerHTML = `
            <div class="mission-stats">
                <div class="stat-item">
                    <span class="stat-label">Mission Duration:</span>
                    <span id="mission-duration" class="stat-value">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Distance Traveled:</span>
                    <span id="distance-traveled" class="stat-value">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max Velocity:</span>
                    <span id="max-velocity" class="stat-value">--</span>
                </div>
                <div class="stat-item">
                    <span class="stat-label">Max G-Force:</span>
                    <span id="max-gforce" class="stat-value">--</span>
                </div>
            </div>
        `;
    }
    
    bindEvents() {
        // File upload events
        const uploadBtn = document.getElementById('upload-btn');
        const fileInput = document.getElementById('csv-file-input');
        const loadSampleBtn = document.getElementById('load-sample');
        
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        loadSampleBtn.addEventListener('click', () => this.loadSampleData());
        
        // Timeline control events
        const playPauseBtn = document.getElementById('play-pause-btn');
        const resetBtn = document.getElementById('reset-btn');
        const timelineSlider = document.getElementById('timeline-slider');
        const speedSelector = document.getElementById('speed-selector');
        
        playPauseBtn.addEventListener('click', () => this.handlePlayPause());
        resetBtn.addEventListener('click', () => this.handleReset());
        timelineSlider.addEventListener('input', (e) => this.handleSeek(e.target.value));
        speedSelector.addEventListener('change', (e) => this.handleSpeedChange(e.target.value));
        
        // Camera control events
        const cameraButtons = document.querySelectorAll('.camera-btn');
        cameraButtons.forEach(btn => {
            btn.addEventListener('click', (e) => this.handleCameraChange(e.target.id));
        });
    }
    
    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            this.showLoading('Loading trajectory data...');
            
            const success = await this.simulation.loadTrajectoryData(file);
            
            if (success) {
                this.updateFileInfo(file.name);
                this.enableControls();
                this.updateMissionStats();
                this.hideLoading();
            } else {
                this.showError('Failed to load trajectory data');
            }
        } catch (error) {
            console.error('File upload error:', error);
            this.showError('Error loading file: ' + error.message);
        }
    }
    
    async loadSampleData() {
        try {
            this.showLoading('Loading sample Mars 2020 data...');
            
            // Generate sample trajectory data
            const sampleData = this.generateSampleData();
            const success = await this.simulation.loadTrajectoryData(sampleData);
            
            if (success) {
                this.updateFileInfo('Sample Mars 2020 Data');
                this.enableControls();
                this.updateMissionStats();
                this.hideLoading();
            } else {
                this.showError('Failed to load sample data');
            }
        } catch (error) {
            console.error('Sample data error:', error);
            this.showError('Error loading sample data');
        }
    }
    
    generateSampleData() {
        // Generate realistic Mars 2020 EDL trajectory data
        const data = [];
        const timeStep = 0.1; // 100ms intervals
        
        for (let time = 0; time <= 260.65; time += timeStep) {
            // Simplified trajectory model
            const altitude = 132000 * Math.exp(-time / 100) + 13462.9;
            const velocity = 5500 * Math.exp(-time / 80) + 100;
            
            // Convert to J2000 coordinates (simplified)
            const x = 0; // Simplified - could be more complex
            const y = altitude;
            const z = velocity * time * 0.1;
            
            data.push(`${time.toFixed(1)},${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`);
        }
        
        return 'Time(s),X(m),Y(m),Z(m)\n' + data.join('\n');
    }
    
    handlePlayPause() {
        if (this.simulation.isPlaying) {
            this.simulation.pause();
            this.updatePlayPauseButton(false);
        } else {
            this.simulation.play();
            this.updatePlayPauseButton(true);
        }
    }
    
    handleReset() {
        this.simulation.reset();
        this.updatePlayPauseButton(false);
        this.updateTimelineSlider(0);
    }
    
    handleSeek(time) {
        this.simulation.seekTo(parseFloat(time));
    }
    
    handleSpeedChange(speed) {
        this.simulation.setPlaybackSpeed(parseFloat(speed));
    }
    
    handleCameraChange(cameraId) {
        // Update active camera button
        document.querySelectorAll('.camera-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById(cameraId).classList.add('active');
        
        // Set camera mode
        const mode = cameraId.replace('camera-', '');
        this.simulation.setCameraMode(mode);
    }
    
    updateFileInfo(fileName) {
        const fileInfo = document.getElementById('file-info');
        const fileNameSpan = document.getElementById('file-name');
        const dataPointsSpan = document.getElementById('data-points');
        
        fileNameSpan.textContent = fileName;
        dataPointsSpan.textContent = `${this.simulation.trajectoryData.length} data points`;
        fileInfo.style.display = 'block';
    }
    
    enableControls() {
        document.getElementById('play-pause-btn').disabled = false;
        document.getElementById('reset-btn').disabled = false;
        document.getElementById('timeline-slider').disabled = false;
        document.getElementById('speed-selector').disabled = false;
    }
    
    updatePlayPauseButton(isPlaying) {
        const playIcon = document.querySelector('.play-icon');
        const pauseIcon = document.querySelector('.pause-icon');
        
        if (isPlaying) {
            playIcon.style.display = 'none';
            pauseIcon.style.display = 'inline';
        } else {
            playIcon.style.display = 'inline';
            pauseIcon.style.display = 'none';
        }
    }
    
    updateTimelineSlider(time) {
        document.getElementById('timeline-slider').value = time;
        document.getElementById('current-time').textContent = this.formatTime(time);
    }
    
    updateTelemetry(telemetry) {
        document.getElementById('altitude-value').textContent = `${(telemetry.altitude / 1000).toFixed(1)} km`;
        document.getElementById('velocity-value').textContent = `${(telemetry.velocity / 1000).toFixed(2)} km/s`;
        document.getElementById('temperature-value').textContent = `${telemetry.temperature.toFixed(0)} K`;
        document.getElementById('gforce-value').textContent = `${telemetry.gForce.toFixed(1)} G`;
        document.getElementById('time-to-parachute').textContent = this.formatTime(telemetry.timeToParachute);
        document.getElementById('current-phase').textContent = this.simulation.currentPhase;
        
        // Update phase indicators
        this.updatePhaseIndicators();
    }
    
    updatePhaseIndicators() {
        const currentPhase = this.simulation.currentPhase;
        document.querySelectorAll('.phase-item').forEach(item => {
            item.classList.remove('active', 'completed');
            
            if (item.dataset.phase === currentPhase) {
                item.classList.add('active');
            } else if (this.isPhaseCompleted(item.dataset.phase)) {
                item.classList.add('completed');
            }
        });
    }
    
    isPhaseCompleted(phase) {
        const phaseOrder = [
            'Entry Interface',
            'Early Entry', 
            'Peak Heating',
            'Peak Deceleration',
            'Approach',
            'Parachute Deployment'
        ];
        
        const currentIndex = phaseOrder.indexOf(this.simulation.currentPhase);
        const phaseIndex = phaseOrder.indexOf(phase);
        
        return phaseIndex < currentIndex;
    }
    
    updateMissionStats() {
        const stats = this.simulation.getMissionStats();
        if (!stats) return;
        
        document.getElementById('mission-duration').textContent = this.formatTime(stats.duration);
        document.getElementById('distance-traveled').textContent = `${(stats.totalDistance / 1000).toFixed(1)} km`;
        document.getElementById('max-velocity').textContent = `${(stats.velocityRange.max / 1000).toFixed(2)} km/s`;
        document.getElementById('max-gforce').textContent = `${(stats.velocityRange.max / 9.81).toFixed(1)} G`;
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = (seconds % 60).toFixed(1);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.padStart(4, '0')}`;
    }
    
    showLoading(message) {
        // Create loading overlay
        const loading = document.createElement('div');
        loading.className = 'loading-overlay';
        loading.innerHTML = `
            <div class="loading-content">
                <div class="loading-spinner"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loading);
        this.elements.loading = loading;
    }
    
    hideLoading() {
        if (this.elements.loading) {
            this.elements.loading.remove();
            this.elements.loading = null;
        }
    }
    
    showError(message) {
        // Create error notification
        const error = document.createElement('div');
        error.className = 'error-notification';
        error.innerHTML = `
            <div class="error-content">
                <span class="error-icon">⚠</span>
                <span class="error-message">${message}</span>
                <button class="error-close">×</button>
            </div>
        `;
        
        error.querySelector('.error-close').addEventListener('click', () => error.remove());
        document.body.appendChild(error);
        
        // Auto-remove after 5 seconds
        setTimeout(() => error.remove(), 5000);
    }
    
    update(deltaTime) {
        if (!this.isInitialized) return;
        
        // Update timeline slider
        this.updateTimelineSlider(this.simulation.currentTime);
        
        // Update telemetry if available
        const state = this.simulation.getState();
        if (state.telemetry) {
            this.updateTelemetry(state.telemetry);
        }
    }
    
    dispose() {
        if (this.elements.overlay) {
            this.elements.overlay.remove();
        }
        if (this.elements.loading) {
            this.elements.loading.remove();
        }
    }
} 