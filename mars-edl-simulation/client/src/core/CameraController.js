class CameraController {
    constructor(container) {
        this.container = container;
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            10000000
        );
        
        this.mode = 'FREE';
        this.target = new THREE.Vector3(0, 0, 0);
        this.targetObject = null;
        this.smoothingFactor = 0.05;
        
        this.mouseDown = false;
        this.mouseX = 0;
        this.mouseY = 0;
        this.cameraRotationX = 0;
        this.cameraRotationY = 0;
        
        this.setupControls();
        this.setInitialPosition();
    }
    
    setupControls() {
        this.container.addEventListener('mousedown', (e) => {
            if (this.mode !== 'FREE') return;
            this.mouseDown = true;
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        this.container.addEventListener('mouseup', () => {
            this.mouseDown = false;
        });
        
        this.container.addEventListener('mousemove', (e) => {
            if (!this.mouseDown || this.mode !== 'FREE') return;
            
            const deltaX = e.clientX - this.mouseX;
            const deltaY = e.clientY - this.mouseY;
            
            this.cameraRotationY -= deltaX * 0.005;
            this.cameraRotationX -= deltaY * 0.005;
            this.cameraRotationX = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.cameraRotationX));
            
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        this.container.addEventListener('wheel', (e) => {
            e.preventDefault();
            const distance = this.camera.position.distanceTo(this.target);
            const zoomSpeed = distance * 0.0002;
            const direction = new THREE.Vector3();
            this.camera.getWorldDirection(direction);
            
            if (e.deltaY > 0) {
                this.camera.position.add(direction.multiplyScalar(-zoomSpeed));
            } else {
                this.camera.position.add(direction.multiplyScalar(zoomSpeed));
            }
        });
    }
    
    setInitialPosition() {
        this.camera.position.set(500000, 200000, 300000);
        this.camera.lookAt(0, 0, 0);
    }
    
    setMode(mode) {
        this.mode = mode;
    }
    
    setTarget(object) {
        this.targetObject = object;
        if (object && object.position) {
            this.target.copy(object.position);
        }
    }
    
    update(deltaTime) {
        switch (this.mode) {
            case 'FREE':
                this.updateFreeCamera();
                break;
            case 'FOLLOW':
                this.updateFollowCamera(deltaTime);
                break;
            case 'CINEMATIC':
                this.updateCinematicCamera(deltaTime);
                break;
        }
    }
    
    updateFreeCamera() {
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(this.camera.position.clone().sub(this.target));
        spherical.theta = this.cameraRotationY;
        spherical.phi = Math.PI/2 + this.cameraRotationX;
        
        this.camera.position.setFromSpherical(spherical).add(this.target);
        this.camera.lookAt(this.target);
    }
    
    updateFollowCamera(deltaTime) {
        if (!this.targetObject) return;
        
        if (this.targetObject.position) {
            this.target.lerp(this.targetObject.position, this.smoothingFactor);
        }
        
        const offset = new THREE.Vector3(0, 50000, 100000);
        const desiredPosition = this.target.clone().add(offset);
        
        this.camera.position.lerp(desiredPosition, this.smoothingFactor);
        this.camera.lookAt(this.target);
    }
    
    updateCinematicCamera(deltaTime) {
        const time = performance.now() * 0.0001;
        const radius = 200000;
        const height = Math.sin(time * 0.5) * 100000 + 50000;
        
        this.camera.position.set(
            Math.cos(time) * radius,
            height,
            Math.sin(time) * radius
        );
        
        this.camera.lookAt(this.target);
    }
}
