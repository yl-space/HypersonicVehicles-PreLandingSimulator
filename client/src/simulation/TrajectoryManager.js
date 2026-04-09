import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

export class TrajectoryManager {
    constructor() {
        this.trajectoryData = [];
        this.totalTime = 260;
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

        // Line2 material resolution (pixels)
        this.lineResolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

        // Track last trajectory index to avoid per-frame geometry rebuilds
        this._lastTrajectoryIndex = -1;
        this._fullTrajectoryMode = false;
        // RTC origin for Float32 precision (set in setTrajectoryData)
        this._rtcOrigin = new THREE.Vector3();

        this.init();
    }
    
    init() {
        this.createTrajectoryVisualization();
        this.createPositionMarker();
        this.updateLineResolution();
        window.addEventListener('resize', () => this.updateLineResolution());
    }
    
    createTrajectoryVisualization() {
        // Use BufferGeometry for better performance
        this.pathGeometry = new THREE.BufferGeometry();

        // Materials with increased visibility (Line2 uses screen-space widths)
        this.pastMaterial = new LineMaterial({
            color: 0xffffff,  // Bright white for traveled path
            linewidth: 3.5,   // pixels (wider for visual stability)
            opacity: 0.95,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });

        this.futureMaterial = new LineMaterial({
            color: 0x6b1e1e,  // Maroon for future path
            linewidth: 3.0,   // pixels (wider for visual stability)
            opacity: 0.85,
            transparent: true,
            dashed: true,
            dashSize: 0.02,
            gapSize: 0.01,
            depthTest: true,
            depthWrite: false,
            toneMapped: false
        });

        // Pre-allocate buffer attributes for performance
        const maxPoints = 2000;
        this.pastPositionBuffer = new Float32Array(maxPoints * 3);
        this.futurePositionBuffer = new Float32Array(maxPoints * 3);

        // Create separate lines for past and future with Line2 geometry
        const pastGeometry = new LineGeometry();
        pastGeometry.setPositions([0, 0, 0, 0, 0, 0]);

        const futureGeometry = new LineGeometry();
        futureGeometry.setPositions([0, 0, 0, 0, 0, 0]);

        this.pastLine = new Line2(pastGeometry, this.pastMaterial);
        this.pastLine.computeLineDistances();
        this.pastLine.frustumCulled = false;
        this.pastLine.renderOrder = 20;

        this.futureLine = new Line2(futureGeometry, this.futureMaterial);
        this.futureLine.computeLineDistances();
        this.futureLine.frustumCulled = false;
        this.futureLine.renderOrder = 20;

        this.group.add(this.pastLine);
        this.group.add(this.futureLine);

        // Create instanced mesh for trajectory points
        if (this.useInstancing) {
            this.createInstancedPathPoints();
        }
    }
    
    createInstancedPathPoints() {
        // Geometry for each point - minimal detail for performance
        const pointGeometry = new THREE.SphereGeometry(0.00005, 4, 2);
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
        // Position marker — visible in trajectory mode as a bright dot at spacecraft location
        const markerGeometry = new THREE.SphereGeometry(0.02, 12, 12);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.0,
            depthTest: false,
        });

        this.currentPositionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.currentPositionMarker.renderOrder = 25;
        this.currentPositionMarker.castShadow = false;
        this.currentPositionMarker.visible = false;

        this.group.add(this.currentPositionMarker);
    }
    
    setTrajectoryFromCSV(rows) {
        this.trajectoryData = [];
        let prevPosition = null;
        const lastRow = rows?.length ? rows[rows.length - 1] : null;
        const csvTotalTime = lastRow ? parseFloat(lastRow.Time || lastRow.time || this.totalTime) : this.totalTime;
        if (Number.isFinite(csvTotalTime) && csvTotalTime > 0) {
            this.totalTime = csvTotalTime;
        }
        
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
    
    setReferenceTrajectoryFromCSV(rows, convertMSL = true) {
        this.referenceTrajectoryData = [];
        let prevPosition = null;
        
        // First pass: get landing site position (last point in trajectory)
        // CSV data is in Z-up (IAU_MARS) convention; rawDistance uses original coords.
        const lastRow = rows[rows.length - 1];
        const landingX = convertMSL ? -parseFloat(lastRow.x || 0) : parseFloat(lastRow.x || 0);
        const landingY = convertMSL ? -parseFloat(lastRow.y || 0) : parseFloat(lastRow.y || 0);
        const landingZ = parseFloat(lastRow.z || 0);
        const landingSite = new THREE.Vector3(landingX, landingY, landingZ);

        // Process CSV data
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const time = parseFloat(row.Time || row.time || 0);
            const x = convertMSL ? -parseFloat(row.x || 0) : parseFloat(row.x || 0);
            const y = convertMSL ? -parseFloat(row.y || 0) : parseFloat(row.y || 0);
            const z = parseFloat(row.z || 0);

            if (!isNaN(time) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                const currentPos = new THREE.Vector3(x, y, z);
                const rawDistance = Math.sqrt(x * x + y * y + z * z);
                const altitude = rawDistance - this.marsRadius;

                // Swap Y↔Z: CSV Z-up (IAU_MARS) → scene Y-up (Three.js tiles)
                const position = new THREE.Vector3(
                    x * this.SCALE_FACTOR,
                    z * this.SCALE_FACTOR,   // CSV z (pole) → scene y
                    y * this.SCALE_FACTOR    // CSV y (equatorial) → scene z
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
                
                // Calculate distance to landing site (in meters, then convert to km)
                const distanceToLanding = currentPos.distanceTo(landingSite) * 0.001;
                
                this.referenceTrajectoryData.push({
                    time,
                    position,
                    altitude: altitude * 0.001, // km
                    velocity: velocityVector.clone(), // Ensure it's a Vector3
                    velocityMagnitude,
                    distanceToLanding // km
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

        // RTC coordinates for reference trajectory too
        const ox = this._rtcOrigin?.x || 0;
        const oy = this._rtcOrigin?.y || 0;
        const oz = this._rtcOrigin?.z || 0;
        const positions = new Float32Array(this.referenceTrajectoryData.length * 3);

        for (let i = 0; i < this.referenceTrajectoryData.length; i++) {
            const point = this.referenceTrajectoryData[i];
            positions[i * 3] = point.position.x - ox;
            positions[i * 3 + 1] = point.position.y - oy;
            positions[i * 3 + 2] = point.position.z - oz;
        }

        const newGeometry = new LineGeometry();
        newGeometry.setPositions(positions);

        this.referenceTrajectoryLine = new Line2(
            newGeometry,
            new LineMaterial({
                color: 0x00ff00,
                opacity: 0.5,
                transparent: true,
                linewidth: 2.0,
                depthTest: true,
                depthWrite: false,
                toneMapped: false
            })
        );
        this.referenceTrajectoryLine.computeLineDistances();
        this.referenceTrajectoryLine.frustumCulled = false;
        this.referenceTrajectoryLine.renderOrder = 20;
        this.referenceTrajectoryLine.position.set(ox, oy, oz);
        this.updateLineResolution();

        this.referenceTrajectoryLine.visible = false;
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

        // RTC (Relative-To-Center): subtract midpoint so Float32 values stay near zero.
        // Then position the Line2 mesh at the RTC origin in world space.
        const ox = this._rtcOrigin?.x || 0;
        const oy = this._rtcOrigin?.y || 0;
        const oz = this._rtcOrigin?.z || 0;
        const positions = new Float32Array(this.trajectoryData.length * 3);

        for (let i = 0; i < this.trajectoryData.length; i++) {
            const point = this.trajectoryData[i];
            positions[i * 3] = point.position.x - ox;
            positions[i * 3 + 1] = point.position.y - oy;
            positions[i * 3 + 2] = point.position.z - oz;
        }

        // Create new geometry for updated trajectory
        const newGeometry = new LineGeometry();
        newGeometry.setPositions(positions);

        // Create full trajectory line - more visible
        this.trajectoryLine = new Line2(
            newGeometry,
            new LineMaterial({
                color: 0x6b1e1e,  // Maroon for full path
                opacity: 0.55,    // More visible
                transparent: true,
                linewidth: 3.0,   // pixels (wider for visual stability)
                depthTest: true,
                depthWrite: false,
                toneMapped: false
            })
        );
        this.trajectoryLine.computeLineDistances();
        this.trajectoryLine.frustumCulled = false;
        this.trajectoryLine.renderOrder = 20;
        // Position at RTC origin so world-space coordinates are correct
        this.trajectoryLine.position.set(ox, oy, oz);
        this.updateLineResolution();

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
    
    /**
     * @param {number} currentTime
     * @param {THREE.Vector3} [cameraPosition] - camera world position for
     *   camera-relative RTC.  When supplied the dynamic past/future lines store
     *   vertices relative to the camera instead of the trajectory midpoint,
     *   maximising Float32 precision near the viewpoint.
     */
    updateTrajectoryDisplay(currentTime, cameraPosition) {
        if (this.trajectoryData.length < 2) return;

        // When full trajectory is shown (trajectory camera mode), only update the
        // position marker — do NOT touch line visibility or geometry. The static
        // trajectoryLine handles display; touching past/future lines causes drift
        // and jiggle because setPositions() is called every frame.
        if (this._fullTrajectoryMode) {
            // Only update the marker position
            const currentData = this.getDataAtTime(currentTime);
            if (currentData?.position && this.currentPositionMarker) {
                this.currentPositionMarker.position.copy(currentData.position);
            }
            return; // Skip all dynamic line updates
        }

        // Normal mode: switch to past/future line visualization
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

        const currentData = this.getDataAtTime(currentTime);

        // Update marker position every frame (smooth movement)
        if (currentData?.position && this.currentPositionMarker) {
            this.currentPositionMarker.position.copy(currentData.position);
        }

        // ONLY rebuild line geometry when currentIndex changes (spacecraft crosses
        // to next data point). This prevents per-frame setPositions() calls that
        // cause visible jiggle from Float32Array buffer rebuilds + GPU re-uploads.
        if (currentIndex === this._lastTrajectoryIndex) return;
        this._lastTrajectoryIndex = currentIndex;

        // Camera-relative RTC: when a camera position is available, use it as
        // the RTC origin for dynamic lines.  Vertex coordinates stay near zero
        // (best Float32 precision) exactly where the camera is looking, which
        // eliminates the jiggle caused by subtracting two large ~34-unit values
        // in the GPU model-view-projection matrix.
        // Falls back to the trajectory-midpoint RTC if no camera position given.
        const ox = cameraPosition?.x ?? this._rtcOrigin?.x ?? 0;
        const oy = cameraPosition?.y ?? this._rtcOrigin?.y ?? 0;
        const oz = cameraPosition?.z ?? this._rtcOrigin?.z ?? 0;
        if (this.pastLine) this.pastLine.position.set(ox, oy, oz);
        if (this.futureLine) this.futureLine.position.set(ox, oy, oz);

        // Past line: data points 0..currentIndex in RTC coords
        let pastPointCount = 0;
        for (let i = 0; i <= currentIndex && pastPointCount * 3 < this.pastPositionBuffer.length - 3; i++) {
            const p = this.trajectoryData[i].position;
            this.pastPositionBuffer[pastPointCount * 3] = p.x - ox;
            this.pastPositionBuffer[pastPointCount * 3 + 1] = p.y - oy;
            this.pastPositionBuffer[pastPointCount * 3 + 2] = p.z - oz;
            pastPointCount++;
        }

        // Future line: data points currentIndex..end in RTC coords
        let futurePointCount = 0;
        for (let i = currentIndex; i < this.trajectoryData.length && futurePointCount * 3 < this.futurePositionBuffer.length - 3; i++) {
            const p = this.trajectoryData[i].position;
            this.futurePositionBuffer[futurePointCount * 3] = p.x - ox;
            this.futurePositionBuffer[futurePointCount * 3 + 1] = p.y - oy;
            this.futurePositionBuffer[futurePointCount * 3 + 2] = p.z - oz;
            futurePointCount++;
        }

        // Rebuild geometries only on index change
        if (pastPointCount > 1) {
            this.pastLine.geometry.setPositions(this.pastPositionBuffer.subarray(0, pastPointCount * 3));
            // No computeLineDistances() for solid line — not needed and avoids
            // unnecessary GPU work.
            this.pastLine.visible = true;
        } else if (this.pastLine) {
            this.pastLine.visible = false;
        }

        if (futurePointCount > 1) {
            this.futureLine.geometry.setPositions(this.futurePositionBuffer.subarray(0, futurePointCount * 3));
            this.futureLine.computeLineDistances();
            this.futureLine.visible = true;
        } else if (this.futureLine) {
            this.futureLine.visible = false;
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
    
    getReferenceDataAtTime(time) {
        if (this.referenceTrajectoryData.length === 0) return null;
        
        // Find total time from reference data
        const refTotalTime = this.referenceTrajectoryData[this.referenceTrajectoryData.length - 1].time;
        time = Math.max(0, Math.min(time, refTotalTime));
        
        let prev = this.referenceTrajectoryData[0];
        let next = this.referenceTrajectoryData[this.referenceTrajectoryData.length - 1];
        
        for (let i = 0; i < this.referenceTrajectoryData.length - 1; i++) {
            if (this.referenceTrajectoryData[i].time <= time && 
                this.referenceTrajectoryData[i + 1].time > time) {
                prev = this.referenceTrajectoryData[i];
                next = this.referenceTrajectoryData[i + 1];
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
            if (data.length > 0) {
                let maxTime = 0;
                for (const point of data) {
                    if (Number.isFinite(point?.time) && point.time > maxTime) {
                        maxTime = point.time;
                    }
                }
                if (maxTime > 0) {
                    this.totalTime = maxTime;
                }

                // Compute RTC (Relative-To-Center) origin for Float32 precision.
                // Trajectory points are ~34 units from world origin (Mars surface).
                // Float32 at 34 units gives ~4 decimal digits — insufficient for
                // sub-meter rendering precision. Subtracting the midpoint keeps
                // vertex values near zero, giving full Float32 mantissa precision.
                const mid = data[Math.floor(data.length / 2)].position;
                this._rtcOrigin = new THREE.Vector3(mid.x, mid.y, mid.z);
            }
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

        // Update RTC origin to new trajectory midpoint for optimal Float32 precision
        if (this.trajectoryData.length > 0) {
            const mid = this.trajectoryData[Math.floor(this.trajectoryData.length / 2)].position;
            this._rtcOrigin = new THREE.Vector3(mid.x, mid.y, mid.z);
        }

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
            if (this.trajectoryData.length > 0) {
                const lastTime = this.trajectoryData[this.trajectoryData.length - 1].time;
                if (Number.isFinite(lastTime) && lastTime > 0) {
                    this.totalTime = lastTime;
                }
                // Restore RTC origin to original trajectory midpoint
                const mid = this.trajectoryData[Math.floor(this.trajectoryData.length / 2)].position;
                this._rtcOrigin = new THREE.Vector3(mid.x, mid.y, mid.z);
            }
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

    /**
     * Return all trajectory positions as THREE.Vector3 array for external use
     * (e.g., computing trajectory-view camera framing).
     * @returns {THREE.Vector3[]}
     */
    getAllTrajectoryPositions() {
        if (!this.trajectoryData || this.trajectoryData.length === 0) return [];
        return this.trajectoryData
            .filter(p => p.position)
            .map(p => p.position.clone());
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
     * Switch between dynamic past/future lines and the full static trajectory.
     * In trajectory camera mode, show the complete path so it doesn't appear
     * to drift as past/future segments change.
     * @param {boolean} showFull - true = show full static line, false = dynamic
     */
    setFullTrajectoryVisible(showFull) {
        this._fullTrajectoryMode = showFull;
        if (showFull) {
            // Ensure the full trajectory line exists
            if (!this.trajectoryLine && this.trajectoryData.length > 1) {
                this.createOptimizedTrajectory();
            }
            if (this.trajectoryLine) {
                this.trajectoryLine.visible = true;
                this.trajectoryLine.material.opacity = 0.8;
            }
            // Hide dynamic past/future to avoid overlap
            if (this.pastLine) this.pastLine.visible = false;
            if (this.futureLine) this.futureLine.visible = false;
            // Show position marker as bright dot (spacecraft is sub-pixel at this distance)
            if (this.currentPositionMarker) {
                this.currentPositionMarker.visible = true;
                this.currentPositionMarker.material.opacity = 1.0;
            }
        } else {
            // Hide full static line, show dynamic
            if (this.trajectoryLine) this.trajectoryLine.visible = false;
            if (this.pastLine) this.pastLine.visible = true;
            if (this.futureLine) this.futureLine.visible = true;
            // Hide position marker in follow/orbit modes
            if (this.currentPositionMarker) {
                this.currentPositionMarker.visible = false;
                this.currentPositionMarker.material.opacity = 0;
            }
        }
    }

    /**
     * Diagnostic: verify that the static trajectoryLine and dynamic
     * pastLine+futureLine reference the same data and RTC origin.
     * Call from browser console: simManager.trajectoryManager.verifyTrajectoryConsistency()
     */
    verifyTrajectoryConsistency() {
        const results = {
            dataPoints: this.trajectoryData.length,
            rtcOrigin: this._rtcOrigin?.toArray(),
            fullTrajectoryMode: this._fullTrajectoryMode,
        };

        // Compare first and last points of trajectoryData
        if (this.trajectoryData.length > 0) {
            const first = this.trajectoryData[0];
            const last = this.trajectoryData[this.trajectoryData.length - 1];
            results.firstPoint = { time: first.time, pos: first.position.toArray() };
            results.lastPoint  = { time: last.time,  pos: last.position.toArray() };
        }

        // Check trajectoryLine (static) world-space endpoints
        if (this.trajectoryLine?.geometry) {
            const posAttr = this.trajectoryLine.geometry.getAttribute('instanceStart');
            if (posAttr && posAttr.count > 0) {
                const mPos = this.trajectoryLine.position;
                results.staticLine = {
                    meshPosition: mPos.toArray(),
                    firstVertex: [posAttr.getX(0) + mPos.x, posAttr.getY(0) + mPos.y, posAttr.getZ(0) + mPos.z],
                };
            }
        }

        // Check pastLine + futureLine world-space overlap at current index
        if (this.pastLine?.geometry && this.futureLine?.geometry) {
            const pastAttr = this.pastLine.geometry.getAttribute('instanceStart');
            const futureAttr = this.futureLine.geometry.getAttribute('instanceStart');
            if (pastAttr && futureAttr && pastAttr.count > 0 && futureAttr.count > 0) {
                const pPos = this.pastLine.position;
                const fPos = this.futureLine.position;
                // Last past point should equal first future point (overlap at currentIndex)
                const lastPastIdx = pastAttr.count - 1;
                results.dynamicLines = {
                    pastMeshPos: pPos.toArray(),
                    futureMeshPos: fPos.toArray(),
                    lastPastWorld: [
                        pastAttr.getX(lastPastIdx) + pPos.x,
                        pastAttr.getY(lastPastIdx) + pPos.y,
                        pastAttr.getZ(lastPastIdx) + pPos.z
                    ],
                    firstFutureWorld: [
                        futureAttr.getX(0) + fPos.x,
                        futureAttr.getY(0) + fPos.y,
                        futureAttr.getZ(0) + fPos.z
                    ],
                };
            }
        }

        console.table(results);
        return results;
    }

    updateLineResolution() {
        const w = window.innerWidth, h = window.innerHeight;
        // Skip if resolution unchanged — avoids unnecessary LineMaterial shader updates
        if (this.lineResolution.x === w && this.lineResolution.y === h) return;
        this.lineResolution.set(w, h);
        if (this.pastMaterial?.resolution) {
            this.pastMaterial.resolution.copy(this.lineResolution);
        }
        if (this.futureMaterial?.resolution) {
            this.futureMaterial.resolution.copy(this.lineResolution);
        }
        if (this.trajectoryLine?.material?.resolution) {
            this.trajectoryLine.material.resolution.copy(this.lineResolution);
        }
        if (this.referenceTrajectoryLine?.material?.resolution) {
            this.referenceTrajectoryLine.material.resolution.copy(this.lineResolution);
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
