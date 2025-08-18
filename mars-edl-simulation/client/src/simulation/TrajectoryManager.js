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
        
        // Materials with modern features - more visible colors
        this.pastMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,  // Bright green for traveled path
            linewidth: 3,
            opacity: 1.0,
            transparent: false
        });
        
        this.futureMaterial = new THREE.LineDashedMaterial({
            color: 0xff0000,  // Red for future path
            linewidth: 3,
            opacity: 0.8,
            transparent: true,
            dashSize: 5,
            gapSize: 3,
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
        // Geometry for each point
        const pointGeometry = new THREE.SphereGeometry(0.02, 4, 4);
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
        // Current position indicator - larger and more visible
        const markerGeometry = new THREE.SphereGeometry(0.5, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,  // Yellow for visibility
            emissive: 0xffff00,
            emissiveIntensity: 1.0
        });
        
        this.currentPositionMarker = new THREE.Mesh(markerGeometry, markerMaterial);
        this.currentPositionMarker.castShadow = false;
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(0.8, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.5,
            blending: THREE.AdditiveBlending
        });
        
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.currentPositionMarker.add(glow);
        
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
        
        // Create full trajectory line - more visible
        this.trajectoryLine = new THREE.Line(
            this.pathGeometry,
            new THREE.LineBasicMaterial({
                color: 0xffffff,  // White for full path
                opacity: 0.3,
                transparent: true,
                linewidth: 2
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