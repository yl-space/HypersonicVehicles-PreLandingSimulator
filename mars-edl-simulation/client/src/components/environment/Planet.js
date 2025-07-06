import * as THREE from 'three';

/**
 * Planet Class
 * 
 * Handles:
 * 1. Planetary physical properties (mass, radius, atmosphere)
 * 2. Atmospheric density models
 * 3. 3D planet visualization
 * 4. Environmental effects
 */
export class Planet {
    constructor(name) {
        this.name = name;
        
        // Load planet data
        this.loadPlanetData();
        
        // 3D representation
        this.mesh = null;
        this.atmosphereMesh = null;
        
        // Environmental effects
        this.starField = null;
        this.clouds = null;
    }
    
    loadPlanetData() {
        // Planet database with realistic values
        const planetData = {
            jupiter: {
                name: 'Jupiter',
                radius: 3389500, // meters
                mass: 6.4171e23, // kg
                atmosphereHeight: 120000, // meters
                atmosphereComposition: {
                    CO2: 0.95,
                    N2: 0.027,
                    Ar: 0.016,
                    O2: 0.0013,
                    CO: 0.0007
                },
                surfaceGravity: 3.71, // m/s²
                escapeVelocity: 5020, // m/s
                orbitalPeriod: 687, // Earth days
                rotationPeriod: 24.6, // hours
                surfaceTemperature: 210, // Kelvin
                atmosphericPressure: 610, // Pa
                speedOfSound: 240, // m/s
                visualProperties: {
                    color: 0xc1440e,
                    texture: 'jupiter_surface',
                    atmosphereColor: 0xff6b35,
                    atmosphereOpacity: 0.1
                }
            },
            venus: {
                name: 'Venus',
                radius: 6051800, // meters
                mass: 4.8675e24, // kg
                atmosphereHeight: 250000, // meters
                atmosphereComposition: {
                    CO2: 0.965,
                    N2: 0.035,
                    SO2: 0.00015
                },
                surfaceGravity: 8.87, // m/s²
                escapeVelocity: 10360, // m/s
                orbitalPeriod: 225, // Earth days
                rotationPeriod: -243, // hours (retrograde)
                surfaceTemperature: 737, // Kelvin
                atmosphericPressure: 9200000, // Pa
                speedOfSound: 480, // m/s
                visualProperties: {
                    color: 0xe6b800,
                    texture: 'venus_surface',
                    atmosphereColor: 0xffd700,
                    atmosphereOpacity: 0.3
                }
            },
            titan: {
                name: 'Titan',
                radius: 2575000, // meters
                mass: 1.3452e23, // kg
                atmosphereHeight: 600000, // meters
                atmosphereComposition: {
                    N2: 0.97,
                    CH4: 0.029,
                    H2: 0.001
                },
                surfaceGravity: 1.352, // m/s²
                escapeVelocity: 2640, // m/s
                orbitalPeriod: 15.95, // Earth days
                rotationPeriod: 15.95, // hours
                surfaceTemperature: 94, // Kelvin
                atmosphericPressure: 146700, // Pa
                speedOfSound: 180, // m/s
                visualProperties: {
                    color: 0x8b4513,
                    texture: 'titan_surface',
                    atmosphereColor: 0xd2691e,
                    atmosphereOpacity: 0.2
                }
            },
            earth: {
                name: 'Earth',
                radius: 6371000, // meters
                mass: 5.97237e24, // kg
                atmosphereHeight: 100000, // meters
                atmosphereComposition: {
                    N2: 0.78,
                    O2: 0.21,
                    Ar: 0.0093,
                    CO2: 0.0004
                },
                surfaceGravity: 9.81, // m/s²
                escapeVelocity: 11186, // m/s
                orbitalPeriod: 365.25, // Earth days
                rotationPeriod: 24, // hours
                surfaceTemperature: 288, // Kelvin
                atmosphericPressure: 101325, // Pa
                speedOfSound: 343, // m/s
                visualProperties: {
                    color: 0x4b7f52,
                    texture: 'earth_surface',
                    atmosphereColor: 0x87ceeb,
                    atmosphereOpacity: 0.15
                }
            }
        };
        
        // Load data for this planet
        const data = planetData[this.name];
        if (!data) {
            throw new Error(`Unknown planet: ${this.name}`);
        }
        
        // Copy all properties
        Object.assign(this, data);
        
        // Calculate derived properties
        this.calculateDerivedProperties();
    }
    
    calculateDerivedProperties() {
        // Gravitational parameter (μ = GM)
        this.mu = this.G * this.mass;
        
        // Scale height for atmospheric density
        this.scaleHeight = this.calculateScaleHeight();
        
        // Orbital velocity at surface
        this.orbitalVelocity = Math.sqrt(this.mu / this.radius);
        
        // Atmospheric density at surface
        this.surfaceDensity = this.calculateAtmosphericDensity(0);
    }
    
    calculateScaleHeight() {
        // Scale height = RT/gM
        // Where R = universal gas constant, T = temperature, g = gravity, M = molar mass
        
        const R = 8.314; // J/(mol·K)
        const T = this.surfaceTemperature; // Kelvin
        const g = this.surfaceGravity; // m/s²
        
        // Calculate average molar mass of atmosphere
        const molarMasses = {
            CO2: 44.01,
            N2: 28.02,
            Ar: 39.95,
            O2: 32.00,
            CO: 28.01,
            CH4: 16.04,
            H2: 2.02,
            SO2: 64.07
        };
        
        let totalMolarMass = 0;
        let totalFraction = 0;
        
        for (const [gas, fraction] of Object.entries(this.atmosphereComposition)) {
            totalMolarMass += fraction * molarMasses[gas];
            totalFraction += fraction;
        }
        
        const averageMolarMass = totalMolarMass / totalFraction;
        
        return (R * T) / (g * averageMolarMass);
    }
    
    /**
     * Calculate atmospheric density at given altitude
     */
    calculateAtmosphericDensity(altitude) {
        if (altitude >= this.atmosphereHeight) {
            return 0; // No atmosphere
        }
        
        // Exponential atmosphere model: ρ = ρ₀ * exp(-h/H)
        // Where ρ₀ = surface density, h = altitude, H = scale height
        return this.surfaceDensity * Math.exp(-altitude / this.scaleHeight);
    }
    
    /**
     * Calculate atmospheric pressure at given altitude
     */
    calculateAtmosphericPressure(altitude) {
        if (altitude >= this.atmosphereHeight) {
            return 0; // No atmosphere
        }
        
        // Pressure follows same exponential model as density
        return this.atmosphericPressure * Math.exp(-altitude / this.scaleHeight);
    }
    
    /**
     * Calculate temperature at given altitude
     */
    calculateTemperature(altitude) {
        if (altitude >= this.atmosphereHeight) {
            return 2.7; // Cosmic microwave background
        }
        
        // Simplified temperature model
        // Temperature decreases with altitude in troposphere, then increases in stratosphere
        if (altitude < 11000) {
            // Troposphere: T = T₀ - 6.5°C/km
            return this.surfaceTemperature - (altitude * 0.0065);
        } else if (altitude < 50000) {
            // Stratosphere: T = T₁ + 1°C/km
            const tropopauseTemp = this.surfaceTemperature - (11000 * 0.0065);
            return tropopauseTemp + ((altitude - 11000) * 0.001);
        } else {
            // Mesosphere and above: T = T₂ - 2°C/km
            const stratopauseTemp = this.surfaceTemperature - (11000 * 0.0065) + (39000 * 0.001);
            return stratopauseTemp - ((altitude - 50000) * 0.002);
        }
    }
    
    /**
     * Create 3D planet mesh
     */
    async createMesh() {
        // Create planet sphere
        const geometry = new THREE.SphereGeometry(this.radius / 1000, 64, 64); // Scale down for visualization
        
        // Create material with planet texture
        const material = await this.createPlanetMaterial();
        
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        
        // Create atmosphere
        this.createAtmosphere();
        
        // Create star field
        this.createStarField();
        
        return this.mesh;
    }
    
    async createPlanetMaterial() {
        // Create procedural texture based on planet type
        const texture = await this.createPlanetTexture();
        
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            color: this.visualProperties.color,
            metalness: 0.1,
            roughness: 0.8,
            emissive: 0x000000,
            emissiveIntensity: 0
        });
        
        return material;
    }
    
    async createPlanetTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base color
        ctx.fillStyle = this.getBaseColor();
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add surface features based on planet type
        switch (this.name) {
            case 'jupiter':
                this.addJupiterFeatures(ctx);
                break;
            case 'venus':
                this.addVenusFeatures(ctx);
                break;
            case 'titan':
                this.addTitanFeatures(ctx);
                break;
            case 'earth':
                this.addEarthFeatures(ctx);
                break;
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        
        return texture;
    }
    
    getBaseColor() {
        const colors = {
            jupiter: '#c1440e',
            venus: '#e6b800',
            titan: '#8b4513',
            earth: '#4b7f52'
        };
        return colors[this.name] || '#808080';
    }
    
    addJupiterFeatures(ctx) {
        // Add craters
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const radius = Math.random() * 20 + 5;
            
            ctx.fillStyle = '#8b4513';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Crater rim
            ctx.strokeStyle = '#a0522d';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
        
        // Add dust storms
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const width = Math.random() * 100 + 50;
            const height = Math.random() * 30 + 10;
            
            ctx.fillStyle = 'rgba(139, 69, 19, 0.3)';
            ctx.fillRect(x, y, width, height);
        }
    }
    
    addVenusFeatures(ctx) {
        // Add cloud patterns
        for (let i = 0; i < 30; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const radius = Math.random() * 40 + 20;
            
            ctx.fillStyle = 'rgba(255, 215, 0, 0.4)';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add volcanic features
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const radius = Math.random() * 15 + 5;
            
            ctx.fillStyle = '#8b0000';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    addTitanFeatures(ctx) {
        // Add methane lakes
        for (let i = 0; i < 15; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const radius = Math.random() * 30 + 10;
            
            ctx.fillStyle = '#2f4f4f';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add hydrocarbon dunes
        for (let i = 0; i < 25; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const width = Math.random() * 80 + 40;
            const height = Math.random() * 20 + 10;
            
            ctx.fillStyle = '#654321';
            ctx.fillRect(x, y, width, height);
        }
    }
    
    addEarthFeatures(ctx) {
        // Add continents
        const continents = [
            { x: 100, y: 150, width: 200, height: 100 },
            { x: 600, y: 200, width: 150, height: 80 },
            { x: 300, y: 300, width: 180, height: 90 }
        ];
        
        continents.forEach(continent => {
            ctx.fillStyle = '#228b22';
            ctx.fillRect(continent.x, continent.y, continent.width, continent.height);
        });
        
        // Add oceans
        ctx.fillStyle = 'rgba(0, 105, 148, 0.6)';
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        
        // Add clouds
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * ctx.canvas.width;
            const y = Math.random() * ctx.canvas.height;
            const radius = Math.random() * 25 + 10;
            
            ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    createAtmosphere() {
        if (this.atmosphereHeight <= 0) return;
        
        const atmosphereGeometry = new THREE.SphereGeometry(
            (this.radius + this.atmosphereHeight) / 1000,
            64,
            64
        );
        
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: this.visualProperties.atmosphereColor,
            transparent: true,
            opacity: this.visualProperties.atmosphereOpacity,
            side: THREE.BackSide
        });
        
        this.atmosphereMesh = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.mesh.add(this.atmosphereMesh);
    }
    
    createStarField() {
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 10000;
        
        const positions = new Float32Array(starCount * 3);
        const colors = new Float32Array(starCount * 3);
        const sizes = new Float32Array(starCount);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            
            // Random position on a large sphere
            const radius = 1000000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Random star colors
            const brightness = Math.random();
            colors[i3] = brightness;
            colors[i3 + 1] = brightness;
            colors[i3 + 2] = brightness;
            
            sizes[i] = Math.random() * 2 + 0.5;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        starGeometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const starMaterial = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                
                void main() {
                    float dist = length(gl_PointCoord - vec2(0.5));
                    if (dist > 0.5) discard;
                    gl_FragColor = vec4(vColor, 1.0);
                }
            `,
            vertexColors: true,
            transparent: true
        });
        
        this.starField = new THREE.Points(starGeometry, starMaterial);
    }
    
    /**
     * Update planet (rotation, etc.)
     */
    update(deltaTime) {
        if (this.mesh) {
            // Rotate planet
            const rotationSpeed = (2 * Math.PI) / (this.rotationPeriod * 3600); // rad/s
            this.mesh.rotation.y += rotationSpeed * deltaTime;
        }
        
        if (this.starField) {
            // Update star field
            this.starField.material.uniforms.time.value += deltaTime;
        }
    }
    
    /**
     * Get planet mesh
     */
    getMesh() {
        return this.mesh;
    }
    
    /**
     * Get star field
     */
    getStarField() {
        return this.starField;
    }
    
    /**
     * Cleanup
     */
    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
        }
        
        if (this.atmosphereMesh) {
            this.atmosphereMesh.geometry.dispose();
            this.atmosphereMesh.material.dispose();
        }
        
        if (this.starField) {
            this.starField.geometry.dispose();
            this.starField.material.dispose();
        }
    }
} 