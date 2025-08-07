/**
 * CoordinateAxes.js
 * Visualizes coordinate axes for better spatial understanding
 */

import * as THREE from 'three';

export class CoordinateAxes {
    constructor(size = 5000000, lineWidth = 3) { // 5,000 km default for Mars-scale visualization
        this.size = size;
        this.lineWidth = lineWidth;
        this.group = new THREE.Group();
        this.group.name = 'CoordinateAxes';
        
        this.createAxes();
        this.createArrowHeads();
        this.createLabels();
    }

    createAxes() {
        // X-axis (Red) - Points toward vernal equinox in J2000
        const xAxisPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(this.size, 0, 0)
        ];
        const xAxisGeometry = new THREE.BufferGeometry().setFromPoints(xAxisPoints);
        const xAxisMaterial = new THREE.LineBasicMaterial({ 
            color: 0xff0000, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.9
        });
        const xAxis = new THREE.Line(xAxisGeometry, xAxisMaterial);
        xAxis.name = 'X-Axis-Positive';
        this.group.add(xAxis);
        
        // X-axis negative (darker red)
        const xAxisNegPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(-this.size, 0, 0)
        ];
        const xAxisNegGeometry = new THREE.BufferGeometry().setFromPoints(xAxisNegPoints);
        const xAxisNegMaterial = new THREE.LineBasicMaterial({ 
            color: 0x800000, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.6
        });
        const xAxisNeg = new THREE.Line(xAxisNegGeometry, xAxisNegMaterial);
        xAxisNeg.name = 'X-Axis-Negative';
        this.group.add(xAxisNeg);

        // Y-axis (Green) - 90° from X in ecliptic plane
        const yAxisPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, this.size, 0)
        ];
        const yAxisGeometry = new THREE.BufferGeometry().setFromPoints(yAxisPoints);
        const yAxisMaterial = new THREE.LineBasicMaterial({ 
            color: 0x00ff00, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.9
        });
        const yAxis = new THREE.Line(yAxisGeometry, yAxisMaterial);
        yAxis.name = 'Y-Axis-Positive';
        this.group.add(yAxis);
        
        // Y-axis negative (darker green)
        const yAxisNegPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, -this.size, 0)
        ];
        const yAxisNegGeometry = new THREE.BufferGeometry().setFromPoints(yAxisNegPoints);
        const yAxisNegMaterial = new THREE.LineBasicMaterial({ 
            color: 0x008000, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.6
        });
        const yAxisNeg = new THREE.Line(yAxisNegGeometry, yAxisNegMaterial);
        yAxisNeg.name = 'Y-Axis-Negative';
        this.group.add(yAxisNeg);

        // Z-axis (Blue) - Toward north ecliptic pole
        const zAxisPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, this.size)
        ];
        const zAxisGeometry = new THREE.BufferGeometry().setFromPoints(zAxisPoints);
        const zAxisMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0000ff, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.9
        });
        const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial);
        zAxis.name = 'Z-Axis-Positive';
        this.group.add(zAxis);
        
        // Z-axis negative (darker blue)
        const zAxisNegPoints = [
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 0, -this.size)
        ];
        const zAxisNegGeometry = new THREE.BufferGeometry().setFromPoints(zAxisNegPoints);
        const zAxisNegMaterial = new THREE.LineBasicMaterial({ 
            color: 0x000080, 
            linewidth: this.lineWidth,
            transparent: true,
            opacity: 0.6
        });
        const zAxisNeg = new THREE.Line(zAxisNegGeometry, zAxisNegMaterial);
        zAxisNeg.name = 'Z-Axis-Negative';
        this.group.add(zAxisNeg);
    }

    createArrowHeads() {
        const arrowSize = this.size * 0.02; // 2% of axis length
        
        // X-axis arrow (Red cone)
        const xArrowGeometry = new THREE.ConeGeometry(arrowSize * 0.3, arrowSize, 8);
        const xArrowMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const xArrow = new THREE.Mesh(xArrowGeometry, xArrowMaterial);
        xArrow.position.set(this.size + arrowSize * 0.5, 0, 0);
        xArrow.rotateZ(-Math.PI / 2);
        xArrow.name = 'X-Arrow';
        this.group.add(xArrow);
        
        // Y-axis arrow (Green cone)
        const yArrowGeometry = new THREE.ConeGeometry(arrowSize * 0.3, arrowSize, 8);
        const yArrowMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const yArrow = new THREE.Mesh(yArrowGeometry, yArrowMaterial);
        yArrow.position.set(0, this.size + arrowSize * 0.5, 0);
        yArrow.name = 'Y-Arrow';
        this.group.add(yArrow);
        
        // Z-axis arrow (Blue cone)
        const zArrowGeometry = new THREE.ConeGeometry(arrowSize * 0.3, arrowSize, 8);
        const zArrowMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
        const zArrow = new THREE.Mesh(zArrowGeometry, zArrowMaterial);
        zArrow.position.set(0, 0, this.size + arrowSize * 0.5);
        zArrow.rotateX(Math.PI / 2);
        zArrow.name = 'Z-Arrow';
        this.group.add(zArrow);
    }

    createLabels() {
        const labelDistance = this.size * 1.1;
        
        // X-axis label
        this.xLabel = this.createTextSprite('X (Vernal Equinox)', 0xff0000);
        this.xLabel.position.set(labelDistance, 0, 0);
        this.group.add(this.xLabel);
        
        // Y-axis label
        this.yLabel = this.createTextSprite('Y (Ecliptic)', 0x00ff00);
        this.yLabel.position.set(0, labelDistance, 0);
        this.group.add(this.yLabel);
        
        // Z-axis label
        this.zLabel = this.createTextSprite('Z (North Pole)', 0x0000ff);
        this.zLabel.position.set(0, 0, labelDistance);
        this.group.add(this.zLabel);
    }

    createTextSprite(text, color) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const fontSize = 48;
        
        canvas.width = 512;
        canvas.height = 128;
        
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.font = `${fontSize}px Arial`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.8
        });
        
        const sprite = new THREE.Sprite(material);
        const scale = this.size * 0.0002; // Scale relative to axis size
        sprite.scale.set(scale, scale * 0.25, 1);
        
        return sprite;
    }

    // Set visibility of axes
    setVisible(visible) {
        this.group.visible = visible;
    }

    // Update position (for moving objects like vehicles)
    setPosition(position) {
        this.group.position.copy(position);
    }

    // Get the Three.js group for adding to scene
    getObject3D() {
        return this.group;
    }

    // Dispose of resources
    dispose() {
        this.group.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }

    // Create axes for a specific object (vehicle, planet, etc.)
    static createLocalAxes(size = 500000, position = new THREE.Vector3(), name = 'Local') {
        const axes = new CoordinateAxes(size);
        axes.group.position.copy(position);
        axes.group.name = `${name}Axes`;
        return axes;
    }
}
