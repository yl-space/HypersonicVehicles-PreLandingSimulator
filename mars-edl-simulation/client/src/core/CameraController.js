/**
 * CameraController.js - FIXED VERSION
 * Camera management for J2000 reference frame
 */

import * as THREE from 'three';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.mode = 'follow'; // Default to follow mode like NASA's visualization
        this.target = null;
        this.smoothness = 0.1; // Smoother transitions
        
        // Camera state
        this.state = {
            distance: 50,      // Distance in km
            height: 20,        // Height offset in km
            angle: 0,
            defaultDistance: 50
        };
        
        // Mouse controls for orbit mode
        this.mouse = {
            isDown: false,
            lastX: 0,
            lastY: 0
        };
        
        // Orbit parameters
        this.orbit = {
            theta: Math.PI / 4,  // Azimuth
            phi: Math.PI / 6,    // Elevation
            radius: 100          // Distance in km
        };
        
        this.init();
    }
    
    init() {
        // Set initial camera position for small scale
        // Position camera to see the entry from a good angle
        this.camera.position.set(50, 20, 50);
        this.camera.lookAt(0, 0, 0);
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse controls for orbit mode
        canvas.addEventListener('mousedown', (e) => {
            if (this.mode === 'orbit' || this.mode === 'free') {
                this.mouse.isDown = true;
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if ((this.mode === 'orbit' || this.mode === 'free') && this.mouse.isDown) {
                const deltaX = e.clientX - this.mouse.lastX;
                const deltaY = e.clientY - this.mouse.lastY;
                
                this.orbit.theta -= deltaX * 0.005;
                this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, 
                    this.orbit.phi + deltaY * 0.005));
                
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
        });
        
        // Wheel for zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
            
            if (this.mode === 'orbit' || this.mode === 'free') {
                this.orbit.radius = Math.max(10, Math.min(10000, this.orbit.radius * delta));
            } else if (this.mode === 'follow') {
                this.state.distance = Math.max(10, Math.min(1000, this.state.distance * delta));
            }
        });
    }
    
    setMode(mode) {
        this.mode = mode.toLowerCase();
        console.log(`Camera mode set to: ${this.mode}`);
        
        // Initialize orbit position when switching modes
        if (mode === 'orbit' && this.target) {
            const offset = this.camera.position.clone().sub(this.target.position);
            this.orbit.radius = offset.length();
            this.orbit.theta = Math.atan2(offset.x, offset.z);
            this.orbit.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / this.orbit.radius)));
        }
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    update(deltaTime, vehicleData) {
        if (!this.target) return;
        
        const targetPos = this.target.position.clone();
        let desiredPosition = new THREE.Vector3();
        let lookAtPoint = targetPos.clone();
        
        switch (this.mode) {
            case 'follow':
                // Follow mode - camera trails behind spacecraft
                if (vehicleData && vehicleData.velocity) {
                    // Get velocity direction
                    const velocity = vehicleData.velocity.clone().normalize();
                    
                    // Adjust distance based on altitude
                    const altitude = vehicleData.altitude || 100;
                    const dynamicDistance = Math.min(200, 30 + altitude * 0.5);
                    const dynamicHeight = Math.min(50, 10 + altitude * 0.1);
                    
                    // Position camera behind and above the spacecraft
                    desiredPosition.copy(targetPos);
                    desiredPosition.sub(velocity.multiplyScalar(dynamicDistance));
                    desiredPosition.y += dynamicHeight;
                    
                    // Look slightly ahead of the spacecraft
                    lookAtPoint = targetPos.clone();
                    lookAtPoint.add(velocity.multiplyScalar(10));
                } else {
                    // Fallback if no velocity data
                    desiredPosition.set(
                        targetPos.x - 50,
                        targetPos.y + 20,
                        targetPos.z - 50
                    );
                }
                break;
                
            case 'orbit':
                // Orbit mode - user-controlled camera around target
                desiredPosition.x = targetPos.x + 
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
                desiredPosition.y = targetPos.y + 
                    this.orbit.radius * Math.cos(this.orbit.phi);
                desiredPosition.z = targetPos.z + 
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
                break;
                
            case 'fixed':
                // Fixed mode - stationary camera position
                desiredPosition.set(30, 20, 30);
                // Always look at Mars center for reference
                lookAtPoint.set(0, 0, 0);
                break;
                
            case 'free':
                // Free mode - user controls camera freely
                if (this.mouse.isDown) {
                    desiredPosition.x = this.camera.position.x;
                    desiredPosition.y = this.camera.position.y;
                    desiredPosition.z = this.camera.position.z;
                } else {
                    return; // Don't update if not actively controlling
                }
                break;
                
            case 'cinematic':
                // Cinematic mode - smooth predetermined path
                const t = (Date.now() * 0.0001) % 1;
                const cinematicRadius = 50 + 20 * Math.sin(t * Math.PI * 2);
                const cinematicAngle = t * Math.PI * 2;
                
                desiredPosition.x = Math.cos(cinematicAngle) * cinematicRadius;
                desiredPosition.y = 20 + 10 * Math.sin(t * Math.PI * 4);
                desiredPosition.z = Math.sin(cinematicAngle) * cinematicRadius;
                
                // Look at spacecraft or Mars center
                if (targetPos.length() > 1) {
                    lookAtPoint = targetPos;
                } else {
                    lookAtPoint.set(0, 0, 0);
                }
                break;
        }
        
        // Smooth camera movement
        this.camera.position.lerp(desiredPosition, this.smoothness);
        
        // Update camera orientation
        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        currentLookAt.add(this.camera.position);
        currentLookAt.lerp(lookAtPoint, this.smoothness);
        this.camera.lookAt(currentLookAt);
        
        // Update field of view based on distance (cinematic effect)
        if (this.mode === 'follow' && vehicleData) {
            const altitude = vehicleData.altitude || 100;
            const targetFOV = 50 + Math.min(25, altitude * 0.1);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.05);
            this.camera.updateProjectionMatrix();
        }
    }
    
    zoom(direction) {
        const zoomSpeed = 0.2;
        const factor = direction > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
        
        if (this.mode === 'orbit' || this.mode === 'free') {
            this.orbit.radius = Math.max(10, Math.min(10000, this.orbit.radius * factor));
        } else {
            this.state.distance = Math.max(10, Math.min(1000, this.state.distance * factor));
        }
    }
    
    setDefaultDistance(distance) {
        this.state.defaultDistance = distance;
        this.state.distance = distance;
        this.orbit.radius = distance * 2;
    }
    
    handleResize() {
        // Camera aspect ratio is handled by the renderer
    }
    
    reset() {
        // Reset camera to default position
        this.camera.position.set(50, 20, 50);
        this.camera.lookAt(0, 0, 0);
        this.orbit.theta = Math.PI / 4;
        this.orbit.phi = Math.PI / 6;
        this.orbit.radius = 100;
        this.state.distance = 50;
    }
}