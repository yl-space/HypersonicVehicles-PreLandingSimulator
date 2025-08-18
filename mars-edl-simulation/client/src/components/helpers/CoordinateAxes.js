/**
 * CoordinateAxes.js
 * Visualizes the J2000 reference frame axes
 */

import * as THREE from 'three';

export class CoordinateAxes {
    constructor(size = 5000) {
        this.size = size;
        this.group = new THREE.Group();
        this.labels = [];
        
        this.init();
    }
    
    init() {
        // Create axes with distinct colors
        // X-axis (Red) - Points to vernal equinox
        const xGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(this.size, 0, 0)
        ]);
        const xMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff0000,
            linewidth: 2,
            opacity: 0.6,
            transparent: true
        });
        const xAxis = new THREE.Line(xGeometry, xMaterial);
        this.group.add(xAxis);
        
        // Y-axis (Green) - Completes right-handed system
        const yGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, this.size, 0)
        ]);
        const yMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00,
            linewidth: 2,
            opacity: 0.6,
            transparent: true
        });
        const yAxis = new THREE.Line(yGeometry, yMaterial);
        this.group.add(yAxis);
        
        // Z-axis (Blue) - Points to Mars north pole
        const zGeometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, this.size)
        ]);
        const zMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0088ff,
            linewidth: 2,
            opacity: 0.6,
            transparent: true
        });
        const zAxis = new THREE.Line(zGeometry, zMaterial);
        this.group.add(zAxis);
        
        // Add coordinate planes (optional, semi-transparent)
        this.createCoordinatePlanes();
        
        // Add axis labels
        this.createAxisLabels();
        
        // Add tick marks
        this.createTickMarks();
    }
    
    createCoordinatePlanes() {
        const planeSize = this.size * 0.3;
        const planeOpacity = 0.05;
        
        // XY Plane (horizontal)
        const xyGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const xyMaterial = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            side: THREE.DoubleSide,
            opacity: planeOpacity,
            transparent: true
        });
        const xyPlane = new THREE.Mesh(xyGeometry, xyMaterial);
        xyPlane.rotation.x = -Math.PI / 2;
        xyPlane.position.set(planeSize/2, 0, planeSize/2);
        this.group.add(xyPlane);
        
        // XZ Plane
        const xzGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const xzMaterial = new THREE.MeshBasicMaterial({
            color: 0xff00ff,
            side: THREE.DoubleSide,
            opacity: planeOpacity,
            transparent: true
        });
        const xzPlane = new THREE.Mesh(xzGeometry, xzMaterial);
        xzPlane.position.set(planeSize/2, planeSize/2, 0);
        this.group.add(xzPlane);
        
        // YZ Plane
        const yzGeometry = new THREE.PlaneGeometry(planeSize, planeSize);
        const yzMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ffff,
            side: THREE.DoubleSide,
            opacity: planeOpacity,
            transparent: true
        });
        const yzPlane = new THREE.Mesh(yzGeometry, yzMaterial);
        yzPlane.rotation.y = Math.PI / 2;
        yzPlane.position.set(0, planeSize/2, planeSize/2);
        this.group.add(yzPlane);
    }
    
    createAxisLabels() {
        // Create sprite labels for each axis
        const labels = [
            { text: 'X (Vernal Equinox)', position: new THREE.Vector3(this.size * 1.1, 0, 0), color: '#ff0000' },
            { text: 'Y', position: new THREE.Vector3(0, this.size * 1.1, 0), color: '#00ff00' },
            { text: 'Z (North)', position: new THREE.Vector3(0, 0, this.size * 1.1), color: '#0088ff' }
        ];
        
        labels.forEach(label => {
            const sprite = this.createTextSprite(label.text, label.color);
            sprite.position.copy(label.position);
            this.group.add(sprite);
            this.labels.push(sprite);
        });
    }
    
    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 128;
        
        const context = canvas.getContext('2d');
        context.font = 'Bold 48px Arial';
        context.fillStyle = color;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, 256, 64);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.8
        });
        
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(200, 50, 1);
        
        return sprite;
    }
    
    createTickMarks() {
        const tickInterval = 1000; // Every 1000 km
        const tickSize = 50;
        const numTicks = Math.floor(this.size / tickInterval);
        
        for (let i = 1; i <= numTicks; i++) {
            const distance = i * tickInterval;
            
            // X-axis ticks
            this.addTick(new THREE.Vector3(distance, -tickSize, 0), 
                       new THREE.Vector3(distance, tickSize, 0), 0xff0000);
            
            // Y-axis ticks
            this.addTick(new THREE.Vector3(-tickSize, distance, 0), 
                       new THREE.Vector3(tickSize, distance, 0), 0x00ff00);
            
            // Z-axis ticks
            this.addTick(new THREE.Vector3(-tickSize, 0, distance), 
                       new THREE.Vector3(tickSize, 0, distance), 0x0088ff);
        }
    }
    
    addTick(start, end, color) {
        const geometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const material = new THREE.LineBasicMaterial({ 
            color: color,
            opacity: 0.3,
            transparent: true
        });
        const tick = new THREE.Line(geometry, material);
        this.group.add(tick);
    }
    
    update(camera) {
        // Make labels always face the camera
        this.labels.forEach(label => {
            label.lookAt(camera.position);
        });
    }
    
    setVisibility(visible) {
        this.group.visible = visible;
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        // Clean up geometries and materials
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}