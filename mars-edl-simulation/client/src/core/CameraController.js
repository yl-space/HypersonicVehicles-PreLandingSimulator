/**
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
        
        // Camera state (adjusted for smaller spacecraft scale)
        this.state = {
            distance: 2,      // Very close for 0.1 unit spacecraft
            height: 1,        // Small height offset
            angle: 0,
            defaultDistance: 2
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
            radius: 3            // Orbit radius for smaller spacecraft
        };
        
        this.init();
    }
    
    init() {
        // Set initial camera position for smaller spacecraft
        this.camera.position.set(3, 2, 3);
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
        
        // Wheel for zoom - more controlled
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.05; // Reduced zoom speed
            const delta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
            
            if (this.mode === 'orbit' || this.mode === 'free') {
                this.orbit.radius = Math.max(0.5, Math.min(50, this.orbit.radius * delta));
            } else if (this.mode === 'follow') {
                this.state.distance = Math.max(0.5, Math.min(10, this.state.distance * delta));
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
                // Follow mode - camera follows spacecraft from behind
                if (vehicleData && vehicleData.velocity instanceof THREE.Vector3) {
                    // Get velocity direction for trailing camera
                    const velocity = vehicleData.velocity.clone();
                    if (velocity.length() > 0.001) {
                        velocity.normalize();
                        
                        // Position camera behind the spacecraft
                        desiredPosition.copy(targetPos);
                        desiredPosition.sub(velocity.clone().multiplyScalar(this.state.distance));
                        desiredPosition.y += this.state.height;
                    } else {
                        // Static follow when no velocity
                        desiredPosition.set(
                            targetPos.x - this.state.distance * 0.7,
                            targetPos.y + this.state.height,
                            targetPos.z - this.state.distance * 0.7
                        );
                    }
                } else {
                    // Default follow position
                    desiredPosition.set(
                        targetPos.x - this.state.distance * 0.7,
                        targetPos.y + this.state.height,
                        targetPos.z - this.state.distance * 0.7
                    );
                }
                // Always look at the spacecraft
                lookAtPoint = targetPos.clone();
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
                
            case 'free':
                // Free mode - user controls camera with mouse drag
                if (this.mouse.isDown) {
                    // Use orbit controls for free camera movement
                    desiredPosition.x = this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
                    desiredPosition.y = this.orbit.radius * Math.cos(this.orbit.phi);
                    desiredPosition.z = this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);
                    lookAtPoint.set(0, 0, 0); // Look at scene center
                } else {
                    // Keep current position when not dragging
                    return;
                }
                break;
                
            // Cinematic mode removed - not needed
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
        const zoomSpeed = 0.1; // Reduced for finer control
        const factor = direction > 0 ? 1 - zoomSpeed : 1 + zoomSpeed; // Inverted for intuitive control
        
        if (this.mode === 'orbit' || this.mode === 'free') {
            this.orbit.radius = Math.max(0.5, Math.min(50, this.orbit.radius * factor));
        } else {
            this.state.distance = Math.max(0.5, Math.min(10, this.state.distance * factor));
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
        // Reset camera to default position for smaller spacecraft
        this.camera.position.set(3, 2, 3);
        this.camera.lookAt(0, 0, 0);
        this.orbit.theta = Math.PI / 4;
        this.orbit.phi = Math.PI / 6;
        this.orbit.radius = 3;
        this.state.distance = 2;
    }
}