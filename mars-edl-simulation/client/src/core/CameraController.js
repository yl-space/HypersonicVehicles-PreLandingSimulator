/**
 * CameraController.js - Camera management and controls
 */

import * as THREE from 'three';

export class CameraController {
    constructor(container) {
        this.container = container;
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            10000000
        );
        
        this.mode = 'FREE'; // FREE, FOLLOW, CINEMATIC
        this.target = new THREE.Vector3(0, 0, 0);
        this.targetObject = null;
        this.smoothingFactor = 0.05;
        
        // Mouse controls
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.cameraRotationX = 0;
        this.cameraRotationY = 0;
        
        // Cinematic sequence
        this.cinematicTime = 0;
        this.cinematicDuration = 10;
        
        this.setupControls();
        this.setInitialPosition();
    }
    
    setupControls() {
        // Mouse controls
        this.container.addEventListener('mousedown', (e) => {
            if (this.mode !== 'FREE') return;
            this.mouseDown = true;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        this.container.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });
        
        this.container.addEventListener('mousemove', (e) => {
            if (!this.mouseDown || this.mode !== 'FREE') return;
            
            const deltaX = e.clientX - this.mouseX;
            const deltaY = e.clientY - this.mouseY;
            
            this.cameraRotationY -= deltaX * 0.005;
            this.cameraRotationX -= deltaY * 0.005;
            this.cameraRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotationX));
            
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        // Wheel zoom
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const distance = this.camera.position.distanceTo(this.target);
            const zoomSpeed = distance * 0.0002;
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            if (e.deltaY > 0) {
                this.camera.position.add(direction.multiplyScalar(-zoomSpeed));
            } else {
                this.camera.position.add(direction.multiplyScalar(zoomSpeed));
            }
        });
        
        // Touch controls for mobile
        this.setupTouchControls();
    }
    
    setupTouchControls() {
        let lastTouchDistance = 0;
        
        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                lastTouchDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
            }
        });
        
        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault();
            
            if (e.touches.length === 2) {
                const currentDistance = this.getTouchDistance(e.touches[0], e.touches[1]);
                const delta = currentDistance - lastTouchDistance;
                
                const distance = this.camera.position.distanceTo(this.target);
                const zoomSpeed = distance * 0.001;
                const direction = new THREE.Vector3();
                this.camera.getWorldDirection(direction);
                
                this.camera.position.add(direction.multiplyScalar(delta * zoomSpeed));
                lastTouchDistance = currentDistance;
            }
        });
    }
    
    getTouchDistance(touch1, touch2) {
        const dx = touch1.clientX - touch2.clientX;
        const dy = touch1.clientY - touch2.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    setInitialPosition() {
        this.camera.position.set(500000, 200000, 300000);
        this.camera.lookAt(0, 0, 0);
    }
    
    setMode(mode) {
        this.mode = mode;
        this.cinematicTime = 0;
        
        switch (mode) {
            case 'FREE':
                break;
            case 'FOLLOW':
                if (this.targetObject) {
                    this.followTarget();
                }
                break;
            case 'CINEMATIC':
                this.startCinematicSequence();
                break;
        }
    }
    
    setTarget(object) {
        this.targetObject = object;
        if (object && object.position) {
            this.target.copy(object.position);
        }
    }
    
    update(deltaTime) {
        switch (this.mode) {
            case 'FREE':
                this.updateFreeCamera();
                break;
            case 'FOLLOW':
                this.updateFollowCamera(deltaTime);
                break;
            case 'CINEMATIC':
                this.updateCinematicCamera(deltaTime);
                break;
        }
    }
    
    updateFreeCamera() {
        // Apply rotation
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position.clone().sub(this.target));
        spherical.theta = this.cameraRotationY;
        spherical.phi = Math.PI/2 + this.cameraRotationX;
        
        this.camera.position.setFromSpherical(spherical).add(this.target);
        this.camera.lookAt(this.target);
    }
    
    updateFollowCamera(deltaTime) {
        if (!this.targetObject) return;
        
        // Update target position
        if (this.targetObject.position) {
            this.target.lerp(this.targetObject.position, this.smoothingFactor);
        }
        
        // Position camera behind and above target
        const offset = new THREE.Vector3(0, 50000, 100000);
        const desiredPosition = this.target.clone().add(offset);
        
        this.camera.position.lerp(desiredPosition, this.smoothingFactor);
        this.camera.lookAt(this.target);
    }
    
    updateCinematicCamera(deltaTime) {
        this.cinematicTime += deltaTime;
        const progress = (this.cinematicTime % this.cinematicDuration) / this.cinematicDuration;
        
        // Circular motion around target
        const radius = 200000;
        const angle = progress * Math.PI * 2;
        const height = Math.sin(progress * Math.PI) * 100000 + 50000;
        
        this.camera.position.set(
            Math.cos(angle) * radius,
            height,
            Math.sin(angle) * radius
        );
        
        this.camera.lookAt(this.target);
    }
    
    startCinematicSequence() {
        this.cinematicTime = 0;
    }
    
    focusOn(position, distance = 100000) {
        this.target.copy(position);
        
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.multiplyScalar(-distance);
        
        this.camera.position.copy(position).add(direction);
        this.camera.lookAt(position);
    }
    
    panTo(position, duration = 2) {
        // Smooth camera transition
        const startPosition = this.camera.position.clone();
        const startTime = performance.now();
        
        const animate = () => {
            const elapsed = (performance.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);
            
            // Ease out function
            const easeOut = 1 - Math.pow(1 - progress, 3);
            
            this.camera.position.lerpVectors(startPosition, position, easeOut);
            
            if (progress < 1) {
                requestAnimationFrame(animate);
            }
        };
        
        animate();
    }
    
    dispose() {
        // Remove event listeners
        this.container.removeEventListener('mousedown', this.onMouseDown);
        this.container.removeEventListener('mouseup', this.onMouseUp);
        this.container.removeEventListener('mousemove', this.onMouseMove);
        this.container.removeEventListener('wheel', this.onWheel);
    }
}