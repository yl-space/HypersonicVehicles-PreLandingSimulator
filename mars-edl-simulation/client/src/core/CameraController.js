/**
 * CameraController.js
 * Manages camera modes and smooth transitions
 */

import * as THREE from 'three';

export class CameraController {
    constructor(renderer) {
        this.renderer = renderer;
        this.camera = null;
        this.mode = 'FOLLOW'; // FREE, FOLLOW, CINEMATIC
        this.target = null;
        this.smoothness = 0.05;
        
        // Camera state
        this.state = {
            distance: 100,
            height: 50,
            angle: 0,
            cinematicTime: 0
        };
        
        // Mouse controls for FREE mode
        this.mouse = {
            isDown: false,
            lastX: 0,
            lastY: 0,
            deltaX: 0,
            deltaY: 0
        };
        
        this.init();
    }
    
    init() {
        // Create perspective camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            100000
        );
        
        this.camera.position.set(1000, 500, 1000);
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Handle resize
        window.addEventListener('resize', this.handleResize.bind(this));
    }
    
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse controls for FREE mode
        canvas.addEventListener('mousedown', (e) => {
            if (this.mode === 'FREE') {
                this.mouse.isDown = true;
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (this.mode === 'FREE' && this.mouse.isDown) {
                this.mouse.deltaX = e.clientX - this.mouse.lastX;
                this.mouse.deltaY = e.clientY - this.mouse.lastY;
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
                
                // Update camera rotation
                this.state.angle += this.mouse.deltaX * 0.01;
                this.state.height = Math.max(10, Math.min(1000, this.state.height - this.mouse.deltaY));
            }
        });
        
        canvas.addEventListener('mouseup', () => {
            this.mouse.isDown = false;
        });
        
        // Wheel for zoom
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.state.distance = Math.max(50, Math.min(5000, this.state.distance + e.deltaY * 0.5));
        });
    }
    
    setMode(mode) {
        this.mode = mode;
        
        // Reset camera state when switching modes
        if (mode === 'CINEMATIC') {
            this.state.cinematicTime = 0;
        }
    }
    
    setTarget(target) {
        this.target = target;
    }
    
    update(deltaTime, spacecraftData) {
        if (!this.target) return;
        
        const targetPos = this.target.position.clone();
        let desiredPosition = new THREE.Vector3();
        let lookAtPoint = targetPos.clone();
        
        switch (this.mode) {
            case 'FOLLOW':
                // Dynamic follow distance based on altitude
                const followDistance = 50 + (spacecraftData?.altitude || 0) * 0.01;
                const followHeight = 20 + (spacecraftData?.altitude || 0) * 0.005;
                
                // Position behind and above spacecraft
                desiredPosition.copy(targetPos);
                desiredPosition.y += followHeight;
                desiredPosition.z += followDistance;
                
                // Smooth camera movement
                this.camera.position.lerp(desiredPosition, this.smoothness);
                break;
                
            case 'CINEMATIC':
                // Cinematic camera with smooth orbital motion
                this.state.cinematicTime += deltaTime * 0.5;
                
                const cinematicRadius = 100 + (spacecraftData?.altitude || 0) * 0.02;
                const verticalOffset = Math.sin(this.state.cinematicTime * 0.3) * 30;
                
                desiredPosition.x = targetPos.x + Math.cos(this.state.cinematicTime) * cinematicRadius;
                desiredPosition.y = targetPos.y + cinematicRadius * 0.5 + verticalOffset;
                desiredPosition.z = targetPos.z + Math.sin(this.state.cinematicTime) * cinematicRadius;
                
                // Smooth camera movement with easing
                this.camera.position.lerp(desiredPosition, this.smoothness * 0.5);
                
                // Look slightly ahead of the spacecraft
                lookAtPoint.add(this.target.getWorldDirection(new THREE.Vector3()).multiplyScalar(20));
                break;
                
            case 'FREE':
                // Free camera with mouse control
                const radius = this.state.distance;
                desiredPosition.x = targetPos.x + Math.cos(this.state.angle) * radius;
                desiredPosition.y = targetPos.y + this.state.height;
                desiredPosition.z = targetPos.z + Math.sin(this.state.angle) * radius;
                
                this.camera.position.lerp(desiredPosition, this.smoothness * 2);
                break;
        }
        
        // Smooth look at
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
    
    // Camera shake effect for dramatic moments
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
            }
        };
        
        shakeAnimation();
    }
    
    // Zoom control
    setFOV(fov) {
        this.camera.fov = Math.max(20, Math.min(120, fov));
        this.camera.updateProjectionMatrix();
    }
    
    zoomIn() {
        this.setFOV(this.camera.fov - 5);
    }
    
    zoomOut() {
        this.setFOV(this.camera.fov + 5);
    }
}