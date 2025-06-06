// client/src/components/spacecraft/Parachute.js
import * as THREE from 'three';

/**
 * Parachute Component - Mars 2020 Supersonic Parachute
 * 
 * This component teaches:
 * 1. Dynamic geometry deformation
 * 2. Cloth simulation basics
 * 3. Suspension line physics
 * 4. Wind effects and turbulence
 */
export class Parachute {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Supersonic Parachute';
        
        // Parachute specifications
        this.specs = {
            diameter: 21.5, // meters (scaled for visualization)
            segments: 32,   // radial segments
            rings: 16,      // concentric rings
            stripeCount: 16, // orange and white stripes
            lineCount: 80,   // suspension lines
            deployed: false,
            deploymentProgress: 0
        };
        
        // Physics parameters
        this.physics = {
            drag: 0.8,
            windForce: new THREE.Vector3(),
            turbulence: 0,
            swayAmount: 0.1,
            inflationRate: 2.0
        };
        
        // Component parts
        this.canopy = null;
        this.suspensionLines = [];
        this.bridles = [];
        this.mortarCover = null;
        
        // Animation state
        this.time = 0;
        this.swayPhase = Math.random() * Math.PI * 2;
        
        // Build components
        this.createCanopy();
        this.createSuspensionLines();
        this.createBridles();
        this.createMortarSystem();
        
        // Initially collapsed
        this.collapse();
    }
    
    createCanopy() {
        // Create dynamic geometry for the parachute canopy
        const radius = this.specs.diameter / 2;
        const segments = this.specs.segments;
        const rings = this.specs.rings;
        
        // Custom geometry for better control over deformation
        const geometry = new THREE.BufferGeometry();
        
        // Calculate vertex count
        const vertexCount = (segments + 1) * (rings + 1);
        const positions = new Float32Array(vertexCount * 3);
        const normals = new Float32Array(vertexCount * 3);
        const uvs = new Float32Array(vertexCount * 2);
        const colors = new Float32Array(vertexCount * 3);
        
        // Store original positions for deformation
        this.originalPositions = new Float32Array(vertexCount * 3);
        
        // Generate vertices
        let vertexIndex = 0;
        for (let ring = 0; ring <= rings; ring++) {
            const v = ring / rings;
            const ringRadius = radius * v;
            
            // Height follows a parabolic curve for realistic shape
            const height = Math.sqrt(1 - v * v) * radius * 0.7;
            
            for (let segment = 0; segment <= segments; segment++) {
                const u = segment / segments;
                const theta = u * Math.PI * 2;
                
                // Position
                const x = Math.cos(theta) * ringRadius;
                const y = height;
                const z = Math.sin(theta) * ringRadius;
                
                positions[vertexIndex * 3] = x;
                positions[vertexIndex * 3 + 1] = y;
                positions[vertexIndex * 3 + 2] = z;
                
                // Store original position
                this.originalPositions[vertexIndex * 3] = x;
                this.originalPositions[vertexIndex * 3 + 1] = y;
                this.originalPositions[vertexIndex * 3 + 2] = z;
                
                // UV
                uvs[vertexIndex * 2] = u;
                uvs[vertexIndex * 2 + 1] = v;
                
                // Color for stripes
                const stripeIndex = Math.floor(u * this.specs.stripeCount);
                if (stripeIndex % 2 === 0) {
                    colors[vertexIndex * 3] = 1;     // R
                    colors[vertexIndex * 3 + 1] = 1; // G
                    colors[vertexIndex * 3 + 2] = 1; // B
                } else {
                    colors[vertexIndex * 3] = 1;       // R
                    colors[vertexIndex * 3 + 1] = 0.4; // G
                    colors[vertexIndex * 3 + 2] = 0;   // B
                }
                
                vertexIndex++;
            }
        }
        
        // Generate indices
        const indices = [];
        for (let ring = 0; ring < rings; ring++) {
            for (let segment = 0; segment < segments; segment++) {
                const a = ring * (segments + 1) + segment;
                const b = a + segments + 1;
                const c = a + 1;
                const d = b + 1;
                
                // Two triangles per quad
                indices.push(a, b, c);
                indices.push(b, d, c);
            }
        }
        
        // Set attributes
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(indices);
        
        // Compute normals
        geometry.computeVertexNormals();
        
        // Material with vertex colors
        const material = new THREE.MeshPhongMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.95,
            shininess: 20,
            specular: 0x222222
        });
        
        this.canopy = new THREE.Mesh(geometry, material);
        this.canopy.castShadow = true;
        this.canopy.receiveShadow = true;
        
        // Add reinforcement pattern texture
        this.addReinforcementTexture();
        
        this.group.add(this.canopy);
    }
    
    addReinforcementTexture() {
        // Create texture showing reinforcement bands
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        // Transparent background
        ctx.clearRect(0, 0, 1024, 1024);
        
        // Draw radial reinforcement lines
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
        ctx.lineWidth = 2;
        
        const centerX = 512;
        const centerY = 512;
        
        // Radial lines
        for (let i = 0; i < this.specs.stripeCount; i++) {
            const angle = (i / this.specs.stripeCount) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * 512,
                centerY + Math.sin(angle) * 512
            );
            ctx.stroke();
        }
        
        // Concentric circles
        for (let i = 1; i <= 8; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, i * 64, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.transparent = true;
        
        // Apply as second texture using multi-material
        this.canopy.material = [
            this.canopy.material,
            new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            })
        ];
    }
    
    createSuspensionLines() {
        // Create suspension lines connecting canopy to payload
        const lineCount = this.specs.lineCount;
        const canopyRadius = this.specs.diameter / 2;
        const lineLength = 50; // meters (scaled)
        
        // Line material
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0x666666,
            transparent: true,
            opacity: 0.8,
            linewidth: 1 // Note: linewidth >1 only works with LineBasicMaterial on some platforms
        });
        
        for (let i = 0; i < lineCount; i++) {
            const angle = (i / lineCount) * Math.PI * 2;
            
            // Top attachment point (on canopy edge)
            const topX = Math.cos(angle) * canopyRadius * 0.95;
            const topZ = Math.sin(angle) * canopyRadius * 0.95;
            const topY = 0; // Will be updated based on canopy shape
            
            // Bottom attachment point (confluence point)
            const bottomX = 0;
            const bottomY = -lineLength;
            const bottomZ = 0;
            
            // Create line geometry
            const points = [];
            
            // Add intermediate points for curved lines
            const curvePoints = 10;
            for (let j = 0; j <= curvePoints; j++) {
                const t = j / curvePoints;
                
                // Bezier curve for natural drape
                const x = topX * (1 - t) + bottomX * t;
                const z = topZ * (1 - t) + bottomZ * t;
                
                // Add catenary curve for realistic line sag
                const sag = Math.sin(t * Math.PI) * 2;
                const y = topY * (1 - t) + bottomY * t - sag;
                
                points.push(new THREE.Vector3(x, y, z));
            }
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(geometry, lineMaterial);
            
            // Store original points for animation
            line.userData = {
                topAttachment: new THREE.Vector3(topX, topY, topZ),
                points: points,
                angle: angle
            };
            
            this.suspensionLines.push(line);
            this.group.add(line);
        }
    }
    
    createBridles() {
        // Create bridle system (connects suspension lines to single point)
        const bridleCount = 3;
        const bridleMaterial = new THREE.LineBasicMaterial({
            color: 0x444444,
            linewidth: 2
        });
        
        for (let i = 0; i < bridleCount; i++) {
            const angle = (i / bridleCount) * Math.PI * 2;
            const radius = 2;
            
            const points = [
                new THREE.Vector3(0, -50, 0), // confluence point
                new THREE.Vector3(
                    Math.cos(angle) * radius,
                    -48,
                    Math.sin(angle) * radius
                )
            ];
            
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            const bridle = new THREE.Line(geometry, bridleMaterial);
            
            this.bridles.push(bridle);
            this.group.add(bridle);
        }
    }
    
    createMortarSystem() {
        // Mortar cover that's ejected during deployment
        const coverGeometry = new THREE.CylinderGeometry(1.5, 1.5, 0.5, 16);
        const coverMaterial = new THREE.MeshStandardMaterial({
            color: 0x888888,
            metalness: 0.6,
            roughness: 0.4
        });
        
        this.mortarCover = new THREE.Mesh(coverGeometry, coverMaterial);
        this.mortarCover.position.y = 10;
        this.mortarCover.castShadow = true;
        
        this.group.add(this.mortarCover);
    }
    
    // Deployment methods
    deploy() {
        if (!this.specs.deployed) {
            this.specs.deployed = true;
            this.specs.deploymentProgress = 0;
            
            // Eject mortar cover
            if (this.mortarCover) {
                this.mortarCover.userData.ejected = true;
                this.mortarCover.userData.velocity = new THREE.Vector3(
                    (Math.random() - 0.5) * 10,
                    20,
                    (Math.random() - 0.5) * 10
                );
            }
        }
    }
    
    collapse() {
        // Collapse parachute to packed state
        this.specs.deployed = false;
        this.specs.deploymentProgress = 0;
        
        // Collapse canopy
        if (this.canopy) {
            const positions = this.canopy.geometry.attributes.position;
            for (let i = 0; i < positions.count; i++) {
                positions.setY(i, 0);
            }
            positions.needsUpdate = true;
            this.canopy.geometry.computeVertexNormals();
        }
        
        // Hide suspension lines
        this.suspensionLines.forEach(line => {
            line.visible = false;
        });
    }
    
    // Physics simulation
    updatePhysics(deltaTime, velocity, altitude) {
        if (!this.specs.deployed) return;
        
        // Update deployment progress
        if (this.specs.deploymentProgress < 1) {
            this.specs.deploymentProgress += deltaTime * this.physics.inflationRate;
            this.specs.deploymentProgress = Math.min(1, this.specs.deploymentProgress);
            
            // Inflate canopy
            this.inflateCanopy(this.specs.deploymentProgress);
            
            // Show suspension lines progressively
            const visibleLines = Math.floor(this.suspensionLines.length * this.specs.deploymentProgress);
            this.suspensionLines.forEach((line, index) => {
                line.visible = index < visibleLines;
            });
        }
        
        // Calculate drag force
        const dynamicPressure = 0.5 * this.getAtmosphericDensity(altitude) * velocity * velocity;
        const dragForce = dynamicPressure * this.physics.drag * Math.PI * 
                         Math.pow(this.specs.diameter / 2, 2) * this.specs.deploymentProgress;
        
        // Add turbulence
        this.physics.turbulence = Math.min(1, dynamicPressure / 1000);
        
        // Update wind effects
        this.time += deltaTime;
        this.updateWindEffects(deltaTime);
    }
    
    inflateCanopy(progress) {
        const positions = this.canopy.geometry.attributes.position;
        
        for (let i = 0; i < positions.count; i++) {
            const originalY = this.originalPositions[i * 3 + 1];
            
            // Inflate from center outward
            const x = this.originalPositions[i * 3];
            const z = this.originalPositions[i * 3 + 2];
            const distanceFromCenter = Math.sqrt(x * x + z * z);
            const inflationDelay = distanceFromCenter / (this.specs.diameter / 2);
            const localProgress = Math.max(0, (progress - inflationDelay * 0.3) / (1 - inflationDelay * 0.3));
            
            // Set height with inflation progress
            positions.setY(i, originalY * localProgress);
            
            // Add some random flutter during inflation
            if (localProgress > 0 && localProgress < 1) {
                const flutter = (Math.random() - 0.5) * 2;
                positions.setY(i, positions.getY(i) + flutter);
            }
        }
        
        positions.needsUpdate = true;
        this.canopy.geometry.computeVertexNormals();
    }
    
    updateWindEffects(deltaTime) {
        if (this.specs.deploymentProgress < 1) return;
        
        const positions = this.canopy.geometry.attributes.position;
        
        // Sway motion
        const swayX = Math.sin(this.time * 0.5 + this.swayPhase) * this.physics.swayAmount;
        const swayZ = Math.cos(this.time * 0.7 + this.swayPhase) * this.physics.swayAmount;
        
        // Apply deformation to canopy
        for (let i = 0; i < positions.count; i++) {
            const originalX = this.originalPositions[i * 3];
            const originalY = this.originalPositions[i * 3 + 1];
            const originalZ = this.originalPositions[i * 3 + 2];
            
            // Distance from center affects deformation amount
            const distanceFromCenter = Math.sqrt(originalX * originalX + originalZ * originalZ);
            const deformationAmount = distanceFromCenter / (this.specs.diameter / 2);
            
            // Apply wind deformation
            const windX = this.physics.windForce.x * deformationAmount;
            const windZ = this.physics.windForce.z * deformationAmount;
            
            // Turbulence
            const turbulenceX = (Math.random() - 0.5) * this.physics.turbulence * 2;
            const turbulenceY = (Math.random() - 0.5) * this.physics.turbulence;
            const turbulenceZ = (Math.random() - 0.5) * this.physics.turbulence * 2;
            
            // Breathing effect (expansion/contraction)
            const breathing = Math.sin(this.time * 2) * 0.02;
            const scale = 1 + breathing * deformationAmount;
            
            // Apply all effects
            positions.setX(i, originalX * scale + swayX + windX + turbulenceX);
            positions.setY(i, originalY + turbulenceY);
            positions.setZ(i, originalZ * scale + swayZ + windZ + turbulenceZ);
        }
        
        positions.needsUpdate = true;
        this.canopy.geometry.computeVertexNormals();
        
        // Update suspension lines to follow canopy
        this.updateSuspensionLines();
    }
    
    updateSuspensionLines() {
        const canopyPositions = this.canopy.geometry.attributes.position;
        
        this.suspensionLines.forEach((line, index) => {
            const userData = line.userData;
            const geometry = line.geometry;
            const positions = geometry.attributes.position;
            
            // Find attachment point on canopy
            const angle = userData.angle;
            const attachmentRadius = (this.specs.diameter / 2) * 0.95;
            
            // Get canopy deformed position at attachment point
            // This is simplified - in reality, we'd find the exact vertex
            const canopyX = Math.cos(angle) * attachmentRadius;
            const canopyZ = Math.sin(angle) * attachmentRadius;
            let canopyY = 0;
            
            // Find approximate Y position from canopy
            for (let i = 0; i < canopyPositions.count; i++) {
                const x = canopyPositions.getX(i);
                const z = canopyPositions.getZ(i);
                const dist = Math.sqrt(
                    Math.pow(x - canopyX, 2) + 
                    Math.pow(z - canopyZ, 2)
                );
                
                if (dist < 1) {
                    canopyY = canopyPositions.getY(i);
                    break;
                }
            }
            
            // Update line top position
            positions.setXYZ(0, canopyX, canopyY, canopyZ);
            
            // Update intermediate points with physics
            const pointCount = positions.count;
            for (let i = 1; i < pointCount - 1; i++) {
                const t = i / (pointCount - 1);
                
                // Add dynamic sway to lines
                const sway = Math.sin(this.time * 3 + index * 0.1) * 0.5 * (1 - t);
                const x = positions.getX(i) + sway;
                const z = positions.getZ(i) + Math.cos(this.time * 3 + index * 0.1) * 0.5 * (1 - t);
                
                positions.setX(i, x * 0.9 + positions.getX(i) * 0.1); // Damping
                positions.setZ(i, z * 0.9 + positions.getZ(i) * 0.1);
            }
            
            positions.needsUpdate = true;
        });
    }
    
    // Utility methods
    getAtmosphericDensity(altitude) {
        // Simplified Mars atmospheric model
        const scaleHeight = 11100; // meters
        const surfaceDensity = 0.020; // kg/m³
        return surfaceDensity * Math.exp(-altitude / scaleHeight);
    }
    
    setWindForce(force) {
        this.physics.windForce.copy(force);
    }
    
    // Main update method
    update(deltaTime, spacecraftVelocity = 0, altitude = 10000) {
        // Update physics simulation
        this.updatePhysics(deltaTime, spacecraftVelocity, altitude);
        
        // Animate ejected mortar cover
        if (this.mortarCover && this.mortarCover.userData.ejected) {
            const velocity = this.mortarCover.userData.velocity;
            this.mortarCover.position.add(velocity.clone().multiplyScalar(deltaTime));
            velocity.y -= 9.8 * deltaTime; // Gravity
            
            this.mortarCover.rotation.x += deltaTime * 5;
            this.mortarCover.rotation.z += deltaTime * 3;
            
            // Remove when far away
            if (this.mortarCover.position.length() > 100) {
                this.group.remove(this.mortarCover);
                this.mortarCover = null;
            }
        }
        
        // Overall parachute motion
        if (this.specs.deployed && this.specs.deploymentProgress > 0.5) {
            // Pendulum motion
            this.group.rotation.x = Math.sin(this.time * 0.3) * 0.05 * this.physics.turbulence;
            this.group.rotation.z = Math.cos(this.time * 0.4) * 0.05 * this.physics.turbulence;
        }
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => {
                        if (mat.map) mat.map.dispose();
                        mat.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        });
    }
}

// Usage example:
/*
const parachute = new Parachute();
scene.add(parachute.group);

// Deploy parachute
parachute.deploy();

// Set wind conditions
parachute.setWindForce(new THREE.Vector3(5, 0, 2));

// In animation loop
parachute.update(deltaTime, spacecraftVelocity, altitude);

// The parachute will automatically:
// - Inflate progressively
// - React to atmospheric conditions
// - Sway and deform realistically
// - Show turbulence effects
*/