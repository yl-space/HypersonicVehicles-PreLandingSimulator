/**
 * Mars EDL Simulation - Main Entry
 */

// Global loading function
function updateLoadingProgress(progress, message) {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) {
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }
    if (loadingText) {
        loadingText.textContent = message || 'Loading...';
    }
    console.log(`${progress}% - ${message}`);
}

// Make globally available
window.updateLoadingProgress = updateLoadingProgress;

// Check Three.js availability
function checkThreeJS() {
    if (typeof THREE === 'undefined') {
        updateLoadingProgress(0, 'Three.js failed to load from CDN');
        showError('Three.js library not loaded. Check internet connection.');
        return false;
    }
    console.log(`Three.js loaded: r${THREE.REVISION}`);
    return true;
}

// Error display
function showError(message) {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) loadingScreen.style.display = 'none';
    
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
        background: #ff4444; color: white; padding: 2rem; border-radius: 12px;
        z-index: 20000; text-align: center; max-width: 500px;
        font-family: -apple-system, sans-serif;
    `;
    errorDiv.innerHTML = `
        <h3>🚨 Simulation Error</h3>
        <p style="margin: 1rem 0;">${message}</p>
        <button onclick="location.reload();" style="padding: 0.75rem 1.5rem; background: white; color: #ff4444; border: none; border-radius: 6px; cursor: pointer;">
            🔄 Reload
        </button>
    `;
    document.body.appendChild(errorDiv);
}

// Simple Three.js simulation without modules
class SimpleEDLSimulation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.spacecraft = null;
        this.mars = null;
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.timeScale = 1;
        this.maxTime = 260.65;
        this.trajectoryData = [];
        
        this.clock = new THREE.Clock();
    }
    
    async init() {
        try {
            updateLoadingProgress(10, 'Initializing Three.js scene...');
            
            const container = document.getElementById('canvas-container');
            if (!container) throw new Error('Canvas container not found');
            
            this.setupScene(container);
            updateLoadingProgress(30, 'Creating Mars environment...');
            
            this.createEnvironment();
            updateLoadingProgress(50, 'Creating spacecraft...');
            
            this.createSpacecraft();
            updateLoadingProgress(70, 'Loading trajectory data...');
            
            await this.loadTrajectoryData();
            updateLoadingProgress(90, 'Setting up controls...');
            
            this.setupControls();
            this.startRenderLoop();
            
            updateLoadingProgress(100, 'Simulation ready!');
            setTimeout(() => this.hideLoadingScreen(), 1000);
            
        } catch (error) {
            console.error('Simulation failed:', error);
            showError(`Initialization failed: ${error.message}`);
        }
    }
    
    setupScene(container) {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000005);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75, 
            container.clientWidth / container.clientHeight, 
            0.1, 
            10000000
        );
        this.camera.position.set(500000, 200000, 300000);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(this.renderer.domElement);
        
        // Lighting
        const sunLight = new THREE.DirectionalLight(0xffeaa7, 2.5);
        sunLight.position.set(-1000000, 500000, 1000000);
        this.scene.add(sunLight);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        console.log('✅ Three.js scene created');
    }
    
    createEnvironment() {
        // Mars
        const marsGeometry = new THREE.SphereGeometry(3390, 64, 32);
        const marsMaterial = new THREE.MeshPhongMaterial({ color: 0xcd5c5c });
        this.mars = new THREE.Mesh(marsGeometry, marsMaterial);
        this.scene.add(this.mars);
        
        // Stars
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 5000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const radius = 5000000;
            positions[i3] = (Math.random() - 0.5) * radius;
            positions[i3 + 1] = (Math.random() - 0.5) * radius;
            positions[i3 + 2] = (Math.random() - 0.5) * radius;
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
        const stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(stars);
        
        console.log('✅ Environment created');
    }
    
    createSpacecraft() {
        const group = new THREE.Group();
        
        // Aeroshell
        const aeroshellGeometry = new THREE.ConeGeometry(4.5, 3.5, 32);
        const aeroshellMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
        const aeroshell = new THREE.Mesh(aeroshellGeometry, aeroshellMaterial);
        group.add(aeroshell);
        
        // Heat shield
        const heatShieldGeometry = new THREE.ConeGeometry(4.5, 0.5, 32);
        const heatShieldMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2F1B14, 
            emissive: 0x331100 
        });
        const heatShield = new THREE.Mesh(heatShieldGeometry, heatShieldMaterial);
        heatShield.position.y = -2;
        group.add(heatShield);
        
        group.scale.setScalar(100);
        this.spacecraft = group;
        this.scene.add(this.spacecraft);
        
        console.log('✅ Spacecraft created');
    }
    
    async loadTrajectoryData() {
        try {
            const response = await fetch('/api/trajectories/msl_position_J2000');
            if (response.ok) {
                const result = await response.json();
                this.trajectoryData = result.data;
                console.log(`✅ Loaded ${this.trajectoryData.length} trajectory points`);
            } else {
                throw new Error('Failed to load trajectory data');
            }
        } catch (error) {
            console.warn('Using demo data:', error);
            // Generate demo trajectory
            this.trajectoryData = [];
            for (let t = 0; t <= 260.65; t += 0.5) {
                const progress = t / 260.65;
                const altitude = 132000 * (1 - progress);
                this.trajectoryData.push({
                    time: t,
                    x: -600000 - t * 2000,
                    y: 3000000,
                    z: 1600000 + altitude
                });
            }
        }
    }
    
    setupControls() {
        // Show UI panels
        ['control-panel', 'timeline-container', 'phase-info', 'stats-panel'].forEach(id => {
            const element = document.getElementById(id);
            if (element) element.classList.remove('hidden');
        });
        
        // Play/Pause
        const playPauseBtn = document.getElementById('play-pause-btn');
        if (playPauseBtn) {
            playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }
        
        // Reset
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.reset());
        }
        
        // Speed
        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.timeScale = parseFloat(e.target.value);
                const speedValue = document.getElementById('speed-value');
                if (speedValue) speedValue.textContent = `${this.timeScale.toFixed(1)}x`;
            });
        }
        
        // Timeline
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            timelineSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
        
        // Camera controls
        this.setupCameraControls();
        
        // Start simulation button
        const startBtn = document.getElementById('start-simulation-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const modal = document.getElementById('intro-modal');
                if (modal) modal.classList.add('hidden');
            });
        }
    }
    
    setupCameraControls() {
        let mouseDown = false;
        let mouseX = 0, mouseY = 0;
        let cameraRotationX = 0, cameraRotationY = 0;
        
        this.renderer.domElement.addEventListener('mousedown', (e) => {
            mouseDown = true;
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        window.addEventListener('mouseup', () => {
            mouseDown = false;
        });
        
        this.renderer.domElement.addEventListener('mousemove', (e) => {
            if (!mouseDown) return;
            
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;
            
            cameraRotationY -= deltaX * 0.005;
            cameraRotationX -= deltaY * 0.005;
            cameraRotationX = THREE.MathUtils.clamp(cameraRotationX, -Math.PI/2, Math.PI/2);
            
            const radius = 500000;
            this.camera.position.x = radius * Math.cos(cameraRotationX) * Math.cos(cameraRotationY);
            this.camera.position.y = radius * Math.sin(cameraRotationX);
            this.camera.position.z = radius * Math.cos(cameraRotationX) * Math.sin(cameraRotationY);
            this.camera.lookAt(0, 0, 0);
            
            mouseX = e.clientX;
            mouseY = e.clientY;
        });
        
        this.renderer.domElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const distance = this.camera.position.length();
            const zoomSpeed = distance * 0.0002;
            
            if (e.deltaY > 0) {
                this.camera.position.multiplyScalar(1 + zoomSpeed);
            } else {
                this.camera.position.multiplyScalar(1 - zoomSpeed);
            }
        });
    }
    
    startRenderLoop() {
        const animate = () => {
            requestAnimationFrame(animate);
            
            const deltaTime = this.clock.getDelta();
            
            if (this.isPlaying) {
                this.currentTime += deltaTime * this.timeScale;
                if (this.currentTime > this.maxTime) {
                    this.currentTime = this.maxTime;
                    this.pause();
                }
            }
            
            this.updateSimulation();
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
    
    updateSimulation() {
        // Find trajectory point
        const trajectoryPoint = this.getTrajectoryAtTime(this.currentTime);
        if (trajectoryPoint && this.spacecraft) {
            const scale = 0.001;
            this.spacecraft.position.set(
                trajectoryPoint.x * scale,
                trajectoryPoint.z * scale,
                trajectoryPoint.y * scale
            );
        }
        
        // Update UI
        this.updateUI();
    }
    
    getTrajectoryAtTime(time) {
        if (this.trajectoryData.length === 0) return null;
        
        const index = this.trajectoryData.findIndex(point => point.time >= time);
        if (index === -1) return this.trajectoryData[this.trajectoryData.length - 1];
        if (index === 0) return this.trajectoryData[0];
        
        // Linear interpolation
        const prev = this.trajectoryData[index - 1];
        const next = this.trajectoryData[index];
        const factor = (time - prev.time) / (next.time - prev.time);
        
        return {
            time: time,
            x: THREE.MathUtils.lerp(prev.x, next.x, factor),
            y: THREE.MathUtils.lerp(prev.y, next.y, factor),
            z: THREE.MathUtils.lerp(prev.z, next.z, factor)
        };
    }
    
    updateUI() {
        const elements = {
            'current-time': this.currentTime.toFixed(2) + 's',
            'current-altitude': '132.0km', // Simplified
            'current-velocity': '5800m/s',
            'current-gforce': '0.0g'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider && !timelineSlider.matches(':focus')) {
            timelineSlider.value = this.currentTime;
        }
    }
    
    togglePlayPause() {
        this.isPlaying ? this.pause() : this.play();
    }
    
    play() {
        this.isPlaying = true;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '⏸ Pause';
    }
    
    pause() {
        this.isPlaying = false;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶ Play';
    }
    
    reset() {
        this.currentTime = 0;
        this.pause();
        this.updateSimulation();
    }
    
    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
                this.showIntroduction();
            }, 500);
        }
    }
    
    showIntroduction() {
        const introModal = document.getElementById('intro-modal');
        if (introModal) {
            introModal.classList.remove('hidden');
        }
    }
}

// Global app state
window.EDLApp = {
    simulation: null,
    isInitialized: false
};

// Initialize when DOM ready
function initializeApp() {
    updateLoadingProgress(0, 'Checking Three.js...');
    
    if (!checkThreeJS()) return;
    
    updateLoadingProgress(5, 'Starting simulation...');
    
    window.EDLApp.simulation = new SimpleEDLSimulation();
    window.EDLApp.simulation.init().then(() => {
        window.EDLApp.isInitialized = true;
        console.log('✅ Mars EDL Simulation ready');
    }).catch(error => {
        console.error('❌ Simulation failed:', error);
        showError(error.message);
    });
}

// Start when ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Handle resize
window.addEventListener('resize', () => {
    if (window.EDLApp.simulation?.renderer) {
        const container = document.getElementById('canvas-container');
        const camera = window.EDLApp.simulation.camera;
        const renderer = window.EDLApp.simulation.renderer;
        
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    }
});

// Handle page visibility
document.addEventListener('visibilitychange', () => {
    if (window.EDLApp.simulation && document.hidden) {
        window.EDLApp.simulation.pause();
    }
});

console.log('Mars EDL Main script loaded');