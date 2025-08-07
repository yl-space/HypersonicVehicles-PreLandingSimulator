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
        yAxis.name = 'Y-Axis';
        this.group.add(yAxis);
        
        // Z-axis (Blue)
        const zAxisPoints = [
            new THREE.Vector3(0, 0, -this.size),
            new THREE.Vector3(0, 0, this.size)
        ];
        const zAxisGeometry = new THREE.BufferGeometry().setFromPoints(zAxisPoints);
        const zAxisMaterial = new THREE.LineBasicMaterial({ 
            color: 0x0000ff, 
            linewidth: 3,
            transparent: true,
            opacity: 0.8
        });
        const zAxis = new THREE.Line(zAxisGeometry, zAxisMaterial);
        zAxis.name = 'Z-Axis';
        this.group.add(zAxis);
        
        // Add arrow heads
        this.createArrowHead(this.size, 0, 0, 0xff0000, 'X+');
        this.createArrowHead(-this.size, 0, 0, 0x800000, 'X-');
        this.createArrowHead(0, this.size, 0, 0x00ff00, 'Y+');
        this.createArrowHead(0, -this.size, 0, 0x008000, 'Y-');
        this.createArrowHead(0, 0, this.size, 0x0000ff, 'Z+');
        this.createArrowHead(0, 0, -this.size, 0x000080, 'Z-');
    }
    
    createArrowHead(x, y, z, color, label) {
        const arrowSize = this.size * 0.05;
        const arrowGeometry = new THREE.ConeGeometry(arrowSize * 0.3, arrowSize, 8);
        const arrowMaterial = new THREE.MeshBasicMaterial({ 
            color: color,
            transparent: true,
            opacity: 0.9
        });
        const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);
        
        arrow.position.set(x, y, z);
        
        // Orient arrow based on axis
        if (Math.abs(x) > Math.abs(y) && Math.abs(x) > Math.abs(z)) {
            // X-axis
            arrow.rotation.z = x > 0 ? -Math.PI / 2 : Math.PI / 2;
        } else if (Math.abs(y) > Math.abs(z)) {
            // Y-axis
            if (y < 0) arrow.rotation.x = Math.PI;
        } else {
            // Z-axis
            arrow.rotation.x = z > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        
        arrow.name = `Arrow-${label}`;
        this.group.add(arrow);
    }
    
    createLabels() {
        // Create text sprites for axis labels
        const labelDistance = this.size * 1.1;
        
        this.createTextSprite('X+', labelDistance, 0, 0, 0xff0000);
        this.createTextSprite('X-', -labelDistance, 0, 0, 0xff0000);
        this.createTextSprite('Y+', 0, labelDistance, 0, 0x00ff00);
        this.createTextSprite('Y-', 0, -labelDistance, 0, 0x00ff00);
        this.createTextSprite('Z+', 0, 0, labelDistance, 0x0000ff);
        this.createTextSprite('Z-', 0, 0, -labelDistance, 0x0000ff);
        
        // Add coordinate system info
        this.createTextSprite('J2000 Inertial Frame', 0, labelDistance * 0.8, 0, 0xffffff, 32);
        this.createTextSprite('Mars Center = Origin', 0, labelDistance * 0.7, 0, 0xffffff, 24);
    }
    
    createTextSprite(text, x, y, z, color, fontSize = 48) {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 256;
        canvas.height = 128;
        
        context.font = `bold ${fontSize}px Arial`;
        context.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillText(text, canvas.width / 2, canvas.height / 2);
        
        const texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        
        const spriteMaterial = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 0.9
        });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        // Scale sprite based on distance from origin
        const distance = Math.sqrt(x*x + y*y + z*z);
        const scale = Math.max(distance * 0.0002, 50000); // Minimum scale
        sprite.scale.set(scale, scale * 0.5, 1);
        
        sprite.position.set(x, y, z);
        sprite.name = `Label-${text}`;
        this.group.add(sprite);
    }
    
    setVisible(visible) {
        this.group.visible = visible;
    }
    
    setOpacity(opacity) {
        this.group.traverse((child) => {
            if (child.material) {
                child.material.opacity = opacity;
            }
        });
    }
    
    getObject3D() {
        return this.group;
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
        });
    }
}
