// client/src/components/spacecraft/Rover.js
import * as THREE from 'three';

/**
 * Rover Component - Perseverance Mars Rover
 * 
 * This component teaches:
 * 1. Complex geometry construction
 * 2. Articulated components (wheels, arm, mast)
 * 3. Animation systems for mechanical parts
 * 4. LOD (Level of Detail) for performance
 */
export class Rover {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = 'Perseverance Rover';
        
        // Rover dimensions (scaled for visualization)
        this.dimensions = {
            body: { width: 2.7, height: 2.2, depth: 3 },
            wheel: { radius: 0.5, width: 0.3 },
            wheelbase: { front: 1.2, rear: 1.2, width: 2.5 }
        };
        
        // Component references for animation
        this.wheels = [];
        this.steeringWheels = [];
        this.arm = null;
        this.mastCamera = null;
        this.antennas = [];
        
        // Animation states
        this.isDriving = false;
        this.wheelRotation = 0;
        this.armPosition = 0;
        this.mastRotation = 0;
        
        // Build the rover
        this.createBody();
        this.createWheels();
        this.createRoboticArm();
        this.createMastAndCameras();
        this.createAntennas();
        this.createScientificInstruments();
        
        // Setup LOD for distant viewing
        this.setupLOD();
    }
    
    createBody() {
        // Main rover body - using a more complex geometry
        const bodyGroup = new THREE.Group();
        bodyGroup.name = 'RoverBody';
        
        // Main chassis
        const chassisGeometry = new THREE.BoxGeometry(
            this.dimensions.body.width,
            this.dimensions.body.height * 0.6,
            this.dimensions.body.depth
        );
        
        // Create metallic material with texture support
        const chassisMaterial = new THREE.MeshStandardMaterial({
            color: 0xe8e8e8,
            metalness: 0.6,
            roughness: 0.4,
            envMapIntensity: 0.5
        });
        
        const chassis = new THREE.Mesh(chassisGeometry, chassisMaterial);
        chassis.position.y = 0.8;
        chassis.castShadow = true;
        chassis.receiveShadow = true;
        bodyGroup.add(chassis);
        
        // Equipment deck (top section)
        const deckGeometry = new THREE.BoxGeometry(
            this.dimensions.body.width * 0.9,
            this.dimensions.body.height * 0.4,
            this.dimensions.body.depth * 0.9
        );
        
        const deck = new THREE.Mesh(deckGeometry, chassisMaterial);
        deck.position.y = 1.5;
        bodyGroup.add(deck);
        
        // RTG (Radioisotope Thermoelectric Generator)
        const rtgGeometry = new THREE.CylinderGeometry(0.3, 0.3, 1.2, 8);
        const rtgMaterial = new THREE.MeshStandardMaterial({
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const rtg = new THREE.Mesh(rtgGeometry, rtgMaterial);
        rtg.rotation.z = Math.PI / 2;
        rtg.position.set(-1.2, 1.2, -0.8);
        bodyGroup.add(rtg);
        
        // Add detail panels and equipment
        this.addBodyDetails(bodyGroup);
        
        this.group.add(bodyGroup);
    }
    
    addBodyDetails(bodyGroup) {
        // Side panels with different colors/materials
        const panelMaterial = new THREE.MeshStandardMaterial({
            color: 0xccaa88,
            metalness: 0.3,
            roughness: 0.7
        });
        
        // Electronics boxes
        const boxGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.3);
        const positions = [
            { x: 1.1, y: 1.2, z: 0.5 },
            { x: 1.1, y: 1.2, z: -0.5 },
            { x: -1.1, y: 1.2, z: 0.5 }
        ];
        
        positions.forEach(pos => {
            const box = new THREE.Mesh(boxGeometry, panelMaterial);
            box.position.set(pos.x, pos.y, pos.z);
            box.castShadow = true;
            bodyGroup.add(box);
        });
    }
    
    createWheels() {
        // Rocker-bogie suspension system
        const wheelMaterial = new THREE.MeshStandardMaterial({
            color: 0x222222,
            metalness: 0.3,
            roughness: 0.8
        });
        
        // Wheel positions (6 wheels total)
        const wheelPositions = [
            // Front wheels (steerable)
            { x: this.dimensions.wheelbase.width / 2, y: 0, z: this.dimensions.wheelbase.front, steering: true },
            { x: -this.dimensions.wheelbase.width / 2, y: 0, z: this.dimensions.wheelbase.front, steering: true },
            // Middle wheels
            { x: this.dimensions.wheelbase.width / 2, y: 0, z: 0, steering: false },
            { x: -this.dimensions.wheelbase.width / 2, y: 0, z: 0, steering: false },
            // Rear wheels (steerable)
            { x: this.dimensions.wheelbase.width / 2, y: 0, z: -this.dimensions.wheelbase.rear, steering: true },
            { x: -this.dimensions.wheelbase.width / 2, y: 0, z: -this.dimensions.wheelbase.rear, steering: true }
        ];
        
        wheelPositions.forEach((pos, index) => {
            const wheelGroup = new THREE.Group();
            wheelGroup.position.set(pos.x, this.dimensions.wheel.radius, pos.z);
            
            // Wheel geometry with tread pattern
            const wheel = this.createWheel(wheelMaterial);
            wheelGroup.add(wheel);
            
            // Suspension arm (simplified)
            const suspensionGeometry = new THREE.BoxGeometry(0.1, 0.4, 0.1);
            const suspensionMaterial = new THREE.MeshStandardMaterial({
                color: 0x666666,
                metalness: 0.7
            });
            
            const suspension = new THREE.Mesh(suspensionGeometry, suspensionMaterial);
            suspension.position.y = 0.3;
            wheelGroup.add(suspension);
            
            // Store references
            this.wheels.push(wheel);
            if (pos.steering) {
                this.steeringWheels.push(wheelGroup);
            }
            
            this.group.add(wheelGroup);
        });
    }
    
    createWheel(material) {
        const wheelGroup = new THREE.Group();
        
        // Main wheel cylinder
        const wheelGeometry = new THREE.CylinderGeometry(
            this.dimensions.wheel.radius,
            this.dimensions.wheel.radius,
            this.dimensions.wheel.width,
            32
        );
        
        const wheel = new THREE.Mesh(wheelGeometry, material);
        wheel.rotation.z = Math.PI / 2;
        wheel.castShadow = true;
        wheelGroup.add(wheel);
        
        // Add tread pattern
        const treadCount = 12;
        const treadGeometry = new THREE.BoxGeometry(
            this.dimensions.wheel.radius * 2,
            0.05,
            this.dimensions.wheel.width
        );
        
        const treadMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.2,
            roughness: 0.9
        });
        
        for (let i = 0; i < treadCount; i++) {
            const angle = (i / treadCount) * Math.PI * 2;
            const tread = new THREE.Mesh(treadGeometry, treadMaterial);
            
            tread.position.x = Math.cos(angle) * this.dimensions.wheel.radius;
            tread.position.y = Math.sin(angle) * this.dimensions.wheel.radius;
            tread.rotation.z = angle;
            
            wheelGroup.add(tread);
        }
        
        return wheelGroup;
    }
    
    createRoboticArm() {
        // 5-degree-of-freedom robotic arm
        const armGroup = new THREE.Group();
        armGroup.name = 'RoboticArm';
        armGroup.position.set(0.8, 1.5, 1.2);
        
        const segmentMaterial = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            metalness: 0.7,
            roughness: 0.3
        });
        
        // Base joint
        const baseGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.3, 16);
        const base = new THREE.Mesh(baseGeometry, segmentMaterial);
        armGroup.add(base);
        
        // Upper arm
        const upperArmGroup = new THREE.Group();
        upperArmGroup.position.y = 0.15;
        
        const upperArmGeometry = new THREE.BoxGeometry(0.1, 0.8, 0.1);
        const upperArm = new THREE.Mesh(upperArmGeometry, segmentMaterial);
        upperArm.position.y = 0.4;
        upperArmGroup.add(upperArm);
        
        // Elbow joint
        const elbowGeometry = new THREE.SphereGeometry(0.08, 16, 16);
        const elbow = new THREE.Mesh(elbowGeometry, segmentMaterial);
        elbow.position.y = 0.8;
        upperArmGroup.add(elbow);
        
        // Forearm
        const forearmGroup = new THREE.Group();
        forearmGroup.position.y = 0.8;
        
        const forearmGeometry = new THREE.BoxGeometry(0.08, 0.6, 0.08);
        const forearm = new THREE.Mesh(forearmGeometry, segmentMaterial);
        forearm.position.y = 0.3;
        forearmGroup.add(forearm);
        
        // End effector (turret with instruments)
        const turretGroup = new THREE.Group();
        turretGroup.position.y = 0.6;
        
        const turretGeometry = new THREE.CylinderGeometry(0.15, 0.15, 0.2, 16);
        const turret = new THREE.Mesh(turretGeometry, segmentMaterial);
        turretGroup.add(turret);
        
        // Add instruments to turret
        this.addArmInstruments(turretGroup);
        
        // Build hierarchy
        forearmGroup.add(turretGroup);
        upperArmGroup.add(forearmGroup);
        armGroup.add(upperArmGroup);
        
        // Store references for animation
        this.arm = {
            base: armGroup,
            upperArm: upperArmGroup,
            forearm: forearmGroup,
            turret: turretGroup
        };
        
        this.group.add(armGroup);
    }
    
    addArmInstruments(turretGroup) {
        // PIXL (X-ray spectrometer)
        const pixlGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.1, 8);
        const pixlMaterial = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.8
        });
        
        const pixl = new THREE.Mesh(pixlGeometry, pixlMaterial);
        pixl.position.set(0.1, 0, 0);
        pixl.rotation.z = Math.PI / 2;
        turretGroup.add(pixl);
        
        // Drill
        const drillGeometry = new THREE.ConeGeometry(0.02, 0.15, 8);
        const drillMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.9,
            roughness: 0.1
        });
        
        const drill = new THREE.Mesh(drillGeometry, drillMaterial);
        drill.position.set(-0.1, -0.1, 0);
        drill.rotation.x = Math.PI;
        turretGroup.add(drill);
    }
    
    createMastAndCameras() {
        // Remote Sensing Mast (RSM)
        const mastGroup = new THREE.Group();
        mastGroup.name = 'RemoteSensingMast';
        mastGroup.position.set(0.3, 1.8, 0.8);
        
        // Mast pole
        const mastGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1.2, 16);
        const mastMaterial = new THREE.MeshStandardMaterial({
            color: 0x999999,
            metalness: 0.7,
            roughness: 0.3
        });
        
        const mast = new THREE.Mesh(mastGeometry, mastMaterial);
        mast.position.y = 0.6;
        mastGroup.add(mast);
        
        // Camera head
        const headGroup = new THREE.Group();
        headGroup.position.y = 1.2;
        
        // Main head box
        const headGeometry = new THREE.BoxGeometry(0.3, 0.2, 0.2);
        const head = new THREE.Mesh(headGeometry, mastMaterial);
        headGroup.add(head);
        
        // Mastcam-Z cameras (stereoscopic pair)
        const cameraGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16);
        const cameraMaterial = new THREE.MeshStandardMaterial({
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.2
        });
        
        const leftCamera = new THREE.Mesh(cameraGeometry, cameraMaterial);
        leftCamera.position.set(-0.08, 0, 0.12);
        leftCamera.rotation.x = Math.PI / 2;
        headGroup.add(leftCamera);
        
        const rightCamera = new THREE.Mesh(cameraGeometry, cameraMaterial);
        rightCamera.position.set(0.08, 0, 0.12);
        rightCamera.rotation.x = Math.PI / 2;
        headGroup.add(rightCamera);
        
        // Add lens details
        const lensGeometry = new THREE.CircleGeometry(0.03, 16);
        const lensMaterial = new THREE.MeshStandardMaterial({
            color: 0x001144,
            metalness: 0.9,
            roughness: 0.1
        });
        
        const leftLens = new THREE.Mesh(lensGeometry, lensMaterial);
        leftLens.position.set(-0.08, 0, 0.161);
        headGroup.add(leftLens);
        
        const rightLens = new THREE.Mesh(lensGeometry, lensMaterial);
        rightLens.position.set(0.08, 0, 0.161);
        headGroup.add(rightLens);
        
        mastGroup.add(headGroup);
        
        // Store reference for animation
        this.mastCamera = headGroup;
        
        this.group.add(mastGroup);
    }
    
    createAntennas() {
        // High-gain antenna
        const hgaGroup = new THREE.Group();
        hgaGroup.position.set(-0.8, 1.8, -0.5);
        
        // Dish
        const dishGeometry = new THREE.SphereGeometry(0.3, 16, 16, 0, Math.PI);
        const dishMaterial = new THREE.MeshStandardMaterial({
            color: 0xeeeeee,
            metalness: 0.5,
            roughness: 0.3,
            side: THREE.DoubleSide
        });
        
        const dish = new THREE.Mesh(dishGeometry, dishMaterial);
        dish.rotation.x = -Math.PI / 2;
        dish.rotation.z = Math.PI / 6;
        hgaGroup.add(dish);
        
        // Feed horn
        const hornGeometry = new THREE.ConeGeometry(0.02, 0.1, 8);
        const horn = new THREE.Mesh(hornGeometry, dishMaterial);
        horn.position.z = 0.15;
        hgaGroup.add(horn);
        
        this.antennas.push(hgaGroup);
        this.group.add(hgaGroup);
        
        // UHF antenna
        const uhfGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.4, 8);
        const uhfMaterial = new THREE.MeshStandardMaterial({
            color: 0x666666,
            metalness: 0.8
        });
        
        const uhf = new THREE.Mesh(uhfGeometry, uhfMaterial);
        uhf.position.set(0.5, 2.2, -0.8);
        this.antennas.push(uhf);
        this.group.add(uhf);
    }
    
    createScientificInstruments() {
        // SuperCam
        const supercamGroup = new THREE.Group();
        supercamGroup.position.set(0.3, 2.2, 0.8);
        
        const supercamGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.25);
        const supercamMaterial = new THREE.MeshStandardMaterial({
            color: 0x885533,
            metalness: 0.4,
            roughness: 0.6
        });
        
        const supercam = new THREE.Mesh(supercamGeometry, supercamMaterial);
        supercamGroup.add(supercam);
        
        // Laser aperture
        const laserGeometry = new THREE.CircleGeometry(0.03, 16);
        const laserMaterial = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            emissive: 0xff0000,
            emissiveIntensity: 0.5
        });
        
        const laser = new THREE.Mesh(laserGeometry, laserMaterial);
        laser.position.z = 0.126;
        supercamGroup.add(laser);
        
        this.group.add(supercamGroup);
    }
    
    setupLOD() {
        // Create LOD levels for performance
        this.lod = new THREE.LOD();
        
        // High detail (current model)
        this.lod.addLevel(this.group, 0);
        
        // Medium detail (simplified)
        const mediumDetail = this.createMediumDetailModel();
        this.lod.addLevel(mediumDetail, 50);
        
        // Low detail (very simple)
        const lowDetail = this.createLowDetailModel();
        this.lod.addLevel(lowDetail, 100);
        
        return this.lod;
    }
    
    createMediumDetailModel() {
        const group = new THREE.Group();
        
        // Simplified body
        const bodyGeometry = new THREE.BoxGeometry(
            this.dimensions.body.width,
            this.dimensions.body.height,
            this.dimensions.body.depth
        );
        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8e8e8 });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.position.y = 1.2;
        group.add(body);
        
        // Simplified wheels
        const wheelMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
        const wheelPositions = [
            { x: 1.2, z: 1.2 }, { x: -1.2, z: 1.2 },
            { x: 1.2, z: 0 }, { x: -1.2, z: 0 },
            { x: 1.2, z: -1.2 }, { x: -1.2, z: -1.2 }
        ];
        
        wheelPositions.forEach(pos => {
            const wheelGeometry = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
            const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(pos.x, 0.5, pos.z);
            group.add(wheel);
        });
        
        return group;
    }
    
    createLowDetailModel() {
        const group = new THREE.Group();
        
        // Single box for entire rover
        const geometry = new THREE.BoxGeometry(3, 2, 3);
        const material = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.y = 1;
        group.add(mesh);
        
        return group;
    }
    
    // Animation methods
    update(deltaTime, terrain = null) {
        if (this.isDriving) {
            // Rotate wheels
            this.wheelRotation += deltaTime * 2;
            this.wheels.forEach(wheel => {
                wheel.rotation.x = this.wheelRotation;
            });
            
            // Simple terrain following
            if (terrain) {
                const position = this.group.position;
                const terrainHeight = terrain.getHeightAtPosition(position.x, position.z);
                
                // Smooth height adjustment
                const targetY = terrainHeight + this.dimensions.wheel.radius;
                position.y = THREE.MathUtils.lerp(position.y, targetY, deltaTime * 5);
                
                // Tilt based on terrain slope
                const slope = terrain.getSlopeAtPosition(position.x, position.z);
                this.group.rotation.x = THREE.MathUtils.lerp(
                    this.group.rotation.x,
                    slope.x * 0.1,
                    deltaTime * 2
                );
                this.group.rotation.z = THREE.MathUtils.lerp(
                    this.group.rotation.z,
                    slope.z * 0.1,
                    deltaTime * 2
                );
            }
        }
        
        // Animate mast camera scanning
        if (this.mastCamera) {
            this.mastRotation += deltaTime * 0.3;
            this.mastCamera.rotation.y = Math.sin(this.mastRotation) * 0.5;
        }
        
        // Animate robotic arm
        if (this.arm && this.arm.upperArm) {
            this.armPosition += deltaTime * 0.2;
            this.arm.upperArm.rotation.z = Math.sin(this.armPosition) * 0.3;
            this.arm.forearm.rotation.z = Math.sin(this.armPosition * 1.5) * 0.4;
            this.arm.turret.rotation.y += deltaTime * 0.5;
        }
    }
    
    drive(direction, speed = 1) {
        this.isDriving = true;
        
        // Calculate movement based on current rotation
        const forward = new THREE.Vector3(0, 0, 1);
        forward.applyQuaternion(this.group.quaternion);
        forward.multiplyScalar(speed * direction);
        
        this.group.position.add(forward);
    }
    
    steer(angle) {
        // Rotate steering wheels
        this.steeringWheels.forEach(wheel => {
            wheel.rotation.y = angle;
        });
        
        // Rotate rover body
        this.group.rotation.y += angle * 0.02;
    }
    
    stop() {
        this.isDriving = false;
    }
    
    deployArm() {
        // Animate arm deployment
        // This would be more complex in a real simulation
        if (this.arm) {
            this.arm.base.rotation.y += 0.02;
        }
    }
    
    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(mat => mat.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });
    }
}

// Usage example:
/*
const rover = new Rover();
scene.add(rover.lod || rover.group);

// In animation loop
rover.update(deltaTime, marsTerrainSystem);

// Control rover
rover.drive(1, 0.5); // Forward at half speed
rover.steer(0.1); // Turn slightly right
rover.deployArm();
*/