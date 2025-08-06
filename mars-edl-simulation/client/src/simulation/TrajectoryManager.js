/**
 * TrajectoryManager.js - FIXED VERSION
 * Handles trajectory data loading, interpolation, and deflection
 */

import * as THREE from 'three';

export class TrajectoryManager {
    constructor() {
        this.trajectoryData = [];
        this.modifiedData = [];
        this.deflectionPoints = [];
        this.totalTime = 260.65; // seconds
        this.marsRadius = 3389.5; // km (scaled appropriately)
        
        this.group = new THREE.Group();
        this.trajectoryLine = null;
        this.pastTrajectory = null;
        this.futureTrajectory = null;
        
        this.createTrajectoryLines();
    }
    
    createTrajectoryLines() {
        // Past trajectory (already traveled)
        const pastMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        this.pastTrajectory = new THREE.Line(
            new THREE.BufferGeometry(),
            pastMaterial
        );
        this.group.add(this.pastTrajectory);
        
        // Future trajectory
        const futureMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.4
        });
        this.futureTrajectory = new THREE.Line(
            new THREE.BufferGeometry(),
            futureMaterial
        );
        this.group.add(this.futureTrajectory);
        
        // Deflection markers
        this.deflectionMarkersGroup = new THREE.Group();
        this.group.add(this.deflectionMarkersGroup);
    }

    deepCopyTrajectoryData(data) {
        return data.map(point => ({
            time: point.time,
            position: point.position.clone(),
            altitude: point.altitude,
            velocity: point.velocity instanceof THREE.Vector3 ? point.velocity.clone() : new THREE.Vector3(0, -point.velocity, 0),
            distanceToLanding: point.distanceToLanding
        }));
    }
    
    async loadTrajectoryData(filename) {
        try {
            const response = await fetch(filename);
            const csvText = await response.text();
            const lines = csvText.trim().split('\n');
            
            this.trajectoryData = [];
            let prevPosition = null;
            
            // Skip header
            for (let i = 1; i < lines.length; i++) {
                const [time, x, y, z] = lines[i].split(',').map(v => parseFloat(v.trim()));
                
                if (!isNaN(time) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    const position = new THREE.Vector3(x, y, z);
                    const altitude = position.length() - this.marsRadius;
                    
                    // Scale down for visualization
                    position.multiplyScalar(0.000001);
                    
                    // Calculate velocity as Vector3
                    let velocityVector = new THREE.Vector3(0, -1, 0);
                    if (prevPosition && i > 1) {
                        const prevTime = this.trajectoryData[this.trajectoryData.length - 1].time;
                        const dt = time - prevTime;
                        if (dt > 0) {
                            velocityVector = position.clone().sub(prevPosition).divideScalar(dt);
                        }
                    }
                    
                    this.trajectoryData.push({
                        time,
                        position,
                        altitude,
                        velocity: velocityVector,
                        distanceToLanding: 0
                    });
                    
                    prevPosition = position.clone();
                }
            }
            
            // Initialize modified data as copy
            this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
            
            this.updateTrajectoryDisplay(0);
            console.log(`Loaded ${this.trajectoryData.length} trajectory points`);
            
        } catch (error) {
            console.error('Error loading trajectory data:', error);
            this.generateSampleTrajectory();
        }
    }
    
    generateSampleTrajectory() {
        const numPoints = 1000;
        const timeStep = this.totalTime / numPoints;
        
        this.trajectoryData = [];
        let prevPosition = null;
        
        for (let i = 0; i < numPoints; i++) {
            const t = i * timeStep;
            const angle = (t / this.totalTime) * Math.PI * 0.5;
            
            // Create spiral descent trajectory
            const radius = 2 * (1 - t / this.totalTime);
            const x = Math.cos(angle * 4) * radius;
            const z = Math.sin(angle * 4) * radius;
            const y = 3 * (1 - t / this.totalTime) - 1;
            
            const position = new THREE.Vector3(x, y, z);
            const altitude = (1 - t / this.totalTime) * 132000;
            
            // Calculate velocity as Vector3
            let velocityVector = new THREE.Vector3(0, -1, 0);
            if (prevPosition && i > 0) {
                velocityVector = position.clone().sub(prevPosition).divideScalar(timeStep);
            }
            
            this.trajectoryData.push({
                time: t,
                position,
                altitude,
                velocity: velocityVector,
                distanceToLanding: radius * 1000
            });
            
            prevPosition = position.clone();
        }
        
        this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
        this.updateTrajectoryDisplay(0);
    }
    
    updateTrajectoryDisplay(currentTime) {
        if (this.modifiedData.length < 2) return;
        
        // Find current position in trajectory
        let currentIndex = 0;
        for (let i = 0; i < this.modifiedData.length - 1; i++) {
            if (this.modifiedData[i].time <= currentTime && this.modifiedData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }
        
        // Update past trajectory
        const pastPoints = [];
        for (let i = 0; i <= Math.min(currentIndex, this.modifiedData.length - 1); i++) {
            pastPoints.push(this.modifiedData[i].position);
        }
        
        if (pastPoints.length > 1) {
            this.pastTrajectory.geometry.setFromPoints(pastPoints);
        } else {
            // Create empty geometry if not enough points
            this.pastTrajectory.geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0.001, 0)
            ]);
        }
        
        // Update future trajectory
        const futurePoints = [];
        for (let i = Math.max(0, currentIndex); i < this.modifiedData.length; i++) {
            futurePoints.push(this.modifiedData[i].position);
        }
        
        if (futurePoints.length > 1) {
            this.futureTrajectory.geometry.setFromPoints(futurePoints);
        } else {
            // Create empty geometry if not enough points
            this.futureTrajectory.geometry.setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0.001, 0)
            ]);
        }
    }
    
    getInterpolatedData(time) {
        if (this.modifiedData.length === 0) return null;
        
        time = Math.max(0, Math.min(time, this.totalTime));
        
        // Find surrounding points
        let i = 0;
        while (i < this.modifiedData.length - 1 && this.modifiedData[i].time < time) {
            i++;
        }
        
        if (i === 0) return this.modifiedData[0];
        if (i >= this.modifiedData.length) return this.modifiedData[this.modifiedData.length - 1];
        
        // Interpolate between points
        const d1 = this.modifiedData[i - 1];
        const d2 = this.modifiedData[i];
        const t = (time - d1.time) / (d2.time - d1.time);
        
        return {
            time,
            position: d1.position.clone().lerp(d2.position.clone(), t),
            altitude: d1.altitude + (d2.altitude - d1.altitude) * t,
            velocity: d1.velocity.clone().lerp(d2.velocity.clone(), t),
            distanceToLanding: d1.distanceToLanding + (d2.distanceToLanding - d1.distanceToLanding) * t
        };
    }
    
    getVelocityVector(time) {
        const dt = 0.1;
        const currentData = this.getInterpolatedData(time);
        const futureData = this.getInterpolatedData(time + dt);
        
        if (!currentData || !futureData) return new THREE.Vector3(0, -1, 0);
        
        return futureData.position.clone().sub(currentData.position).normalize();
    }
    
    // ... rest of the methods remain the same ...
    
    applyDeflection(mousePos, currentTime, camera) {
        if (this.modifiedData.length < 2) return false;
        
        // Find the closest trajectory point to current time
        let closestIndex = 0;
        let minTimeDiff = Infinity;
        
        for (let i = 0; i < this.modifiedData.length; i++) {
            const timeDiff = Math.abs(this.modifiedData[i].time - currentTime);
            if (timeDiff < minTimeDiff) {
                minTimeDiff = timeDiff;
                closestIndex = i;
            }
        }
        
        // Apply 10% downward deflection from this point forward
        const deflectionAngle = 0.1;
        
        // Create deflection marker
        this.addDeflectionMarker(this.modifiedData[closestIndex].position.clone());
        
        // Store deflection point
        this.deflectionPoints.push({
            index: closestIndex,
            time: currentTime,
            angle: deflectionAngle
        });
        
        // Apply deflection to all future points
        for (let i = closestIndex + 1; i < this.modifiedData.length; i++) {
            const prevPoint = this.modifiedData[i - 1];
            const currentPoint = this.modifiedData[i];
            
            // Calculate trajectory direction
            const direction = currentPoint.position.clone().sub(prevPoint.position).normalize();
            
            // Apply downward deflection
            const downVector = new THREE.Vector3(0, -1, 0);
            direction.lerp(downVector, deflectionAngle);
            direction.normalize();
            
            // Calculate new position
            const distance = currentPoint.position.distanceTo(prevPoint.position);
            const newPosition = prevPoint.position.clone().add(direction.multiplyScalar(distance));
            
            // Update with new Vector3 object
            this.modifiedData[i] = {
                ...this.modifiedData[i],
                position: newPosition,
                velocity: this.modifiedData[i].velocity.clone()
            };
        }
        
        // Update trajectory display
        this.updateTrajectoryDisplay(currentTime);
        
        return true;
    }
    
    addDeflectionMarker(position) {
        const geometry = new THREE.SphereGeometry(0.02, 16, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            emissive: 0xffff00,
            emissiveIntensity: 1
        });
        
        const marker = new THREE.Mesh(geometry, material);
        marker.position.copy(position);
        
        // Add glow effect
        const glowGeometry = new THREE.SphereGeometry(0.04, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.3
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        marker.add(glow);
        
        this.deflectionMarkersGroup.add(marker);
    }
    
    reset() {
        // Reset modified data to original
        this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
        
        // Clear deflection markers
        this.deflectionMarkersGroup.clear();
        this.deflectionPoints = [];
        
        // Reset display
        this.updateTrajectoryDisplay(0);
    }
    
    getObject3D() {
        return this.group;
    }
    
    getTrajectoryLine() {
        return this.trajectoryLine || this.futureTrajectory;
    }
    
    getTimeFromPosition(position) {
        if (this.modifiedData.length === 0) return 0;
        
        let closestTime = 0;
        let minDistance = Infinity;
        
        for (const point of this.modifiedData) {
            const distance = position.distanceTo(point.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestTime = point.time;
            }
        }
        
        return closestTime;
    }
    
    updateTrajectoryVisibility(currentTime) {
        if (this.pastTrajectory) {
            this.pastTrajectory.material.opacity = 0.8;
        }
        if (this.futureTrajectory) {
            this.futureTrajectory.material.opacity = 0.4;
        }
    }
    
    getDataAtTime(time) {
        return this.getInterpolatedData(time);
    }
    
    setTrajectoryData(data) {
        if (Array.isArray(data)) {
            // Ensure all positions and velocities are Vector3 objects
            this.trajectoryData = data.map(point => ({
                ...point,
                position: point.position instanceof THREE.Vector3 
                    ? point.position 
                    : new THREE.Vector3(point.position.x, point.position.y, point.position.z),
                velocity: point.velocity instanceof THREE.Vector3
                    ? point.velocity
                    : new THREE.Vector3(0, -point.velocity || -1, 0)
            }));
            this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
            this.updateTrajectoryDisplay(0);
        }
    }
    
    dispose() {
        if (this.pastTrajectory) {
            this.pastTrajectory.geometry.dispose();
            this.pastTrajectory.material.dispose();
        }
        
        if (this.futureTrajectory) {
            this.futureTrajectory.geometry.dispose();
            this.futureTrajectory.material.dispose();
        }
        
        this.deflectionMarkersGroup.clear();
    }
}