/**
 * TrajectoryManager.js
 * Handles trajectory data loading, interpolation, and visualization
 */

import * as THREE from 'three';

export class TrajectoryManager {
    constructor() {
        this.trajectoryData = [];
        this.trajectoryLine = null;
        this.currentIndex = 0;
        this.totalTime = 260.65;
        this.MarsRadius = 3389.5; // km
        // this.modifiedData = JSON.parse(JSON.stringify(trajectoryData)); // Deep copy
        this.modifiedData = [];
        this.deflectionPoints = [];
        this.deflectionMarkers = [];
        this.pastTrajectory = null;
        this.futureTrajectory = null;
        this.trajectoryGroup = new THREE.Group();

        
        // Landing site coordinates (Jezero Crater)
        this.landingSite = {
            lat: 18.38,  // degrees
            lon: 77.58,  // degrees
            position: null
        };
        
        this.init();
    }
    
    init() {
        // Calculate landing site position in 3D
        const phi = (90 - this.landingSite.lat) * Math.PI / 180;
        const theta = this.landingSite.lon * Math.PI / 180;
        
        this.landingSite.position = new THREE.Vector3(
            this.MarsRadius * Math.sin(phi) * Math.cos(theta),
            this.MarsRadius * Math.cos(phi),
            this.MarsRadius * Math.sin(phi) * Math.sin(theta)
        );
        
        // Create trajectory line
        this.createTrajectoryLine();
    }
    
    createTrajectoryLine() {
        const material = new THREE.LineBasicMaterial({
            color: 0x00ffff,
            transparent: true,
            opacity: 0.6,
            linewidth: 2
        });
        
        // Add split trajectory for past/future:
        const pastMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        
        const futureMaterial = new THREE.LineBasicMaterial({
            color: 0x00ff00,
            linewidth: 3,
            transparent: true,
            opacity: 0.6
        });
        
        this.pastTrajectory = new THREE.Line(new THREE.BufferGeometry(), pastMaterial);
        this.futureTrajectory = new THREE.Line(new THREE.BufferGeometry(), futureMaterial);

        const geometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(geometry, material);
        this.trajectoryGroup.add(this.pastTrajectory);
        this.trajectoryGroup.add(this.futureTrajectory);
        this.trajectoryGroup.add(this.trajectoryLine);
    }

    updateTrajectoryDisplay(currentTime) {
        let currentIndex = 0;
        for (let i = 0; i < this.modifiedData.length - 1; i++) {
            if (this.modifiedData[i].time <= currentTime && 
                this.modifiedData[i + 1].time > currentTime) {
                currentIndex = i;
                break;
            }
        }
        
        const pastPoints = [];
        const futurePoints = [];
        
        // Past trajectory
        for (let i = 0; i <= currentIndex; i++) {
            pastPoints.push(this.modifiedData[i].position);
        }
        
        // Add interpolated current position
        if (currentIndex < this.modifiedData.length - 1) {
            const t = (currentTime - this.modifiedData[currentIndex].time) /
                    (this.modifiedData[currentIndex + 1].time - this.modifiedData[currentIndex].time);
            
            const currentPos = new THREE.Vector3().lerpVectors(
                this.modifiedData[currentIndex].position,
                this.modifiedData[currentIndex + 1].position,
                t
            );
            
            pastPoints.push(currentPos);
            futurePoints.push(currentPos);
        }
        
        // Future trajectory
        for (let i = currentIndex + 1; i < this.modifiedData.length; i++) {
            futurePoints.push(this.modifiedData[i].position);
        }
        
        if (pastPoints.length > 1) {
            this.pastTrajectory.geometry.setFromPoints(pastPoints);
        }
        
        if (futurePoints.length > 1) {
            this.futureTrajectory.geometry.setFromPoints(futurePoints);
        }
    }

    // 4. Add deflection method:
    applyDeflection(mouseCoords, currentTime, camera) {
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouseCoords, camera);
        
        const intersects = raycaster.intersectObject(this.futureTrajectory);
        if (intersects.length === 0) return false;
        
        // Find closest trajectory point
        const hitPoint = intersects[0].point;
        let deflectionIndex = -1;
        let minDistance = Infinity;
        
        for (let i = 0; i < this.modifiedData.length; i++) {
            if (this.modifiedData[i].time < currentTime) continue;  // ← Changed from .Time to .time
            
            // Also need to use position object, not x,y,z directly
            const point = this.modifiedData[i].position;
            
            const distance = point.distanceTo(hitPoint);
            if (distance < minDistance && distance < 50000) {
                minDistance = distance;
                deflectionIndex = i;
            }
        }
        
        if (deflectionIndex === -1) return false;
        
        // Perform deflection
        this.performDeflection(deflectionIndex);
        this.addDeflectionMarker(hitPoint, deflectionIndex);
        
        return true;
    }
    // applyDeflection(mouseCoords, currentTime, camera) {
    //     const raycaster = new THREE.Raycaster();
    //     raycaster.setFromCamera(mouseCoords, camera);
        
    //     const intersects = raycaster.intersectObject(this.futureTrajectory);
    //     if (intersects.length === 0) return false;
        
    //     // Find closest trajectory point
    //     const hitPoint = intersects[0].point;
    //     let deflectionIndex = -1;
    //     let minDistance = Infinity;
        
    //     for (let i = 0; i < this.modifiedData.length; i++) {
    //         if (this.modifiedData[i].time < currentTime) continue;
            
    //         const point = new THREE.Vector3(
    //             this.modifiedData[i].x,
    //             this.modifiedData[i].y,
    //             this.modifiedData[i].z
    //         );
            
    //         const distance = point.distanceTo(hitPoint);
    //         if (distance < minDistance && distance < 50000) {
    //             minDistance = distance;
    //             deflectionIndex = i;
    //         }
    //     }
        
    //     if (deflectionIndex === -1) return false;
        
    //     // Perform deflection
    //     this.performDeflection(deflectionIndex);
    //     this.addDeflectionMarker(hitPoint, deflectionIndex);
        
    //     return true;
    // }

    // 5. Add deflection calculation:
    performDeflection(startIndex) {
        const deflectionAngle = 0.1;
        
        if (startIndex === 0 || startIndex >= this.modifiedData.length - 1) return;
        
        const deflectionPoint = this.modifiedData[startIndex].position.clone();
        const prevPoint = this.modifiedData[startIndex - 1].position.clone();
        
        const velocity = new THREE.Vector3().subVectors(deflectionPoint, prevPoint).normalize();
        const radialIn = deflectionPoint.clone().normalize().negate();
        const deflectionAxis = new THREE.Vector3().crossVectors(velocity, radialIn).normalize();
        
        const rotation = new THREE.Quaternion().setFromAxisAngle(deflectionAxis, deflectionAngle);
        
        for (let i = startIndex; i < this.modifiedData.length; i++) {
            const point = this.modifiedData[i].position.clone();
            
            // Rotate around deflection point
            point.sub(deflectionPoint);
            point.applyQuaternion(rotation);
            point.add(deflectionPoint);
            
            // Add gravity effect
            const gravityFactor = 1 + (i - startIndex) * 0.00005;
            const newRadius = point.length() / gravityFactor;
            point.normalize().multiplyScalar(newRadius);
            
            // Update the data structure
            this.modifiedData[i].position = point;
            this.modifiedData[i].altitude = point.length() - this.MarsRadius;
        }
        
        this.deflectionPoints.push({
            index: startIndex,
            position: deflectionPoint.clone()
        });
    }

    // 6. Add visual marker:
    addDeflectionMarker(position, index) {
        const markerGeometry = new THREE.SphereGeometry(5000, 16, 16);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(position);
        marker.userData = { time: 0, active: true };
        
        this.deflectionMarkers.push(marker);
        this.trajectoryGroup.add(marker);
    }

    // 7. Add marker animation:
    animateMarkers(deltaTime) {
        this.deflectionMarkers.forEach(marker => {
            if (!marker.userData.active) return;
            
            marker.userData.time += deltaTime;
            
            // Pulsing
            const scale = 1 + Math.sin(marker.userData.time * 3) * 0.3;
            marker.scale.setScalar(scale);
            
            // Fade after 10 seconds
            if (marker.userData.time > 10) {
                marker.material.opacity = Math.max(0, 1 - (marker.userData.time - 10) / 5);
                if (marker.material.opacity <= 0) {
                    marker.userData.active = false;
                    this.trajectoryGroup.remove(marker);
                    marker.geometry.dispose();
                    marker.material.dispose();
                }
            }
        });
        
        this.deflectionMarkers = this.deflectionMarkers.filter(m => m.userData.active);
    }

    
    async loadTrajectoryData(csvFile) {
        try {
            const response = await fetch(csvFile);
            const text = await response.text();
            
            // Parse CSV
            const lines = text.trim().split('\n');
            const headers = lines[0].split(',').map(h => h.trim());
            
            this.trajectoryData = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => parseFloat(v.trim()));
                
                if (values.length === headers.length) {
                    const time = values[0];
                    const x = values[1] / 1000; // Convert to km
                    const y = values[2] / 1000;
                    const z = values[3] / 1000;
                    
                    // Calculate altitude and velocity
                    const position = new THREE.Vector3(x, y, z);
                    const altitude = position.length() - this.MarsRadius;
                    
                    // Calculate velocity (approximate from position changes)
                    let velocity = 0;
                    if (i > 1) {
                        const prevData = this.trajectoryData[this.trajectoryData.length - 1];
                        const dt = time - prevData.time;
                        const distance = position.distanceTo(prevData.position);
                        velocity = (distance / dt) * 3.6; // km/s to km/h
                    }
                    
                    // Transform from J2000 to Mars-centered coordinates
                    const MarsPosition = this.transformJ2000ToMars(position, time);
                    
                    this.trajectoryData.push({
                        time,
                        position: MarsPosition,
                        altitude,
                        velocity,
                        distanceToLanding: MarsPosition.distanceTo(this.landingSite.position)
                    });
                }
            }
            this.modifiedData = JSON.parse(JSON.stringify(this.trajectoryData));
            
            this.updateTrajectoryLine();
            console.log(`Loaded ${this.trajectoryData.length} trajectory points`);
            
        } catch (error) {
            console.error('Error loading trajectory data:', error);
            // Generate sample trajectory if loading fails
            this.generateSampleTrajectory();
        }
    }


    
    generateSampleTrajectory() {
        const numPoints = 5211;
        const timeStep = this.totalTime / numPoints;
        
        this.trajectoryData = [];
        
        for (let i = 0; i < numPoints; i++) {
            const t = i * timeStep;
            const progress = t / this.totalTime;
            
            // Simulate entry trajectory
            const entryAngle = Math.PI * 0.25;
            const startAltitude = 132; // km above surface
            const endAltitude = 13.463; // km at parachute deploy
            
            // Exponential altitude decay
            const altitude = startAltitude * Math.exp(-progress * 2.3);
            const actualAltitude = Math.max(altitude, endAltitude);
            
            // Position on curved path
            const pathAngle = entryAngle * (1 - progress);
            const radius = this.MarsRadius + actualAltitude;
            
            const x = Math.cos(pathAngle) * radius;
            const y = actualAltitude * 0.1 * Math.sin(progress * Math.PI);
            const z = Math.sin(pathAngle) * radius;
            
            const position = new THREE.Vector3(x, y, z);
            
            // Velocity profile (exponential decay from entry speed)
            const entryVelocity = 19300; // km/h
            const velocity = entryVelocity * Math.exp(-progress * 3);
            
            this.trajectoryData.push({
                time: t,
                position,
                altitude: actualAltitude,
                velocity,
                distanceToLanding: position.distanceTo(this.landingSite.position)
            });
        }
        
        this.updateTrajectoryLine();
    }
    
    transformJ2000ToMars(j2000Position, time) {
        // Simplified transformation - in production, use proper SPICE kernels
        // For now, apply a rotation based on Mars orientation
        const MarsRotation = time * 0.001; // Simplified Mars rotation
        
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(MarsRotation);
        
        const MarsPosition = j2000Position.clone();
        MarsPosition.applyMatrix4(rotationMatrix);
        
        return MarsPosition;
    }
    
    updateTrajectoryLine() {
        if (this.trajectoryData.length === 0) return;
        
        const points = this.trajectoryData.map(d => d.position);
        this.trajectoryLine.geometry.setFromPoints(points);
        
        // Update colors based on altitude
        const colors = [];
        for (let i = 0; i < this.trajectoryData.length; i++) {
            const altitude = this.trajectoryData[i].altitude;
            const normalizedAltitude = altitude / 132; // Normalize by entry altitude
            
            // Color gradient from cyan (high) to orange (low)
            const color = new THREE.Color();
            color.setHSL(0.5 - normalizedAltitude * 0.4, 1, 0.5);
            colors.push(color.r, color.g, color.b);
        }
        
        this.trajectoryLine.geometry.setAttribute(
            'color',
            new THREE.Float32BufferAttribute(colors, 3)
        );
        this.trajectoryLine.material.vertexColors = true;
    }
    
    getInterpolatedData(time) {
        // CHANGE: Use modifiedData instead of trajectoryData
        if (this.modifiedData.length === 0) return null;
        
        time = Math.max(0, Math.min(time, this.totalTime));
        
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
        
        const smoothT = t < 0.5 
            ? 4 * t * t * t 
            : 1 - Math.pow(-2 * t + 2, 3) / 2;
        
        return {
            time,
            position: d1.position.clone().lerp(d2.position, smoothT),
            altitude: d1.altitude + (d2.altitude - d1.altitude) * smoothT,
            velocity: d1.velocity + (d2.velocity - d1.velocity) * smoothT,
            distanceToLanding: d1.distanceToLanding + (d2.distanceToLanding - d1.distanceToLanding) * smoothT
        };
    }

    
    // Get velocity vector for orientation
    getVelocityVector(time) {
        const dt = 0.1;
        const currentData = this.getInterpolatedData(time); // This now uses modifiedData
        const futureData = this.getInterpolatedData(time + dt);
        
        if (!currentData || !futureData) return new THREE.Vector3(0, -1, 0);
        
        const velocityVector = futureData.position.clone().sub(currentData.position);
        velocityVector.normalize();
        
        return velocityVector;
    }
    
    // Get progress percentage
    getProgress(time) {
        return Math.min(time / this.totalTime, 1) * 100;
    }
    
    // Get trajectory segment for partial rendering
    getTrajectorySegment(startTime, endTime) {
        const segment = [];
        
        for (const data of this.trajectoryData) {
            if (data.time >= startTime && data.time <= endTime) {
                segment.push(data.position);
            }
        }
        
        return segment;
    }
    
    // Update visibility of trajectory line based on current time
    updateTrajectoryVisibility(currentTime, showFuture = true) {
        if (!this.trajectoryLine || this.trajectoryData.length === 0) return;
        
        const positions = this.trajectoryLine.geometry.attributes.position.array;
        const colors = this.trajectoryLine.geometry.attributes.color.array;
        
        for (let i = 0; i < this.trajectoryData.length; i++) {
            const data = this.trajectoryData[i];
            const alpha = data.time <= currentTime ? 1.0 : (showFuture ? 0.3 : 0.0);
            
            // Update color alpha (simplified - would need custom shader for true transparency)
            const colorIndex = i * 3;
            const baseColor = new THREE.Color();
            baseColor.setHSL(0.5 - (data.altitude / 132) * 0.4, 1, 0.5 * alpha);
            
            colors[colorIndex] = baseColor.r;
            colors[colorIndex + 1] = baseColor.g;
            colors[colorIndex + 2] = baseColor.b;
        }
        
        this.trajectoryLine.geometry.attributes.color.needsUpdate = true;
    }
    
    getObject3D() {
        return this.trajectoryGroup;
    }
    
    dispose() {
        if (this.trajectoryGroup) {
            this.trajectoryGroup.removeFromParent();
        }
        this.trajectoryLine.material.dispose();
    }

    reset() {
        this.modifiedData = JSON.parse(JSON.stringify(this.trajectoryData));
        
        // Clear markers
        this.deflectionMarkers.forEach(marker => {
            this.trajectoryGroup.remove(marker);
            if (marker.geometry) marker.geometry.dispose();
            if (marker.material) marker.material.dispose();
        });
        
        this.deflectionMarkers = [];
        this.deflectionPoints = [];
    }
}
