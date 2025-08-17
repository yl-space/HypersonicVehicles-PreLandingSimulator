import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.mode = 'freestyle'; // Default to freestyle
        this.target = null;
        this.smoothness = 0.05;
        
        // Camera state
        this.state = {
            distance: 100,
            height: 50,
            angle: 0,
            cinematicTime: 0,
            defaultDistance: 50
        };
        
        // Orbit controls for freestyle mode
        this.orbitControls = null;
        
        this.init();
    }
    
    init() {
        // Better view of trajectory and Mars
        this.camera.position.set(80, 40, 80);
        this.camera.lookAt(0, 0, 0);
        
        // Initialize OrbitControls
        this.orbitControls = new OrbitControls(this.camera, this.renderer.domElement);
        this.orbitControls.enableDamping = true;
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.minDistance = 10;
        this.orbitControls.maxDistance = 300;
        this.orbitControls.target.set(0, 0, 0);
        this.orbitControls.enabled = true;
    }
    
    setMode(mode) {
        this.mode = mode.toLowerCase();
        
        // Handle mode switching
        switch(this.mode) {
            case 'follow':
                this.orbitControls.enabled = false;
                break;
                
            case 'freestyle':
            case 'free':
            case 'orbit':
                this.orbitControls.enabled = true;
                if (this.target) {
                    this.orbitControls.target.copy(this.target.position);
                }
                break;
                
            case 'fixed':
                this.orbitControls.enabled = false;
                this.camera.position.set(100, 50, 100);
                this.camera.lookAt(0, 0, 0);
                break;
                
            case 'cinematic':
                this.orbitControls.enabled = false;
                this.state.cinematicTime = 0;
                break;
        }
    }
    
    setTarget(target) {
        this.target = target;
        if (this.orbitControls && (this.mode === 'freestyle' || this.mode === 'free')) {
            this.orbitControls.target.set(0, 0, 0); // Keep focused on origin
        }
    }
    
    setDefaultDistance(distance) {
        this.state.defaultDistance = distance;
        this.state.distance = distance;
    }
    
    update(deltaTime, vehicleData) {
        // Always update OrbitControls if in freestyle mode
        if (this.orbitControls && this.orbitControls.enabled) {
            this.orbitControls.update();
            return; // Let OrbitControls handle everything
        }
        
        if (!this.target) return;
        
        const targetPos = this.target.position.clone();
        let desiredPosition = new THREE.Vector3();
        let lookAtPoint = targetPos.clone();
        
        switch (this.mode) {
            case 'follow':
                const altitude = vehicleData?.altitude || 10000;
                const followDistance = 30 + Math.sqrt(altitude) * 0.01;
                const followHeight = 15 + Math.sqrt(altitude) * 0.005;
                
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
                
                lookAtPoint.add(forward.multiplyScalar(5));
                break;
                
            case 'fixed':
                desiredPosition.set(100, 50, 100);
                break;
                
            case 'cinematic':
                this.state.cinematicTime += deltaTime;
                const t = this.state.cinematicTime * 0.1;
                
                desiredPosition.x = targetPos.x + Math.sin(t) * 50;
                desiredPosition.y = targetPos.y + 30 + Math.sin(t * 0.5) * 10;
                desiredPosition.z = targetPos.z + Math.cos(t) * 50;
                break;
        }
        
        if (this.mode !== 'freestyle' && this.mode !== 'free') {
            this.camera.position.lerp(desiredPosition, this.smoothness);
            
            const currentLookAt = new THREE.Vector3();
            this.camera.getWorldDirection(currentLookAt);
            currentLookAt.add(this.camera.position);
            
            const targetDirection = lookAtPoint.clone().sub(this.camera.position).normalize();
            const currentDirection = currentLookAt.sub(this.camera.position).normalize();
            
            const smoothedDirection = currentDirection.lerp(targetDirection, this.smoothness * 2);
            this.camera.lookAt(this.camera.position.clone().add(smoothedDirection));
        }
    }
    
    handleResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    }
    
    dispose() {
        if (this.orbitControls) {
            this.orbitControls.dispose();
        }
    }
    
    // Additional methods for camera control
    reset() {
        this.camera.position.set(100, 50, 100);
        this.camera.lookAt(0, 0, 0);
        if (this.orbitControls) {
            this.orbitControls.target.set(0, 0, 0);
            this.orbitControls.update();
        }
    }
    
    focusOnTrajectory() {
        this.camera.position.set(80, 40, 80);
        this.camera.lookAt(0, 0, 0);
        if (this.orbitControls) {
            this.orbitControls.target.set(0, 0, 0);
            this.orbitControls.update();
        }
    }
    
    // Camera shake and zoom methods remain the same
    shake(intensity = 1, duration = 0.5) {
        // Implementation remains the same
    }
    
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