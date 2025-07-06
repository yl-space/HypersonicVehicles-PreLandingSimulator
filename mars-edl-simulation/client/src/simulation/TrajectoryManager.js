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
        this.jupiterRadius = 3389.5; // km
        
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
            this.jupiterRadius * Math.sin(phi) * Math.cos(theta),
            this.jupiterRadius * Math.cos(phi),
            this.jupiterRadius * Math.sin(phi) * Math.sin(theta)
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
        
        const geometry = new THREE.BufferGeometry();
        this.trajectoryLine = new THREE.Line(geometry, material);
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
                    const altitude = position.length() - this.jupiterRadius;
                    
                    // Calculate velocity (approximate from position changes)
                    let velocity = 0;
                    if (i > 1) {
                        const prevData = this.trajectoryData[this.trajectoryData.length - 1];
                        const dt = time - prevData.time;
                        const distance = position.distanceTo(prevData.position);
                        velocity = (distance / dt) * 3.6; // km/s to km/h
                    }
                    
                    // Transform from J2000 to Mars-centered coordinates
                    const jupiterPosition = this.transformJ2000ToMars(position, time);
                    
                    this.trajectoryData.push({
                        time,
                        position: jupiterPosition,
                        altitude,
                        velocity,
                        distanceToLanding: jupiterPosition.distanceTo(this.landingSite.position)
                    });
                }
            }
            
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
            const radius = this.jupiterRadius + actualAltitude;
            
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
        const jupiterRotation = time * 0.001; // Simplified Mars rotation
        
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationY(jupiterRotation);
        
        const jupiterPosition = j2000Position.clone();
        jupiterPosition.applyMatrix4(rotationMatrix);
        
        return jupiterPosition;
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
        if (this.trajectoryData.length === 0) return null;
        
        // Clamp time
        time = Math.max(0, Math.min(time, this.totalTime));
        
        // Find surrounding data points
        let i = 0;
        while (i < this.trajectoryData.length - 1 && this.trajectoryData[i].time < time) {
            i++;
        }
        
        if (i === 0) return this.trajectoryData[0];
        if (i >= this.trajectoryData.length) return this.trajectoryData[this.trajectoryData.length - 1];
        
        // Interpolate between points
        const d1 = this.trajectoryData[i - 1];
        const d2 = this.trajectoryData[i];
        const t = (time - d1.time) / (d2.time - d1.time);
        
        // Smooth interpolation using cubic ease
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
        const dt = 0.1; // Small time step
        const currentData = this.getInterpolatedData(time);
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
        return this.trajectoryLine;
    }
    
    dispose() {
        if (this.trajectoryLine) {
            this.trajectoryLine.geometry.dispose();
            this.trajectoryLine.material.dispose();
        }
    }
}