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
        // Check if planet controls already exist
        if (document.getElementById('planet-controls')) return;
        
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
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            `;
            
            // Add hover effect
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
        
        // Add CSS for active state
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
        this.state.currentPlanet = planetName;
        this.sceneManager.switchPlanet(planetName);
        
        // Update button states
        document.querySelectorAll('.planet-btn').forEach(btn => {
            btn.classList.toggle('active', 
                btn.textContent.toLowerCase() === planetName);
        });
        
        // Adjust camera for different planet sizes
        const cameraDistances = {
            mars: 10,
            earth: 15,
            jupiter: 40
        };
        
        if (cameraDistances[planetName]) {
            this.cameraController.setDefaultDistance(cameraDistances[planetName]);
        }
    }
    
    async loadData() {
        try {
            // Load trajectory data
            const trajectoryData = await this.dataManager.loadTrajectoryData(this.options.dataPath);
            this.trajectoryManager.setTrajectoryData(trajectoryData);
            
            // Load mission configuration
            const missionConfig = await this.dataManager.loadMissionConfig();
            this.phaseController.setPhases(missionConfig.phases);
            
            // Notify data loaded
            if (this.options.onDataLoaded) {
                this.options.onDataLoaded();
            }
            
        } catch (error) {
            console.error('Error loading data:', error);
            // Use sample data if loading fails
            this.trajectoryManager.generateSampleTrajectory();
            this.phaseController.setDefaultPhases();
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
        switch(event.key) {
            case ' ':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'ArrowRight':
                this.seekTo(Math.min(this.state.currentTime + 5, this.state.totalTime));
                break;
            case 'ArrowLeft':
                this.seekTo(Math.max(this.state.currentTime - 5, 0));
                break;
            case '1':
                this.setCameraMode('follow');
                break;
            case '2':
                this.setCameraMode('orbit');
                break;
            case '3':
                this.setCameraMode('fixed');
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
            // Update vehicle position
            this.entryVehicle.setPosition(this.state.vehicleData.position);
            
            // Update vehicle rotation based on velocity
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
        if (!this.clickEnabled || !this.state.isPlaying) return;
        
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
    
    handleResize() {
        this.sceneManager.handleResize();
        this.cameraController.handleResize();
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
        
        // Dispose UI
        this.timeline.dispose();
        this.phaseInfo.dispose();
        this.controls.dispose();
    }
}