/**
 * SimulationManager.js
 * Main simulation controller that coordinates all components
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
            dataPath: '/data/MSL_position_J2000.csv',
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
        this.Mars = null;
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
            vehicleData: null
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
        this.cameraController = new CameraController(this.sceneManager.renderer);
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
        // Create Mars
        this.Mars = new Mars();
        this.sceneManager.scene.add(this.Mars.getObject3D());
        
        // Create stars
        this.stars = new Stars();
        this.sceneManager.scene.add(this.stars.getObject3D());
        
        // Create entry vehicle
        this.entryVehicle = new EntryVehicle();
        this.sceneManager.scene.add(this.entryVehicle.getObject3D());
        
        // Add trajectory line
        this.sceneManager.scene.add(this.trajectoryManager.getObject3D());
        
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
    }
    
    async loadData() {
        try {
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
        // Keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case ' ':
                    e.preventDefault();
                    this.togglePlayPause();
                    break;
                case 'ArrowRight':
                    this.seekTo(Math.min(this.state.currentTime + 5, this.state.totalTime));
                    break;
                case 'ArrowLeft':
                    this.seekTo(Math.max(this.state.currentTime - 5, 0));
                    break;
                case 'r':
                case 'R':
                    this.reset();
                    break;
                case '1':
                    this.setCameraMode('FOLLOW');
                    break;
                case '2':
                    this.setCameraMode('FREE');
                    break;
                case '3':
                    this.setCameraMode('CINEMATIC');
                    break;
            }
        });

        // Mouse click for deflection
        this.options.container.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.options.container.addEventListener('click', (e) => this.onMouseClick(e));
        
        // Window resize
        window.addEventListener('resize', () => {
            this.handleResize();
        });
    }
    
    onMouseMove(event) {
        const rect = this.options.container.getBoundingClientRect();
        this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        
        // Check hover over future trajectory
        if (this.trajectoryManager && this.trajectoryManager.futureTrajectory) {
            this.raycaster.setFromCamera(this.mouse, this.cameraController.camera);
            const intersects = this.raycaster.intersectObject(this.trajectoryManager.futureTrajectory);
            
            this.options.container.style.cursor = 
                (intersects.length > 0 && this.state.isPlaying) ? 'pointer' : 'default';
        }
    }

    onMouseClick(event) {
        if (!this.clickEnabled || !this.state.isPlaying) return;
        
        const now = Date.now();
        if (now - this.lastClickTime < this.clickCooldown) return;
        
        // Apply deflection
        const deflected = this.trajectoryManager.applyDeflection(
            this.mouse,
            this.state.currentTime,
            this.cameraController.camera
        );
        
        if (deflected) {
            this.lastClickTime = now;
            this.showClickFeedback(event.clientX, event.clientY);
            
            // Check if vehicle should react
            const currentDeflection = this.trajectoryManager.deflectionPoints[
                this.trajectoryManager.deflectionPoints.length - 1
            ];
            
            if (currentDeflection) {
                const deflectionTime = this.trajectoryManager.modifiedData[
                    currentDeflection.index
                ].time; // Note: lowercase 'time' in your data structure
                
                if (Math.abs(this.state.currentTime - deflectionTime) < 0.5) {
                    this.entryVehicle.onDeflection();
                }
            }
        }
    }

    reset() {
        this.state.currentTime = 0;
        this.pause();
        
        // Reset trajectory
        if (this.trajectoryManager) {
            this.trajectoryManager.reset();
            this.trajectoryManager.updateTrajectoryDisplay(0);
        }
        
        // Reset vehicle position
        this.state.vehicleData = this.trajectoryManager.getInterpolatedData(0);
        if (this.state.vehicleData) {
            this.entryVehicle.getObject3D().position.copy(this.state.vehicleData.position);
        }
        
        // Update UI
        this.timeline.setTime(0);
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

            // ADD: Update trajectory display
            this.trajectoryManager.updateTrajectoryDisplay(this.state.currentTime);
            
            // ADD: Check for deflection passage
            for (const deflection of this.trajectoryManager.deflectionPoints) {
                const deflectionTime = this.trajectoryManager.modifiedData[deflection.index].time;
                if (Math.abs(this.state.currentTime - deflectionTime) < 0.5) {
                    this.entryVehicle.onDeflection();
                    break;
                }
            }
        }
    }
    
    updateComponents(deltaTime) {
        // Update camera
        this.cameraController.update(deltaTime, this.state.vehicleData);
        
        // Update entry vehicle effects
        this.entryVehicle.update(this.state.currentTime, this.state.vehicleData);
        
        // Update Mars rotation
        this.Mars.update(deltaTime);

        // Update trajectory visibility
        this.trajectoryManager.updateTrajectoryVisibility(this.state.currentTime);

        // ADD: Animate deflection markers
        if (this.trajectoryManager) {
            this.trajectoryManager.animateMarkers(deltaTime);
        }
        
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
        this.emit('phaseChange', phase);
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
            
            // ADD: Update trajectory display when seeking
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
    
    // Event emitter methods (simplified)
    emit(event, data) {
        if (this.options[`on${event.charAt(0).toUpperCase() + event.slice(1)}`]) {
            this.options[`on${event.charAt(0).toUpperCase() + event.slice(1)}`](data);
        }
    }
    
    // Cleanup
    dispose() {
        cancelAnimationFrame(this.animationId);
        
        // Dispose components
        this.sceneManager.dispose();
        this.trajectoryManager.dispose();
        this.entryVehicle.dispose();
        this.Mars.dispose();
        this.stars.dispose();
        
        // Remove event listeners
        document.removeEventListener('keydown', this.handleKeydown);
        window.removeEventListener('resize', this.handleResize);
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
}