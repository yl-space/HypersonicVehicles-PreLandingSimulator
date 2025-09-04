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
import { CoordinateAxes } from '../components/helpers/CoordinateAxes.js';

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
        
        // Scene objects
        this.entryVehicle = null;
        this.mars = null;
        this.earth = null;
        this.jupiter = null;
        this.currentPlanet = null;
        this.stars = null;
        this.coordinateAxes = null;

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
            currentPlanet: 'jupiter'
        };
        
        // Animation
        this.clock = new THREE.Clock();
        this.animationId = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clickEnabled = true; // Enable trajectory click functionality
        this.lastClickTime = 0;
        this.clickCooldown = 500;
        
        this.init();
    }
    
    async init() {
        // Initialize core components
        this.sceneManager = new SceneManager(this.options.container);
        this.cameraController = new CameraController(
            this.sceneManager.camera,
            this.sceneManager.renderer
        );
        
        // Ensure Jupiter is active by default
        this.sceneManager.switchPlanet('jupiter');
        
        this.trajectoryManager = new TrajectoryManager();
        this.phaseController = new PhaseController();
        this.dataManager = new DataManager();
        
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
        
        // Start with Jupiter visible
        this.currentPlanet = this.jupiter;
        this.sceneManager.addToAllScenes(this.jupiter.getObject3D());
        
        // Create coordinate axes for reference 
        // Using scale of 300 units to be clearly visible with planet scales
        this.coordinateAxes = new CoordinateAxes(300);
        this.sceneManager.addToAllScenes(this.coordinateAxes.getObject3D());
        
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
            onZoom: (direction) => this.handleZoom(direction)
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
            btn.className = `planet-btn ${planet === 'jupiter' ? 'active' : ''}`;
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
        
        // Adjust camera for different planet sizes with smaller spacecraft
        const cameraDistances = {
            mars: 5,      // View distance for Mars with small spacecraft
            earth: 8,     // View distance for Earth  
            jupiter: 20   // View distance for Jupiter (larger planet)
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
        
        // Mouse click for trajectory interaction
        this.sceneManager.renderer.domElement.addEventListener('click', (e) => this.onMouseClick(e));
        
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
                this.offsetTrajectory(-1, 0);
                break;
            case 'd':
                this.offsetTrajectory(1, 0);
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
                
                // Update rotation based on velocity
                const velocityVector = this.trajectoryManager.getVelocityVector(this.state.currentTime);
                if (velocityVector && velocityVector.length() > 0.001) {
                    const lookAtPoint = this.state.vehicleData.position.clone().add(velocityVector);
                    this.entryVehicle.getObject3D().lookAt(lookAtPoint);
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
        this.entryVehicle.update(this.state.currentTime, this.state.vehicleData);
        
        // Update current planet
        if (this.currentPlanet) {
            this.currentPlanet.update(this.cameraController.camera, deltaTime);
        }
        
        // Update stars
        if (this.stars) {
            this.stars.update(deltaTime);
        }
        
        // Update coordinate axes
        if (this.coordinateAxes) {
            this.coordinateAxes.update(this.cameraController.camera);
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
        this.phaseInfo.update(
            this.phaseController.phases[this.state.currentPhase],
            this.state.vehicleData,
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
    
    onMouseClick(event) {
        if (!this.clickEnabled) return; // Allow clicking even when paused
        
        const now = Date.now();
        if (now - this.lastClickTime < this.clickCooldown) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.raycaster.setFromCamera(this.mouse, this.cameraController.camera);
        
        const trajectoryLine = this.trajectoryManager.getTrajectoryLine();
        if (trajectoryLine) {
            const intersects = this.raycaster.intersectObject(trajectoryLine);
            
            if (intersects.length > 0) {
                const clickedPoint = intersects[0].point;
                const clickedTime = this.trajectoryManager.getTimeFromPosition(clickedPoint);
                
                if (clickedTime !== null) {
                    this.seekTo(clickedTime);
                    this.lastClickTime = now;
                }
            }
        }
    }
    
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
        this.state.currentTime = 0;
        this.state.isPlaying = false;
        this.seekTo(0);
        this.cameraController.reset();
    }
    
    handleResize() {
        this.sceneManager.handleResize();
        this.cameraController.handleResize();
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
}