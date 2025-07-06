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
            window.updateLoadingProgress(20, 'Initializing 3D scene...');
            
            const container = document.getElementById('canvas-container');
            this.sceneManager = new SceneManager(container);
            
            window.updateLoadingProgress(40, 'Creating Mars environment...');
            this.createEnvironment();
            
            window.updateLoadingProgress(60, 'Loading spacecraft...');
            this.createSpacecraft();
            
            window.updateLoadingProgress(80, 'Loading trajectory data...');
            await this.loadData();
            
            window.updateLoadingProgress(95, 'Setting up controls...');
            this.setupEventListeners();
            
            window.updateLoadingProgress(100, 'Simulation ready!');
            setTimeout(() => this.hideLoadingScreen(), 1000);
            
        } catch (error) {
            console.error('Simulation initialization failed:', error);
            throw error;
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
            console.warn('Using demo data due to load error:', error);
            // Use demo data as fallback
            const demoData = this.dataManager.generateDemoTrajectory();
            await this.trajectoryManager.loadTrajectoryData(demoData);
            this.phaseController.setMissionPhases(this.dataManager.getDefaultMissionConfig().phases);
        }
    }
    
    setupUI() {
        // Show UI panels
        ['control-panel', 'timeline-container', 'phase-info', 'stats-panel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('hidden');
        });
    }
    
    setupEventListeners() {
        // Play/Pause button
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        // Reset button
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
        
        // Speed slider
        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.timeScale = parseFloat(e.target.value);
                document.getElementById('speed-value').textContent = `${this.timeScale.toFixed(1)}x`;
            });
        }
        
        // Timeline slider
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            timelineSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
        
        // Camera mode buttons
        document.querySelectorAll('.camera-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.camera-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.sceneManager.cameraController.setMode(e.target.dataset.mode);
            });
        });
        
        // Start update loop
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
        if (trajectoryData && this.entryVehicle) {
            this.entryVehicle.updateState(trajectoryData);
        }
        
        this.phaseController.updatePhase(this.currentTime);
        this.updateUI();
        
        // Handle phase-specific events
        const currentPhase = this.phaseController.getCurrentPhase();
        if (currentPhase && this.entryVehicle) {
            if (currentPhase.name === 'Parachute Deploy' && this.currentTime >= currentPhase.startTime) {
                this.entryVehicle.deployParachute();
            }
        }
    }
    
    updateUI() {
        // Update stats display
        if (this.entryVehicle) {
            const currentTimeSpan = document.getElementById('current-time');
            const currentAltitudeSpan = document.getElementById('current-altitude');
            const currentVelocitySpan = document.getElementById('current-velocity');
            const currentGForceSpan = document.getElementById('current-gforce');
            
            if (currentTimeSpan) currentTimeSpan.textContent = this.currentTime.toFixed(2) + 's';
            if (currentAltitudeSpan) currentAltitudeSpan.textContent = (this.entryVehicle.getAltitude() / 1000).toFixed(1) + 'km';
            if (currentVelocitySpan) currentVelocitySpan.textContent = this.entryVehicle.getSpeed().toFixed(0) + 'm/s';
            if (currentGForceSpan) currentGForceSpan.textContent = this.entryVehicle.getGForce().toFixed(1) + 'g';
        }
        
        // Update timeline slider
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider && !timelineSlider.matches(':focus')) {
            timelineSlider.value = this.currentTime;
        }
    }
    
    updateTimelineSlider() {
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            timelineSlider.max = this.maxTime;
            timelineSlider.step = this.maxTime / 1000;
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
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '⏸ Pause';
    }
    
    pause() {
        this.isPlaying = false;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶ Play';
    }
    
    reset() {
        this.currentTime = 0;
        this.pause();
        this.updateSimulation();
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