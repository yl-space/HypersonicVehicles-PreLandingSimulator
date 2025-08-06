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
        this.totalTime = 260.65;
        this.marsRadius = 3389.5;
        
        this.group = new THREE.Group();
        this.trajectoryLine = null;
        this.pastTrajectory = null;
        this.futureTrajectory = null;
        
        this.createTrajectoryLines();
    }
    
    createTrajectoryLines() {
        // Create with initial dummy geometry to prevent errors
        const dummyPoints = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.001, 0)];
        
        const pastMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 2,
            transparent: true,
            opacity: 0.8
        });
        const pastGeometry = new THREE.BufferGeometry().setFromPoints(dummyPoints);
        this.pastTrajectory = new THREE.Line(pastGeometry, pastMaterial);
        this.group.add(this.pastTrajectory);
        
        const futureMaterial = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            linewidth: 2,
            transparent: true,
            opacity: 0.4
        });
        const futureGeometry = new THREE.BufferGeometry().setFromPoints(dummyPoints);
        this.futureTrajectory = new THREE.Line(futureGeometry, futureMaterial);
        this.group.add(this.futureTrajectory);
        
        this.deflectionMarkersGroup = new THREE.Group();
        this.group.add(this.deflectionMarkersGroup);
    }

    deepCopyTrajectoryData(data) {
        return data.map(point => ({
            time: point.time,
            position: point.position.clone(),
            altitude: point.altitude,
            velocity: point.velocity instanceof THREE.Vector3 ? point.velocity.clone() : new THREE.Vector3(0, -Math.abs(point.velocity || 5900), 0),
            velocityMagnitude: point.velocityMagnitude || Math.abs(point.velocity || 5900),
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
            
            for (let i = 1; i < lines.length; i++) {
                const [time, x, y, z] = lines[i].split(',').map(v => parseFloat(v.trim()));
                
                if (!isNaN(time) && !isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    const rawPosition = new THREE.Vector3(x, y, z);
                    const altitude = rawPosition.length() - this.marsRadius * 1000; // Convert to meters
                    
                    // Better scaling for visualization
                    const position = new THREE.Vector3(
                        x * 0.00001,  // Increased scale for better visibility
                        y * 0.00001,
                        z * 0.00001
                    );
                    
                    let velocityVector = new THREE.Vector3(0, -1, 0);
                    let velocityMagnitude = 5900 * (1 - time / this.totalTime);
                    
                    if (prevPosition && i > 1) {
                        const prevTime = this.trajectoryData[this.trajectoryData.length - 1].time;
                        const dt = time - prevTime;
                        if (dt > 0) {
                            velocityVector = position.clone().sub(prevPosition).divideScalar(dt);
                            velocityMagnitude = velocityVector.length() * 100000; // Scale back up
                        }
                    }
                    
                    this.trajectoryData.push({
                        time,
                        position,
                        altitude: altitude * 0.001, // Convert to km
                        velocity: velocityVector,
                        velocityMagnitude: velocityMagnitude,
                        distanceToLanding: Math.sqrt(x*x + y*y + z*z) * 0.001
                    });
                    
                    prevPosition = position.clone();
                }
            }
            
            if (this.trajectoryData.length > 0) {
                this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
                this.updateTrajectoryDisplay(0);
                console.log(`Loaded ${this.trajectoryData.length} trajectory points`);
            }
            
        } catch (error) {
            console.error('Error loading trajectory data:', error);
            this.generateSampleTrajectory();
        }
    }
  
    
    generateSampleTrajectory() {
        const numPoints = 1000;
        const timeStep = this.totalTime / numPoints;
        
        this.trajectoryData = [];
        
        for (let i = 0; i < numPoints; i++) {
            const t = i * timeStep;
            const angle = (t / this.totalTime) * Math.PI * 0.5;
            
            const radius = 20 * (1 - t / this.totalTime);
            const x = Math.cos(angle * 4) * radius;
            const z = Math.sin(angle * 4) * radius;
            const y = 30 * (1 - t / this.totalTime) - 10;
            
            const position = new THREE.Vector3(x, y, z);
            const altitude = (1 - t / this.totalTime) * 132;
            const velocityMagnitude = 5900 * (1 - t / this.totalTime);
            
            this.trajectoryData.push({
                time: t,
                position,
                altitude,
                velocity: new THREE.Vector3(0, -velocityMagnitude * 0.001, 0),
                velocityMagnitude: velocityMagnitude,
                distanceToLanding: radius * 1000
            });
        }
        
        this.modifiedData = this.deepCopyTrajectoryData(this.trajectoryData);
        this.updateTrajectoryDisplay(0);
    }
    
    updateTrajectoryDisplay(currentTime) {
        if (this.modifiedData.length < 2) {
            // Keep dummy geometry if not enough data
            return;
        }
        
        let currentIndex = 0;
        for (let i = 0; i < this.modifiedData.length - 1; i++) {
            if (this.modifiedData[i].time <= currentTime && this.modifiedData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }
        
        // Update past trajectory
        if (currentIndex > 0) {
            const pastPoints = [];
            for (let i = 0; i <= currentIndex; i++) {
                pastPoints.push(this.modifiedData[i].position);
            }
            this.pastTrajectory.geometry.dispose();
            this.pastTrajectory.geometry = new THREE.BufferGeometry().setFromPoints(pastPoints);
        }
        
        // Update future trajectory
        if (currentIndex < this.modifiedData.length - 1) {
            const futurePoints = [];
            for (let i = currentIndex; i < this.modifiedData.length; i++) {
                futurePoints.push(this.modifiedData[i].position);
            }
            this.futureTrajectory.geometry.dispose();
            this.futureTrajectory.geometry = new THREE.BufferGeometry().setFromPoints(futurePoints);
        }
    }
    
    getInterpolatedData(time) {
        if (this.modifiedData.length === 0) return null;
        
        time = Math.max(0, Math.min(time, this.totalTime));
        
        let i = 0;
        while (i < this.modifiedData.length - 1 && this.modifiedData[i].time < time) {
            i++;
        }
        
        if (i === 0) return this.modifiedData[0];
        if (i >= this.modifiedData.length) return this.modifiedData[this.modifiedData.length - 1];
        
        const d1 = this.modifiedData[i - 1];
        const d2 = this.modifiedData[i];
        const t = (time - d1.time) / (d2.time - d1.time);
        
        return {
            time,
            position: d1.position.clone().lerp(d2.position.clone(), t),
            altitude: d1.altitude + (d2.altitude - d1.altitude) * t,
            velocity: d1.velocity.clone().lerp(d2.velocity.clone(), t),
            velocityMagnitude: d1.velocityMagnitude + (d2.velocityMagnitude - d1.velocityMagnitude) * t,
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
        if (Array.isArray(data) && data.length > 0) {
            this.trajectoryData = data.map(point => ({
                ...point,
                position: point.position instanceof THREE.Vector3 
                    ? point.position 
                    : new THREE.Vector3(point.position.x, point.position.y, point.position.z),
                velocity: point.velocity instanceof THREE.Vector3
                    ? point.velocity
                    : new THREE.Vector3(0, -Math.abs(point.velocity || 1), 0),
                velocityMagnitude: typeof point.velocity === 'number' 
                    ? Math.abs(point.velocity)
                    : (point.velocityMagnitude || 5900)
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
}