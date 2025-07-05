import * as THREE from 'three';
import { Mars2020DataParser } from '../data/Mars2020DataParser.js';
import { EntryVehicle } from '../components/spacecraft/EntryVehicle.js';

/**
 * Mars 2020 EDL Simulation
 * 
 * Specialized simulation for Mars 2020 Entry, Descent, Landing
 * Focuses on Entry Interface to Parachute Deployment phase
 * Uses real trajectory data from CSV files
 * Similar to NASA's Eyes on the Solar System Mars 2020 visualization
 */

export class Mars2020EDLSimulation {
    constructor(scene, camera, renderer) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        
        // Data management
        this.dataParser = new Mars2020DataParser();
        this.trajectoryData = [];
        this.currentTime = 0;
        this.isPlaying = false;
        this.playbackSpeed = 1.0;
        
        // Simulation objects
        this.entryVehicle = null;
        this.mars = null;
        this.trajectoryLine = null;
        this.plasmaEffect = null;
        this.starField = null;
        
        // UI state
        this.currentPhase = 'Entry Interface';
        this.telemetry = {
            altitude: 0,
            velocity: 0,
            temperature: 300,
            gForce: 0,
            timeToParachute: 260.65
        };
        
        // Event callbacks
        this.onTelemetryUpdate = null;
        this.onPhaseChange = null;
        this.onMissionComplete = null;
        
        this.init();
    }
    
    async init() {
        // Create Mars
        this.createMars();
        
        // Create star field
        this.createStarField();
        
        // Create entry vehicle
        this.entryVehicle = new EntryVehicle();
        this.scene.add(this.entryVehicle.group);
        
        // Create trajectory visualization
        this.createTrajectoryVisualization();
        
        // Setup camera
        this.setupCamera();
        
        // Setup lighting
        this.setupLighting();
        
        console.log('Mars 2020 EDL Simulation initialized');
    }
    
    createMars() {
        // Mars geometry
        const marsGeometry = new THREE.SphereGeometry(3389500, 64, 64);
        
        // Mars material with realistic texture
        const marsMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B4513,
            roughness: 0.8,
            metalness: 0.1
        });
        
        // Create procedural Mars texture
        this.createMarsTexture(marsMaterial);
        
        this.mars = new THREE.Mesh(marsGeometry, marsMaterial);
        this.mars.receiveShadow = true;
        this.scene.add(this.mars);
        
        // Add atmospheric glow
        this.createAtmosphericGlow();
    }
    
    createMarsTexture(material) {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base Mars color
        ctx.fillStyle = '#8B4513';
        ctx.fillRect(0, 0, 1024, 512);
        
        // Add surface features
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 1024;
            const y = Math.random() * 512;
            const radius = Math.random() * 30 + 10;
            
            // Craters
            if (Math.random() > 0.7) {
                ctx.fillStyle = '#654321';
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
                
                // Crater rim
                ctx.strokeStyle = '#A0522D';
                ctx.lineWidth = 2;
                ctx.stroke();
            } else {
                // Surface variations
                ctx.fillStyle = `rgba(139, 69, 19, ${Math.random() * 0.3})`;
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        material.map = texture;
        material.needsUpdate = true;
    }
    
    createAtmosphericGlow() {
        const glowGeometry = new THREE.SphereGeometry(3390000, 32, 32);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xFF4500,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        
        const atmosphericGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.scene.add(atmosphericGlow);
    }
    
    createStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 10000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount * 3; i += 3) {
            // Random positions in a large sphere
            const radius = 10000000 + Math.random() * 5000000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = radius * Math.cos(phi);
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starMaterial = new THREE.PointsMaterial({
            color: 0xFFFFFF,
            size: 1000,
            transparent: true,
            opacity: 0.8
        });
        
        this.starField = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.starField);
    }
    
    createTrajectoryVisualization() {
        // Create trajectory line geometry
        const trajectoryGeometry = new THREE.BufferGeometry();
        const trajectoryMaterial = new THREE.LineBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.6
        });
        
        this.trajectoryLine = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
        this.scene.add(this.trajectoryLine);
    }
    
    setupCamera() {
        // Position camera for initial view
        this.camera.position.set(0, 5000000, 10000000);
        this.camera.lookAt(0, 0, 0);
        
        // Store initial camera position for reset
        this.initialCameraPosition = this.camera.position.clone();
        this.initialCameraTarget = new THREE.Vector3(0, 0, 0);
    }
    
    setupLighting() {
        // Sun light (directional)
        const sunLight = new THREE.DirectionalLight(0xFFFFFF, 1.5);
        sunLight.position.set(10000000, 0, 0);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 1000000;
        sunLight.shadow.camera.far = 20000000;
        sunLight.shadow.camera.left = -10000000;
        sunLight.shadow.camera.right = 10000000;
        sunLight.shadow.camera.top = 10000000;
        sunLight.shadow.camera.bottom = -10000000;
        this.scene.add(sunLight);
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.3);
        this.scene.add(ambientLight);
        
        // Enable shadows
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    }
    
    /**
     * Load trajectory data from CSV
     * @param {string|File} data - CSV data string or file
     */
    async loadTrajectoryData(data) {
        try {
            if (typeof data === 'string') {
                this.trajectoryData = this.dataParser.parseCSV(data);
            } else if (data instanceof File) {
                this.trajectoryData = await this.dataParser.loadFromFile(data);
            } else {
                throw new Error('Invalid data format');
            }
            
            // Update trajectory visualization
            this.updateTrajectoryVisualization();
            
            // Reset simulation
            this.reset();
            
            console.log('Trajectory data loaded successfully');
            return true;
        } catch (error) {
            console.error('Failed to load trajectory data:', error);
            return false;
        }
    }
    
    updateTrajectoryVisualization() {
        if (this.trajectoryData.length === 0) return;
        
        const positions = [];
        this.trajectoryData.forEach(point => {
            positions.push(point.position.x, point.position.y, point.position.z);
        });
        
        this.trajectoryLine.geometry.setAttribute(
            'position', 
            new THREE.Float32BufferAttribute(positions, 3)
        );
    }
    
    /**
     * Start simulation playback
     */
    play() {
        this.isPlaying = true;
    }
    
    /**
     * Pause simulation playback
     */
    pause() {
        this.isPlaying = false;
    }
    
    /**
     * Reset simulation to beginning
     */
    reset() {
        this.currentTime = 0;
        this.isPlaying = false;
        this.updateSimulation(0);
    }
    
    /**
     * Set playback speed
     * @param {number} speed - Playback speed multiplier
     */
    setPlaybackSpeed(speed) {
        this.playbackSpeed = speed;
    }
    
    /**
     * Seek to specific time
     * @param {number} time - Time in seconds after Entry Interface
     */
    seekTo(time) {
        this.currentTime = Math.max(0, Math.min(time, 260.65));
        this.updateSimulation(this.currentTime);
    }
    
    /**
     * Update simulation state
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        if (!this.isPlaying || this.trajectoryData.length === 0) return;
        
        // Update current time
        this.currentTime += deltaTime * this.playbackSpeed;
        
        // Check if mission is complete
        if (this.currentTime >= 260.65) {
            this.currentTime = 260.65;
            this.isPlaying = false;
            if (this.onMissionComplete) {
                this.onMissionComplete();
            }
        }
        
        // Update simulation state
        this.updateSimulation(this.currentTime);
    }
    
    updateSimulation(time) {
        // Get trajectory data at current time
        const trajectoryPoint = this.dataParser.getDataAtTime(time);
        if (!trajectoryPoint) return;
        
        // Update entry vehicle position
        this.entryVehicle.group.position.set(
            trajectoryPoint.position.x,
            trajectoryPoint.position.y,
            trajectoryPoint.position.z
        );
        
        // Update telemetry
        this.telemetry = {
            altitude: trajectoryPoint.altitude,
            velocity: trajectoryPoint.velocity,
            temperature: this.calculateTemperature(trajectoryPoint),
            gForce: this.calculateGForce(trajectoryPoint),
            timeToParachute: Math.max(0, 260.65 - time)
        };
        
        // Update entry vehicle effects
        this.updateEntryVehicleEffects(trajectoryPoint);
        
        // Update camera
        this.updateCamera(trajectoryPoint);
        
        // Check for phase changes
        if (trajectoryPoint.phase !== this.currentPhase) {
            this.currentPhase = trajectoryPoint.phase;
            if (this.onPhaseChange) {
                this.onPhaseChange(this.currentPhase);
            }
        }
        
        // Trigger telemetry update
        if (this.onTelemetryUpdate) {
            this.onTelemetryUpdate(this.telemetry);
        }
    }
    
    calculateTemperature(trajectoryPoint) {
        // Simplified heating model based on velocity and altitude
        if (trajectoryPoint.altitude > 80000) return 300; // Above atmosphere
        
        const atmosphericDensity = Math.exp(-trajectoryPoint.altitude / 8000);
        const heatingRate = trajectoryPoint.velocity * trajectoryPoint.velocity * atmosphericDensity;
        
        // Base temperature plus heating
        return 300 + Math.min(heatingRate * 0.0001, 2000);
    }
    
    calculateGForce(trajectoryPoint) {
        // Simplified G-force calculation based on deceleration
        if (trajectoryPoint.altitude > 80000) return 0;
        
        const atmosphericDensity = Math.exp(-trajectoryPoint.altitude / 8000);
        const deceleration = trajectoryPoint.velocity * trajectoryPoint.velocity * atmosphericDensity * 0.00001;
        
        return Math.min(deceleration / 9.81, 20); // Cap at 20G
    }
    
    updateEntryVehicleEffects(trajectoryPoint) {
        // Update plasma effects based on altitude and velocity
        if (trajectoryPoint.altitude < 80000 && trajectoryPoint.velocity > 1000) {
            this.entryVehicle.enterAtmosphere();
            this.entryVehicle.temperature = this.telemetry.temperature;
        } else {
            this.entryVehicle.exitAtmosphere();
        }
        
        // Update entry vehicle animation
        this.entryVehicle.update(0.016, trajectoryPoint.velocity, trajectoryPoint.altitude);
    }
    
    updateCamera(trajectoryPoint) {
        // Dynamic camera positioning based on mission phase
        const vehiclePosition = new THREE.Vector3(
            trajectoryPoint.position.x,
            trajectoryPoint.position.y,
            trajectoryPoint.position.z
        );
        
        let cameraOffset;
        
        switch (this.currentPhase) {
            case 'Entry Interface':
                // Far view showing approach
                cameraOffset = new THREE.Vector3(0, 2000000, 5000000);
                break;
            case 'Early Entry':
                // Medium distance view
                cameraOffset = new THREE.Vector3(0, 1000000, 2000000);
                break;
            case 'Peak Heating':
                // Close view during heating
                cameraOffset = new THREE.Vector3(0, 500000, 1000000);
                break;
            case 'Peak Deceleration':
                // Very close view
                cameraOffset = new THREE.Vector3(0, 200000, 500000);
                break;
            case 'Approach':
                // Medium close view
                cameraOffset = new THREE.Vector3(0, 300000, 800000);
                break;
            case 'Parachute Deployment':
                // Close view for parachute deployment
                cameraOffset = new THREE.Vector3(0, 100000, 300000);
                break;
            default:
                cameraOffset = new THREE.Vector3(0, 500000, 1000000);
        }
        
        // Smooth camera movement
        const targetPosition = vehiclePosition.clone().add(cameraOffset);
        this.camera.position.lerp(targetPosition, 0.02);
        this.camera.lookAt(vehiclePosition);
    }
    
    /**
     * Get current simulation state
     * @returns {Object} Current simulation state
     */
    getState() {
        return {
            currentTime: this.currentTime,
            isPlaying: this.isPlaying,
            playbackSpeed: this.playbackSpeed,
            currentPhase: this.currentPhase,
            telemetry: this.telemetry
        };
    }
    
    /**
     * Get mission statistics
     * @returns {Object} Mission statistics
     */
    getMissionStats() {
        return this.dataParser.getMissionStats();
    }
    
    /**
     * Set camera view mode
     * @param {string} mode - Camera mode ('follow', 'orbit', 'top', 'side')
     */
    setCameraMode(mode) {
        this.cameraMode = mode;
        // Camera mode changes will be handled in updateCamera method
    }
    
    /**
     * Export current trajectory data
     * @returns {string} CSV formatted trajectory data
     */
    exportTrajectoryData() {
        return this.dataParser.exportAsCSV();
    }
    
    /**
     * Cleanup resources
     */
    dispose() {
        if (this.entryVehicle) {
            this.entryVehicle.dispose();
        }
        
        if (this.trajectoryLine) {
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.material.dispose();
        }
        
        // Remove objects from scene
        this.scene.remove(this.entryVehicle?.group);
        this.scene.remove(this.trajectoryLine);
        this.scene.remove(this.mars);
        this.scene.remove(this.starField);
    }
} 