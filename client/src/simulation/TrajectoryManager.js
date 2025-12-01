import * as THREE from 'three';

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

        // Reference trajectory
        this.referenceTrajectoryLine = null;
        this.referenceTrajectoryData = [];

        // Performance optimizations
        this.useInstancing = true;
        this.useLOD = true;

        // Backend integration removed - now handled by TrajectoryService in SimulationManager

        this.init();
    }
    
    init() {
        this.createTrajectoryVisualization();
        this.createPositionMarker();
    }
    
    createTrajectoryVisualization() {
        // Use BufferGeometry for better performance
        this.pathGeometry = new THREE.BufferGeometry();

        // Materials with increased visibility - thicker, more opaque lines
        this.pastMaterial = new THREE.LineBasicMaterial({
            color: 0xaaaaaa,  // Light gray for traveled path - more visible
            linewidth: 3,     // Thicker line
            opacity: 0.9,     // More opaque
            transparent: true
        });

        this.futureMaterial = new THREE.LineDashedMaterial({
            color: 0xff3333,  // Bright red for future path - more visible
            linewidth: 3,     // Thicker line
            opacity: 0.9,     // More opaque
            transparent: true,
            dashSize: 3,      // Larger dashes for visibility
            gapSize: 1.5,     // Slightly larger gaps
            scale: 1
        });

        // Pre-allocate buffer attributes for performance
        const maxPoints = 2000;
        this.pastPositionBuffer = new Float32Array(maxPoints * 3);
        this.futurePositionBuffer = new Float32Array(maxPoints * 3);

        // Create separate lines for past and future with pre-allocated buffers
        const pastGeometry = new THREE.BufferGeometry();
        pastGeometry.setAttribute('position', new THREE.BufferAttribute(this.pastPositionBuffer, 3));
        pastGeometry.setDrawRange(0, 0); // Start with no points drawn

        const futureGeometry = new THREE.BufferGeometry();
        futureGeometry.setAttribute('position', new THREE.BufferAttribute(this.futurePositionBuffer, 3));
        futureGeometry.setDrawRange(0, 0); // Start with no points drawn

        this.pastLine = new THREE.Line(pastGeometry, this.pastMaterial);
        this.pastLine.frustumCulled = true; // Enable frustum culling for performance

        this.futureLine = new THREE.Line(futureGeometry, this.futureMaterial);
        this.futureLine.frustumCulled = true; // Enable frustum culling for performance

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
            color: 0x00ffff,
            transparent: true,
            opacity: 0.0  // Make points invisible - user requested removal
        });

        // Use InstancedMesh for performance
        const maxPoints = 1000;
        this.pathPoints = new THREE.InstancedMesh(
            pointGeometry,
            pointMaterial,
            maxPoints
        );

        // Make invisible by default - user requested removal of markers
        this.pathPoints.visible = false;

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

    setReferenceTrajectory(trajectoryData) {
        this.referenceTrajectoryData = trajectoryData;
        this.createReferenceTrajectory();
    }
    
    setReferenceTrajectoryFromCSV(rows) {
        this.referenceTrajectoryData = [];
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
                    const prevTime = this.referenceTrajectoryData[this.referenceTrajectoryData.length - 1].time;
                    const dt = time - prevTime;
                    if (dt > 0) {
                        velocityVector = position.clone().sub(prevPosition).divideScalar(dt);
                        velocityMagnitude = velocityVector.length() / this.SCALE_FACTOR;
                    }
                }
                
                this.referenceTrajectoryData.push({
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
        
        this.createReferenceTrajectory();
    }

    createReferenceTrajectory() {
        if (this.referenceTrajectoryData.length < 2) return;

        if (this.referenceTrajectoryLine) {
            this.group.remove(this.referenceTrajectoryLine);
            if (this.referenceTrajectoryLine.geometry) this.referenceTrajectoryLine.geometry.dispose();
            if (this.referenceTrajectoryLine.material) this.referenceTrajectoryLine.material.dispose();
            this.referenceTrajectoryLine = null;
        }

        const positions = new Float32Array(this.referenceTrajectoryData.length * 3);

        for (let i = 0; i < this.referenceTrajectoryData.length; i++) {
            const point = this.referenceTrajectoryData[i];
            positions[i * 3] = point.position.x;
            positions[i * 3 + 1] = point.position.y;
            positions[i * 3 + 2] = point.position.z;
        }

        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );
        newGeometry.computeBoundingSphere();

        this.referenceTrajectoryLine = new THREE.Line(
            newGeometry,
            new THREE.LineBasicMaterial({
                color: 0x00ff00,  // Green for reference
                opacity: 0.3,     // Lower opacity
                transparent: true,
                linewidth: 10
            })
        );
        
        this.referenceTrajectoryLine.visible = false; // Hidden by default
        this.group.add(this.referenceTrajectoryLine);
    }

    toggleReferenceTrajectory(visible) {
        if (this.referenceTrajectoryLine) {
            this.referenceTrajectoryLine.visible = visible;
        } else {
            console.warn('[TrajectoryManager] Cannot toggle reference trajectory: line does not exist');
        }
    }

    createOptimizedTrajectory() {
        if (this.trajectoryData.length < 2) return;

        // CRITICAL: Remove old trajectory line before creating new one
        if (this.trajectoryLine) {
            this.group.remove(this.trajectoryLine);
            // Dispose of geometry and material to prevent memory leaks
            if (this.trajectoryLine.geometry) {
                this.trajectoryLine.geometry.dispose();
            }
            if (this.trajectoryLine.material) {
                this.trajectoryLine.material.dispose();
            }
            this.trajectoryLine = null;
        }

        // CRITICAL: Hide past/future lines to prevent multiple trajectory display
        // When trajectory is modified (e.g., bank angle change), we show the full new trajectory
        // and hide the old past/future line system to avoid overlapping visualizations
        if (this.pastLine) {
            this.pastLine.visible = false;
        }
        if (this.futureLine) {
            this.futureLine.visible = false;
        }

        // Create Float32Array for positions (more efficient)
        const positions = new Float32Array(this.trajectoryData.length * 3);

        for (let i = 0; i < this.trajectoryData.length; i++) {
            const point = this.trajectoryData[i];
            positions[i * 3] = point.position.x;
            positions[i * 3 + 1] = point.position.y;
            positions[i * 3 + 2] = point.position.z;
        }

        // Create new geometry for updated trajectory
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute(
            'position',
            new THREE.BufferAttribute(positions, 3)
        );

        // Compute bounding sphere for frustum culling
        newGeometry.computeBoundingSphere();

        // Create full trajectory line - more visible
        this.trajectoryLine = new THREE.Line(
            newGeometry,
            new THREE.LineBasicMaterial({
                color: 0xffffff,  // White for full path
                opacity: 0.4,     // More visible
                transparent: true,
                linewidth: 2      // Thicker for visibility
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

        // CRITICAL: Switch to past/future line visualization during normal playback
        // Hide the white optimized trajectory line and show the dynamic past/future lines
        if (this.trajectoryLine) {
            this.trajectoryLine.visible = false;
        }
        if (this.pastLine) {
            this.pastLine.visible = true;
        }
        if (this.futureLine) {
            this.futureLine.visible = true;
        }

        // Find current position in trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime &&
                this.trajectoryData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }

        // Update past line using pre-allocated buffer
        let pastPointCount = 0;
        for (let i = 0; i <= currentIndex && pastPointCount * 3 < this.pastPositionBuffer.length - 3; i++) {
            const p = this.trajectoryData[i].position;
            this.pastPositionBuffer[pastPointCount * 3] = p.x;
            this.pastPositionBuffer[pastPointCount * 3 + 1] = p.y;
            this.pastPositionBuffer[pastPointCount * 3 + 2] = p.z;
            pastPointCount++;
        }

        const currentData = this.getDataAtTime(currentTime);
        if (currentData?.position) {
            if (pastPointCount * 3 < this.pastPositionBuffer.length - 3) {
                this.pastPositionBuffer[pastPointCount * 3] = currentData.position.x;
                this.pastPositionBuffer[pastPointCount * 3 + 1] = currentData.position.y;
                this.pastPositionBuffer[pastPointCount * 3 + 2] = currentData.position.z;
                pastPointCount++;
            }

            // Update marker position
            this.currentPositionMarker.position.copy(currentData.position);
        }

        // Update future line using pre-allocated buffer
        let futurePointCount = 0;
        if (currentData?.position && futurePointCount * 3 < this.futurePositionBuffer.length - 3) {
            this.futurePositionBuffer[futurePointCount * 3] = currentData.position.x;
            this.futurePositionBuffer[futurePointCount * 3 + 1] = currentData.position.y;
            this.futurePositionBuffer[futurePointCount * 3 + 2] = currentData.position.z;
            futurePointCount++;
        }

        for (let i = currentIndex + 1; i < this.trajectoryData.length && futurePointCount * 3 < this.futurePositionBuffer.length - 3; i++) {
            const p = this.trajectoryData[i].position;
            this.futurePositionBuffer[futurePointCount * 3] = p.x;
            this.futurePositionBuffer[futurePointCount * 3 + 1] = p.y;
            this.futurePositionBuffer[futurePointCount * 3 + 2] = p.z;
            futurePointCount++;
        }

        // Update geometries efficiently - just update draw range and mark for update
        if (pastPointCount > 1) {
            const pastPositionAttr = this.pastLine.geometry.getAttribute('position');
            pastPositionAttr.needsUpdate = true;
            this.pastLine.geometry.setDrawRange(0, pastPointCount);
            this.pastLine.geometry.computeBoundingSphere();
        }

        if (futurePointCount > 1) {
            const futurePositionAttr = this.futureLine.geometry.getAttribute('position');
            futurePositionAttr.needsUpdate = true;
            this.futureLine.geometry.setDrawRange(0, futurePointCount);
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

    /**
     * Replace trajectory from current time onwards (preserves past trajectory)
     * Used when bank angle changes - only future path is recalculated
     * @param {number} currentTime - Current simulation time
     * @param {Array} futureTrajectoryData - New trajectory data from current time onwards
     */
    spliceTrajectoryFromTime(currentTime, futureTrajectoryData) {
        if (!Array.isArray(futureTrajectoryData) || futureTrajectoryData.length === 0) {
            console.error('[TrajectoryManager] Invalid future trajectory data');
            return;
        }

        // Find index of current time in existing trajectory
        let spliceIndex = 0;
        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= currentTime && this.trajectoryData[i + 1].time > currentTime) {
                spliceIndex = i + 1;  // Replace from next point onwards
                break;
            }
        }

        console.log(`[TrajectoryManager] Splicing trajectory at t=${currentTime.toFixed(2)}s (index ${spliceIndex})`);
        console.log(`[TrajectoryManager] Keeping past ${spliceIndex} points, replacing with ${futureTrajectoryData.length} new points`);

        // Keep past trajectory points up to current time
        const pastTrajectory = this.trajectoryData.slice(0, spliceIndex);

        // Combine past with new future trajectory
        this.trajectoryData = [...pastTrajectory, ...futureTrajectoryData];

        // Update total time
        if (this.trajectoryData.length > 0) {
            this.totalTime = this.trajectoryData[this.trajectoryData.length - 1].time;
        }

        console.log(`[TrajectoryManager] New trajectory: ${this.trajectoryData.length} total points, duration ${this.totalTime.toFixed(2)}s`);

        // Rebuild visualization
        this.createOptimizedTrajectory();
        this.updateInstancedPoints();
    }

    /**
     * Reset trajectory to original data
     * Used when rerunning simulation
     */
    resetToOriginal() {
        if (this.originalTrajectoryData) {
            console.log('[TrajectoryManager] Resetting to original trajectory');
            // Deep copy the original data
            this.trajectoryData = this.originalTrajectoryData.map(pt => ({
                ...pt,
                position: pt.position.clone()
            }));
            // Rebuild visualization
            this.createOptimizedTrajectory();
            this.updateInstancedPoints();
        } else {
            console.warn('[TrajectoryManager] No original trajectory data to reset to');
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
        // Logging removed for production use
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

        // Store this in the offset history if it's newer than the last entry
        if (currentData.time > (this.offsetHistory.length ? this.offsetHistory[this.offsetHistory.length - 1].time : -Infinity)) {
            this.offsetHistory.push({ time: currentData.time, x: currentData.position.x, y: currentData.position.y, z: currentData.position.z });
        }

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
     * Now tries backend first, falls back to local calculation
     * @param {number} currentTime - Current simulation time
     * @param {THREE.Vector3} liftForceDirection - Direction of lift force in 3D space
     * @param {number} bankAngle - Current bank angle in degrees
     */
    async offsetTrajectoryWithPhysicsRealTime(currentTime, liftForceDirection, bankAngle) {
        // REMOVED: Backend integration - now handled by TrajectoryService in SimulationManager
        // This method is no longer used - keeping for backwards compatibility
        console.warn('[TrajectoryManager] offsetTrajectoryWithPhysicsRealTime is deprecated and has no effect');
        console.warn('[TrajectoryManager] All trajectory modifications are now handled by TrajectoryService');
        return;
    }

    /**
     * Local real-time physics-based trajectory modification
     * Original implementation
     * @param {number} currentTime - Current simulation time
     * @param {THREE.Vector3} liftForceDirection - Direction of lift force in 3D space
     * @param {number} bankAngle - Current bank angle in degrees
     */
    offsetTrajectoryWithPhysicsRealTimeLocal(currentTime, liftForceDirection, bankAngle) {
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

    
    /**
     * REMOVED: setBackendPreference, getBackendStatus, checkBackendAvailability
     * Backend integration now handled by TrajectoryService in SimulationManager
     */

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
        // No backend API to dispose
    }
}