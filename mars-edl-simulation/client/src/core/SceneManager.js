export class SceneManager {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        this.renderer = null;
        this.cameraController = null;
        this.clock = new THREE.Clock();
        this.isRendering = false;
        
        this.init();
    }
    
    init() {
        // WebGL renderer setup
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true,
            powerPreference: "high-performance"
        });
        
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        
        this.container.appendChild(this.renderer.domElement);
        
        // Camera setup
        this.cameraController = new CameraController(this.container);
        
        // Scene setup
        this.scene.background = new THREE.Color(0x000005);
        this.scene.fog = new THREE.FogExp2(0x000005, 0.000001);
        
        this.setupLighting();
        this.startRenderLoop();
        
        console.log('✅ Three.js scene initialized');
    }
    
    setupLighting() {
        // Sun light
        const sunLight = new THREE.DirectionalLight(0xffeaa7, 2.5);
        sunLight.position.set(-1000000, 500000, 1000000);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        this.scene.add(sunLight);
        
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        // Mars glow
        const marsLight = new THREE.PointLight(0xff6b35, 0.8, 200000);
        marsLight.position.set(0, 0, 0);
        this.scene.add(marsLight);
    }
    
    startRenderLoop() {
        this.isRendering = true;
        this.render();
    }
    
    render() {
        if (!this.isRendering) return;
        
        requestAnimationFrame(() => this.render());
        
        const deltaTime = this.clock.getDelta();
        this.cameraController.update(deltaTime);
        this.renderer.render(this.scene, this.cameraController.camera);
    }
    
    addToScene(object) {
        if (object.mesh) {
            this.scene.add(object.mesh);
        } else if (object.isObject3D || object.type) {
            this.scene.add(object);
        }
    }
    
    handleResize() {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        this.cameraController.camera.aspect = width / height;
        this.cameraController.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen();
        } else {
            document.exitFullscreen();
        }
    }
}