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
        
        this.clock = new THREE.Clock();
    }
    
    async init() {
        try {
            window.updateLoadingProgress(20, 'Creating Three.js scene...');
            
            const container = document.getElementById('canvas-container');
            if (!container) throw new Error('Canvas container not found');
            
            this.sceneManager = new SceneManager(container);
            
            window.updateLoadingProgress(40, 'Building Mars environment...');
            this.createEnvironment();
            
            window.updateLoadingProgress(60, 'Loading MSL spacecraft...');
            this.createSpacecraft();
            
            window.updateLoadingProgress(80, 'Loading trajectory data...');
            await this.loadData();
            
            window.updateLoadingProgress(95, 'Setting up controls...');
            this.setupUI();
            this.setupEventListeners();
            
            window.updateLoadingProgress(100, 'Simulation ready!');
            setTimeout(() => this.hideLoadingScreen(), 1000);
            
        } catch (error) {
            console.error('Three.js simulation initialization failed:', error);
            throw error;
        }
    }
    
    createEnvironment() {
        this.mars = new Mars();
        this.stars = new Stars();
        
        this.sceneManager.addToScene(this.mars);
        this.sceneManager.addToScene(this.stars);
        
        console.log('✅ Three.js environment created');
    }
    
    createSpacecraft() {
        this.entryVehicle = new EntryVehicle();
        this.sceneManager.addToScene(this.entryVehicle);
        this.sceneManager.cameraController.setTarget(this.entryVehicle.mesh);
        
        console.log('✅ Three.js spacecraft created');
    }
    
    async loadData() {
        try {
            const missionConfig = await this.dataManager.loadMissionConfig('msl');
            const trajectoryData = await this.dataManager.loadTrajectoryData('msl_position_J2000');
            
            await this.trajectoryManager.loadTrajectoryData(trajectoryData);
            this.phaseController.setMissionPhases(missionConfig.phases);
            
            this.maxTime = this.trajectoryManager.getEndTime();
            this.updateTimelineSlider();
            
            console.log('✅ Trajectory data loaded:', this.trajectoryManager.data.length, 'points');
            
        } catch (error) {
            console.warn('Using demo data due to load error:', error);
            const demoData = this.dataManager.generateDemoTrajectory();
            await this.trajectoryManager.loadTrajectoryData(demoData);
            this.phaseController.setMissionPhases(this.dataManager.getDefaultMissionConfig().phases);
        }
    }
    
    setupUI() {
        ['control-panel', 'timeline-container', 'phase-info', 'stats-panel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('hidden');
        });
    }
    
    setupEventListeners() {
        const playPauseBtn = document.getElementById('play-pause-btn');
        const resetBtn = document.getElementById('reset-btn');
        const speedSlider = document.getElementById('speed-slider');
        const timelineSlider = document.getElementById('timeline-slider');
        
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
        
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.timeScale = parseFloat(e.target.value);
                const speedValue = document.getElementById('speed-value');
                if (speedValue) speedValue.textContent = `${this.timeScale.toFixed(1)}x`;
            });
        }
        
        if (timelineSlider) {
            timelineSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
        
        document.querySelectorAll('.camera-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.camera-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.sceneManager.cameraController.setMode(e.target.dataset.mode);
            });
        });
        
        this.startUpdateLoop();
    }
    
    startUpdateLoop() {
        const update = () => {
            const deltaTime = this.clock.getDelta();
            
            if (this.isPlaying) {
                this.currentTime += deltaTime * this.timeScale;
                if (this.currentTime > this.maxTime) {
                    this.currentTime = this.maxTime;
                    this.pause();
                }
            }
            
            this.updateSimulation();
            
            // Update Three.js objects
            if (this.entryVehicle) {
                this.entryVehicle.update(deltaTime);
            }
            
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
        
        const currentPhase = this.phaseController.getCurrentPhase();
        if (currentPhase && this.entryVehicle) {
            if (currentPhase.name === 'Parachute Deploy' && this.currentTime >= currentPhase.startTime) {
                this.entryVehicle.deployParachute();
            }
        }
    }
    
    updateUI() {
        if (this.entryVehicle) {
            const elements = {
                'current-time': this.currentTime.toFixed(2) + 's',
                'current-altitude': (this.entryVehicle.getAltitude() / 1000).toFixed(1) + 'km',
                'current-velocity': this.entryVehicle.getSpeed().toFixed(0) + 'm/s',
                'current-gforce': this.entryVehicle.getGForce().toFixed(1) + 'g'
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element) element.textContent = value;
            });
        }
        
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
        this.isPlaying ? this.pause() : this.play();
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