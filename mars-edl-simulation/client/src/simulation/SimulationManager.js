/**
 * SimulationManager.js
 * Main simulation controller with planet switching
 */

import * as THREE from 'three';
import { SceneManager } from '../core/SceneManager.js';
import { CameraController } from '../core/CameraController.js';
import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';
import { Mars } from '../components/environment/Mars.js';
import { Stars } from '../components/environment/Stars.js';
import { TrajectoryManager } from './TrajectoryManager.js';
import { PhaseController } from './PhaseController.js';
import { Timeline } from '../ui/Timeline.js';
import { PhaseInfo } from '../ui/PhaseInfo.js';
import { Controls } from '../ui/Controls.js';
import { DataManager } from '../data/DataManager.js';

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
            currentPlanet: 'mars'
        };
        
        // Animation
        this.clock = new THREE.Clock();
        this.animationId = null;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.clickEnabled = true;
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
        
        // Notify ready
        if (this.options.onReady) {
            this.options.onReady();
        }
        
        // Start animation loop
        this.animate();
        
        // Auto-start if requested
        if (this.options.autoStart) {
            this.play();
        }
    }
    
    createSceneObjects() {
        // Create entry vehicle
        this.entryVehicle = new EntryVehicle();
        this.sceneManager.addToAllScenes(this.entryVehicle.getObject3D());
        
        // Add trajectory line to all scenes
        this.sceneManager.addToAllScenes(this.trajectoryManager.getObject3D());
        
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
        // Add planet controls to existing UI without disrupting layout
        const planetControls = document.createElement('div');
        planetControls.id = 'planet-controls';
        planetControls.style.cssText = `
            position: absolute;
            top: 20px;
            right: 20px;
            z-index: 100;
            display: flex;
            gap: 10px;
        `;
        
        ['mars', 'earth', 'jupiter'].forEach(planet => {
            const btn = document.createElement('button');
            btn.className = `planet-btn ${planet === 'mars' ? 'active' : ''}`;
            btn.textContent = planet.charAt(0).toUpperCase() + planet.slice(1);
            btn.style.cssText = `
                padding: 10px 20px;
                font-size: 14px;
                background-color: rgba(255, 255, 255, 0.1);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            `;
            
            btn.addEventListener('click', () => this.switchPlanet(planet));
            planetControls.appendChild(btn);
        });
        
        document.getElementById('ui-overlay').appendChild(planetControls);
    }
    
    switchPlanet(planetName) {
        this.state.currentPlanet = planetName;
        this.sceneManager.switchPlanet(planetName);
        
        // Update button states
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.classList.toggle('active', 
                btn.textContent.toLowerCase() === planetName);
        });
    }
    
    async loadData() {
        try {
            // Notify data loading
            if (this.options.onDataLoaded) {
                this.options.onDataLoaded();
            }
            
            // Load trajectory data
            await this.trajectoryManager.loadTrajectoryData(this.options.dataPath);
            
            // Load mission configuration
            const missionConfig = await this.dataManager.loadMissionConfig();
            this.phaseController.setPhases(missionConfig.phases);
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Use sample data if loading fails
            this.trajectoryManager.generateSampleTrajectory();
        }
    }
    
    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => this.handleResize());
        
        // Mouse events for camera control
        this.sceneManager.renderer.domElement.addEventListener('mousedown', (e) => {
            this.onMouseDown(e);
        });
        
        this.sceneManager.renderer.domElement.addEventListener('mousemove', (e) => {
            this.onMouseMove(e);
        });
        
        this.sceneManager.renderer.domElement.addEventListener('mouseup', (e) => {
            this.onMouseUp(e);
        });
        
        // Mouse wheel for zoom
        this.sceneManager.renderer.domElement.addEventListener('wheel', (e) => {
            this.onMouseWheel(e);
        });
        
        // Click for deflection
        this.sceneManager.renderer.domElement.addEventListener('click', (e) => {
            this.onMouseClick(e);
        });
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        
        const deltaTime = this.clock.getDelta();
        
        // Update simulation time
        if (this.state.isPlaying) {
            this.updateSimulation(deltaTime);
        }
        
        // Update components
        this.updateComponents(deltaTime);
        
        // Render
        this.sceneManager.render(this.cameraController.camera);
    }
    
    updateSimulation(deltaTime) {
        // Update time
        this.state.currentTime += deltaTime * this.state.playbackSpeed;
        
        // Check bounds
        if (this.state.currentTime >= this.state.totalTime) {
            this.state.currentTime = this.state.totalTime;
            this.pause();
        }
        
        // Get current vehicle data
        this.state.vehicleData = this.trajectoryManager.getInterpolatedData(this.state.currentTime);
        
        if (this.state.vehicleData) {
            // Update vehicle position
            this.entryVehicle.getObject3D().position.copy(this.state.vehicleData.position);
            
            // Orient vehicle along velocity vector
            const velocityVector = this.trajectoryManager.getVelocityVector(this.state.currentTime);
            const lookAtPoint = this.state.vehicleData.position.clone().add(velocityVector);
            this.entryVehicle.getObject3D().lookAt(lookAtPoint);
            
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
        
        // Update planet rotation
        this.sceneManager.updatePlanetRotation(deltaTime);
        
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
    
    onMouseClick(event) {
        if (!this.clickEnabled || !this.state.isPlaying) return;
        
        const now = Date.now();
        if (now - this.lastClickTime < this.clickCooldown) return;
        
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        // Apply deflection
        const deflected = this.trajectoryManager.applyDeflection(
            this.mouse,
            this.state.currentTime,
            this.cameraController.camera
        );
        
        if (deflected) {
            this.lastClickTime = now;
            this.showClickFeedback(event.clientX, event.clientY);
        }
    }
    
    showClickFeedback(x, y) {
        const ripple = document.createElement('div');
        ripple.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            width: 40px;
            height: 40px;
            border: 2px solid #ffff00;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            pointer-events: none;
            animation: deflectionRipple 0.6s ease-out;
            z-index: 1000;
        `;
        
        document.body.appendChild(ripple);
        setTimeout(() => document.body.removeChild(ripple), 600);
    }
    
    handlePhaseTransition(newPhase) {
        this.state.currentPhase = newPhase;
        const phase = this.phaseController.phases[newPhase];
        
        console.log(`Phase transition: ${phase.name}`);
        
        // Handle phase-specific events
        switch(phase.name) {
            case 'Parachute Deploy':
                this.entryVehicle.deployParachute();
                this.cameraController.shake(2, 0.5);
                break;
                
            case 'Heat Shield Separation':
                this.entryVehicle.ejectHeatShield();
                this.cameraController.shake(1, 0.3);
                break;
                
            case 'Powered Descent':
                this.entryVehicle.activateThrusters(true);
                break;
        }
        
        // Emit phase change event
        if (this.options.onPhaseChange) {
            this.options.onPhaseChange(phase);
        }
    }
    
    // Control methods
    play() {
        this.state.isPlaying = true;
        this.timeline.setPlaying(true);
    }
    
    pause() {
        this.state.isPlaying = false;
        this.timeline.setPlaying(false);
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
        this.timeline.setTime(this.state.currentTime);
        
        this.state.vehicleData = this.trajectoryManager.getInterpolatedData(this.state.currentTime);
        if (this.state.vehicleData) {
            this.entryVehicle.getObject3D().position.copy(this.state.vehicleData.position);
            
            // Update trajectory display when seeking
            this.trajectoryManager.updateTrajectoryDisplay(this.state.currentTime);
        }
    }
    
    setPlaybackSpeed(speed) {
        this.state.playbackSpeed = speed;
        this.timeline.setPlaybackSpeed(speed);
    }
    
    setCameraMode(mode) {
        this.cameraController.setMode(mode);
        this.controls.setActiveCamera(mode);
    }
    
    handleZoom(direction) {
        if (direction === 'in') {
            this.cameraController.zoomIn();
        } else {
            this.cameraController.zoomOut();
        }
    }
    
    handleResize() {
        this.cameraController.handleResize();
        this.sceneManager.handleResize();
    }
    
    // Mouse event handlers
    onMouseDown(event) {
        this.cameraController.onMouseDown(event);
    }
    
    onMouseMove(event) {
        this.cameraController.onMouseMove(event);
        
        // Update cursor
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        
        this.sceneManager.renderer.domElement.style.cursor = 
            this.state.isPlaying ? 'pointer' : 'default';
    }
    
    onMouseUp(event) {
        this.cameraController.onMouseUp(event);
    }
    
    onMouseWheel(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? 'out' : 'in';
        this.handleZoom(delta);
    }
    
    // Public API
    getState() {
        return { ...this.state };
    }
    
    getVehicleData() {
        return this.state.vehicleData;
    }
    
    getCurrentPhase() {
        return this.phaseController.phases[this.state.currentPhase];
    }
    
    // Cleanup
    dispose() {
        cancelAnimationFrame(this.animationId);
        
        // Dispose components
        this.sceneManager.dispose();
        this.trajectoryManager.dispose();
        this.entryVehicle.dispose();
        
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
    }
}