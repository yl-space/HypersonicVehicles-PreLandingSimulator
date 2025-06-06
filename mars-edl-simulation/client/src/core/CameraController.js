// client/src/core/CameraController.js
import * as THREE from 'three';

/**
 * CameraController - Advanced camera management system
 * 
 * This class teaches:
 * 1. Different camera movement modes
 * 2. Smooth transitions and interpolation
 * 3. Input handling (mouse, touch, keyboard)
 * 4. Cinematic camera movements
 */
export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Camera states
        this.enabled = true;
        this.mode = 'orbit'; // orbit, fly, follow, cinematic
        
        // Orbit controls parameters
        this.orbitTarget = new THREE.Vector3(0, 0, 0);
        this.spherical = new THREE.Spherical();
        this.sphericalDelta = new THREE.Spherical();
        
        // Movement parameters
        this.rotateSpeed = 1.0;
        this.zoomSpeed = 1.2;
        this.panSpeed = 1.0;
        this.dampingFactor = 0.05;
        
        // Constraints
        this.minDistance = 1;
        this.maxDistance = 10000;
        this.minPolarAngle = 0; // radians
        this.maxPolarAngle = Math.PI; // radians
        
        // Mouse state
        this.mouse = {
            current: new THREE.Vector2(),
            previous: new THREE.Vector2(),
            delta: new THREE.Vector2(),
            isDown: false,
            button: -1
        };
        
        // Touch state for mobile support
        this.touch = {
            points: [],
            prevDistance: 0
        };
        
        // Cinematic camera system
        this.cinematicPath = [];
        this.cinematicProgress = 0;
        this.cinematicSpeed = 1;
        
        // Follow target
        this.followTarget = null;
        this.followOffset = new THREE.Vector3(0, 10, 20);
        this.followLookAhead = 0.1;
        
        // Initialize
        this.setupEventListeners();
        this.update();
    }
    
    setupEventListeners() {
        // Mouse events
        this.domElement.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.domElement.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.domElement.addEventListener('wheel', this.onMouseWheel.bind(this));
        
        // Touch events for mobile
        this.domElement.addEventListener('touchstart', this.onTouchStart.bind(this));
        this.domElement.addEventListener('touchmove', this.onTouchMove.bind(this));
        this.domElement.addEventListener('touchend', this.onTouchEnd.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Context menu prevention
        this.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
    }
    
    onMouseDown(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        this.mouse.isDown = true;
        this.mouse.button = event.button;
        this.mouse.current.x = event.clientX;
        this.mouse.current.y = event.clientY;
        this.mouse.previous.copy(this.mouse.current);
    }
    
    onMouseMove(event) {
        if (!this.enabled || !this.mouse.isDown) return;
        
        event.preventDefault();
        
        this.mouse.current.x = event.clientX;
        this.mouse.current.y = event.clientY;
        this.mouse.delta.subVectors(this.mouse.current, this.mouse.previous);
        
        switch (this.mode) {
            case 'orbit':
                this.handleOrbitRotation();
                break;
            case 'fly':
                this.handleFlyRotation();
                break;
        }
        
        this.mouse.previous.copy(this.mouse.current);
    }
    
    onMouseUp(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        this.mouse.isDown = false;
        this.mouse.button = -1;
    }
    
    onMouseWheel(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        const delta = event.deltaY < 0 ? 0.9 : 1.1;
        
        switch (this.mode) {
            case 'orbit':
                this.handleOrbitZoom(delta);
                break;
            case 'fly':
                this.handleFlyZoom(delta);
                break;
        }
    }
    
    onTouchStart(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        this.touch.points = Array.from(event.touches).map(touch => ({
            x: touch.clientX,
            y: touch.clientY,
            id: touch.identifier
        }));
        
        if (this.touch.points.length === 2) {
            // Calculate initial pinch distance
            const dx = this.touch.points[0].x - this.touch.points[1].x;
            const dy = this.touch.points[0].y - this.touch.points[1].y;
            this.touch.prevDistance = Math.sqrt(dx * dx + dy * dy);
        }
    }
    
    onTouchMove(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        
        const touches = Array.from(event.touches);
        
        if (touches.length === 1) {
            // Single touch - rotate
            const touch = touches[0];
            const prevTouch = this.touch.points.find(p => p.id === touch.identifier);
            
            if (prevTouch) {
                this.mouse.delta.x = touch.clientX - prevTouch.x;
                this.mouse.delta.y = touch.clientY - prevTouch.y;
                this.handleOrbitRotation();
                
                prevTouch.x = touch.clientX;
                prevTouch.y = touch.clientY;
            }
        } else if (touches.length === 2) {
            // Pinch zoom
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (this.touch.prevDistance > 0) {
                const delta = this.touch.prevDistance / distance;
                this.handleOrbitZoom(delta);
            }
            
            this.touch.prevDistance = distance;
        }
    }
    
    onTouchEnd(event) {
        if (!this.enabled) return;
        
        event.preventDefault();
        this.touch.points = [];
        this.touch.prevDistance = 0;
    }
    
    onKeyDown(event) {
        if (!this.enabled) return;
        
        switch (event.key) {
            case 'w':
            case 'W':
                this.moveForward = true;
                break;
            case 's':
            case 'S':
                this.moveBackward = true;
                break;
            case 'a':
            case 'A':
                this.moveLeft = true;
                break;
            case 'd':
            case 'D':
                this.moveRight = true;
                break;
            case 'q':
            case 'Q':
                this.moveUp = true;
                break;
            case 'e':
            case 'E':
                this.moveDown = true;
                break;
        }
    }
    
    onKeyUp(event) {
        switch (event.key) {
            case 'w':
            case 'W':
                this.moveForward = false;
                break;
            case 's':
            case 'S':
                this.moveBackward = false;
                break;
            case 'a':
            case 'A':
                this.moveLeft = false;
                break;
            case 'd':
            case 'D':
                this.moveRight = false;
                break;
            case 'q':
            case 'Q':
                this.moveUp = false;
                break;
            case 'e':
            case 'E':
                this.moveDown = false;
                break;
        }
    }
    
    // Orbit mode handlers
    handleOrbitRotation() {
        // Convert mouse movement to spherical coordinate deltas
        const deltaTheta = -this.mouse.delta.x * this.rotateSpeed * 0.01;
        const deltaPhi = -this.mouse.delta.y * this.rotateSpeed * 0.01;
        
        this.sphericalDelta.theta = deltaTheta;
        this.sphericalDelta.phi = deltaPhi;
    }
    
    handleOrbitZoom(delta) {
        this.spherical.radius *= delta;
        this.spherical.radius = Math.max(this.minDistance, 
                                        Math.min(this.maxDistance, this.spherical.radius));
    }
    
    // Fly mode handlers
    handleFlyRotation() {
        const rotationSpeed = this.rotateSpeed * 0.002;
        
        // Yaw (Y axis rotation)
        this.camera.rotateY(-this.mouse.delta.x * rotationSpeed);
        
        // Pitch (X axis rotation)
        const pitchObject = new THREE.Object3D();
        pitchObject.add(this.camera);
        pitchObject.rotateX(-this.mouse.delta.y * rotationSpeed);
        pitchObject.remove(this.camera);
    }
    
    handleFlyZoom(delta) {
        // In fly mode, zoom changes movement speed
        this.panSpeed *= delta;
        this.panSpeed = Math.max(0.1, Math.min(10, this.panSpeed));
    }
    
    // Update camera position and orientation
    update(deltaTime = 0.016) {
        if (!this.enabled) return;
        
        switch (this.mode) {
            case 'orbit':
                this.updateOrbit();
                break;
            case 'fly':
                this.updateFly(deltaTime);
                break;
            case 'follow':
                this.updateFollow(deltaTime);
                break;
            case 'cinematic':
                this.updateCinematic(deltaTime);
                break;
        }
    }
    
    updateOrbit() {
        // Get current position in spherical coordinates
        const offset = this.camera.position.clone().sub(this.orbitTarget);
        this.spherical.setFromVector3(offset);
        
        // Apply deltas
        this.spherical.theta += this.sphericalDelta.theta;
        this.spherical.phi += this.sphericalDelta.phi;
        
        // Restrict phi to be between desired limits
        this.spherical.phi = Math.max(this.minPolarAngle, 
                                     Math.min(this.maxPolarAngle, this.spherical.phi));
        
        // Restrict radius to be between desired limits
        this.spherical.radius = Math.max(this.minDistance, 
                                        Math.min(this.maxDistance, this.spherical.radius));
        
        // Convert back to Cartesian coordinates
        offset.setFromSpherical(this.spherical);
        this.camera.position.copy(this.orbitTarget).add(offset);
        
        // Look at target
        this.camera.lookAt(this.orbitTarget);
        
        // Apply damping
        this.sphericalDelta.theta *= (1 - this.dampingFactor);
        this.sphericalDelta.phi *= (1 - this.dampingFactor);
    }
    
    updateFly(deltaTime) {
        const moveSpeed = this.panSpeed * deltaTime * 60;
        const direction = new THREE.Vector3();
        
        // Get camera direction vectors
        const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0);
        
        // Apply movement based on key states
        if (this.moveForward) direction.add(forward);
        if (this.moveBackward) direction.sub(forward);
        if (this.moveRight) direction.add(right);
        if (this.moveLeft) direction.sub(right);
        if (this.moveUp) direction.add(up);
        if (this.moveDown) direction.sub(up);
        
        // Normalize and scale by speed
        if (direction.length() > 0) {
            direction.normalize().multiplyScalar(moveSpeed);
            this.camera.position.add(direction);
        }
    }
    
    updateFollow(deltaTime) {
        if (!this.followTarget) return;
        
        // Get target position and velocity
        const targetPos = this.followTarget.position.clone();
        const targetVelocity = this.followTarget.velocity || new THREE.Vector3();
        
        // Calculate desired camera position
        const desiredPosition = targetPos.clone().add(this.followOffset);
        
        // Smooth camera movement
        this.camera.position.lerp(desiredPosition, this.dampingFactor);
        
        // Look at target with velocity prediction
        const lookTarget = targetPos.clone().add(
            targetVelocity.clone().multiplyScalar(this.followLookAhead)
        );
        
        // Smooth rotation
        const targetQuaternion = new THREE.Quaternion();
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(this.camera.position, lookTarget, this.camera.up);
        targetQuaternion.setFromRotationMatrix(tempMatrix);
        
        this.camera.quaternion.slerp(targetQuaternion, this.dampingFactor);
    }
    
    updateCinematic(deltaTime) {
        if (this.cinematicPath.length < 2) return;
        
        // Update progress
        this.cinematicProgress += this.cinematicSpeed * deltaTime;
        
        // Loop or clamp progress
        if (this.cinematicProgress >= this.cinematicPath.length - 1) {
            this.cinematicProgress = 0; // Loop
            // Or stop: this.cinematicProgress = this.cinematicPath.length - 1;
        }
        
        // Get current segment
        const index = Math.floor(this.cinematicProgress);
        const t = this.cinematicProgress - index;
        
        // Ensure we don't go out of bounds
        if (index >= this.cinematicPath.length - 1) return;
        
        const current = this.cinematicPath[index];
        const next = this.cinematicPath[index + 1];
        
        // Interpolate position using cubic bezier
        if (current.position && next.position) {
            this.camera.position.lerpVectors(current.position, next.position, t);
        }
        
        // Interpolate rotation
        if (current.quaternion && next.quaternion) {
            this.camera.quaternion.slerpQuaternions(current.quaternion, next.quaternion, t);
        }
        
        // Interpolate field of view for zoom effects
        if (current.fov && next.fov) {
            this.camera.fov = THREE.MathUtils.lerp(current.fov, next.fov, t);
            this.camera.updateProjectionMatrix();
        }
    }
    
    // Mode switching
    setMode(mode) {
        this.mode = mode;
        
        // Reset mode-specific parameters
        switch (mode) {
            case 'orbit':
                // Initialize spherical coordinates from current position
                const offset = this.camera.position.clone().sub(this.orbitTarget);
                this.spherical.setFromVector3(offset);
                break;
                
            case 'fly':
                // Reset movement flags
                this.moveForward = false;
                this.moveBackward = false;
                this.moveLeft = false;
                this.moveRight = false;
                this.moveUp = false;
                this.moveDown = false;
                break;
        }
    }
    
    // Orbit mode specific methods
    setOrbitTarget(target) {
        this.orbitTarget.copy(target);
    }
    
    // Follow mode specific methods
    setFollowTarget(target, offset) {
        this.followTarget = target;
        if (offset) {
            this.followOffset.copy(offset);
        }
    }
    
    // Cinematic mode specific methods
    setCinematicPath(waypoints) {
        this.cinematicPath = waypoints;
        this.cinematicProgress = 0;
    }
    
    addCinematicWaypoint(position, lookAt, fov = null, duration = 1) {
        const waypoint = {
            position: position.clone(),
            quaternion: new THREE.Quaternion(),
            fov: fov || this.camera.fov,
            duration
        };
        
        // Calculate rotation from look at
        const tempMatrix = new THREE.Matrix4();
        tempMatrix.lookAt(position, lookAt, this.camera.up);
        waypoint.quaternion.setFromRotationMatrix(tempMatrix);
        
        this.cinematicPath.push(waypoint);
    }
    
    // Utility methods
    reset() {
        this.camera.position.set(0, 10, 20);
        this.camera.lookAt(0, 0, 0);
        this.sphericalDelta.set(0, 0, 0);
    }
    
    dispose() {
        this.domElement.removeEventListener('mousedown', this.onMouseDown.bind(this));
        this.domElement.removeEventListener('mousemove', this.onMouseMove.bind(this));
        this.domElement.removeEventListener('mouseup', this.onMouseUp.bind(this));
        this.domElement.removeEventListener('wheel', this.onMouseWheel.bind(this));
        this.domElement.removeEventListener('touchstart', this.onTouchStart.bind(this));
        this.domElement.removeEventListener('touchmove', this.onTouchMove.bind(this));
        this.domElement.removeEventListener('touchend', this.onTouchEnd.bind(this));
        document.removeEventListener('keydown', this.onKeyDown.bind(this));
        document.removeEventListener('keyup', this.onKeyUp.bind(this));
    }
}

// Usage example:
/*
const cameraController = new CameraController(camera, renderer.domElement);

// Set orbit mode for general viewing
cameraController.setMode('orbit');
cameraController.setOrbitTarget(spacecraftPosition);

// Switch to follow mode during landing
cameraController.setMode('follow');
cameraController.setFollowTarget(rover, new THREE.Vector3(0, 10, 20));

// Create cinematic sequence
cameraController.setMode('cinematic');
cameraController.addCinematicWaypoint(
    new THREE.Vector3(100, 50, 100),
    new THREE.Vector3(0, 0, 0),
    60
);
*/