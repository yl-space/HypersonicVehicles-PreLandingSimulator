/**
 * Camera management 
 */

import * as THREE from 'three';

export class CameraController {
    constructor(camera, renderer) {
        this.camera = camera;
        this.renderer = renderer;
        this.mode = 'follow'; // Default to follow mode like NASA's visualization
        this.target = null;
        this.smoothness = 0.15; // Increased for more responsive camera movement
        
        // Camera state (spacecraft-centric with planet collision prevention)
        this.state = {
            distance: 0.15,    // Close initial distance for spacecraft focus
            height: 0.05,      // Lower height for better spacecraft focus
            angle: 0,
            defaultDistance: 0.15,
            minDistance: 0.005, // Very close minimum zoom for spacecraft detail
            maxDistance: 2.5   // Max zoom to see entire trajectory (~2.5 units = full trajectory view)
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
            phi: Math.PI / 3,      // Elevation (better initial angle)
            radius: 0.3,           // Close orbit radius for spacecraft focus
            minPhi: 0.1,           // Prevent camera from going below ground
            maxPhi: Math.PI - 0.1, // Prevent camera flip
            planetRadius: 33.9     // Mars radius for collision detection
        };

        // Follow mode orbit controls (mouse drag in follow mode)
        this.followOrbit = {
            enabled: false,
            theta: 0,
            phi: 0
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
        // Set initial camera position safely outside Mars
        // Will smoothly transition to spacecraft once it's positioned at trajectory start
        // Position camera at a safe distance from Mars center (Mars radius = 33.9 units)
        this.camera.position.set(0, 50, 50);  // Safe position above Mars
        this.camera.lookAt(0, 0, 0);  // Look at Mars center initially
        this.camera.up.set(0, 1, 0);  // Maintain standard Y-up orientation

        // Cinematic camera tracking state
        this.cinematic = {
            offset: new THREE.Vector3(0, 0.03, 0.1),  // Camera offset relative to spacecraft (right, up, back)
            smoothing: 0.08,  // Smooth position tracking
            orientationSmoothing: 0.05,  // Smoother orientation tracking
            lookAheadDistance: 0.02,  // Look slightly ahead of spacecraft
            upVector: new THREE.Vector3(0, 1, 0),  // Target up vector
            currentUp: new THREE.Vector3(0, 1, 0),  // Current smoothed up vector
            initialized: false  // Track if camera has locked onto spacecraft
        };

        this.setupEventListeners();
    }
    
    setupEventListeners() {
        const canvas = this.renderer.domElement;
        
        // Mouse controls for both orbit and follow modes
        canvas.addEventListener('mousedown', (e) => {
            this.mouse.isDown = true;
            this.mouse.lastX = e.clientX;
            this.mouse.lastY = e.clientY;

            // Enable manual control in follow mode
            if (this.mode === 'follow') {
                this.followOrbit.enabled = true;
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (this.mouse.isDown) {
                const deltaX = e.clientX - this.mouse.lastX;
                const deltaY = e.clientY - this.mouse.lastY;

                // Add inertia for smoother movement
                // FIXED: Positive deltaX = drag right = rotate right (add, not subtract)
                this.inertia.deltaX = deltaX * 0.005;
                // FIXED: Positive deltaY = drag down = tilt down (add, not subtract)
                this.inertia.deltaY = deltaY * 0.005;

                if (this.mode === 'orbit') {
                    // FIXED: Add deltaX so dragging right rotates right
                    this.orbit.theta += this.inertia.deltaX;
                    // FIXED: Add deltaY but clamp to prevent flipping
                    this.orbit.phi = Math.max(this.orbit.minPhi, Math.min(this.orbit.maxPhi,
                        this.orbit.phi + this.inertia.deltaY));
                } else if (this.mode === 'follow') {
                    // Apply rotation in follow mode with same fix
                    this.followOrbit.theta += this.inertia.deltaX;
                    // Clamp phi to prevent camera flipping
                    this.followOrbit.phi = Math.max(-Math.PI / 2 + 0.1, Math.min(Math.PI / 2 - 0.1,
                        this.followOrbit.phi + this.inertia.deltaY));
                }

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
        
        // Wheel for zoom - focused on spacecraft with proper limits
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const zoomSpeed = 0.08; // Smooth zoom speed
            // Scroll up = zoom in (smaller distance)
            const delta = e.deltaY < 0 ? 1 - zoomSpeed : 1 + zoomSpeed;

            if (this.mode === 'orbit') {
                this.orbit.radius = Math.max(this.state.minDistance,
                    Math.min(this.state.maxDistance, this.orbit.radius * delta));
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

                    // FIXED: Add deltaX (not subtract) for correct touch rotation
                    this.orbit.theta += deltaX * 0.005;
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

        // Reset follow orbit when switching modes
        if (mode === 'follow') {
            this.followOrbit.enabled = false;
            this.followOrbit.theta = 0;
            this.followOrbit.phi = 0;
        }

        // Initialize orbit position when switching to orbit mode
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
        // Do NOT immediately move camera - respect J2000-aware initialization
        // Camera will smoothly transition to following target during update loop
    }
    
    update(deltaTime, vehicleData) {
        if (!this.target) return;

        // Apply inertia damping
        if (this.mode === 'orbit' && !this.mouse.isDown) {
            if (Math.abs(this.inertia.deltaX) > 0.0001 || Math.abs(this.inertia.deltaY) > 0.0001) {
                // FIXED: Add deltaX (not subtract) to match mouse movement direction
                this.orbit.theta += this.inertia.deltaX;
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
                // Cinematic follow mode - spacecraft always centered and upright
                if (this.followOrbit.enabled && (Math.abs(this.followOrbit.theta) > 0.01 || Math.abs(this.followOrbit.phi) > 0.01)) {
                    // User has rotated camera - use orbital positioning around spacecraft
                    // BUT ALWAYS LOOK AT SPACECRAFT (maintain focus)
                    const distance = this.state.distance;
                    desiredPosition.x = targetPos.x +
                        distance * Math.cos(this.followOrbit.phi) * Math.sin(this.followOrbit.theta);
                    desiredPosition.y = targetPos.y +
                        distance * Math.sin(this.followOrbit.phi);
                    desiredPosition.z = targetPos.z +
                        distance * Math.cos(this.followOrbit.phi) * Math.cos(this.followOrbit.theta);

                    // Maintain spacecraft-centric up vector (radial from Mars)
                    if (vehicleData && vehicleData.position instanceof THREE.Vector3 && vehicleData.position.length() > 0.001) {
                        this.cinematic.upVector.copy(vehicleData.position.clone().normalize());
                    } else {
                        this.cinematic.upVector.set(0, 1, 0);
                    }

                    // ALWAYS look at spacecraft - never lose focus
                    lookAtPoint = targetPos.clone();
                } else {
                    // Cinematic auto-follow mode - position camera in spacecraft's local reference frame
                    if (vehicleData && vehicleData.velocity instanceof THREE.Vector3 && vehicleData.position instanceof THREE.Vector3) {
                        const velocity = vehicleData.velocity.clone();
                        const position = vehicleData.position.clone();

                        if (velocity.length() > 0.001 && position.length() > 0.001) {
                            // Build spacecraft-centric coordinate system
                            const forward = velocity.clone().normalize();  // Direction of motion
                            const radial = position.clone().normalize();   // Radial from Mars (up direction)

                            // Right vector = perpendicular to both forward and radial
                            const right = new THREE.Vector3().crossVectors(forward, radial).normalize();

                            // Recalculate up to be perpendicular to forward and right (ensures orthogonal frame)
                            const up = new THREE.Vector3().crossVectors(right, forward).normalize();

                            // Apply camera offset in spacecraft's local coordinate system
                            // offset.x = right, offset.y = up, offset.z = back (opposite to forward)
                            desiredPosition.copy(targetPos);
                            desiredPosition.add(right.multiplyScalar(this.cinematic.offset.x * this.state.distance));
                            desiredPosition.add(up.multiplyScalar(this.cinematic.offset.y * this.state.distance));
                            desiredPosition.add(forward.multiplyScalar(-this.cinematic.offset.z * this.state.distance));

                            // Set up vector to keep spacecraft upright in frame (aligned with radial direction)
                            this.cinematic.upVector.copy(radial);

                            // Look slightly ahead of spacecraft for more dynamic framing
                            lookAtPoint.copy(targetPos).add(forward.multiplyScalar(this.cinematic.lookAheadDistance));
                        } else {
                            // Fallback for zero velocity
                            desiredPosition.set(
                                targetPos.x,
                                targetPos.y + this.state.height,
                                targetPos.z + this.state.distance
                            );
                            this.cinematic.upVector.set(0, 1, 0);
                        }
                    } else {
                        // Default follow position when no vehicle data
                        desiredPosition.set(
                            targetPos.x,
                            targetPos.y + this.state.height,
                            targetPos.z + this.state.distance
                        );
                        this.cinematic.upVector.set(0, 1, 0);
                    }
                }

                // Ensure camera doesn't go below Mars surface or through the planet
                const distanceFromCenter = desiredPosition.length();
                const marsRadius = this.orbit.planetRadius;
                const minSafeDistance = marsRadius + 0.5;  // 0.5 units above surface

                if (distanceFromCenter < minSafeDistance) {
                    // Push camera away from Mars center to safe distance
                    const direction = desiredPosition.clone().normalize();
                    desiredPosition.copy(direction.multiplyScalar(minSafeDistance));
                }

                // Mark camera as initialized once spacecraft has valid position
                if (!this.cinematic.initialized && vehicleData && vehicleData.position && vehicleData.position.length() > 1.0) {
                    this.cinematic.initialized = true;
                }
                break;

            case 'orbit':
                // Orbit mode - user-controlled camera around target
                // ALWAYS keep spacecraft in view and never go inside planet
                desiredPosition.x = targetPos.x +
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.sin(this.orbit.theta);
                desiredPosition.y = targetPos.y +
                    this.orbit.radius * Math.cos(this.orbit.phi);
                desiredPosition.z = targetPos.z +
                    this.orbit.radius * Math.sin(this.orbit.phi) * Math.cos(this.orbit.theta);

                // Ensure camera doesn't go through Mars
                const orbitDistFromCenter = desiredPosition.length();
                const orbitMarsRadius = this.orbit.planetRadius;
                const minOrbitDistance = orbitMarsRadius + 0.5;

                if (orbitDistFromCenter < minOrbitDistance) {
                    // Push camera away from Mars center
                    const direction = desiredPosition.clone().normalize();
                    desiredPosition.copy(direction.multiplyScalar(minOrbitDistance));
                }

                // Ensure camera maintains minimum distance from spacecraft
                const distToSpacecraft = desiredPosition.distanceTo(targetPos);
                if (distToSpacecraft < 0.02) {  // Minimum 0.02 units from spacecraft
                    const toCamera = desiredPosition.clone().sub(targetPos).normalize();
                    desiredPosition.copy(targetPos).add(toCamera.multiplyScalar(0.02));
                }

                // Use spacecraft-centric up vector for orbit mode too
                if (vehicleData && vehicleData.position instanceof THREE.Vector3 && vehicleData.position.length() > 0.001) {
                    this.cinematic.upVector.copy(vehicleData.position.clone().normalize());
                } else {
                    this.cinematic.upVector.set(0, 1, 0);
                }

                // ALWAYS look at spacecraft - maintain focus
                lookAtPoint = targetPos.clone();
                break;
        }

        // Smooth camera position movement
        this.camera.position.lerp(desiredPosition, this.cinematic.smoothing);

        // Smooth up vector transition for stable orientation
        this.cinematic.currentUp.lerp(this.cinematic.upVector, this.cinematic.orientationSmoothing);
        this.cinematic.currentUp.normalize();

        // Update camera orientation with smoothed up vector
        const toTarget = lookAtPoint.clone().sub(this.camera.position).normalize();
        const right = new THREE.Vector3().crossVectors(toTarget, this.cinematic.currentUp).normalize();
        const correctedUp = new THREE.Vector3().crossVectors(right, toTarget).normalize();

        // Apply orientation
        this.camera.up.copy(correctedUp);
        this.camera.lookAt(lookAtPoint);

        // Update field of view based on distance (cinematic effect)
        if (this.mode === 'follow' && vehicleData) {
            const altitude = vehicleData.altitude || 100;
            const targetFOV = 50 + Math.min(25, altitude * 0.1);
            this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFOV, 0.05);
            this.camera.updateProjectionMatrix();
        }
    }
    
    zoom(direction) {
        const zoomSpeed = 0.12;
        // 'in' = zoom in (closer), positive direction = zoom out
        const factor = direction > 0 ? 1 + zoomSpeed : 1 - zoomSpeed;

        if (this.mode === 'orbit') {
            this.orbit.radius = Math.max(this.state.minDistance,
                Math.min(this.state.maxDistance, this.orbit.radius * factor));
        } else {
            this.state.distance = Math.max(this.state.minDistance,
                Math.min(this.state.maxDistance, this.state.distance * factor));
        }
    }
    
    setDefaultDistance(distance) {
        this.state.defaultDistance = distance;
        this.state.distance = distance;
        // Set orbit radius proportionally
        this.orbit.radius = Math.max(this.state.minDistance,
            Math.min(this.state.maxDistance, distance * 1.5));
    }
    
    handleResize() {
        // Camera aspect ratio is handled by the renderer
    }

    reset() {
        // Reset camera to J2000-aware position
        // This ensures the camera looks toward the correct hemisphere where the trajectory is
        if (this.target) {
            const targetPos = this.target.position.clone();
            this.camera.position.set(
                targetPos.x,
                targetPos.y + 0.05,
                targetPos.z + 0.2
            );
            this.camera.lookAt(targetPos);
        } else {
            // Reset to J2000-correct initial view
            this.camera.position.set(-10, 40, 25);
            this.camera.lookAt(0, 30, 15);
            this.camera.up.set(0, 1, 0);
        }

        this.orbit.theta = Math.PI / 4;
        this.orbit.phi = Math.PI / 3;
        this.orbit.radius = 0.3;
        this.state.distance = this.state.defaultDistance;

        // Reset follow orbit
        this.followOrbit.enabled = false;
        this.followOrbit.theta = 0;
        this.followOrbit.phi = 0;

        // Reset inertia
        this.inertia.deltaX = 0;
        this.inertia.deltaY = 0;

        // Reset cinematic camera state
        this.cinematic.upVector.set(0, 1, 0);
        this.cinematic.currentUp.set(0, 1, 0);
    }
}