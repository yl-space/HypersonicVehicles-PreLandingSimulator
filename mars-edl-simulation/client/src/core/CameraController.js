/**
 * CameraController.js
 * Advanced camera control system with multiple modes
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export class CameraController {
    constructor(camera, domElement) {
        this.camera = camera;
        this.domElement = domElement;
        
        // Camera modes
        this.modes = {
            FREE: 'FREE',
            FOLLOW: 'FOLLOW',
            CINEMATIC: 'CINEMATIC',
            FIRST_PERSON: 'FIRST_PERSON',
            FIXED: 'FIXED'
        };
        
        this.currentMode = this.modes.FREE;
        
        // Orbit controls for free camera
        this.orbitControls = new OrbitControls(camera, domElement);
        this.setupOrbitControls();
        
        // Follow mode properties
        this.followTarget = null;
        this.followOffset = new THREE.Vector3(0, 200, 500);
        this.followLookOffset = new THREE.Vector3(0, 0, 0);
        this.followSmoothing = 0.1;
        
        // Cinematic mode properties
        this.cinematicPath = null;
        this.cinematicProgress = 0;
        this.cinematicSpeed = 0.001;
        this.cinematicPaused = false;
        
        // Camera shake
        this.shakeIntensity = 0;
        this.shakeDecay = 0.95;
        this.originalPosition = new THREE.Vector3();
        
        // Smooth transitions
        this.isTransitioning = false;
        this.transitionStart = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            target: new THREE.Vector3()
        };
        this.transitionEnd = {
            position: new THREE.Vector3(),
            rotation: new THREE.Euler(),
            target: new THREE.Vector3()
        };
        this.transitionProgress = 0;
        this.transitionDuration = 2000; // ms
        
        // Predefined camera positions
        this.presetViews = [
            {
                name: 'Overview',
                position: new THREE.Vector3(0, 2000, 5000),
                target: new THREE.Vector3(0, 0, 0)
            },
            {
                name: 'Entry View',
                position: new THREE.Vector3(2000, 3000, 4000),
                target: new THREE.Vector3(0, 1000, 0)
            },
            {
                name: 'Surface View',
                position: new THREE.Vector3(-3000, 500, -2000),
                target: new THREE.Vector3(0, 0, 0)
            },
            {
                name: 'Close Follow',
                position: new THREE.Vector3(100, 50, 200),
                target: new THREE.Vector3(0, 0, 0)
            }
        ];
    }
    
    setupOrbitControls() {
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.screenSpacePanning = false;
        this.orbitControls.minDistance = 10;
        this.orbitControls.maxDistance = 100000;
        this.orbitControls.maxPolarAngle = Math.PI * 0.495;
        
        // Mouse settings
        this.orbitControls.rotateSpeed = 0.5;
        this.orbitControls.zoomSpeed = 1.0;
        this.orbitControls.panSpeed = 0.8;
        
        // Touch settings
        this.orbitControls.touches = {
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN
        };
    }
    
    setMode(mode) {
        if (this.currentMode === mode) return;
        
        const previousMode = this.currentMode;
        this.currentMode = mode;
        
        switch (mode) {
            case this.modes.FREE:
                this.orbitControls.enabled = true;
                this.followTarget = null;
                break;
                
            case this.modes.FOLLOW:
                this.orbitControls.enabled = false;
                break;
                
            case this.modes.CINEMATIC:
                this.orbitControls.enabled = false;
                this.cinematicProgress = 0;
                break;
                
            case this.modes.FIRST_PERSON:
                this.orbitControls.enabled = false;
                break;
                
            case this.modes.FIXED:
                this.orbitControls.enabled = false;
                break;
        }
        
        // Dispatch mode change event
        window.dispatchEvent(new CustomEvent('camera-mode-changed', {
            detail: { mode, previousMode }
        }));
    }
    
    // Follow mode methods
    setFollowTarget(target, offset = null, lookOffset = null) {
        this.followTarget = target;
        if (offset) this.followOffset.copy(offset);
        if (lookOffset) this.followLookOffset.copy(lookOffset);
        this.setMode(this.modes.FOLLOW);
    }
    
    updateFollowMode() {
        if (!this.followTarget) return;
        
        // Calculate desired camera position
        const targetPosition = this.followTarget.position.clone();
        const desiredPosition = targetPosition.clone().add(this.followOffset);
        
        // Smooth camera movement
        this.camera.position.lerp(desiredPosition, this.followSmoothing);
        
        // Look at target with offset
        const lookTarget = targetPosition.clone().add(this.followLookOffset);
        this.camera.lookAt(lookTarget);
    }
    
    // Cinematic mode methods
    createCinematicPath(points, loop = false) {
        const curve = new THREE.CatmullRomCurve3(points, loop);
        this.cinematicPath = curve;
        this.cinematicProgress = 0;
    }
    
    updateCinematicMode(deltaTime) {
        if (!this.cinematicPath || this.cinematicPaused) return;
        
        // Update progress
        this.cinematicProgress += this.cinematicSpeed * deltaTime;
        
        if (this.cinematicProgress > 1) {
            if (this.cinematicPath.closed) {
                this.cinematicProgress = this.cinematicProgress % 1;
            } else {
                this.cinematicProgress = 1;
                this.cinematicPaused = true;
            }
        }
        
        // Get position and look-ahead point on path
        const position = this.cinematicPath.getPointAt(this.cinematicProgress);
        const lookAhead = Math.min(this.cinematicProgress + 0.05, 1);
        const lookTarget = this.cinematicPath.getPointAt(lookAhead);
        
        this.camera.position.copy(position);
        this.camera.lookAt(lookTarget);
    }
    
    // Transition methods
    transitionTo(position, target, duration = 2000) {
        this.isTransitioning = true;
        this.transitionProgress = 0;
        this.transitionDuration = duration;
        
        // Store start state
        this.transitionStart.position.copy(this.camera.position);
        this.transitionStart.rotation.copy(this.camera.rotation);
        this.transitionStart.target.copy(this.orbitControls.target);
        
        // Store end state
        this.transitionEnd.position.copy(position);
        this.transitionEnd.target.copy(target);
        
        // Calculate end rotation
        const tempCamera = this.camera.clone();
        tempCamera.position.copy(position);
        tempCamera.lookAt(target);
        this.transitionEnd.rotation.copy(tempCamera.rotation);
        
        return new Promise((resolve) => {
            this.transitionResolve = resolve;
        });
    }
    
    updateTransition(deltaTime) {
        if (!this.isTransitioning) return;
        
        this.transitionProgress += deltaTime / this.transitionDuration;
        
        if (this.transitionProgress >= 1) {
            this.transitionProgress = 1;
            this.isTransitioning = false;
        }
        
        // Smooth easing
        const t = this.easeInOutCubic(this.transitionProgress);
        
        // Interpolate position
        this.camera.position.lerpVectors(
            this.transitionStart.position,
            this.transitionEnd.position,
            t
        );
        
        // Interpolate rotation using quaternions
        const startQuat = new THREE.Quaternion().setFromEuler(this.transitionStart.rotation);
        const endQuat = new THREE.Quaternion().setFromEuler(this.transitionEnd.rotation);
        const currentQuat = new THREE.Quaternion().slerpQuaternions(startQuat, endQuat, t);
        this.camera.quaternion.copy(currentQuat);
        
        // Update orbit controls target
        this.orbitControls.target.lerpVectors(
            this.transitionStart.target,
            this.transitionEnd.target,
            t
        );
        
        if (this.transitionProgress >= 1 && this.transitionResolve) {
            this.transitionResolve();
            this.transitionResolve = null;
        }
    }
    
    // Camera shake
    shake(intensity) {
        this.shakeIntensity = intensity;
        this.originalPosition.copy(this.camera.position);
    }
    
    updateShake() {
        if (this.shakeIntensity > 0.001) {
            const shakeX = (Math.random() - 0.5) * this.shakeIntensity * 10;
            const shakeY = (Math.random() - 0.5) * this.shakeIntensity * 10;
            const shakeZ = (Math.random() - 0.5) * this.shakeIntensity * 10;
            
            this.camera.position.x = this.originalPosition.x + shakeX;
            this.camera.position.y = this.originalPosition.y + shakeY;
            this.camera.position.z = this.originalPosition.z + shakeZ;
            
            this.shakeIntensity *= this.shakeDecay;
        }
    }
    
    // Preset views
    setPresetView(index) {
        if (index < 0 || index >= this.presetViews.length) return;
        
        const view = this.presetViews[index];
        this.transitionTo(view.position, view.target);
    }
    
    // First person mode
    attachToObject(object, offset = new THREE.Vector3(0, 10, 0)) {
        this.followTarget = object;
        this.followOffset = offset;
        this.followLookOffset.set(0, 0, -100); // Look forward
        this.setMode(this.modes.FIRST_PERSON);
    }
    
    updateFirstPersonMode() {
        if (!this.followTarget) return;
        
        // Position camera at object position plus offset
        const position = this.followTarget.position.clone().add(this.followOffset);
        this.camera.position.copy(position);
        
        // Look in the direction the object is facing
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(this.followTarget.quaternion);
        const lookTarget = position.clone().add(direction.multiplyScalar(100));
        this.camera.lookAt(lookTarget);
    }
    
    // Main update method
    update(deltaTime) {
        switch (this.currentMode) {
            case this.modes.FREE:
                this.orbitControls.update();
                break;
                
            case this.modes.FOLLOW:
                this.updateFollowMode();
                break;
                
            case this.modes.CINEMATIC:
                this.updateCinematicMode(deltaTime);
                break;
                
            case this.modes.FIRST_PERSON:
                this.updateFirstPersonMode();
                break;
        }
        
        // Update transitions
        if (this.isTransitioning) {
            this.updateTransition(deltaTime);
        }
        
        // Update camera shake
        this.updateShake();
    }
    
    // Utility methods
    easeInOutCubic(t) {
        return t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }
    
    getState() {
        return {
            mode: this.currentMode,
            position: this.camera.position.clone(),
            rotation: this.camera.rotation.clone(),
            target: this.orbitControls.target.clone()
        };
    }
    
    setState(state) {
        this.camera.position.copy(state.position);
        this.camera.rotation.copy(state.rotation);
        this.orbitControls.target.copy(state.target);
        this.setMode(state.mode);
    }
    
    // Cleanup
    dispose() {
        this.orbitControls.dispose();
    }
}

export default CameraController;