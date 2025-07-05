import * as THREE from 'three';
import { VehicleController } from '../components/spacecraft/VehicleController.js';
import { Planet } from '../components/environment/Planet.js';
import { TrajectoryManager } from './TrajectoryManager.js';
import { PhaseController } from './PhaseController.js';
import { PhysicsEngine } from '../core/PhysicsEngine.js';

/**
 * Main Simulation Manager
 * 
 * Handles:
 * 1. Real-time vehicle control and physics
 * 2. Trajectory calculations and updates
 * 3. Mission phases and state management
 * 4. Real-time telemetry and data updates
 */
export class SimulationManager {
    constructor(sceneManager, dataManager) {
        this.sceneManager = sceneManager;
        this.dataManager = dataManager;
        
        // Simulation state
        this.isRunning = false;
        this.isPaused = false;
        this.playbackSpeed = 1.0;
        this.simulationTime = 0;
        this.missionTime = 0;
        this.realTimeStart = Date.now();
        
        // Physics and components
        this.physicsEngine = new PhysicsEngine();
        this.vehicleController = new VehicleController();
        this.trajectoryManager = new TrajectoryManager();
        this.phaseController = new PhaseController();
        
        // Current mission data
        this.currentPlanet = null;
        this.currentMission = null;
        this.vehicleState = {
            position: new THREE.Vector3(),
            velocity: new THREE.Vector3(),
            acceleration: new THREE.Vector3(),
            orientation: new THREE.Quaternion(),
            angularVelocity: new THREE.Vector3(),
            mass: 1000, // kg
            fuel: 100, // percentage
            battery: 100, // percentage
            temperature: 300, // Kelvin
            altitude: 0,
            gForce: 0
        };
        
        // Control inputs
        this.controls = {
            mainThrust: 0,
            rcsThrust: 0,
            pitch: 0,
            yaw: 0,
            roll: 0,
            systems: {
                parachute: false,
                heatShield: true,
                landingLegs: false
            }
        };
        
        // Telemetry history
        this.telemetryHistory = [];
        this.maxTelemetryHistory = 1000;
        
        // Event listeners
        this.setupEventListeners();
        
        // Initialize
        this.init();
    }
    
    async init() {
        try {
            // Initialize physics engine
            await this.physicsEngine.init();
            
            // Load default planet (Mars)
            await this.loadPlanet('mars');
            
            // Setup vehicle in scene
            this.setupVehicle();
            
            // Initialize trajectory
            this.trajectoryManager.init(this.vehicleState, this.currentPlanet);
            
            // Setup phase controller
            this.phaseController.init(this.trajectoryManager);
            
            console.log('Simulation Manager initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize simulation:', error);
            throw error;
        }
    }
    
    async loadPlanet(planetName) {
        try {
            // Create planet instance
            this.currentPlanet = new Planet(planetName);
            
            // Add planet to scene
            const planetMesh = await this.currentPlanet.createMesh();
            this.sceneManager.scene.add(planetMesh);
            
            // Update physics with planet data
            this.physicsEngine.setPlanet(this.currentPlanet);
            
            // Update trajectory calculations
            this.trajectoryManager.setPlanet(this.currentPlanet);
            
            console.log(`Loaded planet: ${planetName}`);
            
        } catch (error) {
            console.error(`Failed to load planet ${planetName}:`, error);
            throw error;
        }
    }
    
    setupVehicle() {
        // Create vehicle mesh and add to scene
        const vehicleMesh = this.vehicleController.createVehicleMesh();
        this.sceneManager.scene.add(vehicleMesh);
        
        // Set initial position (high altitude orbit)
        this.vehicleState.position.set(0, this.currentPlanet.radius + 100000, 0);
        this.vehicleState.velocity.set(3000, 0, 0); // Initial orbital velocity
        
        // Update vehicle mesh position
        vehicleMesh.position.copy(this.vehicleState.position);
        
        // Setup camera to follow vehicle
        this.sceneManager.camera.position.set(0, 0, 5000);
        this.sceneManager.camera.lookAt(this.vehicleState.position);
    }
    
    setupEventListeners() {
        // Thrust controls
        document.getElementById('main-thrust').addEventListener('input', (e) => {
            this.controls.mainThrust = parseFloat(e.target.value) / 100;
            document.getElementById('main-thrust-value').textContent = `${e.target.value}%`;
        });
        
        document.getElementById('rcs-thrust').addEventListener('input', (e) => {
            this.controls.rcsThrust = parseFloat(e.target.value) / 100;
            document.getElementById('rcs-thrust-value').textContent = `${e.target.value}%`;
        });
        
        // System controls
        document.getElementById('deploy-parachute').addEventListener('click', () => {
            this.controls.systems.parachute = !this.controls.systems.parachute;
            this.deployParachute();
        });
        
        document.getElementById('eject-heat-shield').addEventListener('click', () => {
            this.controls.systems.heatShield = false;
            this.ejectHeatShield();
        });
        
        document.getElementById('deploy-legs').addEventListener('click', () => {
            this.controls.systems.landingLegs = true;
            this.deployLandingLegs();
        });
        
        // Timeline controls
        document.getElementById('play-pause').addEventListener('click', () => {
            this.togglePlayPause();
        });
        
        document.getElementById('reset').addEventListener('click', () => {
            this.reset();
        });
        
        document.getElementById('speed-selector').addEventListener('change', (e) => {
            this.setPlaybackSpeed(parseFloat(e.target.value));
        });
        
        // Planet selection
        document.getElementById('planet-select').addEventListener('change', (e) => {
            this.loadPlanet(e.target.value);
        });
        
        // Camera controls
        document.getElementById('camera-follow').addEventListener('click', () => {
            this.setCameraMode('follow');
        });
        
        document.getElementById('camera-orbit').addEventListener('click', () => {
            this.setCameraMode('orbit');
        });
        
        document.getElementById('camera-top').addEventListener('click', () => {
            this.setCameraMode('top');
        });
        
        document.getElementById('camera-side').addEventListener('click', () => {
            this.setCameraMode('side');
        });
    }
    
    // Main update loop
    update(deltaTime) {
        if (!this.isRunning || this.isPaused) return;
        
        // Apply playback speed
        const scaledDeltaTime = deltaTime * this.playbackSpeed;
        
        // Update simulation time
        this.simulationTime += scaledDeltaTime;
        this.missionTime = (Date.now() - this.realTimeStart) / 1000;
        
        // Update physics
        this.updatePhysics(scaledDeltaTime);
        
        // Update vehicle state
        this.updateVehicleState(scaledDeltaTime);
        
        // Update trajectory calculations
        this.updateTrajectory();
        
        // Update mission phases
        this.updateMissionPhases();
        
        // Update vehicle controller
        this.vehicleController.update(scaledDeltaTime, this.vehicleState, this.controls);
        
        // Update camera
        this.updateCamera();
        
        // Update telemetry
        this.updateTelemetry();
        
        // Update UI
        this.updateUI();
    }
    
    updatePhysics(deltaTime) {
        // Calculate forces acting on vehicle
        const forces = this.physicsEngine.calculateForces(
            this.vehicleState,
            this.currentPlanet,
            this.controls
        );
        
        // Apply forces to vehicle state
        this.vehicleState.acceleration.copy(forces).divideScalar(this.vehicleState.mass);
        this.vehicleState.velocity.add(this.vehicleState.acceleration.clone().multiplyScalar(deltaTime));
        this.vehicleState.position.add(this.vehicleState.velocity.clone().multiplyScalar(deltaTime));
        
        // Update orientation based on control inputs
        const angularAcceleration = new THREE.Vector3(
            this.controls.pitch * 0.1,
            this.controls.yaw * 0.1,
            this.controls.roll * 0.1
        );
        
        this.vehicleState.angularVelocity.add(angularAcceleration.multiplyScalar(deltaTime));
        
        // Apply angular velocity to orientation
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromEuler(
            new THREE.Euler(
                this.vehicleState.angularVelocity.x * deltaTime,
                this.vehicleState.angularVelocity.y * deltaTime,
                this.vehicleState.angularVelocity.z * deltaTime
            )
        );
        
        this.vehicleState.orientation.multiply(new THREE.Quaternion().setFromRotationMatrix(rotationMatrix));
        
        // Calculate altitude
        this.vehicleState.altitude = this.vehicleState.position.length() - this.currentPlanet.radius;
        
        // Calculate G-force
        this.vehicleState.gForce = this.vehicleState.acceleration.length() / 9.81;
    }
    
    updateVehicleState(deltaTime) {
        // Update fuel consumption
        if (this.controls.mainThrust > 0) {
            const fuelConsumption = this.controls.mainThrust * 0.1 * deltaTime;
            this.vehicleState.fuel = Math.max(0, this.vehicleState.fuel - fuelConsumption);
        }
        
        // Update battery consumption
        const batteryConsumption = 0.01 * deltaTime; // Base consumption
        this.vehicleState.battery = Math.max(0, this.vehicleState.battery - batteryConsumption);
        
        // Update temperature based on velocity and altitude
        this.updateTemperature(deltaTime);
        
        // Check for mission failure conditions
        this.checkMissionStatus();
    }
    
    updateTemperature(deltaTime) {
        const atmosphericDensity = this.currentPlanet.getAtmosphericDensity(this.vehicleState.altitude);
        const velocity = this.vehicleState.velocity.length();
        
        // Heating due to atmospheric friction
        const heatingRate = velocity * velocity * atmosphericDensity * 0.00001;
        this.vehicleState.temperature += heatingRate * deltaTime;
        
        // Cooling
        const coolingRate = (this.vehicleState.temperature - 300) * 0.01;
        this.vehicleState.temperature -= coolingRate * deltaTime;
        
        // Ensure temperature doesn't go below ambient
        this.vehicleState.temperature = Math.max(300, this.vehicleState.temperature);
    }
    
    updateTrajectory() {
        // Update trajectory calculations based on current state
        this.trajectoryManager.updateTrajectory(this.vehicleState);
        
        // Get predicted landing time and location
        const prediction = this.trajectoryManager.getLandingPrediction();
        
        // Update vehicle state with prediction data
        this.vehicleState.timeToLanding = prediction.timeToLanding;
        this.vehicleState.distanceToTarget = prediction.distanceToTarget;
        this.vehicleState.entryAngle = prediction.entryAngle;
    }
    
    updateMissionPhases() {
        // Update current mission phase based on altitude and velocity
        const currentPhase = this.phaseController.getCurrentPhase(this.vehicleState);
        
        // Update UI phase indicators
        document.querySelectorAll('.phase').forEach(phase => {
            phase.classList.remove('active');
        });
        
        const activePhaseElement = document.querySelector(`[data-phase="${currentPhase}"]`);
        if (activePhaseElement) {
            activePhaseElement.classList.add('active');
        }
        
        // Handle phase-specific events
        this.phaseController.handlePhaseEvents(currentPhase, this.vehicleState);
    }
    
    updateCamera() {
        const vehiclePosition = this.vehicleState.position;
        const camera = this.sceneManager.camera;
        
        // Camera follow mode
        const offset = new THREE.Vector3(0, 0, 5000);
        offset.applyQuaternion(this.vehicleState.orientation);
        
        camera.position.copy(vehiclePosition).add(offset);
        camera.lookAt(vehiclePosition);
    }
    
    updateTelemetry() {
        // Add current telemetry to history
        const telemetry = {
            timestamp: this.simulationTime,
            position: this.vehicleState.position.clone(),
            velocity: this.vehicleState.velocity.clone(),
            altitude: this.vehicleState.altitude,
            temperature: this.vehicleState.temperature,
            fuel: this.vehicleState.fuel,
            battery: this.vehicleState.battery,
            gForce: this.vehicleState.gForce
        };
        
        this.telemetryHistory.push(telemetry);
        
        // Limit history size
        if (this.telemetryHistory.length > this.maxTelemetryHistory) {
            this.telemetryHistory.shift();
        }
        
        // Emit telemetry update event
        window.dispatchEvent(new CustomEvent('telemetryUpdate', {
            detail: telemetry
        }));
    }
    
    updateUI() {
        // Update telemetry display
        document.getElementById('altitude').textContent = `${(this.vehicleState.altitude / 1000).toFixed(1)} km`;
        document.getElementById('velocity').textContent = `${(this.vehicleState.velocity.length() / 1000).toFixed(2)} km/s`;
        document.getElementById('temperature').textContent = `${this.vehicleState.temperature.toFixed(0)} K`;
        document.getElementById('fuel').textContent = `${this.vehicleState.fuel.toFixed(1)}%`;
        document.getElementById('battery').textContent = `${this.vehicleState.battery.toFixed(1)}%`;
        document.getElementById('g-force').textContent = `${this.vehicleState.gForce.toFixed(1)} G`;
        
        // Update time displays
        document.getElementById('mission-time').textContent = this.formatTime(this.missionTime);
        document.getElementById('simulation-time').textContent = this.formatTime(this.simulationTime);
        
        // Update trajectory info
        if (this.vehicleState.timeToLanding !== undefined) {
            document.getElementById('time-to-landing').textContent = this.formatTime(this.vehicleState.timeToLanding);
        }
        
        if (this.vehicleState.distanceToTarget !== undefined) {
            document.getElementById('distance-to-target').textContent = `${(this.vehicleState.distanceToTarget / 1000).toFixed(1)} km`;
        }
        
        if (this.vehicleState.entryAngle !== undefined) {
            document.getElementById('entry-angle').textContent = `${this.vehicleState.entryAngle.toFixed(1)}°`;
        }
        
        // Update timeline progress
        const progress = (this.simulationTime / this.trajectoryManager.getTotalMissionTime()) * 100;
        document.getElementById('timeline-progress').style.width = `${Math.min(100, progress)}%`;
    }
    
    // Control methods
    deployParachute() {
        if (this.controls.systems.parachute) {
            this.vehicleController.deployParachute();
            this.showAlert('Parachute deployed', 'success');
        } else {
            this.vehicleController.retractParachute();
            this.showAlert('Parachute retracted', 'warning');
        }
    }
    
    ejectHeatShield() {
        this.vehicleController.ejectHeatShield();
        this.vehicleState.mass -= 200; // Reduce mass
        this.showAlert('Heat shield ejected', 'success');
    }
    
    deployLandingLegs() {
        this.vehicleController.deployLandingLegs();
        this.showAlert('Landing legs deployed', 'success');
    }
    
    // Timeline controls
    play() {
        this.isRunning = true;
        this.isPaused = false;
        document.getElementById('play-pause').textContent = '⏸';
    }
    
    pause() {
        this.isPaused = true;
        document.getElementById('play-pause').textContent = '▶';
    }
    
    togglePlayPause() {
        if (this.isPaused) {
            this.play();
        } else {
            this.pause();
        }
    }
    
    reset() {
        this.simulationTime = 0;
        this.missionTime = 0;
        this.realTimeStart = Date.now();
        
        // Reset vehicle state
        this.vehicleState.position.set(0, this.currentPlanet.radius + 100000, 0);
        this.vehicleState.velocity.set(3000, 0, 0);
        this.vehicleState.orientation.set(0, 0, 0, 1);
        this.vehicleState.angularVelocity.set(0, 0, 0);
        this.vehicleState.fuel = 100;
        this.vehicleState.battery = 100;
        this.vehicleState.temperature = 300;
        
        // Reset controls
        this.controls.mainThrust = 0;
        this.controls.rcsThrust = 0;
        this.controls.pitch = 0;
        this.controls.yaw = 0;
        this.controls.roll = 0;
        
        // Reset trajectory
        this.trajectoryManager.reset();
        
        this.showAlert('Simulation reset', 'success');
    }
    
    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
    }
    
    setCameraMode(mode) {
        // Update camera mode buttons
        document.querySelectorAll('.camera-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`camera-${mode}`).classList.add('active');
        
        // Implement camera mode logic here
        console.log(`Camera mode set to: ${mode}`);
    }
    
    // Utility methods
    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.remove();
        }, 3000);
    }
    
    checkMissionStatus() {
        // Check for mission failure conditions
        if (this.vehicleState.fuel <= 0) {
            this.showAlert('Mission failed: Out of fuel', 'error');
            this.pause();
        }
        
        if (this.vehicleState.battery <= 0) {
            this.showAlert('Mission failed: Out of power', 'error');
            this.pause();
        }
        
        if (this.vehicleState.temperature > 2000) {
            this.showAlert('Warning: Critical temperature', 'warning');
        }
        
        // Check for successful landing
        if (this.vehicleState.altitude <= 0 && this.vehicleState.velocity.length() < 10) {
            this.showAlert('Mission accomplished: Successful landing!', 'success');
            this.pause();
        }
    }
    
    // Public API
    getVehicleState() {
        return { ...this.vehicleState };
    }
    
    getControls() {
        return { ...this.controls };
    }
    
    getTelemetryHistory() {
        return [...this.telemetryHistory];
    }
    
    // Cleanup
    dispose() {
        this.isRunning = false;
        this.physicsEngine.dispose();
        this.vehicleController.dispose();
        this.trajectoryManager.dispose();
        this.phaseController.dispose();
    }
}
