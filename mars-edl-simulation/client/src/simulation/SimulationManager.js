import { SceneManager } from '../core/SceneManager.js';
import { TrajectoryManager } from './TrajectoryManager.js';
import { PhaseController } from './PhaseController.js';
import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';
import { Mars } from '../components/environment/Mars.js';
import { Stars } from '../components/environment/Stars.js';
import { DataManager } from '../data/DataManager.js';

export class SimulationManager {
    constructor() {
        this.sceneManager = null;
        this.trajectoryManager = new TrajectoryManager();
        this.phaseController = new PhaseController();
        this.dataManager = new DataManager();
        
        this.entryVehicle = null;
        this.mars = null;
        this.stars = null;
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.timeScale = 1;
        this.maxTime = 260.65;
        
        this.setupUI();
    }
    
    async init() {
        try {
            this.updateLoadingProgress(10, 'Initializing scene...');
            
            const container = document.getElementById('canvas-container');
            this.sceneManager = new SceneManager(container);
            
            this.updateLoadingProgress(30, 'Creating environment...');
            this.createEnvironment();
            
            this.updateLoadingProgress(50, 'Loading spacecraft...');
            this.createSpacecraft();
            
            this.updateLoadingProgress(70, 'Loading trajectory data...');
            await this.loadData();
            
            this.updateLoadingProgress(90, 'Finalizing...');
            this.setupEventListeners();
            
            this.updateLoadingProgress(100, 'Ready!');
            setTimeout(() => this.hideLoadingScreen(), 500);
            
        } catch (error) {
            console.error('Simulation initialization failed:', error);
        }
    }
    
    createEnvironment() {
        this.mars = new Mars();
        this.stars = new Stars();
        
        this.sceneManager.addToScene(this.mars);
        this.sceneManager.addToScene(this.stars);
    }
    
    createSpacecraft() {
        this.entryVehicle = new EntryVehicle();
        this.sceneManager.addToScene(this.entryVehicle);
        this.sceneManager.cameraController.setTarget(this.entryVehicle.mesh);
    }
    
    async loadData() {
        try {
            const missionConfig = await this.dataManager.loadMissionConfig('msl');
            const trajectoryData = await this.dataManager.loadTrajectoryData('msl_position_J2000');
            
            await this.trajectoryManager.loadTrajectoryData(trajectoryData);
            this.phaseController.setMissionPhases(missionConfig.phases);
            
            this.maxTime = this.trajectoryManager.getEndTime();
            this.updateTimelineSlider();
            
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    }
    
    setupUI() {
        this.playPauseBtn = document.getElementById('play-pause-btn');
        this.resetBtn = document.getElementById('reset-btn');
        this.speedSlider = document.getElementById('speed-slider');
        this.timelineSlider = document.getElementById('timeline-slider');
        
        // Show UI panels
        ['control-panel', 'timeline-container', 'phase-info', 'stats-display'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('hidden');
        });
    }
    
    setupEventListeners() {
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (this.resetBtn) {
            this.resetBtn.addEventListener('click', () => this.reset());
        }
        
        if (this.speedSlider) {
            this.speedSlider.addEventListener('input', (e) => {
                this.timeScale = parseFloat(e.target.value);
                document.getElementById('speed-value').textContent = `${this.timeScale}x`;
            });
        }
        
        if (this.timelineSlider) {
            this.timelineSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
        
        // Camera mode buttons
        document.querySelectorAll('.camera-mode-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.camera-mode-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.sceneManager.cameraController.setMode(e.target.dataset.mode);
            });
        });
        
        // Start render loop
        this.startUpdateLoop();
    }
    
    startUpdateLoop() {
        const update = () => {
            if (this.isPlaying) {
                this.currentTime += 0.016 * this.timeScale; // 60fps
                if (this.currentTime > this.maxTime) {
                    this.currentTime = this.maxTime;
                    this.pause();
                }
            }
            
            this.updateSimulation();
            requestAnimationFrame(update);
        };
        update();
    }
    
    updateSimulation() {
        const trajectoryData = this.trajectoryManager.getStateAtTime(this.currentTime);
        if (trajectoryData) {
            this.entryVehicle.updateState(trajectoryData);
        }
        
        this.phaseController.updatePhase(this.currentTime);
        this.updateUI();
        
        // Handle phase-specific events
        const currentPhase = this.phaseController.getCurrentPhase();
        if (currentPhase) {
            if (currentPhase.name === 'Parachute Deploy' && this.currentTime >= currentPhase.startTime) {
                this.entryVehicle.deployParachute();
            }
        }
    }
    
    updateUI() {
        // Update stats display
        const currentTimeSpan = document.getElementById('current-time');
        const currentAltitudeSpan = document.getElementById('current-altitude');
        const currentVelocitySpan = document.getElementById('current-velocity');
        const currentGForceSpan = document.getElementById('current-gforce');
        
        if (currentTimeSpan) currentTimeSpan.textContent = this.currentTime.toFixed(2);
        if (currentAltitudeSpan) currentAltitudeSpan.textContent = (this.entryVehicle.getAltitude() / 1000).toFixed(1);
        if (currentVelocitySpan) currentVelocitySpan.textContent = this.entryVehicle.getSpeed().toFixed(0);
        if (currentGForceSpan) currentGForceSpan.textContent = this.entryVehicle.getGForce().toFixed(1);
        
        // Update timeline slider
        if (this.timelineSlider && !this.timelineSlider.matches(':focus')) {
            this.timelineSlider.value = this.currentTime;
        }
    }
    
    updateTimelineSlider() {
        if (this.timelineSlider) {
            this.timelineSlider.max = this.maxTime;
            this.timelineSlider.step = this.maxTime / 1000;
        }
    }
    
    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        this.isPlaying = true;
        if (this.playPauseBtn) this.playPauseBtn.textContent = 'Pause';
    }
    
    pause() {
        this.isPlaying = false;
        if (this.playPauseBtn) this.playPauseBtn.textContent = 'Play';
    }
    
    reset() {
        this.currentTime = 0;
        this.pause();
        this.updateSimulation();
    }
    
    updateLoadingProgress(progress, message) {
        const progressBar = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');
        
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (loadingText) loadingText.textContent = message;
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                this.showIntroduction();
            }, 500);
        }
    }
    
    showIntroduction() {
        const introModal = document.getElementById('intro-modal');
        if (introModal) {
            introModal.classList.remove('hidden');
        }
    }
}