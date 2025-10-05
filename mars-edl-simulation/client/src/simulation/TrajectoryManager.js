import * as THREE from '/node_modules/three/build/three.module.js';

export class TrajectoryManager {
    constructor() {
        this.trajectoryData = [];
        this.totalTime = 260.65;
        this.marsRadius = 3390000; // meters (NASA data)
        // Scale factor: 1 unit = 100 km for consistency with planet scales
        this.SCALE_FACTOR = 0.00001; // Convert meters to visualization units
        
        // Visual components
        this.group = new THREE.Group();
        this.trajectoryLine = null;
        this.pathPoints = null;
        this.currentPositionMarker = null;
        
        // Performance optimizations
        this.useInstancing = true;
        this.useLOD = true;
        
        this.init();
    }
    
    init() {
        this.createTrajectoryVisualization();
        this.createPositionMarker();
    }
    
    createTrajectoryVisualization() {
        // Use BufferGeometry for better performance
        this.pathGeometry = new THREE.BufferGeometry();
        
        // Materials with modern features - thinner lines for better view
        this.pastMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,  // Dark gray for traveled path
            linewidth: 1,
            opacity: 0.4,
            transparent: true
        });

        this.futureMaterial = new THREE.LineDashedMaterial({
            color: 0xff0000,  // Red for future path
            linewidth: 1,     // Reduced thickness
            opacity: 0.6,
            transparent: true,
            dashSize: 2,      // Smaller dashes
            gapSize: 1,       // Smaller gaps
            scale: 1
        });
        
        // Create separate lines for past and future
        this.pastLine = new THREE.Line(
            new THREE.BufferGeometry(),
            this.pastMaterial
        );
        
        this.futureLine = new THREE.Line(
            new THREE.BufferGeometry(),
            this.futureMaterial
        );
        
        this.group.add(this.pastLine);
        this.group.add(this.futureLine);
        
        // Create instanced mesh for trajectory points
        if (this.useInstancing) {
            this.createInstancedPathPoints();
        }
    }
    
    createInstancedPathPoints() {
        // Geometry for each point - minimal detail for performance
        const pointGeometry = new THREE.SphereGeometry(0.02, 4, 2);
        const pointMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff
        });
        
        // Use InstancedMesh for performance
        const maxPoints = 1000;
        this.pathPoints = new THREE.InstancedMesh(
            pointGeometry,
            pointMaterial,
            maxPoints
        );
        
        // Initialize instance color attribute
        const colors = new Float32Array(maxPoints * 3);
        for (let i = 0; i < maxPoints * 3; i++) {
            colors[i] = 1;
        }
        this.pathPoints.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
        
        // Enable frustum culling for performance
        this.pathPoints.frustumCulled = true;
        this.pathPoints.castShadow = false;
        this.pathPoints.receiveShadow = false;
        
        this.group.add(this.pathPoints);
    }
    
    createPositionMarker() {
        // Position marker (invisible by default)
        const markerGeometry = new THREE.SphereGeometry(0.005, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            transparent: true,
            opacity: 0.0
        });

        this.currentPositionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.currentPositionMarker.castShadow = false;
        this.currentPositionMarker.visible = false;

        this.group.add(this.currentPositionMarker);
    }
    
    setTrajectoryFromCSV(rows) {
        this.trajectoryData = [];
        let prevPosition = null;
        
        // Process CSV data
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const time = parseFloat(row.Time || row.time || 0);
            const x = parseFloat(row.x || 0);
            const y = parseFloat(row.y || 0);
            const z = parseFloat(row.z || 0);
            
            if (!isNaN(time) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                const rawDistance = Math.sqrt(x * x + y * y + z * z);
                const altitude = rawDistance - this.marsRadius;
                
                const position = new THREE.Vector3(
                    x * this.SCALE_FACTOR,
                    y * this.SCALE_FACTOR,
                    z * this.SCALE_FACTOR
                );
                
                let velocityVector = new THREE.Vector3(0, -1, 0);
                let velocityMagnitude = 5900 * (1 - time / this.totalTime);
                
                if (prevPosition && i > 0) {
                    const prevTime = this.trajectoryData[this.trajectoryData.length - 1].time;
                    const dt = time - prevTime;
                    if (dt > 0) {
                        velocityVector = position.clone().sub(prevPosition).divideScalar(dt);
                        velocityMagnitude = velocityVector.length() / this.SCALE_FACTOR;
                    }
                }
                
                this.trajectoryData.push({
                    time,
                    position,
                    altitude: altitude * 0.001, // km
                    velocity: velocityVector.clone(), // Ensure it's a Vector3
                    velocityMagnitude,
                    distanceToLanding: rawDistance * 0.001 // km
                });
                
                prevPosition = position.clone();
            }
        }
        
        this.createOptimizedTrajectory();
        this.updateInstancedPoints();
    }
    
    createOptimizedTrajectory() {
        if (this.trajectoryData.length < 2) return;
        
        // Create Float32Array for positions (more efficient)
        const positions = new Float32Array(this.trajectoryData.length * 3);
        
        for (let i = 0; i < this.trajectoryData.length; i++) {
            const point = this.trajectoryData[i];
            positions[i * 3] = point.position.x;
            positions[i * 3 + 1] = point.position.y;
            positions[i * 3 + 2] = point.position.z;
        }
        
        // Set BufferAttribute
        this.pathGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        
        // Compute bounding sphere for frustum culling
        this.pathGeometry.computeBoundingSphere();
        
        // Create full trajectory line - thinner for better visibility
        this.trajectoryLine = new THREE.Line(
            this.pathGeometry,
            new THREE.LineBasicMaterial({
                color: 0xffffff,  // White for full path
                opacity: 0.2,
                transparent: true,
                linewidth: 1      // Reduced thickness
            })
        );
        
        this.group.add(this.trajectoryLine);
    }
    
    updateInstancedPoints() {
        if (!this.pathPoints || this.trajectoryData.length === 0) return;
        
        const stride = Math.max(1, Math.floor(this.trajectoryData.length / 100));
        const matrix = new THREE.Matrix4();
        
        let instanceIndex = 0;
        for (let i = 0; i < this.trajectoryData.length && instanceIndex < 1000; i += stride) {
            const point = this.trajectoryData[i];
            matrix.setPosition(point.position);
            this.pathPoints.setMatrixAt(instanceIndex, matrix);
            
            // Color based on altitude
            const color = new THREE.Color();
            const altitudeNorm = Math.min(1, point.altitude / 132);
            color.setHSL(0.1 + altitudeNorm * 0.5, 1, 0.5);
            
            if (this.pathPoints.instanceColor) {
                this.pathPoints.instanceColor.setXYZ(
                    instanceIndex,
                    color.r,
                    color.g,
                    color.b
                );
            }
            
            instanceIndex++;
        }
        
        this.pathPoints.count = instanceIndex;
        this.pathPoints.instanceMatrix.needsUpdate = true;
        if (this.pathPoints.instanceColor) {
            this.pathPoints.instanceColor.needsUpdate = true;
        }
    }
    
    updateTrajectoryDisplay(currentTime) {
        if (this.trajectoryData.length < 2) return;
        
        // Find current position in trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime && 
                this.trajectoryData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }
        
        // Update past line
        const pastPositions = [];
        for (let i = 0; i <= currentIndex; i++) {
            const p = this.trajectoryData[i].position;
            pastPositions.push(p.x, p.y, p.z);
        }
        
        const currentData = this.getDataAtTime(currentTime);
        if (currentData?.position) {
            pastPositions.push(
                currentData.position.x,
                currentData.position.y,
                currentData.position.z
            );
            
            // Update marker position
            this.currentPositionMarker.position.copy(currentData.position);
        }
        
        // Update future line
        const futurePositions = [];
        if (currentData?.position) {
            futurePositions.push(
                currentData.position.x,
                currentData.position.y,
                currentData.position.z
            );
        }
        
        for (let i = currentIndex + 1; i < this.trajectoryData.length; i++) {
            const p = this.trajectoryData[i].position;
            futurePositions.push(p.x, p.y, p.z);
        }
        
        // Update geometries efficiently
        if (pastPositions.length >= 6) {
            this.pastLine.geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(pastPositions, 3)
            );
            this.pastLine.geometry.computeBoundingSphere();
        }
        
        if (futurePositions.length >= 6) {
            this.futureLine.geometry.setAttribute(
                'position',
                new THREE.Float32BufferAttribute(futurePositions, 3)
            );
            this.futureLine.geometry.computeBoundingSphere();
            this.futureLine.computeLineDistances();
        }
        
        // Update point visibility based on time
        this.updatePointVisibility(currentTime);
    }
    
    updatePointVisibility(currentTime) {
        if (!this.pathPoints) return;
        
        const fadeDistance = 10; // seconds
        const matrix = new THREE.Matrix4();
        
        for (let i = 0; i < Math.min(this.trajectoryData.length, this.pathPoints.count); i++) {
            const point = this.trajectoryData[i];
            const timeDiff = Math.abs(point.time - currentTime);
            
            // Scale based on time distance
            const scale = Math.max(0.1, 1 - timeDiff / fadeDistance);
            matrix.makeScale(scale, scale, scale);
            matrix.setPosition(point.position);
            
            this.pathPoints.setMatrixAt(i, matrix);
        }
        
        this.pathPoints.instanceMatrix.needsUpdate = true;
    }
    
    getDataAtTime(time) {
        if (this.trajectoryData.length === 0) return null;
        
        time = Math.max(0, Math.min(time, this.totalTime));
        
        let prev = this.trajectoryData[0];
        let next = this.trajectoryData[this.trajectoryData.length - 1];
        
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= time && 
                this.trajectoryData[i + 1].time > time) {
                prev = this.trajectoryData[i];
                next = this.trajectoryData[i + 1];
                break;
            }
        }
        
        const t = (time - prev.time) / (next.time - prev.time || 1);
        
        return {
            time,
            position: prev.position.clone().lerp(next.position, t),
            altitude: THREE.MathUtils.lerp(prev.altitude, next.altitude, t),
            velocity: (prev.velocity instanceof THREE.Vector3 && next.velocity instanceof THREE.Vector3)
                ? prev.velocity.clone().lerp(next.velocity, t)
                : new THREE.Vector3(0, -1, 0),
            velocityMagnitude: THREE.MathUtils.lerp(
                prev.velocityMagnitude,
                next.velocityMagnitude,
                t
            ),
            distanceToLanding: THREE.MathUtils.lerp(
                prev.distanceToLanding,
                next.distanceToLanding,
                t
            )
        };
    }
    
    // Required methods for compatibility
    setTrajectoryData(data) {
        if (Array.isArray(data)) {
            this.trajectoryData = data;
            // Store original data for reset functionality
            if (!this.originalTrajectoryData) {
                this.originalTrajectoryData = data.map(pt => ({...pt, position: pt.position.clone()}));
            }
            this.createOptimizedTrajectory();
            this.updateInstancedPoints();
        }
    }
    
    generateSampleTrajectory() {
        const points = 500;
        const data = [];
        
        for (let i = 0; i < points; i++) {
            const t = (i / points) * this.totalTime;
            const angle = t * 0.02;
            const radius = 50 * (1 - t / this.totalTime);
            
            data.push({
                time: t,
                position: new THREE.Vector3(
                    Math.cos(angle) * radius,
                    30 * (1 - t / this.totalTime),
                    Math.sin(angle) * radius
                ),
                altitude: 132 * (1 - t / this.totalTime),
                velocity: new THREE.Vector3(0, -1, 0),
                velocityMagnitude: 5900 * (1 - t / this.totalTime),
                distanceToLanding: radius * 100
            });
        }
        
        this.setTrajectoryData(data);
    }
    
    getObject3D() {
        return this.group;
    }
    
    getVelocityVector(time) {
        const data = this.getDataAtTime(time);
        return data?.velocity || new THREE.Vector3(0, -1, 0);
    }
    
    getTimeFromPosition(position) {
        let minDist = Infinity;
        let closestTime = 0;
        
        for (const point of this.trajectoryData) {
            const dist = point.position.distanceTo(position);
            if (dist < minDist) {
                minDist = dist;
                closestTime = point.time;
            }
        }
        
        return closestTime;
    }
    
    getTrajectoryLine() {
        return this.trajectoryLine;
    }
    
    updateTrajectoryVisibility(time) {
        const progress = time / this.totalTime;
        
        if (this.pastLine) {
            this.pastLine.material.opacity = 0.9;
        }
        
        if (this.futureLine) {
            this.futureLine.material.opacity = 0.5 * (1 - progress * 0.5);
        }
    }

    /**
     * Starting from the current time, offset the trajectory linearly in the specified direction.
     * 
     * Direction x and y are based on the current velocity/direction of the spacecraft. So x is horizontal relative to 
     * the spacecraft, and y is towards or away from the planet radially.
     * 
     * The current position will not be moved at all in the target direction, but the amount that the 
     * trajectory points are offset is increased linearly from 0% at the current position to finalPercent at the end.
     * 
     * @param {number} currentTime 
     * @param {number} directionX 
     * @param {number} directionY 
     * @param {number} finalPercent
     */
    offsetTrajectoryLinearlyFromCurrentTime(currentTime, directionX, directionY, finalPercent = 0.1) {
        console.log(`Offsetting trajectory: time=${currentTime}, dirX=${directionX}, dirY=${directionY}, finalPercent=${finalPercent}`);
        if (!this.trajectoryData.length) {
            console.log('No trajectory data available');
            return;
        }

        // Find the current index in the trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime && this.trajectoryData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }

        // Get interpolated data at currentTime
        const currentData = this.getDataAtTime(currentTime);
        if (!currentData) return;

        // "Up" is from Mars center to position (radial)
        const up = currentData.position.clone().normalize();

        // Velocity is the direction of motion
        const velocity = currentData.velocity.clone().normalize();

        // "Horizontal" is perpendicular to velocity and up (in local tangent plane)
        // The cross product is in this order due to the right-hand rule.
        // In this order, the horizontal vector points "right", rather than "left" horizontally.
        let horizontal = new THREE.Vector3().crossVectors(velocity, up).normalize();
        if (horizontal.lengthSq() < 1e-8) {
            // If velocity is parallel to up, pick arbitrary perpendicular
            horizontal = new THREE.Vector3(1, 0, 0).cross(up).normalize();
        }

        // Compose the offset direction in world space
        const offsetDir = new THREE.Vector3()
            .addScaledVector(horizontal, directionX)
            .addScaledVector(up, directionY);

        if (offsetDir.lengthSq() < 1e-8) return; // No direction

        offsetDir.normalize();

        // Copy trajectory data and apply offset to positions
        const newData = this.trajectoryData.map((pt, i) => {
            if (i <= currentIndex) {
                return {
                    ...pt,
                    position: pt.position.clone()
                };
            }

            // Linear percent from currentIndex to end
            const percent = (i - currentIndex) / (this.trajectoryData.length - 1 - currentIndex);
            const offsetAmount = finalPercent * percent;

            // Offset is proportional to the distance from current position to this point
            const baseDist = pt.position.distanceTo(currentData.position);
            const offset = offsetDir.clone().multiplyScalar(baseDist * offsetAmount);

            return {
                ...pt,
                position: pt.position.clone().add(offset)
            };
        });

        // Recompute velocity, altitude, velocityMagnitude, distanceToLanding for all points
        for (let i = 0; i < newData.length; i++) {
            const pt = newData[i];
            // Unscale for calculations
            const unscaledPos = pt.position.clone().multiplyScalar(1 / this.SCALE_FACTOR);
            const rawDistance = unscaledPos.length();
            pt.altitude = (rawDistance - this.marsRadius) * 0.001; // km
            pt.distanceToLanding = rawDistance * 0.001; // km

            // Velocity
            if (i > 0) {
                const prevPt = newData[i - 1];
                const dt = pt.time - prevPt.time;
                if (dt > 0) {
                    pt.velocity = pt.position.clone().sub(prevPt.position).divideScalar(dt);
                    pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
                } else {
                    pt.velocity = prevPt.velocity.clone();
                    pt.velocityMagnitude = prevPt.velocityMagnitude;
                }
            } else {
                // First point: keep original or set to zero
                pt.velocity = pt.velocity ? pt.velocity.clone() : new THREE.Vector3(0, -1, 0);
                pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
            }
        }

        this.setTrajectoryData(newData);
    }

    /**
     * Apply physics-based trajectory modification using lift force from bank angle
     * @param {number} currentTime - Current simulation time
     * @param {THREE.Vector3} liftForceDirection - Direction of lift force in 3D space
     * @param {number} bankAngle - Current bank angle in degrees
     */
    offsetTrajectoryWithPhysics(currentTime, liftForceDirection, bankAngle) {
        if (!this.trajectoryData.length || !liftForceDirection) return;

        // Find the current index in the trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime && this.trajectoryData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }

        // Get interpolated data at currentTime
        const currentData = this.getDataAtTime(currentTime);
        if (!currentData) return;

        // Copy trajectory data and apply physics-based offset
        const newData = this.trajectoryData.map((pt, i) => {
            if (i <= currentIndex) {
                return {
                    ...pt,
                    position: pt.position.clone()
                };
            }

            // Time factor for cumulative effect
            const timeDelta = pt.time - currentTime;
            const timeWeight = Math.min(1.0, timeDelta / 60.0); // Effect builds over 60 seconds

            // Atmospheric effect - stronger in denser atmosphere
            const altitudeFactor = Math.exp(-Math.max(0, pt.altitude) / 11.1); // Mars scale height

            // Velocity-dependent effect - stronger at higher speeds
            const velocityFactor = Math.min(1.0, pt.velocityMagnitude / 5000); // Normalize to entry speed

            // Bank angle effect magnitude
            const bankAngleFactor = Math.sin(THREE.MathUtils.degToRad(Math.abs(bankAngle))) * 2.0;

            // Combined effect magnitude
            const effectMagnitude = timeWeight * altitudeFactor * velocityFactor * bankAngleFactor * 0.01;

            // Apply cumulative lateral displacement
            const displacement = liftForceDirection.clone().multiplyScalar(effectMagnitude);

            return {
                ...pt,
                position: pt.position.clone().add(displacement)
            };
        });

        // Recompute derived properties for modified trajectory
        for (let i = 0; i < newData.length; i++) {
            const pt = newData[i];

            // Recalculate altitude and distance
            const unscaledPos = pt.position.clone().multiplyScalar(1 / this.SCALE_FACTOR);
            const rawDistance = unscaledPos.length();
            pt.altitude = (rawDistance - this.marsRadius) * 0.001; // km
            pt.distanceToLanding = rawDistance * 0.001; // km

            // Recalculate velocity based on new positions
            if (i > 0) {
                const prevPt = newData[i - 1];
                const dt = pt.time - prevPt.time;
                if (dt > 0) {
                    pt.velocity = pt.position.clone().sub(prevPt.position).divideScalar(dt);
                    pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
                } else {
                    pt.velocity = prevPt.velocity.clone();
                    pt.velocityMagnitude = prevPt.velocityMagnitude;
                }
            } else {
                // First point: preserve original velocity
                pt.velocity = pt.velocity ? pt.velocity.clone() : new THREE.Vector3(0, -1, 0);
                pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
            }
        }

        this.setTrajectoryData(newData);
    }

    /**
     * Real-time physics-based trajectory modification with immediate visual feedback
     * @param {number} currentTime - Current simulation time
     * @param {THREE.Vector3} liftForceDirection - Direction of lift force in 3D space
     * @param {number} bankAngle - Current bank angle in degrees
     */
    offsetTrajectoryWithPhysicsRealTime(currentTime, liftForceDirection, bankAngle) {
        if (!this.trajectoryData.length || !liftForceDirection) {
            return;
        }

        // Find the current index in the trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime && this.trajectoryData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }

        // Get interpolated data at currentTime
        const currentData = this.getDataAtTime(currentTime);
        if (!currentData) return;

        // Enhanced real-time modification with immediate effect
        const newData = this.trajectoryData.map((pt, i) => {
            if (i <= currentIndex) {
                return {
                    ...pt,
                    position: pt.position.clone()
                };
            }

            // Immediate strong effect for real-time feedback
            const timeDelta = pt.time - currentTime;
            const timeWeight = Math.min(1.0, timeDelta / 30.0); // Faster effect build-up

            // Enhanced atmospheric effect
            const altitudeFactor = Math.exp(-Math.max(0, pt.altitude) / 11.1);

            // Enhanced velocity effect
            const velocityFactor = Math.min(1.0, pt.velocityMagnitude / 4000);

            // Stronger bank angle effect for immediate visibility
            const bankAngleFactor = Math.sin(THREE.MathUtils.degToRad(Math.abs(bankAngle))) * 5.0;

            // Enhanced effect magnitude for real-time response
            const effectMagnitude = timeWeight * altitudeFactor * velocityFactor * bankAngleFactor * 0.03;

            // Apply enhanced lateral displacement
            const displacement = liftForceDirection.clone().multiplyScalar(effectMagnitude);

            return {
                ...pt,
                position: pt.position.clone().add(displacement)
            };
        });

        // Recompute derived properties
        for (let i = 0; i < newData.length; i++) {
            const pt = newData[i];

            // Recalculate altitude and distance
            const unscaledPos = pt.position.clone().multiplyScalar(1 / this.SCALE_FACTOR);
            const rawDistance = unscaledPos.length();
            pt.altitude = (rawDistance - this.marsRadius) * 0.001;
            pt.distanceToLanding = rawDistance * 0.001;

            // Recalculate velocity
            if (i > 0) {
                const prevPt = newData[i - 1];
                const dt = pt.time - prevPt.time;
                if (dt > 0) {
                    pt.velocity = pt.position.clone().sub(prevPt.position).divideScalar(dt);
                    pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
                } else {
                    pt.velocity = prevPt.velocity.clone();
                    pt.velocityMagnitude = prevPt.velocityMagnitude;
                }
            } else {
                pt.velocity = pt.velocity ? pt.velocity.clone() : new THREE.Vector3(0, -1, 0);
                pt.velocityMagnitude = pt.velocity.length() / this.SCALE_FACTOR;
            }
        }

        this.setTrajectoryData(newData);

        // Force immediate visual update
        this.updateTrajectoryDisplay(currentTime);
    }

    resetTrajectory() {
        // Reset to original trajectory data if available
        if (this.originalTrajectoryData) {
            this.setTrajectoryData(this.originalTrajectoryData.slice());
        } else {
            // Generate sample trajectory if no original data
            this.generateSampleTrajectory();
        }
        
        // Reset trajectory display
        this.updateTrajectoryDisplay(0);
        this.updateTrajectoryVisibility(0);
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}