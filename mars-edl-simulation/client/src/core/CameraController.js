/**
 * CameraController.js
 * Manages camera modes and smooth transitions
 */

import * as THREE from 'three';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.mode = 'follow'; // follow, orbit, freestyle
        this.target = null;
        this.smoothness = 0.05;
        
        // Camera state
        this.state = {
            distance: 100,
            height: 50,
            angle: 0,
            cinematicTime: 0,
            defaultDistance: 10
        };
        
        // Mouse controls for orbit mode
        this.mouse = {
            isDown: false,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0
        };
        
        // Orbit controls state
        this.orbit = {
            theta: 0,
            phi: Math.PI / 4,
            radius: 100
        };
        
        this.init();
    }
    
    init() {
        // Set initial camera position for large scale (meters)
        // Position camera ~10,000 km from Mars center for good overview
        this.camera.position.set(10000000, 5000000, 10000000);
        this.camera.lookAt(0, 0, 0);
        
        // Setup event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse controls for orbit mode
        canvas.addEventListener('mousedown', (e) => {
            if (this.mode === 'orbit') {
                this.mouse.isDown = true;
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (this.mode === 'orbit' && this.mouse.isDown) {
                this.mouse.deltaX = e.clientX - this.mouse.lastX;
                this.mouse.deltaY = e.clientY - this.mouse.lastY;
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
                
                // Update orbit angles
                this.orbit.theta -= this.mouse.deltaX * 0.01;
                this.orbit.phi = Math.max(0.1, Math.min(Math.PI - 0.1, 
                    this.orbit.phi + this.mouse.deltaY * 0.01));
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
        });
        
        // Prevent context menu on right click
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Wheel for zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1;
            const delta = e.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;
            
            if (this.mode === 'orbit') {
                this.orbit.radius = Math.max(20, Math.min(500, this.orbit.radius * delta));
            } else {
                this.state.distance = Math.max(20, Math.min(500, this.state.distance * delta));
            }
        });
    }
    
    setMode(mode) {
        this.mode = mode.toLowerCase();
        
        // Initialize orbit position when switching to orbit mode
        if (mode === 'orbit' && this.target) {
            const offset = this.camera.position.clone().sub(this.target.position);
            this.orbit.radius = offset.length();
            this.orbit.theta = Math.atan2(offset.x, offset.z);
            this.orbit.phi = Math.acos(offset.y / this.orbit.radius);
        }
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    setDefaultDistance(distance) {
        this.state.defaultDistance = distance;
        this.state.distance = distance;
    }
    
    update(deltaTime, vehicleData) {
        if (!this.target) return;
        
        const targetPos = this.target.position.clone();
        let desiredPosition = new THREE.Vector3();
        let lookAtPoint = targetPos.clone();
        
        switch (this.mode) {
            case 'follow':
                const altitude = vehicleData?.altitude || 10000;
                const followDistance = 10 + Math.sqrt(altitude) * 0.01;
                const followHeight = 5 + Math.sqrt(altitude) * 0.005;
                
                // Handle velocity properly
                let velocity;
                if (vehicleData?.velocity) {
                    if (vehicleData.velocity instanceof THREE.Vector3) {
                        velocity = vehicleData.velocity.clone();
                    } else {
                        velocity = new THREE.Vector3(0, -1, 0);
                    }
                } else {
                    velocity = new THREE.Vector3(0, -1, 0);
                }
                
                const forward = velocity.normalize();
                
                desiredPosition.copy(targetPos);
                desiredPosition.sub(forward.multiplyScalar(followDistance));
                desiredPosition.y += followHeight;
                
                lookAtPoint.add(forward.multiplyScalar(2));
                break;
                
            case 'orbit':
                // Orbit mode using mouse controls
                if (this.target) {
                    const spherical = new THREE.Spherical();
                    spherical.setFromVector3(this.camera.position.clone().sub(this.target.position));
                    
                    spherical.theta = this.orbit.theta;
                    spherical.phi = this.orbit.phi;
                    spherical.radius = this.orbit.radius;
                    
                    desiredPosition.copy(this.target.position);
                    desiredPosition.add(new THREE.Vector3().setFromSpherical(spherical));
                    lookAtPoint = this.target.position.clone();
                }
                break;
                
            case 'freestyle':
                // Freestyle mode - manual orbit controls around current position
                const center = this.target ? this.target.position : new THREE.Vector3(0, 0, 0);
                
                const spherical = new THREE.Spherical();
                spherical.setFromVector3(this.camera.position.clone().sub(center));
                
                spherical.theta = this.orbit.theta;
                spherical.phi = this.orbit.phi;
                spherical.radius = this.orbit.radius;
                
                desiredPosition.copy(center);
                desiredPosition.add(new THREE.Vector3().setFromSpherical(spherical));
                lookAtPoint = center.clone();
                break;
                
            case 'cinematic':
                this.state.cinematicTime += deltaTime;
                const t = this.state.cinematicTime * 0.1;
                
                desiredPosition.x = targetPos.x + Math.sin(t) * 30;
                desiredPosition.y = targetPos.y + 15 + Math.sin(t * 0.5) * 5;
                desiredPosition.z = targetPos.z + Math.cos(t) * 30;
                break;
        }
        
        this.camera.position.lerp(desiredPosition, this.smoothness);
        
        const currentLookAt = new THREE.Vector3();
        this.camera.getWorldDirection(currentLookAt);
        currentLookAt.add(this.camera.position);
        
        const targetDirection = lookAtPoint.clone().sub(this.camera.position).normalize();
        const currentDirection = currentLookAt.sub(this.camera.position).normalize();
        
        const smoothedDirection = currentDirection.lerp(targetDirection, this.smoothness * 2);
        this.camera.lookAt(this.camera.position.clone().add(smoothedDirection));
    }
    
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
    
    // Camera shake effect for dramatic momen
    shake(intensity = 1, duration = 0.5) {
        const startTime = Date.now();
        const originalPosition = this.camera.position.clone();
        
        const shakeAnimation = () => {
            const elapsed = (Date.now() - startTime) / 1000;
            if (elapsed < duration) {
                const decay = 1 - elapsed / duration;
                const offsetX = (Math.random() - 0.5) * intensity * decay;
                const offsetY = (Math.random() - 0.5) * intensity * decay;
                const offsetZ = (Math.random() - 0.5) * intensity * decay;
                
                this.camera.position.x = originalPosition.x + offsetX;
                this.camera.position.y = originalPosition.y + offsetY;
                this.camera.position.z = originalPosition.z + offsetZ;
                
                requestAnimationFrame(shakeAnimation);
            } else {
                this.camera.position.copy(originalPosition);
            }
        };
        
        shakeAnimation();
    }
    
    // Zoom control
    zoom(direction) {
        const zoomSpeed = 5;
        if (direction === 'in') {
            this.camera.fov = Math.max(20, this.camera.fov - zoomSpeed);
        } else {
            this.camera.fov = Math.min(120, this.camera.fov + zoomSpeed);
        }
        this.camera.updateProjectionMatrix();
    }
}