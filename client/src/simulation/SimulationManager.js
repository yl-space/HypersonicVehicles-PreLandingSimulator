/**
 * Main simulation controller with planet switching
 */

import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager.js';
import { CameraController } from '../core/CameraController.js';
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
import { DataManager } from '../data/DataManager.js';
import { TrajectoryService } from '../services/TrajectoryService.js';
import { config } from '../config/SimulationConfig.js';

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
        
        // Simulation state
        this.state = {
            currentTime: 0,
            totalTime: 260.65,
            isPlaying: false,
            playbackSpeed: 1,
            currentPhase: 0,
            vehicleData: null,
            currentPlanet: 'mars',
            bankAngle: 0
        };
        
        // Animation
        this.clock = new THREE.Clock();
        this.animationId = null;

        // Removed trajectory clicking functionality
        
        this.init();
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
        
        this.trajectoryManager = new TrajectoryManager();
        this.phaseController = new PhaseController();
        this.dataManager = new DataManager();

        // Initialize backend-only trajectory service
        this.trajectoryService = new TrajectoryService({
            backendUrl: config.get('dataSource.backendUrl') || 'http://localhost:3001',
            timeout: 30000
        });
        
        // Create scene objects
        this.createSceneObjects();
        
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
    
    createSceneObjects() {
        // Create stars background
        this.stars = new Stars();
        this.sceneManager.addToAllScenes(this.stars.getObject3D());
        
        // Create all planets
        this.mars = new Mars();
        this.earth = new Earth();
        this.jupiter = new Jupiter();
        
        // Start with Mars visible
        this.currentPlanet = this.mars;
        this.sceneManager.addToAllScenes(this.mars.getObject3D());

        // Create entry vehicle
        this.entryVehicle = new EntryVehicle();
        this.sceneManager.addToAllScenes(this.entryVehicle.getObject3D());
        
        // Add trajectory line to all scenes
        const trajectoryObject = this.trajectoryManager.getObject3D();
        if (trajectoryObject) {
            this.sceneManager.addToAllScenes(trajectoryObject);
        }
        
        // Set camera target
        this.cameraController.setTarget(this.entryVehicle.getObject3D());
    }
    
    initializeUI() {
        // Timeline
        this.timeline = new Timeline({
            container: document.getElementById('timeline-container'),
            totalTime: this.state.totalTime,
            onTimeUpdate: (time) => this.seekTo(time),
            onPlayPause: () => this.togglePlayPause()
        });
        
        // Phase info panel
        this.phaseInfo = new PhaseInfo({
            container: document.getElementById('phase-info')
        });
        
        // Camera and zoom controls
        this.controls = new Controls({
            onCameraMode: (mode) => this.setCameraMode(mode),
            onZoom: (direction) => this.handleZoom(direction),
            onBankAngle: (lastAngle, angle) => this.handleBankAngle(lastAngle, angle),
            onSettings: (setting) => this.handleSettings(setting)
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
            mars: 0.1,    // Very close spacecraft-centric view for Mars
            earth: 0.2,   // Close view for Earth
            jupiter: 0.5  // Close view for Jupiter
        };
        
        if (cameraDistances[planetName]) {
            this.cameraController.setDefaultDistance(cameraDistances[planetName]);
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

            // Update total time from trajectory
            if (trajectoryData.length > 0) {
                this.state.totalTime = trajectoryData[trajectoryData.length - 1].time;
            }

            // Load mission configuration
            const missionConfig = await this.dataManager.loadMissionConfig();

            // PhaseController expects setPhases with array
            if (missionConfig.phases) {
                this.phaseController.setPhases(missionConfig.phases);
            }

            // Notify data loaded
            if (this.options.onDataLoaded) {
                this.options.onDataLoaded();
            }

            console.log('[SimulationManager] Trajectory data loaded successfully:', trajectoryData.length, 'points');

            // Initialize spacecraft position to trajectory start (critical for camera positioning)
            const startData = this.trajectoryManager.getDataAtTime(0);
            if (startData && startData.position && this.entryVehicle) {
                this.entryVehicle.setPosition(startData.position);
                console.log('[SimulationManager] Spacecraft initialized at J2000 trajectory start:', startData.position);
            }

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
        // Prevent default for navigation keys
        if (event.key === ' ' || event.key.startsWith('Arrow')) {
            event.preventDefault();
        }
        
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
            case 'r':
            case 'R':
                this.restart();
                break;
            case 'a':
                this.controls.updateBankAngleRelative(-5);
                break;
            case 'd':
                this.controls.updateBankAngleRelative(5);
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
        
        if (this.state.currentTime >= this.state.totalTime) {
            this.state.currentTime = this.state.totalTime;
            this.pause();
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
                    // Use scientific attitude calculation (trim AoA + bank angle)
                    this.entryVehicle.setScientificAttitude(
                        velocityVector,
                        this.state.vehicleData.position,
                        this.state.bankAngle
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
        this.entryVehicle.update(this.state.currentTime, this.state.vehicleData, this.state.bankAngle);
        
        // Update current planet
        if (this.currentPlanet) {
            this.currentPlanet.update(this.cameraController.camera, deltaTime);
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
            bankAngle: this.state.bankAngle
        };

        this.phaseInfo.update(
            this.phaseController.phases[this.state.currentPhase],
            enhancedVehicleData,
            this.state.currentTime,
            this.state.totalTime
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
        this.state.currentTime = Math.max(0, Math.min(time, this.state.totalTime));
        this.updateSimulation(0);
    }
    
    setPlaybackSpeed(speed) {
        this.state.playbackSpeed = speed;
    }
    
    setCameraMode(mode) {
        this.cameraController.setMode(mode);
    }
    
    handleZoom(direction) {
        this.cameraController.zoom(direction);
    }
    
    restart() {
        // Full simulation reset
        this.state.currentTime = 0;
        this.state.isPlaying = false;
        this.state.currentPhase = 0;
        this.state.bankAngle = 0;
        
        // Reset trajectory display
        if (this.trajectoryManager) {
            this.trajectoryManager.resetTrajectory();
        }
        
        // Reset spacecraft state
        if (this.entryVehicle) {
            this.entryVehicle.setVectorsVisible(false);
            // Reset spacecraft position to start
            const startData = this.trajectoryManager.getDataAtTime(0);
            if (startData && startData.position) {
                this.entryVehicle.setPosition(startData.position);
            }
        }
        
        // Reset UI elements
        if (this.controls && this.controls.elements.bankAngleSlider) {
            this.controls.elements.bankAngleSlider.value = 0;
            this.controls.elements.bankAngleValue.textContent = '0°';
            this.controls.lastSliderValue = 0;
        }
        
        // Reset camera
        if (this.cameraController) {
            this.cameraController.reset();
        }
        
        // Seek to beginning
        this.seekTo(0);
    }
    
    handleResize() {
        this.sceneManager.handleResize();
        this.cameraController.handleResize();
    }

    handleBankAngle(lastAngle, angle) {
        this.state.bankAngle = angle;

        // Apply realistic bank angle physics - immediate trajectory modification
        this.applyBankAnglePhysicsRealTime(angle);

        // Show vectors automatically when bank angle changes
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

    // All physics calculations now done by backend - no local physics methods needed

    // Throttle async calls to avoid performance issues in real-time loop
    _lastBankAngleUpdate = 0;
    _bankAngleCache = null;
    _bankAngleCacheAngle = null;
    _bankAngleUpdateInProgress = false;

    async applyBankAnglePhysicsRealTime(bankAngle) {
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
        if (this._bankAngleUpdateInProgress) {
            console.log('[SimulationManager] Bank angle update already in progress, skipping');
            return;
        }

        // Use cached result if within throttle interval and angle hasn't changed
        if (
            this._bankAngleCache &&
            this._bankAngleCacheAngle === bankAngle &&
            now - this._lastBankAngleUpdate < THROTTLE_INTERVAL
        ) {
            console.log(`[SimulationManager] Using cached trajectory for bank angle ${bankAngle}°`);
            return;
        }

        this._lastBankAngleUpdate = now;
        this._bankAngleCacheAngle = bankAngle;
        this._bankAngleUpdateInProgress = true;

        console.log(`[SimulationManager] Recalculating trajectory FROM CURRENT TIME with bank angle ${bankAngle}°`);

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
                velocity: currentState.velocityMetersPerSec
            });

            // Call backend to recalculate trajectory FROM CURRENT INSTANT ONWARDS
            const futureTrajectory = await this.trajectoryService.modifyTrajectoryFromCurrentState(
                bankAngle,
                this.state.currentTime,
                currentState
            );

            if (futureTrajectory && futureTrajectory.length > 0) {
                // SPLICE new trajectory from current time - PRESERVES PAST TRAJECTORY
                this.trajectoryManager.spliceTrajectoryFromTime(this.state.currentTime, futureTrajectory);

                // Cache result
                this._bankAngleCache = futureTrajectory;

                // Update total time if changed
                if (this.trajectoryManager.trajectoryData.length > 0) {
                    this.state.totalTime = this.trajectoryManager.trajectoryData[this.trajectoryManager.trajectoryData.length - 1].time;
                }

                console.log(`[SimulationManager] Applied bank angle ${bankAngle}° - future trajectory recalculated with ${futureTrajectory.length} points`);
            } else {
                console.error('[SimulationManager] Backend returned empty trajectory');
            }
        } catch (error) {
            console.error('[SimulationManager] Error applying bank angle physics:', error);
            alert(`Failed to recalculate trajectory: ${error.message}\n\nPlease ensure the sim-server is running on port 3001 (proxied through Express server).`);
        } finally {
            this._bankAngleUpdateInProgress = false;
        }
    }

    // Removed legacy physics methods - all calculations now done by backend
    
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