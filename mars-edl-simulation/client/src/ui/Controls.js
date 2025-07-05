/**
 * Controls.js
 * Main control panel UI component
 */

export class Controls {
    constructor(simulationManager) {
        this.simulation = simulationManager;
        this.element = null;
        this.playButton = null;
        this.notifications = [];
        
        this.create();
        this.setupEventListeners();
    }
    
    create() {
        this.element = document.createElement('div');
        this.element.className = 'controls-container';
        this.element.innerHTML = `
            <div class="controls-main">
                <button class="control-btn play-btn" id="play-btn">
                    <span class="icon">▶</span>
                    <span class="label">Play</span>
                </button>
                <button class="control-btn" id="reset-btn">
                    <span class="icon">↺</span>
                    <span class="label">Reset</span>
                </button>
                <div class="speed-control">
                    <label>Speed:</label>
                    <select id="speed-select">
                        <option value="0.25">0.25x</option>
                        <option value="0.5">0.5x</option>
                        <option value="1" selected>1x</option>
                        <option value="2">2x</option>
                        <option value="5">5x</option>
                        <option value="10">10x</option>
                    </select>
                </div>
            </div>
            <div class="controls-secondary">
                <button class="control-btn" id="camera-btn">
                    <span class="icon">📷</span>
                    <span class="label">Camera</span>
                </button>
                <button class="control-btn" id="data-btn">
                    <span class="icon">📊</span>
                    <span class="label">Data</span>
                </button>
                <button class="control-btn" id="settings-btn">
                    <span class="icon">⚙️</span>
                    <span class="label">Settings</span>
                </button>
                <button class="control-btn" id="help-btn">
                    <span class="icon">?</span>
                    <span class="label">Help</span>
                </button>
            </div>
        `;
        
        this.playButton = this.element.querySelector('#play-btn');
        
        // Add modals
        this.createModals();
    }
    
    createModals() {
        // Help modal
        const helpModal = document.createElement('div');
        helpModal.className = 'modal help-modal';
        helpModal.id = 'help-modal';
        helpModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Mars EDL Simulation Help</h2>
                    <button class="modal-close" data-modal="help-modal">×</button>
                </div>
                <div class="modal-body">
                    <section>
                        <h3>Keyboard Controls</h3>
                        <div class="key-bindings">
                            <div class="key-binding">
                                <kbd>Space</kbd>
                                <span>Play/Pause simulation</span>
                            </div>
                            <div class="key-binding">
                                <kbd>R</kbd>
                                <span>Reset to beginning</span>
                            </div>
                            <div class="key-binding">
                                <kbd>F</kbd>
                                <span>Toggle camera mode</span>
                            </div>
                            <div class="key-binding">
                                <kbd>1-3</kbd>
                                <span>Cinematic camera views</span>
                            </div>
                            <div class="key-binding">
                                <kbd>ESC</kbd>
                                <span>Close dialogs</span>
                            </div>
                        </div>
                    </section>
                    <section>
                        <h3>Mouse Controls</h3>
                        <ul>
                            <li>Left click + drag: Rotate camera</li>
                            <li>Right click + drag: Pan camera</li>
                            <li>Scroll: Zoom in/out</li>
                            <li>Click timeline: Jump to time</li>
                        </ul>
                    </section>
                    <section>
                        <h3>Mission Phases</h3>
                        <div class="phase-list">
                            <div class="phase-item">
                                <strong>Entry Interface (132 km)</strong>
                                <p>Atmospheric entry begins, heat shield faces the atmosphere</p>
                            </div>
                            <div class="phase-item">
                                <strong>Peak Heating (~60 km)</strong>
                                <p>Maximum thermal stress on heat shield</p>
                            </div>
                            <div class="phase-item">
                                <strong>Peak Deceleration (~25 km)</strong>
                                <p>Maximum g-forces experienced by the vehicle</p>
                            </div>
                            <div class="phase-item">
                                <strong>Parachute Deploy (13.5 km)</strong>
                                <p>Supersonic parachute deployment</p>
                            </div>
                        </div>
                    </section>
                </div>
            </div>
        `;
        document.body.appendChild(helpModal);
        
        // Settings modal
        const settingsModal = document.createElement('div');
        settingsModal.className = 'modal settings-modal';
        settingsModal.id = 'settings-modal';
        settingsModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Settings</h2>
                    <button class="modal-close" data-modal="settings-modal">×</button>
                </div>
                <div class="modal-body">
                    <div class="settings-group">
                        <h3>Graphics</h3>
                        <label class="setting-item">
                            <span>Quality:</span>
                            <select id="quality-select">
                                <option value="low">Low</option>
                                <option value="medium" selected>Medium</option>
                                <option value="high">High</option>
                            </select>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="shadows-toggle" checked>
                            <span>Shadows</span>
                        </label>
                        <label class="setting-item">
                            <input type="checkbox" id="effects-toggle" checked>
                            <span>Visual Effects</span>
                        </label>
                    </div>
                    <div class="settings-group">
                        <h3>Data</h3>
                        <label class="setting-item">
                            <span>Load CSV:</span>
                            <input type="file" id="csv-upload" accept=".csv">
                        </label>
                        <label class="setting-item">
                            <span>Mission:</span>
                            <select id="mission-select">
                                <option value="msl" selected>Mars Science Laboratory</option>
                                <option value="perseverance">Perseverance</option>
                                <option value="custom">Custom</option>
                            </select>
                        </label>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(settingsModal);
        
        // Data modal
        const dataModal = document.createElement('div');
        dataModal.className = 'modal data-modal';
        dataModal.id = 'data-modal';
        dataModal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>Telemetry Data</h2>
                    <button class="modal-close" data-modal="data-modal">×</button>
                </div>
                <div class="modal-body">
                    <canvas id="telemetry-chart"></canvas>
                    <div class="data-controls">
                        <button id="export-data-btn">Export CSV</button>
                        <button id="toggle-chart-btn">Toggle Chart Type</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(dataModal);
    }
    
    setupEventListeners() {
        // Play/Pause
        this.playButton.addEventListener('click', () => {
            this.simulation.togglePlayPause();
        });
        
        // Reset
        this.element.querySelector('#reset-btn').addEventListener('click', () => {
            this.simulation.reset();
        });
        
        // Speed control
        this.element.querySelector('#speed-select').addEventListener('change', (e) => {
            this.simulation.setPlaybackSpeed(parseFloat(e.target.value));
        });
        
        // Camera button
        this.element.querySelector('#camera-btn').addEventListener('click', () => {
            this.simulation.toggleCameraMode();
        });
        
        // Modal buttons
        this.element.querySelector('#help-btn').addEventListener('click', () => {
            this.openModal('help-modal');
        });
        
        this.element.querySelector('#settings-btn').addEventListener('click', () => {
            this.openModal('settings-modal');
        });
        
        this.element.querySelector('#data-btn').addEventListener('click', () => {
            this.openModal('data-modal');
            this.updateDataChart();
        });
        
        // Modal close buttons
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modalId = e.target.getAttribute('data-modal');
                this.closeModal(modalId);
            });
        });
        
        // Click outside modal to close
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal(modal.id);
                }
            });
        });
        
        // Settings handlers
        document.getElementById('csv-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.simulation.loadCSVFile(file);
                this.showNotification('CSV file loaded successfully', 'success');
                this.closeModal('settings-modal');
            }
        });
    }
    
    updatePlayButton(isPlaying) {
        const icon = this.playButton.querySelector('.icon');
        const label = this.playButton.querySelector('.label');
        
        if (isPlaying) {
            icon.textContent = '⏸';
            label.textContent = 'Pause';
            this.playButton.classList.add('playing');
        } else {
            icon.textContent = '▶';
            label.textContent = 'Play';
            this.playButton.classList.remove('playing');
        }
    }
    
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('open');
            document.body.style.overflow = '';
        }
    }
    
    closeModals() {
        document.querySelectorAll('.modal.open').forEach(modal => {
            modal.classList.remove('open');
        });
        document.body.style.overflow = '';
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    updateDataChart() {
        // This would create actual charts using Chart.js or similar
        // For now, just a placeholder
        const canvas = document.getElementById('telemetry-chart');
        const ctx = canvas.getContext('2d');
        
        canvas.width = canvas.offsetWidth;
        canvas.height = 300;
        
        ctx.fillStyle = '#333';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#fff';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Telemetry data visualization', canvas.width / 2, canvas.height / 2);
    }
}

export default Controls;