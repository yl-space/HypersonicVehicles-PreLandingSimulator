/**
 * Camera management 
 */

import * as THREE from '/node_modules/three/build/three.module.js';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.mode = 'follow'; // Default to follow mode like NASA's visualization
        this.target = null;
        this.smoothness = 0.15; // Increased for more responsive camera movement
        
        // Camera state (spacecraft-centric with planet collision prevention)
        this.state = {
            distance: 0.2,     // Very close initial distance for spacecraft focus
            height: 0.05,      // Lower height for better spacecraft focus
            angle: 0,
            defaultDistance: 0.2,
            minDistance: 0.01, // Very close minimum zoom distance for spacecraft detail
            maxDistance: 80    // Max distance to see full trajectory path (Mars radius 33.9 + trajectory altitude ~40)
        };
        
        // Mouse controls for orbit mode
        this.mouse = {
            isDown: false,
            lastX: 0,
            lastY: 0
        };
        
        // Orbit parameters with planet collision prevention
        this.orbit = {
            theta: Math.PI / 4,    // Azimuth
            phi: Math.PI / 4,      // Elevation (better initial angle)
            radius: 0.5,           // Close orbit radius for spacecraft focus
            minPhi: 0.1,           // Prevent camera from going below ground
            maxPhi: Math.PI - 0.1, // Prevent camera flip
            planetRadius: 33.9     // Mars radius for collision detection
        };
        
        // Touch support
        this.touch = {
            isActive: false,
            startX: 0,
            startY: 0,
            startDistance: 0
        };
        
        // Inertia for smooth camera movement
        this.inertia = {
            deltaX: 0,
            deltaY: 0,
            damping: 0.95
        };
        
        this.init();
    }
    
    init() {
        // Set initial camera position focused on spacecraft (will be updated when target is set)
        this.camera.position.set(0, 0, 1);
        this.camera.lookAt(0, 0, 0);

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
                const deltaX = e.clientX - this.mouse.lastX;
                const deltaY = e.clientY - this.mouse.lastY;
                
                // Add inertia for smoother movement
                this.inertia.deltaX = deltaX * 0.005;
                this.inertia.deltaY = deltaY * 0.005;
                
                this.orbit.theta -= this.inertia.deltaX;
                this.orbit.phi = Math.max(this.orbit.minPhi, Math.min(this.orbit.maxPhi, 
                    this.orbit.phi + this.inertia.deltaY));
                
                this.mouse.lastX = e.clientX;
                this.mouse.lastY = e.clientY;
            }
        });
        
        // Mouse up on both canvas and document to prevent stuck drag
        const handleMouseUp = () => {
            this.mouse.isDown = false;
        };
        canvas.addEventListener('mouseup', handleMouseUp);
        document.addEventListener('mouseup', handleMouseUp);
        
        // Handle mouse leave to prevent stuck state
        canvas.addEventListener('mouseleave', handleMouseUp);
        
        // Wheel for zoom - intuitive direction with planet collision prevention
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.1; // Better zoom speed
            // Inverted: scroll up = zoom in (smaller distance)
            const delta = e.deltaY < 0 ? 1 - zoomSpeed : 1 + zoomSpeed;

            if (this.mode === 'orbit') {
                const newRadius = this.orbit.radius * delta;
                // Prevent camera from going inside planet
                const minSafeRadius = this.orbit.planetRadius + 1.0;
                this.orbit.radius = Math.max(minSafeRadius,
                    Math.min(this.state.maxDistance, newRadius));
            } else if (this.mode === 'follow') {
                this.state.distance = Math.max(this.state.minDistance,
                    Math.min(this.state.maxDistance, this.state.distance * delta));
            }
        }, { passive: false });
        
        // Touch support for mobile devices
        this.setupTouchControls(canvas);
    }
    
    setupTouchControls(canvas) {
        // Touch start
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (this.mode === 'orbit') {
                if (e.touches.length === 1) {
                    // Single touch for rotation
                    this.touch.isActive = true;
                    this.touch.startX = e.touches[0].clientX;
                    this.touch.startY = e.touches[0].clientY;
                } else if (e.touches.length === 2) {
                    // Two finger pinch for zoom
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    this.touch.startDistance = Math.sqrt(dx * dx + dy * dy);
                }
            }
        }, { passive: false });
        
        // Touch move
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (this.mode === 'orbit' && this.touch.isActive) {
                if (e.touches.length === 1) {
                    // Single touch rotation
                    const deltaX = e.touches[0].clientX - this.touch.startX;
                    const deltaY = e.touches[0].clientY - this.touch.startY;
                    
                    this.orbit.theta -= deltaX * 0.005;
                    this.orbit.phi = Math.max(this.orbit.minPhi, 
                        Math.min(this.orbit.maxPhi, this.orbit.phi + deltaY * 0.005));
                    
                    this.touch.startX = e.touches[0].clientX;
                    this.touch.startY = e.touches[0].clientY;
                } else if (e.touches.length === 2) {
                    // Pinch zoom
                    const dx = e.touches[0].clientX - e.touches[1].clientX;
                    const dy = e.touches[0].clientY - e.touches[1].clientY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (this.touch.startDistance > 0) {
                        const scale = distance / this.touch.startDistance;
                        this.orbit.radius = Math.max(this.state.minDistance,
                            Math.min(this.state.maxDistance, this.orbit.radius / scale));
                        this.touch.startDistance = distance;
                    }
                }
            }
        }, { passive: false });
        
        // Touch end
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.touch.isActive = false;
            this.touch.startDistance = 0;
        }, { passive: false });
    }
    
    setMode(mode) {
        this.mode = mode.toLowerCase();
        console.log(`Camera mode set to: ${this.mode}`);
        
        // Initialize orbit position when switching modes
        if (mode === 'orbit' && this.target) {
            const offset = this.camera.position.clone().sub(this.target.position);
            this.orbit.radius = Math.max(this.state.minDistance, 
                Math.min(this.state.maxDistance, offset.length()));
            this.orbit.theta = Math.atan2(offset.x, offset.z);
            const phi = Math.acos(Math.max(-1, Math.min(1, offset.y / this.orbit.radius)));
            this.orbit.phi = Math.max(this.orbit.minPhi, Math.min(this.orbit.maxPhi, phi));
        }
    }
    
    setTarget(target) {
        this.target = target;

        // Immediately focus camera on the new target (spacecraft)
        if (target && target.position) {
            const targetPos = target.position.clone();
            this.camera.position.set(
                targetPos.x,
                targetPos.y + 0.1,
                targetPos.z + 0.3
            );
            this.camera.lookAt(targetPos);
        }
    }
    
    update(deltaTime, vehicleData) {
        if (!this.target) return;
        
        // Apply inertia damping
        if (this.mode === 'orbit' && !this.mouse.isDown) {
            if (Math.abs(this.inertia.deltaX) > 0.0001 || Math.abs(this.inertia.deltaY) > 0.0001) {
                this.orbit.theta -= this.inertia.deltaX;
                this.orbit.phi = Math.max(this.orbit.minPhi, 
                    Math.min(this.orbit.maxPhi, this.orbit.phi + this.inertia.deltaY));
                
                this.inertia.deltaX *= this.inertia.damping;
                this.inertia.deltaY *= this.inertia.damping;
            }
        }
        
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
                        
                        // Position camera behind and slightly above the spacecraft for better view
                        desiredPosition.copy(targetPos);
                        desiredPosition.sub(velocity.clone().multiplyScalar(this.state.distance));
                        desiredPosition.y += this.state.height;
                        
                        // Add slight offset to avoid looking directly from behind
                        const sideOffset = new THREE.Vector3();
                        sideOffset.crossVectors(velocity, new THREE.Vector3(0, 1, 0)).normalize();
                        desiredPosition.add(sideOffset.multiplyScalar(this.state.distance * 0.2));

                        // Ensure camera doesn't go below Mars surface
                        const distanceFromCenter = desiredPosition.length();
                        const marsRadius = this.orbit.planetRadius;
                        if (distanceFromCenter < marsRadius + 0.5) {
                            const direction = desiredPosition.clone().normalize();
                            desiredPosition.copy(direction.multiplyScalar(marsRadius + 0.5));
                        }
                    } else {
                        // Static follow when no velocity
                        desiredPosition.set(
                            targetPos.x - this.state.distance * 0.7,
                            targetPos.y + this.state.height,
                            targetPos.z - this.state.distance * 0.7
                        );

                        // Ensure camera doesn't go below Mars surface
                        const distanceFromCenter2 = desiredPosition.length();
                        const marsRadius2 = this.orbit.planetRadius;
                        if (distanceFromCenter2 < marsRadius2 + 0.5) {
                            const direction2 = desiredPosition.clone().normalize();
                            desiredPosition.copy(direction2.multiplyScalar(marsRadius2 + 0.5));
                        }
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
                // Orbit mode - user-controlled camera around target with planet collision prevention
                desiredPosition.x = targetPos.x +
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
                desiredPosition.y = targetPos.y +
                    this.orbit.radius * Math.cos(this.orbit.phi);
                desiredPosition.z = targetPos.z +
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);

                // Check if camera would go inside planet and adjust if needed
                const distanceFromPlanetCenter = desiredPosition.length();
                const minSafeDistance = this.orbit.planetRadius + 1.0;
                if (distanceFromPlanetCenter < minSafeDistance) {
                    // Push camera away from planet center
                    const direction = desiredPosition.clone().normalize();
                    desiredPosition.copy(direction.multiplyScalar(minSafeDistance));
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
        const zoomSpeed = 0.15; // Better zoom speed
        // Fixed zoom direction: 'in' means closer (smaller distance)
        const factor = direction === 'in' ? 1 - zoomSpeed : 1 + zoomSpeed;

        if (this.mode === 'orbit') {
            const newRadius = this.orbit.radius * factor;
            // Prevent camera from going inside planet
            const minSafeRadius = this.orbit.planetRadius + 1.0;
            this.orbit.radius = Math.max(minSafeRadius,
                Math.min(this.state.maxDistance, newRadius));
        } else {
            this.state.distance = Math.max(this.state.minDistance,
                Math.min(this.state.maxDistance, this.state.distance * factor));
        }
    }
    
    setDefaultDistance(distance) {
        this.state.defaultDistance = distance;
        this.state.distance = distance;
        // Set orbit radius with planet collision prevention
        const newRadius = distance * 1.5;
        const minSafeRadius = this.orbit.planetRadius + 1.0;
        this.orbit.radius = Math.max(minSafeRadius,
            Math.min(this.state.maxDistance, newRadius));
    }
    
    handleResize() {
        // Camera aspect ratio is handled by the renderer
    }
    
    reset() {
        // Reset camera to spacecraft-focused position
        if (this.target) {
            const targetPos = this.target.position.clone();
            this.camera.position.set(
                targetPos.x,
                targetPos.y + 0.1,
                targetPos.z + 0.3
            );
            this.camera.lookAt(targetPos);
        } else {
            this.camera.position.set(0, 0.1, 0.3);
            this.camera.lookAt(0, 0, 0);
        }

        this.orbit.theta = Math.PI / 4;
        this.orbit.phi = Math.PI / 4;
        // Safe orbit radius considering planet collision
        const minSafeRadius = this.orbit.planetRadius + 1.0;
        this.orbit.radius = Math.max(minSafeRadius, 35);
        this.state.distance = this.state.defaultDistance;

        // Reset inertia
        this.inertia.deltaX = 0;
        this.inertia.deltaY = 0;
    }
}