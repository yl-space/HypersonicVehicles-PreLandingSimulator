export class Mars {
    constructor() {
        this.mesh = new THREE.Group();
        this.planet = null;
        this.atmosphere = null;
        this.createPlanet();
        this.createAtmosphere();
    }
    
    createPlanet() {
        const geometry = new THREE.SphereGeometry(3390, 64, 32);
        const material = new THREE.MeshPhongMaterial({
            color: 0xCD5C5C,
            shininess: 5
        });
        
        this.planet = new THREE.Mesh(geometry, material);
        this.planet.receiveShadow = true;
        this.mesh.add(this.planet);
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