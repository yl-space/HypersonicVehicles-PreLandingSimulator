export class EntryVehicle {
    constructor() {
        this.mesh = new THREE.Group();
        this.position = new THREE.Vector3();
        this.velocity = new THREE.Vector3();
        
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
        // Aeroshell
        const aeroshellGeometry = new THREE.ConeGeometry(4.5, 3.5, 32);
        const aeroshellMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513, shininess: 30 });
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
        
        // Scale for visibility
        this.mesh.scale.setScalar(100);
        
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
        
        const scale = 0.001;
        this.position.set(
            trajectoryData.x * scale,
            trajectoryData.z * scale,
            trajectoryData.y * scale
        );
        this.mesh.position.copy(this.position);
        
        const marsRadius = 3390000;
        const distanceFromCenter = Math.sqrt(
            trajectoryData.x ** 2 + trajectoryData.y ** 2 + trajectoryData.z ** 2
        );
        this.altitude = Math.max(0, distanceFromCenter - marsRadius);
        
        this.updateOrientation(trajectoryData);
        this.updatePhaseVisuals();
    }
    
    updateOrientation(trajectoryData) {
        if (this.previousData) {
            this.velocity.set(
                trajectoryData.x - this.previousData.x,
                trajectoryData.z - this.previousData.z,
                trajectoryData.y - this.previousData.y
            );
            this.speed = this.velocity.length() * 100;
            
            if (this.velocity.length() > 0) {
                const direction = this.velocity.clone().normalize();
                this.mesh.lookAt(this.mesh.position.clone().add(direction));
            }
        }
        this.previousData = { ...trajectoryData };
    }
    
    updatePhaseVisuals() {
        const altitudeKm = this.altitude / 1000;
        
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
        }
        
        if (this.effects) {
            this.effects.material.opacity = heatIntensity * 0.8;
            this.effects.visible = heatIntensity > 0.1;
        }
        
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
        
        const deployAnimation = () => {
            if (this.parachute.scale.x < 1) {
                this.parachute.scale.addScalar(0.02);
                requestAnimationFrame(deployAnimation);
            }
        };
        deployAnimation();
        
        this.phase = 'parachute';
    }
    
    update(deltaTime) {
        if (this.effects && this.effects.visible) {
            const positions = this.effects.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i + 1] -= deltaTime * 20;
                if (positions[i + 1] < -10) {
                    positions[i + 1] = 0;
                }
            }
            this.effects.geometry.attributes.position.needsUpdate = true;
        }
        
        if (this.parachute) {
            this.parachute.rotation.z = Math.sin(Date.now() * 0.001) * 0.1;
        }
        
        if (this.phase === 'entry') {
            this.mesh.rotation.y += deltaTime * 0.1;
        }
    }
    
    getAltitude() { return this.altitude; }
    getSpeed() { return this.speed; }
    getTemperature() { return this.temperature; }
    getGForce() { return this.gForce; }
    getPhase() { return this.phase; }
}

export class Mars {
    constructor() {
        this.mesh = new THREE.Group();
        this.createPlanet();
        this.createAtmosphere();
    }
    
    createPlanet() {
        const geometry = new THREE.SphereGeometry(3390, 64, 32);
        
        // Procedural Mars texture
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#CD5C5C');
        gradient.addColorStop(0.5, '#A0522D');
        gradient.addColorStop(1, '#8B4513');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 512);
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.MeshPhongMaterial({ map: texture, shininess: 5 });
        
        this.planet = new THREE.Mesh(geometry, material);
        this.planet.receiveShadow = true;
        this.mesh.add(this.planet);
        
        this.highlightLandingZone(-5.4, 137.8, 50);
    }
    
    createAtmosphere() {
        const geometry = new THREE.SphereGeometry(3450, 32, 16);
        const material = new THREE.MeshBasicMaterial({
            color: 0xFF6B35,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        
        this.atmosphere = new THREE.Mesh(geometry, material);
        this.mesh.add(this.atmosphere);
    }
    
    highlightLandingZone(lat, lon, radius) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);
        
        const x = 3390 * Math.sin(phi) * Math.cos(theta);
        const y = 3390 * Math.cos(phi);
        const z = 3390 * Math.sin(phi) * Math.sin(theta);
        
        const markerGeometry = new THREE.RingGeometry(radius * 0.8, radius, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00FF00,
            transparent: true,
            opacity: 0.7,
            side: THREE.DoubleSide
        });
        
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(x, y, z);
        marker.lookAt(0, 0, 0);
        this.mesh.add(marker);
    }
}

export class Stars {
    constructor() {
        this.mesh = new THREE.Group();
        this.createStarField();
    }
    
    createStarField() {
        const geometry = new THREE.BufferGeometry();
        const starCount = 10000;
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const radius = 5000000;
            
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            const brightness = Math.random();
            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true
        });
        
        const stars = new THREE.Points(geometry, material);
        this.mesh.add(stars);
    }
}