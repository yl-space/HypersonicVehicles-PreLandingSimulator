/**
 * SimulationManager.js
 * Main simulation controller that orchestrates all components
 */

import { SceneManager } from '../core/SceneManager.js';
import { TrajectoryManager } from './TrajectoryManager.js';
import { PhaseController } from './PhaseController.js';
import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';
import { Mars } from '../components/environment/Mars.js';
import { Stars } from '../components/environment/Stars.js';
import { Timeline } from '../ui/Timeline.js';
import { PhaseInfo } from '../ui/PhaseInfo.js';
import { Controls } from '../ui/Controls.js';
import { DataManager } from '../data/DataManager.js';
import * as THREE from 'three';

export class SimulationManager {
    constructor() {
        this.sceneManager = null;
        this.trajectoryManager = null;
        this.phaseController = null;
        this.dataManager = null;
        
        this.entryVehicle = null;
        this.mars = null;
        this.stars = null;
        
        // UI Components
        this.timeline = null;
        this.phaseInfo = null;
        this.controls = null;
        
        // Simulation state
        this.isLoaded = false;
        this.isPaused = true;
        this.currentMission = 'msl';
        
        // Camera modes
        this.cameraMode = 'FREE';
        
        this.init();
    }
    
    async init() {
        try {
            // Update loading progress
            this.updateLoadingProgress(10, 'Initializing scene...');
            
            // Initialize scene manager
            const container = document.getElementById('canvas-container');
            this.sceneManager = new SceneManager(container);
            
            this.updateLoadingProgress(20, 'Loading environment...');
            
            // Create environment
            this.createEnvironment();
            
            this.updateLoadingProgress(30, 'Creating spacecraft...');
            
            // Create entry vehicle
            this.entryVehicle = new EntryVehicle();
            this.sceneManager.addToScene(this.entryVehicle);
            
            this.updateLoadingProgress(40, 'Loading trajectory data...');
            
            // Initialize managers
            this.trajectoryManager = new TrajectoryManager();
            this.phaseController = new PhaseController();
            this.dataManager = new DataManager();
            
            // Load trajectory data
            await this.loadMissionData();
            
            this.updateLoadingProgress(60, 'Setting up visualization...');
            
            // Create trajectory visualization
            this.createTrajectoryVisualization();
            
            this.updateLoadingProgress(80, 'Initializing user interface...');
            
            // Setup UI
            this.setupUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.updateLoadingProgress(100, 'Ready!');
            
            // Hide loading screen
            setTimeout(() => {
                document.getElementById('loading-screen').style.opacity = '0';
                setTimeout(() => {
                    document.getElementById('loading-screen').style.display = 'none';
                    this.isLoaded = true;
                    this.showIntroduction();
                }, 500);
            }, 500);
            
        } catch (error) {
            console.error('Initialization failed:', error);
            this.showError(error.message);
        }
    }
    
    createEnvironment() {
        // Create Mars
        this.mars = new Mars();
        this.sceneManager.addToScene(this.mars);
        
        // Create starfield
        this.stars = new Stars();
        this.sceneManager.addToScene(this.stars);
        
        // Add landing zone marker
        this.mars.highlightLandingZone(-5.4, 137.8, 20); // Gale Crater
    }
    
    async loadMissionData() {
        try {
            // Load mission configuration
            const missionConfig = await this.dataManager.loadMissionConfig(this.currentMission);
            
            // Load trajectory data
            const trajectoryData = await this.dataManager.loadTrajectoryData(this.currentMission);
            await this.trajectoryManager.loadTrajectoryData(trajectoryData);
            
            // Configure phase controller
            this.phaseController.setMissionPhases(missionConfig.phases);
            
            // Set initial position
            const initialState = this.trajectoryManager.getStateAtTime(0);
            this.entryVehicle.updateState(initialState);
            
            // Position camera
            this.positionCameraForEntry(initialState);
            
        } catch (error) {
            console.error('Failed to load mission data:', error);
            // Use demo data as fallback
            await this.loadDemoData();
        }
    }
    
    async loadDemoData() {
        // Generate demo trajectory
        const demoCSV = this.generateDemoCSV();
        await this.trajectoryManager.loadTrajectoryData(demoCSV);
        
        // Set default phases
        this.phaseController.setMissionPhases([
            { name: "Entry Interface", startTime: 0, altitude: 132000 },
            { name: "Peak Heating", startTime: 80, altitude: 60000 },
            { name: "Peak Deceleration", startTime: 150, altitude: 25000 },
            { name: "Parachute Deploy", startTime: 260.65, altitude: 13462.9 }
        ]);
    }
    
    generateDemoCSV() {
        let csv = "Time,x,y,z\n";
        const marsRadius = 3389500;
        
        for (let t = 0; t <= 260.65; t += 0.5) {
            const progress = t / 260.65;
            const altitude = 132000 * Math.exp(-3.5 * Math.pow(progress, 1.8));
            const r = marsRadius + altitude;
            
            const angle = progress * 0.035;
            const lat = -0.27 + progress * 0.1; // -15.5 degrees entry
            
            const x = r * Math.cos(lat) * Math.cos(angle);
            const y = r * Math.cos(lat) * Math.sin(angle);
            const z = r * Math.sin(lat);
            
            csv += `${t},${x},${y},${z}\n`;
        }
        
        return csv;
    }
    
    createTrajectoryVisualization() {
        const points = this.trajectoryManager.getFullTrajectory();
        const scaledPoints = points.map(p => p.clone().multiplyScalar(0.001));
        
        // Create main trajectory line
        const geometry = new THREE.BufferGeometry().setFromPoints(scaledPoints);
        
        // Add color gradient
        const colors = new Float32Array(scaledPoints.length * 3);
        for (let i = 0; i < scaledPoints.length; i++) {
            const t = i / (scaledPoints.length - 1);
            colors[i * 3] = 0.0 + t * 1.0;     // R
            colors[i * 3 + 1] = 1.0 - t * 0.3; // G
            colors[i * 3 + 2] = 1.0 - t * 1.0; // B
        }
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.LineBasicMaterial({
            vertexColors: true,
            linewidth: 2,
            transparent: true,
            opacity: 0.6
        });
        
        const trajectoryLine = new THREE.Line(geometry, material);
        trajectoryLine.name = 'trajectory';
        this.sceneManager.addToScene(trajectoryLine);
        
        // Add phase markers
        this.addPhaseMarkers();
    }
    
    addPhaseMarkers() {
        const phases = this.phaseController.phases;
        const markerGroup = new THREE.Group();
        markerGroup.name = 'phase-markers';
        
        phases.forEach((phase, index) => {
            const state = this.trajectoryManager.getStateAtTime(phase.startTime);
            if (state) {
                const pos = state.position.clone().multiplyScalar(0.001);
                
                // Create marker
                const geometry = new THREE.SphereGeometry(3, 16, 8);
                const material = new THREE.MeshBasicMaterial({
                    color: new THREE.Color().setHSL(index / phases.length, 1, 0.5),
                    emissive: new THREE.Color().setHSL(index / phases.length, 1, 0.5),
                    emissiveIntensity: 0.5
                });
                
                const marker = new THREE.Mesh(geometry, material);
                marker.position.copy(pos);
                marker.userData = { phase: phase.name };
                markerGroup.add(marker);
            }
        });
        
        this.sceneManager.addToScene(markerGroup);
    }
    
    setupUI() {
        const uiOverlay = document.getElementById('ui-overlay');
        
        // Timeline
        this.timeline = new Timeline(this.trajectoryManager);
        uiOverlay.appendChild(this.timeline.element);
        
        // Phase info
        this.phaseInfo = new PhaseInfo(this.phaseController);
        uiOverlay.appendChild(this.phaseInfo.element);
        
        // Controls
        this.controls = new Controls(this);
        uiOverlay.appendChild(this.controls.element);
        
        // Telemetry panel
        this.createTelemetryPanel();
    }
    
    createTelemetryPanel() {
        const panel = document.createElement('div');
        panel.id = 'telemetry-panel';
        panel.className = 'ui-panel';
        panel.innerHTML = `
            <h3>Vehicle Telemetry</h3>
            <div id="telemetry-data">
                <div class="telemetry-item">
                    <span class="label">Altitude:</span>
                    <span class="value" id="altitude">--</span>
                    <span class="unit">km</span>
                </div>
                <div class="telemetry-item">
                    <span class="label">Velocity:</span>
                    <span class="value" id="velocity">--</span>
                    <span class="unit">m/s</span>
                </div>
                <div class="telemetry-item">
                    <span class="label">Mach:</span>
                    <span class="value" id="mach">--</span>
                    <span class="unit"></span>
                </div>
                <div class="telemetry-item">
                    <span class="label">G-Force:</span>
                    <span class="value" id="gforce">--</span>
                    <span class="unit">G</span>
                </div>
                <div class="telemetry-item">
                    <span class="label">Heat Load:</span>
                    <span class="value" id="heat">--</span>
                    <span class="unit">%</span>
                </div>
                <div class="telemetry-item">
                    <span class="label">Pressure:</span>
                    <span class="value" id="pressure">--</span>
                    <span class="unit">kPa</span>
                </div>
            </div>
        `;
        document.getElementById('ui-overlay').appendChild(panel);
    }
    
    setupEventListeners() {
        // Scene render event
        window.addEventListener('scene-render', (e) => {
            this.update(e.detail.deltaTime);
        });
        
        // Trajectory events
        this.trajectoryManager.on('timeupdate', (time) => {
            this.updateSimulation(time);
        });
        
        this.trajectoryManager.on('complete', () => {
            this.onSimulationComplete();
        });
        
        // Phase events
        this.phaseController.on('phasechange', (phase) => {
            this.onPhaseChange(phase);
        });
        
        // Keyboard controls
        window.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // Camera shake event
        window.addEventListener('camera-shake', (e) => {
            this.sceneManager.applyCameraShake(e.detail.intensity);
        });
    }
    
    handleKeyboard(event) {
        switch(event.key) {
            case ' ':
                event.preventDefault();
                this.togglePlayPause();
                break;
            case 'r':
                this.reset();
                break;
            case 'f':
                this.toggleCameraMode();
                break;
            case '1':
            case '2':
            case '3':
                this.setCinematicView(parseInt(event.key) - 1);
                break;
            case 'Escape':
                this.controls.closeModals();
                break;
        }
    }
    
    update(deltaTime) {
        if (!this.isLoaded) return;
        
        // Update trajectory
        this.trajectoryManager.update(deltaTime);
        
        // Update phase controller
        const currentTime = this.trajectoryManager.currentTime;
        this.phaseController.update(currentTime);
        
        // Update environment
        this.mars.update(deltaTime);
        this.stars.update(deltaTime);
        
        // Update UI
        this.timeline.update();
        this.phaseInfo.update();
    }
    
    updateSimulation(time) {
        const state = this.trajectoryManager.getCurrentState();
        
        // Update vehicle
        this.entryVehicle.updateState(state);
        
        // Update telemetry
        this.updateTelemetry(state);
        
        // Update trajectory visualization
        this.updateTrajectoryHighlight(time);
    }
    
    updateTelemetry(state) {
        const telemetry = this.entryVehicle.getTelemetry();
        if (!telemetry) return;
        
        document.getElementById('altitude').textContent = telemetry.altitude;
        document.getElementById('velocity').textContent = telemetry.velocity;
        document.getElementById('mach').textContent = telemetry.machNumber;
        document.getElementById('gforce').textContent = telemetry.gForce;
        document.getElementById('heat').textContent = telemetry.heatIntensity;
        document.getElementById('pressure').textContent = ((state.dynamicPressure || 0) / 1000).toFixed(1);
    }
    
    updateTrajectoryHighlight(time) {
        // Could implement shader-based highlight of completed trajectory
        const progress = time / this.trajectoryManager.totalDuration;
        
        // Update any progress-based visuals
        if (this.entryVehicle.plasmaTrail) {
            this.entryVehicle.plasmaTrail.material.uniforms.intensity.value = 
                Math.min(1, progress * 2) * this.entryVehicle.heatIntensity;
        }
    }
    
    onPhaseChange(phase) {
        console.log('Phase changed to:', phase.name);
        
        // Special effects for phase transitions
        switch(phase.name) {
            case 'Peak Heating':
                this.showNotification('Entering Peak Heating Phase', 'warning');
                break;
            case 'Peak Deceleration':
                this.showNotification('Maximum Deceleration', 'danger');
                break;
            case 'Parachute Deploy':
                this.showNotification('Parachute Deployment', 'success');
                this.entryVehicle.deployParachute();
                break;
        }
    }
    
    positionCameraForEntry(initialState) {
        const vehiclePos = initialState.position.clone().multiplyScalar(0.001);
        this.sceneManager.camera.position.set(
            vehiclePos.x + 100,
            vehiclePos.y + 200,
            vehiclePos.z + 500
        );
        this.sceneManager.camera.lookAt(vehiclePos);
    }
    
    togglePlayPause() {
        if (this.trajectoryManager.isPlaying) {
            this.trajectoryManager.pause();
        } else {
            this.trajectoryManager.play();
        }
        this.controls.updatePlayButton(this.trajectoryManager.isPlaying);
    }
    
    reset() {
        this.trajectoryManager.reset();
        this.phaseController.reset();
        
        const initialState = this.trajectoryManager.getStateAtTime(0);
        this.entryVehicle.updateState(initialState);
        this.positionCameraForEntry(initialState);
        
        this.controls.updatePlayButton(false);
    }
    
    toggleCameraMode() {
        const modes = ['FREE', 'FOLLOW', 'CINEMATIC'];
        const currentIndex = modes.indexOf(this.cameraMode);
        this.cameraMode = modes[(currentIndex + 1) % modes.length];
        
        switch(this.cameraMode) {
            case 'FREE':
                this.sceneManager.stopFollowing();
                break;
            case 'FOLLOW':
                this.sceneManager.followObject(
                    this.entryVehicle,
                    new THREE.Vector3(50, 100, 200)
                );
                break;
            case 'CINEMATIC':
                this.setCinematicView(0);
                break;
        }
        
        this.showNotification(`Camera Mode: ${this.cameraMode}`, 'info');
    }
    
    setCinematicView(index) {
        const views = this.sceneManager.cinematicViews;
        if (index >= 0 && index < views.length) {
            const view = views[index];
            this.sceneManager.animateCameraTo(view.position, view.target);
        }
    }
    
    showNotification(message, type = 'info') {
        this.controls.showNotification(message, type);
    }
    
    showIntroduction() {
        this.showNotification('Mars EDL Simulation Ready - Press SPACE to start', 'info');
    }
    
    onSimulationComplete() {
        this.showNotification('Parachute Deployed Successfully!', 'success');
    }
    
    updateLoadingProgress(percent, status) {
        const progressBar = document.getElementById('loading-progress');
        const statusText = document.getElementById('loading-status');
        
        if (progressBar) {
            progressBar.style.width = `${percent}%`;
            progressBar.setAttribute('aria-valuenow', percent);
        }
        if (statusText) statusText.textContent = status;
    }
    
    showError(message) {
        document.getElementById('error-message').textContent = message;
        document.getElementById('error-screen').style.display = 'flex';
        document.getElementById('loading-screen').style.display = 'none';
    }
    
    // Public API for external control
    async loadCSVFile(file) {
        const text = await file.text();
        await this.trajectoryManager.loadTrajectoryData(text);
        this.reset();
        this.createTrajectoryVisualization();
    }
    
    setPlaybackSpeed(speed) {
        this.trajectoryManager.setPlaybackSpeed(speed);
    }
    
    getCurrentTelemetry() {
        return {
            time: this.trajectoryManager.currentTime,
            state: this.trajectoryManager.getCurrentState(),
            phase: this.phaseController.currentPhase,
            telemetry: this.entryVehicle.getTelemetry()
        };
    }
}

export default SimulationManager;