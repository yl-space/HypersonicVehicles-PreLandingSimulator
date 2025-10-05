/**
 * Main simulation controller with planet switching
 */

import * as THREE from '/node_modules/three/build/three.module.js';
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
import { SimulationDataProvider } from '../core/SimulationDataProvider.js';
import { PhysicsEngine } from '../physics/PhysicsEngine.js';
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
        this.dataProvider = null;
        this.physicsEngine = null;
        
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

        // Initialize new flexible data architecture
        this.physicsEngine = new PhysicsEngine(config.get('physics'));
        this.dataProvider = new SimulationDataProvider({
            source: config.get('dataSource.mode'),
            backendUrl: config.get('dataSource.backendUrl'),
            fallbackToFrontend: config.get('dataSource.fallbackToFrontend'),
            cacheResults: config.get('dataSource.cacheResults')
        });
        this.dataProvider.initialize(this.physicsEngine);
        
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
            // Extract filename from path
            const filename = this.options.dataPath.split('/').pop();
            
            // Load trajectory data using existing DataManager method
            const csvData = await this.dataManager.loadTrajectoryCSV(filename);
            
            // Transform CSV data to trajectory format with proper Vector3 objects
            const trajectoryData = [];
            let prevPosition = null;
            
            for (let i = 0; i < csvData.rows.length; i++) {
                const row = csvData.rows[i];
                
                // Parse values as floats
                const time = parseFloat(row.Time || row.time || 0);
                const x = parseFloat(row.x || 0);
                const y = parseFloat(row.y || 0);
                const z = parseFloat(row.z || 0);
                
                if (!isNaN(time) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    // Calculate raw distance from Mars center
                    const rawDistance = Math.sqrt(x * x + y * y + z * z);
                    
                    // Mars radius in meters
                    const marsRadiusMeters = 3390000;
                    
                    // Calculate altitude (distance from surface)
                    const altitude = rawDistance - marsRadiusMeters;
                    
                    // Scale factor for visualization (matching EntryVehicle scale)
                    const SCALE_FACTOR = 0.00001;
                    
                    // Create position vector
                    const position = new THREE.Vector3(
                        x * SCALE_FACTOR,
                        y * SCALE_FACTOR,
                        z * SCALE_FACTOR
                    );
                    
                    // Calculate velocity vector
                    let velocityVector = new THREE.Vector3(0, -1, 0);
                    let velocityMagnitude = 5900 * (1 - time / 260.65);
                    
                    if (prevPosition && i > 0) {
                        const prevTime = trajectoryData[trajectoryData.length - 1].time;
                        const dt = time - prevTime;
                        if (dt > 0) {
                            velocityVector = position.clone().sub(prevPosition).divideScalar(dt);
                            velocityMagnitude = velocityVector.length() / SCALE_FACTOR;
                            velocityVector.normalize();
                        }
                    }
                    
                    trajectoryData.push({
                        time: time,
                        position: position,
                        altitude: altitude * 0.001, // Convert to km for display
                        velocity: velocityVector, // Ensure it's a Vector3
                        velocityMagnitude: velocityMagnitude,
                        distanceToLanding: rawDistance * 0.001 // km
                    });
                    
                    prevPosition = position.clone();
                }
            }
            
            // Set trajectory data in TrajectoryManager
            this.trajectoryManager.setTrajectoryData(trajectoryData);
            
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
            
            console.log('Trajectory data loaded successfully:', trajectoryData.length, 'points');
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Use sample data if loading fails
            this.trajectoryManager.generateSampleTrajectory();
            console.log('Using sample trajectory data');
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

    applyBankAnglePhysics(angleDelta) {
        if (!this.trajectoryManager || !this.state.vehicleData) return;

        // Get current vehicle state
        const currentData = this.state.vehicleData;
        if (!currentData.velocity || !currentData.position) return;

        // Calculate lift force direction with current bank angle
        const velocity = currentData.velocity.clone();
        const position = currentData.position.clone();

        // Calculate angular momentum vector (h = r × v)
        const angularMomentum = new THREE.Vector3();
        angularMomentum.crossVectors(position, velocity).normalize();

        // Calculate base lift direction (perpendicular to velocity in orbital plane)
        const velocityNorm = velocity.clone().normalize();
        let liftDirection = new THREE.Vector3();
        liftDirection.crossVectors(angularMomentum, velocityNorm).normalize();

        // Apply bank angle rotation around velocity axis
        if (Math.abs(this.state.bankAngle) > 0.001) {
            const quaternion = new THREE.Quaternion();
            quaternion.setFromAxisAngle(velocityNorm, THREE.MathUtils.degToRad(this.state.bankAngle));
            liftDirection.applyQuaternion(quaternion);
        }

        // Calculate trajectory modification based on lift force
        // Real EDL physics: Lift force affects lateral trajectory
        const altitude = currentData.altitude || 100;
        const velocityMag = velocity.length();

        // Atmospheric density effect (exponential decay with altitude)
        const scaleHeight = 11.1; // km, Mars atmospheric scale height
        const densityRatio = Math.exp(-Math.max(0, altitude) / scaleHeight);

        // Lift coefficient for MSL-type capsule (typical L/D ~ 0.13)
        const liftToDragRatio = 0.13;
        const dynamicPressure = densityRatio * velocityMag * velocityMag;

        // Lift force magnitude (simplified)
        const liftMagnitude = liftToDragRatio * dynamicPressure * 0.0001; // Scaled for simulation

        // Apply lateral displacement based on lift force
        const lateralDisplacement = liftDirection.clone().multiplyScalar(liftMagnitude * 0.01);

        // Modify trajectory from current time forward
        this.trajectoryManager.offsetTrajectoryWithPhysics(
            this.state.currentTime,
            lateralDisplacement,
            this.state.bankAngle
        );
    }

    // Throttle async calls and cache results to avoid performance issues in real-time loop
    _lastBankAngleUpdate = 0;
    _bankAngleCache = null;
    _bankAngleCacheAngle = null;

    async applyBankAnglePhysicsRealTime(bankAngle) {
        const now = performance.now();
        const THROTTLE_INTERVAL = 300; // ms

        if (!this.dataProvider || !this.state.vehicleData) {
            console.log('DataProvider or vehicleData missing');
            return;
        }

        // Use cached result if within throttle interval and angle hasn't changed
        if (
            this._bankAngleCache &&
            this._bankAngleCacheAngle === bankAngle &&
            now - this._lastBankAngleUpdate < THROTTLE_INTERVAL
        ) {
            this.trajectoryManager.setTrajectoryData(this._bankAngleCache);
            return;
        }

        this._lastBankAngleUpdate = now;
        this._bankAngleCacheAngle = bankAngle;

        console.log(`Applying bank angle ${bankAngle}° at time ${this.state.currentTime}`);

        try {
            // Use the new data provider for trajectory modifications
            const modificationParameters = {
                currentTime: this.state.currentTime,
                bankAngle,
                realTimeModifications: true,
                source: config.get('dataSource.mode')
            };

            // Update physics parameters in real-time
            await this.dataProvider.updateParameters({
                bankAngle,
                currentTime: this.state.currentTime
            });

            // Get modified trajectory data
            const modifiedTrajectory = await this.dataProvider.getTrajectoryData(modificationParameters);

            if (modifiedTrajectory && modifiedTrajectory.points) {
                // Update trajectory manager with new data
                this.trajectoryManager.setTrajectoryData(modifiedTrajectory.points);

                // Cache result for throttle interval
                this._bankAngleCache = modifiedTrajectory.points;

                console.log(`Applied bank angle modification using ${modifiedTrajectory.metadata?.source || 'unknown'} source`);
            } else {
                console.warn('Failed to get modified trajectory data, falling back to legacy method');
                this.applyBankAnglePhysicsLegacy(bankAngle);
            }
        } catch (error) {
            console.error('Error applying bank angle physics:', error);

            // Fallback to legacy method if new system fails
            console.log('Falling back to legacy bank angle physics');
            this.applyBankAnglePhysicsLegacy(bankAngle);
        }
    }

    // Keep legacy method as fallback
    applyBankAnglePhysicsLegacy(bankAngle) {
        if (!this.trajectoryManager || !this.state.vehicleData) {
            return;
        }

        const currentData = this.state.vehicleData;
        if (!currentData.velocity || !currentData.position) {
            return;
        }

        // Reset to original trajectory before applying new bank angle
        this.trajectoryManager.resetTrajectory();

        // Calculate lift force direction with new bank angle
        const velocity = currentData.velocity.clone();
        const position = currentData.position.clone();

        // Calculate lift direction using physics engine
        const liftDirection = this.physicsEngine.calculateLiftDirection(position, velocity, bankAngle);

        // Convert bank angle to lateral trajectory offset
        const bankAngleRadians = THREE.MathUtils.degToRad(bankAngle);
        const lateralOffset = Math.sin(bankAngleRadians) * 0.1;

        // Apply lateral trajectory offset
        this.trajectoryManager.offsetTrajectoryLinearlyFromCurrentTime(
            this.state.currentTime,
            lateralOffset, // X direction (lateral)
            0,             // Y direction (no vertical change)
            0.2            // Final percent (stronger effect)
        );
    }

    offsetTrajectory(directionX, directionY) {
        if (!this.trajectoryManager) return;

        this.trajectoryManager.offsetTrajectoryLinearlyFromCurrentTime(this.state.currentTime, directionX, directionY);
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
    }

    getState() {
        return this.state;
    }

    /**
     * Switch between different calculation modes (frontend/backend/hybrid)
     * @param {string} mode - New calculation mode
     * @param {Object} options - Additional options for the mode switch
     */
    async switchCalculationMode(mode, options = {}) {
        if (!this.dataProvider) {
            console.error('DataProvider not initialized');
            return false;
        }

        try {
            console.log(`Switching calculation mode to: ${mode}`);

            // Update configuration
            config.set('dataSource.mode', mode);

            // Switch data provider source
            this.dataProvider.switchSource(mode);

            // Apply mode-specific configuration
            if (options.backendUrl) {
                config.set('dataSource.backendUrl', options.backendUrl);
                this.dataProvider.config.backendUrl = options.backendUrl;
            }

            // Reload trajectory data with new mode if needed
            if (options.reloadData !== false) {
                console.log('Reloading trajectory data with new calculation mode...');

                const currentTrajectoryData = this.trajectoryManager.trajectoryData;
                if (currentTrajectoryData && currentTrajectoryData.length > 0) {
                    // Get fresh trajectory data using new mode
                    const freshTrajectory = await this.dataProvider.getTrajectoryData({
                        recomputeFromOriginal: true,
                        bankAngle: this.state.bankAngle,
                        currentTime: this.state.currentTime
                    });

                    if (freshTrajectory && freshTrajectory.points) {
                        this.trajectoryManager.setTrajectoryData(freshTrajectory.points);
                        console.log(`Trajectory reloaded using ${mode} mode`);
                    }
                }
            }

            // Notify UI of mode change
            if (typeof options.onModeChanged === 'function') {
                options.onModeChanged(mode);
            }

            return true;
        } catch (error) {
            console.error(`Failed to switch to ${mode} mode:`, error);
            return false;
        }
    }

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