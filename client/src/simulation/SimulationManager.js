/**
 * Main simulation controller with planet switching
 */

import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager.js';
import { CameraController } from '../core/CameraController.js';
import { AssetLoader } from '../core/AssetLoader.js';
import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';
import { Mars } from '../components/environment/Mars.js';
import { Earth } from '../components/environment/Earth.js';
import { Jupiter } from '../components/environment/Jupiter.js';
import { Stars } from '../components/environment/Stars.js';
import { TrajectoryManager } from './TrajectoryManager.js';
import { PhaseController } from './PhaseController.js';
import { Timeline } from '../ui/Timeline.js';
import { PhaseInfo } from '../ui/PhaseInfo.js';
import { Controls } from '../ui/Controls.js';
import { ModelSelector } from '../ui/ModelSelector.js';
import { DataManager } from '../data/DataManager.js';
import { TrajectoryService } from '../services/TrajectoryService.js';
import { config } from '../config/SimulationConfig.js';
import { CONTROLS_CONFIG, getDefaultControlValues } from '../config/ControlsConfig.js';

export class SimulationManager {
    constructor(options = {}) {
        this.options = {
            container: document.getElementById('canvas-container'),
            dataPath: '/assets/data/MSL_position_J2000.csv',
            autoStart: false,
            showStats: false,
            ...options
        };
        
        // Core components
        this.sceneManager = null;
        this.cameraController = null;
        this.assetLoader = null;
        this.trajectoryManager = null;
        this.phaseController = null;
        this.dataManager = null;
        this.trajectoryService = null;
        
        // Scene objects
        this.entryVehicle = null;
        this.mars = null;
        this.earth = null;
        this.jupiter = null;
        this.currentPlanet = null;
        this.stars = null;

        // UI components
        this.timeline = null;
        this.phaseInfo = null;
        this.controls = null;
        this.modelSelector = null;
        
        // Simulation state
        this.state = {
            currentTime: 0,
            totalTime: 260.65,
            isPlaying: false,
            playbackSpeed: 1,
            currentPhase: 0,
            vehicleData: null,
            currentPlanet: 'mars',
            
            // Dynamic control values (initialized from ControlsConfig)
            controls: {},           // Current values for all controls
            controlsHistory: {},    // History for each control: { controlId: [{time, value}] }
            
            isRerunnning: false,  // Flag to indicate if we're replaying with history
            simulationCompleted: false,  // Track if simulation has completed once
            controlsLocked: false,
            playbackInitialized: false
        };
        
        // Animation
        this.clock = new THREE.Clock();
        this.animationId = null;

        // Initialize control values and history from configuration
        this.initializeControls();
        
        this.init();
    }
    
    /**
     * Initialize control values and history from ControlsConfig
     */
    initializeControls() {
        // Set initial values from config
        this.state.controls = getDefaultControlValues();
        
        // Initialize history for each control
        this.state.controlsHistory = {};
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            const config = CONTROLS_CONFIG[controlId];
            if (config.historyKey) {
                this.state.controlsHistory[controlId] = [];
            }
        });
    }
    
    async init() {
        // Initialize core components
        this.sceneManager = new SceneManager(this.options.container);
        this.cameraController = new CameraController(
            this.sceneManager.camera,
            this.sceneManager.renderer
        );
        
        // Ensure Mars is active by default
        this.sceneManager.switchPlanet('mars');

        // Initialize asset loader for loading 3D models
        this.assetLoader = new AssetLoader();

        this.trajectoryManager = new TrajectoryManager();
        this.phaseController = new PhaseController();
        this.dataManager = new DataManager();

        // Initialize backend-only trajectory service
        this.trajectoryService = new TrajectoryService({
            backendUrl: config.get('dataSource.backendUrl') || 'http://localhost:3001',
            timeout: 30000
        });
        
        // Create scene objects (now async to handle GLTF loading)
        await this.createSceneObjects();

        // Initialize UI
        this.initializeUI();
        
        // Load trajectory data
        await this.loadData();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Start animation loop
        this.animate();
        
        // Auto-start if requested
        if (this.options.autoStart) {
            this.play();
        }
    }
    
    async createSceneObjects() {
        const maxAnisotropy = this.sceneManager.renderer?.capabilities?.getMaxAnisotropy?.() || 1;

        // Create stars background
        this.stars = new Stars();
        this.sceneManager.addToAllScenes(this.stars.getObject3D());

        // Create all planets
        this.mars = new Mars({
            maxAnisotropy,
            renderMode: 'tile', // now proxied via sim-server to avoid CORS
            tileBaseUrl: 'http://localhost:8000/tiles/mars',
            tileExtension: 'jpg',
            maxTileLevel: 6, // keep tile loads lighter for faster visibility
            marsJSBaseUrl: '/assets/textures/MarsJS'
        });
        this.earth = new Earth();
        this.jupiter = new Jupiter();

        // Start with Mars visible
        this.currentPlanet = this.mars;
        this.sceneManager.addToAllScenes(this.mars.getObject3D());

        // Create and initialize entry vehicle with asset loader for GLTF model support
        this.entryVehicle = new EntryVehicle(this.assetLoader);

        // Initialize the vehicle (loads GLTF if available) - must await this!
        await this.entryVehicle.init();

        this.sceneManager.addToAllScenes(this.entryVehicle.getObject3D());

        // Add trajectory line to all scenes
        const trajectoryObject = this.trajectoryManager.getObject3D();
        if (trajectoryObject) {
            this.sceneManager.addToAllScenes(trajectoryObject);
        }

        // Set camera target
        this.cameraController.setTarget(this.entryVehicle.getObject3D());
        // Snap immediately to vehicle if we already have data
        if (this.state.vehicleData) {
            this.cameraController.snapToTarget(this.state.vehicleData);
        }
    }
    
    initializeUI() {
        // Timeline
        this.timeline = new Timeline({
            container: document.getElementById('timeline-container'),
            totalTime: this.state.totalTime,
            onTimeUpdate: (time) => this.seekTo(time),
            onPlayPause: () => this.togglePlayPause(),
            onSpeedChange: (speed) => this.setPlaybackSpeed(speed),
            onReset: () => this.startPlaybackReplay(true)
        });
        this.timeline.setReplayAvailable(false);
        
        // Phase info panel
        this.phaseInfo = new PhaseInfo({
            container: document.getElementById('phase-info'),
            onControlAdjust: (controlId, adjustment) => this.handlePhaseInfoControlAdjust(controlId, adjustment)
        });
        
        // Camera and zoom controls
        this.controls = new Controls({
            onCameraMode: (mode) => this.setCameraMode(mode),
            onZoom: (direction) => this.handleZoom(direction),
            onControlChange: (change) => this.handleControlChange(change),
            onSettings: (setting) => this.handleSettings(setting),
            onToggleReference: (visible) => {
                console.log(`[SimulationManager] onToggleReference callback triggered: ${visible}`);
                if (this.trajectoryManager) {
                    this.trajectoryManager.toggleReferenceTrajectory(visible);
                } else {
                    console.error('[SimulationManager] TrajectoryManager not initialized');
                }
            }
        });
        this.controls.setControlsEnabled(true, '');

        // Model selector for spacecraft
        const selectorContainer = this.controls.getCameraControlsElement
            ? this.controls.getCameraControlsElement()
            : document.body;
        this.modelSelector = new ModelSelector({
            container: selectorContainer || document.body,
            entryVehicle: this.entryVehicle,
            onModelChange: (modelId) => {
                console.log(`Model changed to: ${modelId}`);
            }
        });

        // Add planet switching buttons to existing UI
        this.addPlanetControls();
    }
    
    addPlanetControls() {
        if (document.getElementById('planet-controls')) return;
        
        const planetControls = document.createElement('div');
        planetControls.id = 'planet-controls';
        planetControls.style.cssText = `
            position: absolute;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            gap: 10px;
        `;
        
        ['mars', 'earth', 'jupiter'].forEach(planet => {
            const btn = document.createElement('button');
            btn.className = `planet-btn ${planet === 'mars' ? 'active' : ''}`;
            btn.textContent = planet.charAt(0).toUpperCase() + planet.slice(1);
            btn.style.cssText = `
                padding: 12px 24px;
                font-size: 14px;
                background-color: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 25px;
                cursor: pointer;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                text-transform: capitalize;
            `;
            
            btn.addEventListener('mouseenter', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                }
            });
            
            btn.addEventListener('mouseleave', () => {
                if (!btn.classList.contains('active')) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                }
            });
            
            btn.addEventListener('click', () => this.switchPlanet(planet));
            planetControls.appendChild(btn);
        });
        
        const style = document.createElement('style');
        style.textContent = `
            .planet-btn.active {
                background-color: rgba(255, 107, 107, 0.5) !important;
                border-color: rgba(255, 107, 107, 0.8) !important;
                font-weight: 600;
            }
        `;
        document.head.appendChild(style);
        
        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.appendChild(planetControls);
        }
    }
    
    switchPlanet(planetName) {
        // Remove current planet from scene
        if (this.currentPlanet) {
            this.sceneManager.currentScene.remove(this.currentPlanet.getObject3D());
        }
        
        // Add new planet to scene
        switch(planetName) {
            case 'mars':
                this.currentPlanet = this.mars;
                break;
            case 'earth':
                this.currentPlanet = this.earth;
                break;
            case 'jupiter':
                this.currentPlanet = this.jupiter;
                break;
        }
        
        if (this.currentPlanet) {
            this.sceneManager.currentScene.add(this.currentPlanet.getObject3D());
        }
        
        this.state.currentPlanet = planetName;
        
        // Update button states
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.classList.toggle('active', 
                btn.textContent.toLowerCase() === planetName.toLowerCase());
        });
        
        // Adjust camera for different planet sizes with smaller spacecraft (now properly scaled)
        const cameraDistances = {
            mars: 0.00004,    // ~4 m
            earth: 0.00005,   // ~5 m
            jupiter: 0.00008  // ~8 m
        };

        if (cameraDistances[planetName]) {
            this.cameraController.setDefaultDistance(cameraDistances[planetName]);
            // Also snap immediately when switching planets
            if (this.state.vehicleData) {
                this.cameraController.snapToTarget(this.state.vehicleData);
            }
        }
    }
    
    async loadData() {
        try {
            console.log('[SimulationManager] Loading trajectory from backend...');

            // Check backend health first
            const backendStatus = await this.trajectoryService.getBackendStatus();
            console.log('[SimulationManager] Backend status:', backendStatus);

            if (!backendStatus.available) {
                throw new Error(`Backend server not available at ${backendStatus.backendUrl}. Please start the sim-server on port 3001 (proxied through Express server).`);
            }

            // Load initial trajectory with default parameters (bank angle = 0)
            const trajectoryData = await this.trajectoryService.calculateTrajectory({
                control: { bank_angle: 0.0 }  // Initial bank angle = 0 radians
            });

            console.log('[SimulationManager] Loaded trajectory from backend:', {
                points: trajectoryData.length,
                duration: trajectoryData[trajectoryData.length - 1].time.toFixed(2) + 's'
            });

            // Set trajectory data in TrajectoryManager
            this.trajectoryManager.setTrajectoryData(trajectoryData);

            // Load reference trajectory from CSV (MSL position)
            try {
                const referenceData = await this.dataManager.loadTrajectoryCSV("MSL_position_J2000.csv");

                if (referenceData && referenceData.rows) {
                    this.trajectoryManager.setReferenceTrajectoryFromCSV(referenceData.rows);
                } else {
                    this.trajectoryManager.setReferenceTrajectory(trajectoryData);
                }
            } catch (refError) {
                console.warn('[SimulationManager] Failed to load reference trajectory:', refError);
            }

            // Update total time from trajectory
            if (trajectoryData.length > 0) {
                this.state.totalTime = trajectoryData[trajectoryData.length - 1].time;
                if (this.timeline) {
                    this.timeline.setTotalTime(this.state.totalTime);
                }
            }

            // Load mission configuration
            const missionConfig = await this.dataManager.loadMissionConfig();

            // PhaseController expects setPhases with array
            if (missionConfig.phases) {
                this.phaseController.setPhases(missionConfig.phases);
                if (this.timeline) {
                    this.timeline.setPhases(missionConfig.phases);
                }
            }

            // Notify data loaded
            if (this.options.onDataLoaded) {
                this.options.onDataLoaded();
            }

            console.log('[SimulationManager] Trajectory data loaded successfully:', trajectoryData.length, 'points');

        } catch (error) {
            console.error('[SimulationManager] Error loading data:', error);
            alert(`Failed to load trajectory: ${error.message}\n\nPlease ensure the sim-server is running on port 3001 (proxied through Express server).`);
            throw error;  // Re-throw to prevent app from running without data
        }
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse click for trajectory interaction - REMOVED
        // this.sceneManager.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    handleKeyPress(event) {
        // First, check if this key is a control shortcut
        if (this.controls && this.controls.handleControlKeyPress(event.key)) {
            event.preventDefault();
            return;
        }
        
        // Prevent default for navigation keys
        if (event.key === ' ' || event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
        
        // Handle non-control keys
        switch(event.key) {
            case ' ':
                this.togglePlayPause();
                break;
            case 'ArrowRight':
                this.seekTo(Math.min(this.state.currentTime + 5, this.state.totalTime));
                break;
            case 'ArrowLeft':
                this.seekTo(Math.max(this.state.currentTime - 5, 0));
                break;
            case 'ArrowUp':
                this.handleZoom(1);
                break;
            case 'ArrowDown':
                this.handleZoom(-1);
                break;
            case '1':
                this.setCameraMode('follow');
                break;
            case '2':
                this.setCameraMode('orbit');
                break;
            case 'v':
            case 'V':
                if (this.entryVehicle) {
                    this.entryVehicle.toggleVectors();
                }
                break;
        }
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        if (this.state.isPlaying) {
            this.updateSimulation(deltaTime);
        }
        
        this.updateComponents(deltaTime);
        this.sceneManager.render(this.cameraController.camera);
    }
    
    updateSimulation(deltaTime) {
        // Update simulation time
        this.state.currentTime += deltaTime * this.state.playbackSpeed;

        // Check if we're replaying and need to apply controls history
        if (this.state.isRerunnning) {
            // Update all controls from history
            Object.keys(this.state.controlsHistory).forEach(controlId => {
                if (this.state.controlsHistory[controlId].length > 0) {
                    const value = this.getControlValueForTime(controlId, this.state.currentTime);
                    this.state.controls[controlId] = value;
                }
            });
        }

        if (this.state.currentTime >= this.state.totalTime) {
            this.state.currentTime = this.state.totalTime;
            this.pause();

            // Mark simulation as completed
            if (!this.state.simulationCompleted) {
                this.state.simulationCompleted = true;
                this.handleInitialRunCompletion();
            }
        }

        // Get vehicle data at current time
        this.state.vehicleData = this.trajectoryManager.getDataAtTime(this.state.currentTime);

        if (this.state.vehicleData) {
            // Update spacecraft position
            if (this.entryVehicle && this.state.vehicleData.position) {
                this.entryVehicle.setPosition(this.state.vehicleData.position);

                // Update spacecraft attitude using scientifically accurate method
                // This maintains trim angle of attack and bank angle per MSL EDL standards
                const velocityVector = this.trajectoryManager.getVelocityVector(this.state.currentTime);
                if (velocityVector && velocityVector.length() > 0.001) {
                    // Use scientific attitude calculation (trim AoA + bank angle from controls)
                    this.entryVehicle.setScientificAttitude(
                        velocityVector,
                        this.state.vehicleData.position,
                        this.state.controls.bankAngle || 0
                    );
                }
            }
            
            // Update phase
            const currentPhase = this.phaseController.getCurrentPhase(this.state.currentTime);
            if (currentPhase !== this.state.currentPhase) {
                this.handlePhaseTransition(currentPhase);
            }
            
            // Update trajectory display
            this.trajectoryManager.updateTrajectoryDisplay(this.state.currentTime);
        }
    }
    
    updateComponents(deltaTime) {
        // Update camera
        this.cameraController.update(deltaTime, this.state.vehicleData);
        
        // Update entry vehicle effects
        this.entryVehicle.update(this.state.currentTime, this.state.vehicleData, this.state.controls.bankAngle || 0);
        
        // Update current planet
        if (this.currentPlanet) {
            this.currentPlanet.update(this.cameraController.camera, deltaTime, this.sceneManager.renderer);
        }
        
        // Update stars
        if (this.stars) {
            this.stars.update(deltaTime);
        }

        // Planet rotation removed - planets remain stationary in J2000 reference frame
        
        // Update trajectory visibility
        this.trajectoryManager.updateTrajectoryVisibility(this.state.currentTime);
        
        // Update scene lighting based on altitude
        if (this.state.vehicleData) {
            this.sceneManager.updateLighting(
                this.state.vehicleData.altitude,
                this.state.currentPhase
            );
        }
        
        // Update UI
        this.timeline.update(this.state.currentTime, this.state.isPlaying);

        // Enhance vehicle data with attitude information for telemetry display
        const enhancedVehicleData = {
            ...this.state.vehicleData,
            angleOfAttack: this.entryVehicle ? this.entryVehicle.attitude.angleOfAttack : -16,
            bankAngle: this.state.controls.bankAngle || 0
        };

        this.phaseInfo.update(
            this.phaseController.phases[this.state.currentPhase],
            enhancedVehicleData,
            this.state.currentTime,
            this.state.totalTime,
            this.state.controls  // Pass entire controls object instead of just bankAngle
        );
    }
    
    handlePhaseTransition(newPhase) {
        this.state.currentPhase = newPhase;
        
        // Trigger phase-specific effects
        const phase = this.phaseController.phases[newPhase];
        if (phase) {
            this.entryVehicle.triggerPhaseTransition(phase.name);
            
            // Update camera mode based on phase
            if (phase.cameraMode) {
                this.cameraController.setMode(phase.cameraMode);
            }
        }
    }
    
    // onMouseClick method removed - no longer needed for trajectory clicking
    
    play() {
        this.state.isPlaying = true;
        this.clock.start();
        // Force follow mode and snap to current state for close framing
        this.cameraController.setMode('follow');
        const currentData = this.trajectoryManager.getDataAtTime(this.state.currentTime || 0);
        if (currentData) {
            this.state.vehicleData = currentData;
            this.cameraController.snapToTarget(currentData);
        }
    }
    
    pause() {
        this.state.isPlaying = false;
    }
    
    togglePlayPause() {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    seekTo(time) {
        // Prevent seeking during live simulation unless it's completed
        if (!this.state.simulationCompleted) {
            console.log('Seeking disabled during live simulation');
            return;
        }
        this.state.currentTime = Math.max(0, Math.min(time, this.state.totalTime));
        this.updateSimulation(0);
    }

    resetToStart(controlsHistory = {}) {
        // Reset simulation to beginning for rerun
        this.state.currentTime = 0;
        this.state.currentPhase = 0;
        this.state.isPlaying = false;
        
        // Reset all controls to default values
        this.state.controls = getDefaultControlValues();
        
        this.state.simulationCompleted = false;
        if (this.timeline) {
            this.timeline.setScrubbingEnabled(false);
            this.timeline.setReplayAvailable(false);
        }
        this.state.controlsLocked = false;
        this.state.playbackInitialized = false;
        if (this.controls) {
            this.controls.setControlsEnabled(true);
        }

        // Store controls history for rerun (support both old and new format)
        const hasHistory = Object.keys(controlsHistory).length > 0 || 
                          (Array.isArray(controlsHistory) && controlsHistory.length > 0);
        
        if (hasHistory) {
            // Support legacy bankingHistory array format
            if (Array.isArray(controlsHistory)) {
                this.state.controlsHistory = { bankAngle: controlsHistory };
            } else {
                this.state.controlsHistory = controlsHistory;
            }
            this.state.isRerunnning = true;
            console.log(`Rerunning with controls history:`, this.state.controlsHistory);
        } else {
            this.state.controlsHistory = {};
            Object.keys(CONTROLS_CONFIG).forEach(controlId => {
                this.state.controlsHistory[controlId] = [];
            });
            this.state.isRerunnning = false;
        }

        // Reset trajectory to original
        if (this.trajectoryManager) {
            this.trajectoryManager.resetToOriginal();
        }

        // Reset phase info
        if (this.phaseInfo) {
            this.phaseInfo.reset();
        }

        // Reset vehicle position
        this.updateSimulation(0);
    }
    
    setPlaybackSpeed(speed) {
        const normalizedSpeed = Number(speed) || 1;
        this.state.playbackSpeed = normalizedSpeed;
        if (this.timeline) {
            this.timeline.setPlaybackSpeed(normalizedSpeed);
        }
    }
    
    setCameraMode(mode) {
        this.cameraController.setMode(mode);
    }
    
    handleZoom(direction) {
        this.cameraController.zoom(direction);
    }
    
    
    handleResize() {
        this.sceneManager.handleResize();
        this.cameraController.handleResize();
    }

    /**
     * Handle changes to interactive controls
     * @param {Object} change - Control change information
     * @param {string} change.controlId - ID of the control that changed
     * @param {*} change.oldValue - Previous value
     * @param {*} change.newValue - New value
     * @param {Object} change.config - Control configuration
     */
    handleControlChange(change) {
        const { controlId, oldValue, newValue, config } = change;
        
        console.log(`Control ${controlId} changed from ${oldValue} to ${newValue}`);
        
        // Check if controls are locked
        if (this.state.controlsLocked) {
            console.log(`Control ${controlId} disabled - controls locked`);
            return;
        }
        
        // During rerun, ignore manual control inputs
        if (this.state.isRerunnning) {
            console.log(`Control ${controlId} disabled during rerun`);
            return;
        }

        // Update current control value
        this.state.controls[controlId] = newValue;

        // Store control adjustment in history for replay
        if (!this.state.simulationCompleted && this.state.controlsHistory[controlId]) {
            this.state.controlsHistory[controlId].push({
                time: this.state.currentTime,
                value: newValue
            });
        }

        // Apply physics update with all current control values
        this.applyControlPhysicsRealTime();

        // Show vectors automatically when controls change
        if (this.entryVehicle) {
            this.entryVehicle.setVectorsVisible(true, true); // true for auto-fade
        }
    }
    
    handleSettings(setting) {
        if (setting.type === 'showVectors') {
            if (this.entryVehicle) {
                this.entryVehicle.setVectorsVisible(setting.value);
            }
        }
    }
    
    /**
     * Handle control adjustments from PhaseInfo telemetry buttons
     * @param {string} controlId - Control identifier
     * @param {number} adjustment - Amount to adjust (+/- value)
     */
    handlePhaseInfoControlAdjust(controlId, adjustment) {
        // Only allow adjustments if controls are available
        if (!this.controls) {
            console.warn('Controls not initialized');
            return;
        }
        
        // Use the Controls class method to update the control
        this.controls.updateControlRelative(controlId, adjustment);
    }

    // All physics calculations now done by backend - no local physics methods needed

    // Throttle async calls to avoid performance issues in real-time loop
    _lastControlUpdate = 0;
    _controlCache = null;
    _controlCacheState = null;
    _controlUpdateInProgress = false;

    /**
     * Apply physics update with current control values
     * Generic method that works with any control configuration
     */
    async applyControlPhysicsRealTime() {
        const now = performance.now();
        const THROTTLE_INTERVAL = 500; // ms - increased for backend calls

        if (!this.trajectoryService) {
            console.warn('[SimulationManager] TrajectoryService not initialized');
            return;
        }

        // Need current vehicle data to send to backend
        if (!this.state.vehicleData) {
            console.warn('[SimulationManager] No vehicle data available for trajectory modification');
            return;
        }

        // Prevent concurrent backend calls
        if (this._controlUpdateInProgress) {
            console.log('[SimulationManager] Control update already in progress, skipping');
            return;
        }

        // Create cache key from current control values
        const controlStateKey = JSON.stringify(this.state.controls);

        // Use cached result if within throttle interval and controls haven't changed
        if (
            this._controlCache &&
            this._controlCacheState === controlStateKey &&
            now - this._lastControlUpdate < THROTTLE_INTERVAL
        ) {
            console.log(`[SimulationManager] Using cached trajectory for controls:`, this.state.controls);
            return;
        }

        this._lastControlUpdate = now;
        this._controlCacheState = controlStateKey;
        this._controlUpdateInProgress = true;

        console.log(`[SimulationManager] Recalculating trajectory FROM CURRENT TIME with controls:`, this.state.controls);

        try {
            // Get current state in meters (unscaled) for backend
            const currentData = this.state.vehicleData;

            // Prepare current state in backend format
            const currentState = {
                positionMeters: currentData.positionMeters || new THREE.Vector3(
                    currentData.position.x / 0.00001,
                    currentData.position.y / 0.00001,
                    currentData.position.z / 0.00001
                ),
                velocityMetersPerSec: currentData.velocity  // Already in m/s
            };

            console.log('[SimulationManager] Sending current state to backend:', {
                time: this.state.currentTime,
                position: currentState.positionMeters,
                velocity: currentState.velocityMetersPerSec,
                controls: this.state.controls
            });

            // Call backend to recalculate trajectory FROM CURRENT INSTANT ONWARDS
            const futureTrajectory = await this.trajectoryService.modifyTrajectoryFromCurrentState(
                this.state.controls,
                this.state.currentTime,
                currentState
            );

            if (futureTrajectory && futureTrajectory.length > 0) {
                // SPLICE new trajectory from current time - PRESERVES PAST TRAJECTORY
                this.trajectoryManager.spliceTrajectoryFromTime(this.state.currentTime, futureTrajectory);

                // Cache result
                this._controlCache = futureTrajectory;

                // Update total time if changed
                if (this.trajectoryManager.trajectoryData.length > 0) {
                    this.state.totalTime = this.trajectoryManager.trajectoryData[this.trajectoryManager.trajectoryData.length - 1].time;
                    if (this.timeline) {
                        this.timeline.setTotalTime(this.state.totalTime);
                    }
                }

                console.log(`[SimulationManager] Applied controls - future trajectory recalculated with ${futureTrajectory.length} points`);
            } else {
                console.error('[SimulationManager] Backend returned empty trajectory');
            }
        } catch (error) {
            console.error('[SimulationManager] Error applying control physics:', error);
            alert(`Failed to recalculate trajectory: ${error.message}\n\nPlease ensure the sim-server is running on port 3001 (proxied through Express server).`);
        } finally {
            this._controlUpdateInProgress = false;
        }
    }
    
    /**
     * Legacy method for backward compatibility
     * @deprecated Use applyControlPhysicsRealTime instead
     */
    async applyBankAnglePhysicsRealTime(bankAngle) {
        this.state.controls.bankAngle = bankAngle;
        await this.applyControlPhysicsRealTime();
    }

    // Removed legacy physics methods - all calculations now done by backend
    
    /**
     * Get control value at specific time from history
     * @param {string} controlId - Control identifier
     * @param {number} time - Time to get value for
     * @returns {*} Control value at that time
     */
    getControlValueForTime(controlId, time) {
        const history = this.state.controlsHistory[controlId];
        if (!history || history.length === 0) {
            return CONTROLS_CONFIG[controlId]?.defaultValue || 0;
        }

        let value = CONTROLS_CONFIG[controlId]?.defaultValue || 0;
        for (let i = 0; i < history.length; i++) {
            const adjustment = history[i];
            if (adjustment.time <= time) {
                value = adjustment.value;
            } else {
                break;
            }
        }
        return value;
    }
    
    startPlaybackReplay(autoPlay = true) {
        if (!this.state.simulationCompleted) {
            return;
        }

        this.pause();
        this.state.isRerunnning = true;
        this.state.currentTime = 0;
        
        // Reset all controls to default values
        this.state.controls = getDefaultControlValues();

        if (this.timeline) {
            this.timeline.setTime(0);
            this.timeline.setScrubbingEnabled(true);
            this.timeline.setReplayAvailable(true);
        }

        this.seekTo(0);

        if (autoPlay) {
            this.play();
        }
    }

    handleInitialRunCompletion() {
        if (this.state.playbackInitialized) {
            return;
        }

        this.state.playbackInitialized = true;
        this.state.controlsLocked = true;

        if (this.controls) {
            this.controls.setControlsEnabled(false, 'Playback mode active');
        }

        if (this.timeline) {
            this.timeline.setScrubbingEnabled(true);
            this.timeline.setReplayAvailable(true);
        }

        if (this.phaseInfo) {
            this.phaseInfo.setReplayMode(true);
        }

        if (this.options.onSimulationComplete) {
            this.options.onSimulationComplete();
        }

        this.startPlaybackReplay(true);
    }
    
    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up event listeners
        window.removeEventListener('resize', () => this.handleResize());
        window.removeEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Dispose components
        this.sceneManager.dispose();
        this.entryVehicle.dispose();
        this.trajectoryManager.dispose();
        if (this.mars) this.mars.dispose();
        if (this.stars) this.stars.dispose();
        
        // Dispose UI
        this.timeline.dispose();
        this.phaseInfo.dispose();
        this.controls.dispose();
        if (this.modelSelector) this.modelSelector.dispose();
    }

    getState() {
        return this.state;
    }

    // Removed switchCalculationMode - backend-only mode, no switching needed

    /**
     * Get current calculation mode and status
     * @returns {Object} Current mode information
     */
    getCalculationModeInfo() {
        return {
            currentMode: config.get('dataSource.mode'),
            backendUrl: config.get('dataSource.backendUrl'),
            fallbackEnabled: config.get('dataSource.fallbackToFrontend'),
            cacheEnabled: config.get('dataSource.cacheResults'),
            physicsEngine: this.physicsEngine ? 'available' : 'not available',
            dataProvider: this.dataProvider ? this.dataProvider.getConfig() : 'not available'
        };
    }

    /**
     * Test backend connectivity
     * @returns {Promise<boolean>} Whether backend is accessible
     */
    async testBackendConnection() {
        if (!this.dataProvider) {
            return false;
        }

        try {
            // Try to fetch a simple test endpoint
            const response = await fetch(`${config.get('dataSource.backendUrl')}/health`, {
                method: 'GET',
                timeout: 5000
            });

            return response.ok;
        } catch (error) {
            console.log('Backend connection test failed:', error.message);
            return false;
        }
    }
}
