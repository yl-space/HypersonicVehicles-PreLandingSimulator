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
import { MarsTerrainMarkers } from '../components/environment/MarsTerrainMarkers.js';
import { MarsLatLonGrid } from '../components/environment/MarsLatLonGrid.js';
import { Atmosphere } from '../components/environment/Atmosphere.js';
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
        this.marsTerrainMarkers = null;
        this.marsLatLonGrid = null;
        this.atmosphere = null;

        // Nose camera (renders spacecraft pilot's POV to PFD canvas)
        this.noseCamera = null;
        this.noseCamRT = null;        // WebGLRenderTarget for off-screen render
        this._noseCamCtx = null;      // 2D context of the PFD canvas
        this._noseCamPixels = null;   // Uint8Array for readPixels
        this._noseCamImageData = null; // ImageData for canvas blit
        this._noseCamFrameSkip = 0;   // Throttle: render every 2nd frame

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

        // Marker tooltip state
        this.markerTooltipsEnabled = true;
        this.hoveredFeature = null;
        this.markerTooltipEl = null;
        this._markerRaycaster = new THREE.Raycaster();
        this._markerMouse = new THREE.Vector2();
        this._lastRaycastTime = 0;
        this._planetCenterWorld = new THREE.Vector3();

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
        const runtimeOrigin = window.location?.origin && window.location.origin !== 'null'
            ? window.location.origin
            : 'http://localhost:3001';
        const backendBaseUrl = config.get('dataSource.backendUrl') || runtimeOrigin;
        const marsTileBaseUrl = new URL('/sim/tiles/mars', backendBaseUrl).toString();

        // Create stars background
        this.stars = new Stars();
        this.sceneManager.addToAllScenes(this.stars.getObject3D());

        // Create all planets
        this.mars = new Mars({
            maxAnisotropy,
            renderMode: 'tile', // now proxied via sim-server to avoid CORS
            tileBaseUrl: marsTileBaseUrl,
            tileExtension: 'jpg',
            maxTileLevel: 6, // keep tile loads lighter for faster visibility
            marsJSBaseUrl: '/assets/textures/MarsJS'
        });
        this.earth = new Earth();
        this.jupiter = new Jupiter();

        // Create Mars terrain markers (craters, volcanoes, landing sites)
        this.marsTerrainMarkers = new MarsTerrainMarkers({
            marsRadius: this.mars.getRadius(),
            maxVisibleFeatures: 200,
            onFeatureHover: (feature) => {
                if (feature) {
                    console.log(`[SimulationManager] Hovering over: ${feature.name}`);
                }
            },
            onFeatureClick: (feature) => {
                if (feature) {
                    console.log(`[SimulationManager] Clicked: ${feature.name} - ${feature.description || ''}`);
                }
            }
        });

        // Atmospheric glow shell around Mars
        this.atmosphere = new Atmosphere(this.mars.getRadius());
        this.mars.getObject3D().add(this.atmosphere.getObject3D());

        // Start with Mars visible
        this.currentPlanet = this.mars;
        this.sceneManager.addToAllScenes(this.mars.getObject3D());

        // Add terrain markers to scene
        this.sceneManager.addToAllScenes(this.marsTerrainMarkers.getObject3D());

        // Create latitude / longitude grid overlay (enabled by default, toggleable via Settings)
        this.marsLatLonGrid = new MarsLatLonGrid({
            marsRadius : this.mars.getRadius(),
            visible    : false   // Off by default, toggled via Settings panel
        });
        this.sceneManager.addToAllScenes(this.marsLatLonGrid.getObject3D());

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

        // ── Nose camera: PerspectiveCamera at spacecraft nose ──
        this.noseCamera = new THREE.PerspectiveCamera(90, 1, 0.000001, 10000);
        // Position it at the forward tip of the spacecraft hull.
        // Spacecraft +Z = forward (velocity direction), nose is at +Z = VEHICLE_HEIGHT_UNITS.
        // We offset slightly forward so the hull isn't in view.
        const noseOffset = 0.00004; // ~4 m ahead of spacecraft center
        this.noseCamera.position.set(0, 0, noseOffset);
        this.noseCamera.rotation.set(0, 0, 0); // look along +Z (forward)
        this.entryVehicle.getObject3D().add(this.noseCamera);

        // Off-screen render target (256x256, matching the PFD canvas)
        this.noseCamRT = new THREE.WebGLRenderTarget(256, 256, {
            format: THREE.RGBAFormat,
            type: THREE.UnsignedByteType,
            depthBuffer: true,
            stencilBuffer: false,
        });
        this._noseCamPixels = new Uint8Array(256 * 256 * 4);

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
            onReset: () => this.startPlaybackReplay(true),
            onControlAdjust: (controlId, delta) => this.handlePhaseInfoControlAdjust(controlId, delta)
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
        if (document.getElementById('top-status-bar')) return;

        // Container for all top-center indicators
        const topBar = document.createElement('div');
        topBar.id = 'top-status-bar';
        topBar.style.cssText = `
            position: absolute;
            top: 10px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 100;
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        // Back button - collapses to icon, expands with label on hover
        const backBtn = document.createElement('button');
        backBtn.id = 'back-to-setup';
        backBtn.title = '';
        backBtn.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0;
            height: 30px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 15px;
            backdrop-filter: blur(8px);
            cursor: pointer;
            color: rgba(255, 255, 255, 0.6);
            transition: all 1.5s ease;
            padding: 0 8px;
            overflow: hidden;
            white-space: nowrap;
        `;
        backBtn.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span id="back-btn-label" style="
                max-width: 0;
                opacity: 0;
                overflow: hidden;
                transition: max-width 1.5s ease, opacity 1.5s ease, margin 1.5s ease;
                font-size: 11px;
                font-family: var(--font-ui);
                letter-spacing: 0.3px;
                margin-left: 0;
            ">Modify Inputs</span>
        `;
        backBtn.addEventListener('mouseenter', () => {
            backBtn.style.background = 'rgba(0, 0, 0, 0.6)';
            backBtn.style.borderColor = 'rgba(255, 255, 255, 0.25)';
            backBtn.style.color = 'rgba(255, 255, 255, 0.95)';
            const label = backBtn.querySelector('#back-btn-label');
            if (label) {
                label.style.maxWidth = '200px';
                label.style.opacity = '1';
                label.style.marginLeft = '6px';
            }
        });
        backBtn.addEventListener('mouseleave', () => {
            backBtn.style.background = 'rgba(0, 0, 0, 0.4)';
            backBtn.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            backBtn.style.color = 'rgba(255, 255, 255, 0.6)';
            const label = backBtn.querySelector('#back-btn-label');
            if (label) {
                label.style.maxWidth = '0';
                label.style.opacity = '0';
                label.style.marginLeft = '0';
            }
        });
        backBtn.addEventListener('click', () => {
            if (window.showStartupDialog) {
                window.showStartupDialog();
            }
        });

        // Planet indicator
        const planetIndicator = document.createElement('div');
        planetIndicator.id = 'planet-indicator';
        planetIndicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 5px 14px;
            background: rgba(0, 0, 0, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(8px);
            pointer-events: none;
        `;

        const planetName = (window.MarsEDL?.config?.planet || 'mars');
        const planetColors = { mars: '#c0392b', earth: '#2980b9', venus: '#f39c12', titan: '#e67e22' };
        const dotColor = planetColors[planetName] || '#c0392b';

        planetIndicator.innerHTML = `
            <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;box-shadow:0 0 6px ${dotColor};"></span>
            <span style="font-size:12px;color:rgba(255,255,255,0.7);font-family:var(--font-ui);text-transform:uppercase;letter-spacing:1px;">${planetName}</span>
        `;

        topBar.appendChild(backBtn);
        topBar.appendChild(planetIndicator);

        const uiOverlay = document.getElementById('ui-overlay');
        if (uiOverlay) {
            uiOverlay.appendChild(topBar);
        }
    }

    /**
     * Update the mode indicator (SIMULATION vs PLAYBACK)
     */
    updateModeIndicator(mode) {
        if (this.timeline) {
            this.timeline.setMode(mode);
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

        if (this.atmosphere) {
            this.atmosphere.getObject3D().visible = planetName === 'mars';
        }
        
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

        // Keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyPress(e));

        // Marker hover detection
        this.createMarkerTooltip();
        const canvas = this.sceneManager.renderer.domElement;
        canvas.addEventListener('pointermove', (e) => this.handleMarkerHover(e));
        canvas.addEventListener('pointerleave', () => this.hideMarkerTooltip());
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
            case '3':
                this.setCameraMode('trajectory');
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

        try {
            const deltaTime = this.clock.getDelta();

            if (this.state.isPlaying) {
                this.updateSimulation(deltaTime);
            }

            this.updateComponents(deltaTime);
            this.sceneManager.render(this.cameraController.camera);
        } catch (error) {
            console.error('[SimulationManager] Animation loop error:', error);
            console.error('Stack trace:', error.stack);
            // Don't stop the animation loop - just log the error
        }
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

        // Update entry vehicle effects - MUST pass camera for LOD updates!
        this.entryVehicle.update(
            this.state.currentTime,
            this.state.vehicleData,
            this.state.controls.bankAngle || 0,
            this.cameraController.camera  // FIX: Pass camera for LOD updates
        );

        // Update current planet
        if (this.currentPlanet) {
            this.currentPlanet.update(this.cameraController.camera, deltaTime, this.sceneManager.renderer);
        }
        
        // Update stars
        if (this.stars) {
            this.stars.update(deltaTime);
        }

        // Update terrain markers visibility based on camera distance
        if (this.marsTerrainMarkers && this.state.currentPlanet === 'mars') {
            this.marsTerrainMarkers.update(this.cameraController.camera);
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

        // Keep atmosphere anchored to Mars and adjust by spacecraft altitude.
        if (this.atmosphere && this.mars) {
            const altitudeKm = this.state.vehicleData?.altitude ?? 250;
            this.mars.getObject3D().getWorldPosition(this._planetCenterWorld);
            this.atmosphere.updateDynamics(altitudeKm, this._planetCenterWorld);
            // Scene tint/exposure removed — the atmosphere shader handles all visual
            // grading internally. No renderer.setClearColor or toneMappingExposure
            // changes, which eliminates the per-frame flicker.
        }

        // ── Render nose camera to PFD canvas (throttled to every 2nd frame) ──
        if (this.noseCamera && this.noseCamRT && this.sceneManager.currentScene) {
            this._noseCamFrameSkip = (this._noseCamFrameSkip + 1) % 2;
            if (this._noseCamFrameSkip === 0) {
                this._renderNoseCamera();
            }
        }
        
        // Update UI
        this.timeline.update(this.state.currentTime, this.state.isPlaying);

        // Keep timeline stepper displays in sync with current control values
        if (this.timeline) {
            this.timeline.setControlValue('bankAngle',      this.state.controls.bankAngle      ?? 0);
            this.timeline.setControlValue('angleOfAttack',  this.state.controls.angleOfAttack  ?? -16);

            // Feed cockpit instrument readouts
            if (this.state.vehicleData) {
                const vd = this.state.vehicleData;
                let velocity = 0;
                if (typeof vd.velocityMagnitude === 'number' && !isNaN(vd.velocityMagnitude)) {
                    velocity = vd.velocityMagnitude;
                } else if (vd.velocity && typeof vd.velocity.length === 'function') {
                    velocity = vd.velocity.length() * 100000;
                }
                const altKm = vd.altitude || 0;
                const soundSpeed = Math.max(150, 240 - altKm * 0.5);
                const mach = velocity / soundSpeed;
                const gForce = Math.min(velocity / 5000, 8);

                this.timeline.setTelemetry({
                    altitudeMiles:  altKm * 0.621371,
                    velocityMph:    velocity * 0.621371,
                    distanceMiles:  (vd.distanceToLanding || 0) * 0.621371,
                    mach,
                    gForce,
                });
            }
        }

        // Enhance vehicle data with attitude information for telemetry display
        const enhancedVehicleData = {
            ...this.state.vehicleData,
            angleOfAttack: this.entryVehicle ? this.entryVehicle.attitude.angleOfAttack : -16,
            bankAngle: this.state.controls.bankAngle || 0
        };
        
        // Get reference trajectory data at current time
        const refVehicleData = this.trajectoryManager.getReferenceDataAtTime(this.state.currentTime);

        this.phaseInfo.update(
            this.phaseController.phases[this.state.currentPhase],
            enhancedVehicleData,
            this.state.currentTime,
            this.state.totalTime,
            this.state.controls,  // Pass entire controls object instead of just bankAngle
            refVehicleData  // Pass reference trajectory data
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
    
    /**
     * Render the scene from the nose-mounted camera and blit to the PFD canvas.
     * Uses readPixels → ImageData → 2D canvas to avoid DOM-visible WebGL context.
     */
    _renderNoseCamera() {
        const renderer = this.sceneManager.renderer;
        const scene = this.sceneManager.currentScene;
        if (!renderer || !scene) return;

        // Lazily grab the 2D canvas context from the Timeline PFD
        if (!this._noseCamCtx) {
            const canvas = this.timeline?.getNoseCamCanvas?.();
            if (!canvas) return;
            this._noseCamCtx = canvas.getContext('2d');
            this._noseCamImageData = this._noseCamCtx.createImageData(256, 256);
        }

        const vehicleObj = this.entryVehicle.getObject3D();
        const wasVisible = vehicleObj.visible;

        try {
            // Hide the spacecraft itself so it doesn't block the nose camera view
            vehicleObj.visible = false;

            // Update the nose camera's world matrix (it's a child of the spacecraft group)
            this.noseCamera.updateMatrixWorld(true);

            // Save current render target, render into the off-screen RT
            const prevRT = renderer.getRenderTarget();
            renderer.setRenderTarget(this.noseCamRT);
            renderer.render(scene, this.noseCamera);

            // Read pixels from the RT
            renderer.readRenderTargetPixels(this.noseCamRT, 0, 0, 256, 256, this._noseCamPixels);

            // Restore render target
            renderer.setRenderTarget(prevRT);

            // Flip vertically (WebGL Y is bottom-up, canvas Y is top-down)
            const src = this._noseCamPixels;
            const dst = this._noseCamImageData.data;
            const stride = 256 * 4;
            for (let row = 0; row < 256; row++) {
                const srcOffset = (255 - row) * stride;
                const dstOffset = row * stride;
                for (let i = 0; i < stride; i++) {
                    dst[dstOffset + i] = src[srcOffset + i];
                }
            }

            this._noseCamCtx.putImageData(this._noseCamImageData, 0, 0);
        } catch (e) {
            // WebGL context loss or GPU error — silently skip this frame
        } finally {
            vehicleObj.visible = wasVisible;
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
        if (this.timeline) {
            this.timeline.setControlSteppersEnabled(true);
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
        if (setting.type === 'showMarkerInfo') {
            this.markerTooltipsEnabled = setting.value;
            if (!setting.value) this.hideMarkerTooltip();
        }
        if (setting.type === 'showLatLonGrid') {
            if (this.marsLatLonGrid) {
                this.marsLatLonGrid.setVisible(setting.value);
            }
        }
    }

    // ── Marker Tooltip ──────────────────────────────────────────

    createMarkerTooltip() {
        const el = document.createElement('div');
        el.className = 'marker-tooltip';
        el.innerHTML = `
            <div class="marker-tooltip-name"></div>
            <span class="marker-tooltip-type"></span>
            <div class="marker-tooltip-coords"></div>
            <div class="marker-tooltip-desc"></div>
            <div class="marker-tooltip-mission"></div>
        `;
        document.body.appendChild(el);
        this.markerTooltipEl = el;
    }

    handleMarkerHover(event) {
        if (!this.markerTooltipsEnabled || !this.marsTerrainMarkers) return;

        // Throttle to ~60 ms for performance
        const now = performance.now();
        if (now - this._lastRaycastTime < 60) return;
        this._lastRaycastTime = now;

        // Store cursor position for tooltip placement
        this._cursorX = event.clientX;
        this._cursorY = event.clientY;

        const canvas = this.sceneManager.renderer.domElement;
        const rect   = canvas.getBoundingClientRect();

        // Mouse position relative to the canvas in CSS pixels
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Find the closest feature within a 10-mile (16.093 km) surface radius
        // using depth-correct screen-space proximity projection
        const feature = this.marsTerrainMarkers.getFeatureNearPointer(
            this.cameraController.camera,
            mouseX,
            mouseY,
            rect.width,
            rect.height,
            16.093  // 10 miles expressed in km
        );

        if (feature) {
            if (!this.hoveredFeature || this.hoveredFeature.name !== feature.name) {
                this.hoveredFeature = feature;
                this.marsTerrainMarkers.clearHighlights();
                this.marsTerrainMarkers.highlightFeature(feature.name);
                this.showMarkerTooltip(feature);
            }
            this.updateMarkerTooltipPosition();
        } else if (this.hoveredFeature) {
            this.hoveredFeature = null;
            this.marsTerrainMarkers.clearHighlights();
            this.hideMarkerTooltip();
        }
    }

    showMarkerTooltip(feature) {
        const el = this.markerTooltipEl;
        if (!el) return;

        const style = feature.style || {};
        const colorHex = style.color != null
            ? '#' + new THREE.Color(style.color).getHexString()
            : '#ffffff';

        el.querySelector('.marker-tooltip-name').textContent = feature.name;

        const typeEl = el.querySelector('.marker-tooltip-type');
        typeEl.textContent = style.label || feature.type || 'Feature';
        typeEl.style.background = colorHex + '30';
        typeEl.style.color = colorHex;
        typeEl.style.border = `1px solid ${colorHex}50`;

        const lat = feature.lat != null ? feature.lat.toFixed(2) : '—';
        const lon = feature.lon != null ? feature.lon.toFixed(2) : '—';
        el.querySelector('.marker-tooltip-coords').textContent = `${lat}\u00B0 N, ${lon}\u00B0 E`;

        const descEl = el.querySelector('.marker-tooltip-desc');
        if (feature.description && feature.description.length > 0) {
            descEl.textContent = feature.description.length > 120
                ? feature.description.slice(0, 117) + '...'
                : feature.description;
            descEl.style.display = '';
        } else {
            descEl.style.display = 'none';
        }

        const missionEl = el.querySelector('.marker-tooltip-mission');
        if (feature.type === 'LF' && feature.mission) {
            missionEl.innerHTML =
                `<span>${feature.mission}</span>` +
                (feature.year ? ` (${feature.year})` : '') +
                (feature.agency ? `<br>${feature.agency}` : '') +
                (feature.status ? ` &mdash; ${feature.status}` : '');
            missionEl.style.display = '';
        } else {
            missionEl.style.display = 'none';
        }

        el.classList.add('visible');
    }

    hideMarkerTooltip() {
        if (this.markerTooltipEl) {
            this.markerTooltipEl.classList.remove('visible');
        }
    }

    updateMarkerTooltipPosition() {
        if (!this.markerTooltipEl || !this.hoveredFeature) return;

        const tooltipRect = this.markerTooltipEl.getBoundingClientRect();
        const offset = 16;
        const cx = this._cursorX || 0;
        const cy = this._cursorY || 0;

        // Place to the right of cursor; flip left if near right edge
        let left = cx + offset;
        if (left + tooltipRect.width > window.innerWidth - 8) {
            left = cx - offset - tooltipRect.width;
        }

        // Place below cursor; flip above if near bottom edge
        let top = cy + offset;
        if (top + tooltipRect.height > window.innerHeight - 8) {
            top = cy - offset - tooltipRect.height;
        }

        // Clamp to viewport
        left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));

        this.markerTooltipEl.style.left = `${left}px`;
        this.markerTooltipEl.style.top = `${top}px`;
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
            this.timeline.setPlaybackMode(true);
            this.timeline.setControlSteppersEnabled(false);
        }

        if (this.phaseInfo) {
            this.phaseInfo.setReplayMode(true);
        }

        // Update mode indicator to PLAYBACK
        this.updateModeIndicator('PLAYBACK');

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
        if (this.atmosphere) this.atmosphere.dispose();
        if (this.marsTerrainMarkers) this.marsTerrainMarkers.dispose();
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
