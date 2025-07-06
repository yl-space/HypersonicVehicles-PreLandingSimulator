export class EntryVehicle {
    constructor() {
        this.mesh = new THREE.Group();
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        this.rotation = new THREE.Euler();
        
        this.altitude = 132000;
        this.speed = 5800;
        this.temperature = 300;
        this.gForce = 0;
        this.phase = 'entry';
        
        this.parachute = null;
        this.effects = null;
        
        this.createGeometry();
    }
    
    createGeometry() {
        // Main aeroshell
        const aeroshellGeometry = new THREE.ConeGeometry(4.5, 3.5, 32);
        const aeroshellMaterial = new THREE.MeshPhongMaterial({
            color: 0x8B4513,
            shininess: 30
        });
        this.aeroshell = new THREE.Mesh(aeroshellGeometry, aeroshellMaterial);
        this.aeroshell.castShadow = true;
        this.mesh.add(this.aeroshell);
        
        // Heat shield
        const heatShieldGeometry = new THREE.ConeGeometry(4.5, 0.5, 32);
        const heatShieldMaterial = new THREE.MeshPhongMaterial({
            color: 0x2F1B14,
            emissive: 0x331100,
            emissiveIntensity: 0.3
        });
        this.heatShieldMesh = new THREE.Mesh(heatShieldGeometry, heatShieldMaterial);
        this.heatShieldMesh.position.y = -2;
        this.mesh.add(this.heatShieldMesh);
        
        // Backshell
        const backshellGeometry = new THREE.SphereGeometry(4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const backshellMaterial = new THREE.MeshPhongMaterial({
            color: 0xC0C0C0,
            shininess: 50
        });
        this.backshell = new THREE.Mesh(backshellGeometry, backshellMaterial);
        this.backshell.position.y = 1.5;
        this.mesh.add(this.backshell);
        
        // Scale for visibility
        this.mesh.scale.setScalar(100);
        
        // Create heat effects
        this.createHeatEffects();
    }
    
    createHeatEffects() {
        const particleCount = 500;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 10;
            positions[i3 + 1] = Math.random() * -5;
            positions[i3 + 2] = (Math.random() - 0.5) * 10;
            
            colors[i3] = 1;
            colors[i3 + 1] = Math.random() * 0.5;
            colors[i3 + 2] = 0;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 0.5,
            vertexColors: true,
            transparent: true,
            opacity: 0,
            blending: THREE.AdditiveBlending
        });
        
        this.effects = new THREE.Points(geometry, material);
        this.mesh.add(this.effects);
    }
    
    updateState(trajectoryData) {
        if (!trajectoryData) return;
        
        // Update position (convert from meters to Three.js units)
        const scale = 0.001;
        this.position.set(
            trajectoryData.x * scale,
            trajectoryData.z * scale,
            trajectoryData.y * scale
        );
        this.mesh.position.copy(this.position);
        
        // Calculate altitude
        const marsRadius = 3390000;
        const distanceFromCenter = Math.sqrt(
            trajectoryData.x * trajectoryData.x +
            trajectoryData.y * trajectoryData.y +
            trajectoryData.z * trajectoryData.z
        );
        this.altitude = Math.max(0, distanceFromCenter - marsRadius);
        
        // Update orientation
        this.updateOrientation(trajectoryData);
        
        // Update visual effects
        this.updatePhaseVisuals();
    }
    
    updateOrientation(trajectoryData) {
        if (this.previousData) {
            const dx = trajectoryData.x - this.previousData.x;
            const dy = trajectoryData.y - this.previousData.y;
            const dz = trajectoryData.z - this.previousData.z;
            
            this.velocity.set(dx, dz, dy);
            this.speed = this.velocity.length() * 100;
            
            if (this.velocity.length() > 0) {
                const direction = this.velocity.clone().normalize();
                this.mesh.lookAt(
                    this.mesh.position.clone().add(direction)
                );
            }
        }
        
        this.previousData = { ...trajectoryData };
    }
    
    updatePhaseVisuals() {
        const altitudeKm = this.altitude / 1000;
        
        // Heat effects intensity
        let heatIntensity = 0;
        if (altitudeKm > 60 && altitudeKm < 100) {
            heatIntensity = 1.0;
            this.temperature = 1500;
        } else if (altitudeKm > 30 && altitudeKm < 80) {
            heatIntensity = 0.7;
            this.temperature = 1200;
        } else if (altitudeKm > 15 && altitudeKm < 40) {
            heatIntensity = 0.4;
            this.temperature = 800;
        } else {
            heatIntensity = 0.1;
            this.temperature = 400;
        }
        
        if (this.effects) {
            this.effects.material.opacity = heatIntensity * 0.8;
            this.effects.visible = heatIntensity > 0.1;
        }
        
        // G-force calculation
        this.gForce = Math.max(0, (this.speed - 500) / 100);
    }
    
    deployParachute() {
        if (this.parachute) return;
        
        const parachuteGeometry = new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
        const parachuteMaterial = new THREE.MeshPhongMaterial({
            color: 0xFF4500,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        
        this.parachute = new THREE.Mesh(parachuteGeometry, parachuteMaterial);
        this.parachute.position.y = 15;
        this.parachute.scale.set(0, 0, 0);
        this.mesh.add(this.parachute);
        
        // Animate deployment
        const deployAnimation = () => {
            if (this.parachute.scale.x < 1) {
                this.parachute.scale.addScalar(0.02);
                requestAnimationFrame(deployAnimation);
            }
        };
        deployAnimation();
        
        this.phase = 'parachute';
    }
    
    getAltitude() { return this.altitude; }
    getSpeed() { return this.speed; }
    getTemperature() { return this.temperature; }
    getGForce() { return this.gForce; }
    getPhase() { return this.phase; }
}