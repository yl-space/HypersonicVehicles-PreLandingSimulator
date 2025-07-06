/**
 * Mars EDL Simulation - All Features Fixed
 */

function updateLoadingProgress(progress, message) {
    const progressBar = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    if (loadingText) loadingText.textContent = message || 'Loading...';
    console.log(`${progress}% - ${message}`);
}

window.updateLoadingProgress = updateLoadingProgress;

function checkThreeJS() {
    if (typeof THREE === 'undefined') {
        updateLoadingProgress(0, 'Three.js failed to load');
        showError('Three.js library not loaded. Check internet connection.');
        return false;
    }
    console.log(`Three.js loaded: r${THREE.REVISION}`);
    return true;
}

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

class MarsEDLSimulation {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.spacecraft = null;
        this.mars = null;
        this.stars = null;
        this.trajectoryLine = null;
        this.landingEffects = null;
        
        this.isPlaying = false;
        this.currentTime = 0;
        this.timeScale = 1;
        this.maxTime = 260.65;
        this.trajectoryData = [];
        this.phases = [];
        this.currentPhase = 0;
        
        this.clock = new THREE.Clock();
        this.cameraMode = 'FREE';
        this.cameraTarget = new THREE.Vector3();
        this.cameraControls = {
            mouseDown: false,
            mouseX: 0,
            mouseY: 0,
            phi: 0.3,
            theta: 0,
            radius: 50000
        };
    }
    
    async init() {
        try {
            updateLoadingProgress(10, 'Creating Three.js scene...');
            
            const container = document.getElementById('canvas-container');
            if (!container) throw new Error('Canvas container not found');
            
            this.setupScene(container);
            updateLoadingProgress(30, 'Creating Mars environment...');
            
            this.createEnvironment();
            updateLoadingProgress(50, 'Creating spacecraft...');
            
            this.createSpacecraft();
            updateLoadingProgress(70, 'Loading trajectory data...');
            
            await this.loadTrajectoryData();
            this.createTrajectoryPath();
            updateLoadingProgress(90, 'Setting up controls...');
            
            this.setupPhases();
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
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000010);
        
        this.camera = new THREE.PerspectiveCamera(
            60, 
            container.clientWidth / container.clientHeight, 
            1, 
            2000000
        );
        
        this.camera.position.set(30000, 15000, 30000);
        this.camera.lookAt(0, 0, 0);
        
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: false
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000010, 1);
        container.appendChild(this.renderer.domElement);
        
        // Enhanced lighting
        const sunLight = new THREE.DirectionalLight(0xffffff, 3);
        sunLight.position.set(100000, 50000, 50000);
        this.scene.add(sunLight);
        
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        
        const marsLight = new THREE.PointLight(0xff6600, 1.5, 50000);
        marsLight.position.set(0, 0, 0);
        this.scene.add(marsLight);
        
        console.log('✅ Three.js scene created');
    }
    
    createEnvironment() {
        // Mars
        const marsGeometry = new THREE.SphereGeometry(3390, 64, 32);
        const marsMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xcd5c5c,
            shininess: 5
        });
        this.mars = new THREE.Mesh(marsGeometry, marsMaterial);
        this.scene.add(this.mars);
        
        // Mars atmosphere
        const atmosphereGeometry = new THREE.SphereGeometry(3500, 32, 16);
        const atmosphereMaterial = new THREE.MeshBasicMaterial({
            color: 0xff6b35,
            transparent: true,
            opacity: 0.1,
            side: THREE.BackSide
        });
        const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
        this.scene.add(atmosphere);
        
        // Stars
        const starGeometry = new THREE.BufferGeometry();
        const starCount = 3000;
        const positions = new Float32Array(starCount * 3);
        
        for (let i = 0; i < starCount; i++) {
            const i3 = i * 3;
            const radius = 500000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
        }
        
        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 2 });
        this.stars = new THREE.Points(starGeometry, starMaterial);
        this.scene.add(this.stars);
        
        // Landing zone marker
        const markerGeometry = new THREE.RingGeometry(30, 50, 32);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: 0x00ff00,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(0, 3395, 0);
        marker.lookAt(0, 0, 0);
        this.scene.add(marker);
        
        console.log('✅ Environment created');
    }
    
    createSpacecraft() {
        const group = new THREE.Group();
        
        // Main aeroshell
        const aeroshellGeometry = new THREE.ConeGeometry(1.5, 2.5, 16);
        const aeroshellMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x8B4513,
            shininess: 30
        });
        const aeroshell = new THREE.Mesh(aeroshellGeometry, aeroshellMaterial);
        group.add(aeroshell);
        
        // Heat shield
        const heatShieldGeometry = new THREE.ConeGeometry(1.5, 0.3, 16);
        const heatShieldMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x2F1B14,
            emissive: 0x440000,
            emissiveIntensity: 0.3
        });
        const heatShield = new THREE.Mesh(heatShieldGeometry, heatShieldMaterial);
        heatShield.position.y = -1.4;
        group.add(heatShield);
        
        // Backshell
        const backshellGeometry = new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const backshellMaterial = new THREE.MeshPhongMaterial({ 
            color: 0xC0C0C0,
            shininess: 50
        });
        const backshell = new THREE.Mesh(backshellGeometry, backshellMaterial);
        backshell.position.y = 1.25;
        group.add(backshell);
        
        // Parachute (hidden initially)
        const parachuteGeometry = new THREE.SphereGeometry(5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const parachuteMaterial = new THREE.MeshPhongMaterial({
            color: 0xff4500,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        this.parachute = new THREE.Mesh(parachuteGeometry, parachuteMaterial);
        this.parachute.position.y = 8;
        this.parachute.visible = false;
        group.add(this.parachute);
        
        // Scale for visibility
        group.scale.setScalar(15);
        
        // Start at entry interface
        group.position.set(-30000, 10000, 15000);
        
        this.spacecraft = group;
        this.scene.add(this.spacecraft);
        
        console.log('✅ Spacecraft created');
    }
    
    createTrajectoryPath() {
        if (this.trajectoryData.length === 0) return;
        
        const points = [];
        this.trajectoryData.forEach(point => {
            const scale = 0.01;
            points.push(new THREE.Vector3(
                point.x * scale,
                point.z * scale,
                point.y * scale
            ));
        });
        
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ 
            color: 0x00d4ff, 
            transparent: true, 
            opacity: 0.6 
        });
        
        this.trajectoryLine = new THREE.Line(geometry, material);
        this.scene.add(this.trajectoryLine);
        
        console.log('✅ Trajectory path created');
    }
    
    createLandingEffects() {
        // Dust cloud effect
        const particleCount = 100;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            positions[i3] = (Math.random() - 0.5) * 50;
            positions[i3 + 1] = Math.random() * 20;
            positions[i3 + 2] = (Math.random() - 0.5) * 50;
            
            colors[i3] = 0.8;
            colors[i3 + 1] = 0.6;
            colors[i3 + 2] = 0.4;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        
        const material = new THREE.PointsMaterial({
            size: 3,
            vertexColors: true,
            transparent: true,
            opacity: 0.8,
            blending: THREE.AdditiveBlending
        });
        
        this.landingEffects = new THREE.Points(geometry, material);
        this.landingEffects.position.copy(this.spacecraft.position);
        this.landingEffects.position.y = 3395; // Mars surface
        this.landingEffects.visible = false;
        this.scene.add(this.landingEffects);
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
            this.generateDemoTrajectory();
        }
    }
    
    generateDemoTrajectory() {
        this.trajectoryData = [];
        for (let t = 0; t <= 260.65; t += 0.5) {
            const progress = t / 260.65;
            const altitude = 132000 * (1 - progress);
            const angle = t * 0.01;
            
            this.trajectoryData.push({
                time: t,
                x: -600000 - t * 1000 + Math.sin(angle) * 5000,
                y: 3000000 + Math.cos(angle) * 20000,
                z: 1600000 + altitude
            });
        }
        console.log(`✅ Generated ${this.trajectoryData.length} demo trajectory points`);
    }
    
    setupPhases() {
        this.phases = [
            { name: 'Entry Interface', startTime: 0, description: 'Atmospheric entry begins at 132km altitude' },
            { name: 'Peak Heating', startTime: 80, description: 'Maximum thermal stress on heat shield' },
            { name: 'Peak Deceleration', startTime: 150, description: 'Maximum g-forces experienced' },
            { name: 'Parachute Deploy', startTime: 260.65, description: 'Supersonic parachute deployment' }
        ];
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
        
        // Speed slider
        const speedSlider = document.getElementById('speed-slider');
        if (speedSlider) {
            speedSlider.addEventListener('input', (e) => {
                this.timeScale = parseFloat(e.target.value);
                const speedValue = document.getElementById('speed-value');
                if (speedValue) speedValue.textContent = `${this.timeScale.toFixed(1)}x`;
            });
        }
        
        // Timeline slider - FIXED
        const timelineSlider = document.getElementById('timeline-slider');
        if (timelineSlider) {
            timelineSlider.max = this.maxTime;
            timelineSlider.addEventListener('input', (e) => {
                this.currentTime = parseFloat(e.target.value);
                this.updateSimulation();
            });
        }
        
        // Camera mode buttons - FIXED
        document.querySelectorAll('.camera-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.camera-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.setCameraMode(e.target.dataset.mode);
            });
        });
        
        // Camera controls
        this.setupCameraControls();
        
        // Start button
        const startBtn = document.getElementById('start-simulation-btn');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const modal = document.getElementById('intro-modal');
                if (modal) modal.classList.add('hidden');
            });
        }
        
        // Create landing effects
        this.createLandingEffects();
    }
    
    setupCameraControls() {
        const canvas = this.renderer.domElement;
        
        canvas.addEventListener('mousedown', (e) => {
            if (this.cameraMode !== 'FREE') return;
            this.cameraControls.mouseDown = true;
            this.cameraControls.mouseX = e.clientX;
            this.cameraControls.mouseY = e.clientY;
            canvas.style.cursor = 'grabbing';
        });
        
        window.addEventListener('mouseup', () => {
            this.cameraControls.mouseDown = false;
            canvas.style.cursor = 'grab';
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!this.cameraControls.mouseDown || this.cameraMode !== 'FREE') return;
            
            const deltaX = e.clientX - this.cameraControls.mouseX;
            const deltaY = e.clientY - this.cameraControls.mouseY;
            
            this.cameraControls.theta -= deltaX * 0.01;
            this.cameraControls.phi += deltaY * 0.01;
            this.cameraControls.phi = THREE.MathUtils.clamp(this.cameraControls.phi, -Math.PI/2, Math.PI/2);
            
            this.cameraControls.mouseX = e.clientX;
            this.cameraControls.mouseY = e.clientY;
        });
        
        canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.cameraControls.radius += e.deltaY * 50;
            this.cameraControls.radius = THREE.MathUtils.clamp(this.cameraControls.radius, 1000, 100000);
        });
        
        canvas.style.cursor = 'grab';
    }
    
    setCameraMode(mode) {
        this.cameraMode = mode;
        console.log('Camera mode set to:', mode);
        
        if (mode === 'FOLLOW') {
            this.cameraControls.radius = 5000;
        } else if (mode === 'CINEMATIC') {
            this.cameraControls.radius = 20000;
        }
    }
    
    updateCamera() {
        let target = new THREE.Vector3(0, 0, 0);
        
        if (this.cameraMode === 'FOLLOW' && this.spacecraft) {
            target.copy(this.spacecraft.position);
        } else if (this.cameraMode === 'CINEMATIC') {
            const time = performance.now() * 0.0001;
            target.copy(this.spacecraft ? this.spacecraft.position : new THREE.Vector3(0, 0, 0));
            this.cameraControls.theta = time;
            this.cameraControls.phi = Math.sin(time * 0.5) * 0.3;
        }
        
        this.cameraTarget.lerp(target, 0.1);
        
        this.camera.position.x = this.cameraTarget.x + this.cameraControls.radius * Math.cos(this.cameraControls.phi) * Math.cos(this.cameraControls.theta);
        this.camera.position.y = this.cameraTarget.y + this.cameraControls.radius * Math.sin(this.cameraControls.phi);
        this.camera.position.z = this.cameraTarget.z + this.cameraControls.radius * Math.cos(this.cameraControls.phi) * Math.sin(this.cameraControls.theta);
        
        this.camera.lookAt(this.cameraTarget);
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
            this.updateCamera();
            
            // Rotate Mars
            if (this.mars) {
                this.mars.rotation.y += deltaTime * 0.02;
            }
            
            // Animate landing effects
            if (this.landingEffects && this.landingEffects.visible) {
                this.landingEffects.rotation.y += deltaTime * 0.5;
                const positions = this.landingEffects.geometry.attributes.position.array;
                for (let i = 1; i < positions.length; i += 3) {
                    positions[i] += deltaTime * 10;
                    if (positions[i] > 50) positions[i] = 0;
                }
                this.landingEffects.geometry.attributes.position.needsUpdate = true;
            }
            
            this.renderer.render(this.scene, this.camera);
        };
        animate();
    }
    
    updateSimulation() {
        const trajectoryPoint = this.getTrajectoryAtTime(this.currentTime);
        if (trajectoryPoint && this.spacecraft) {
            const scale = 0.01;
            this.spacecraft.position.set(
                trajectoryPoint.x * scale,
                trajectoryPoint.z * scale,
                trajectoryPoint.y * scale
            );
            
            // Calculate altitude
            const marsRadius = 3390;
            const distanceFromCenter = this.spacecraft.position.length();
            const altitude = Math.max(0, distanceFromCenter - marsRadius);
            const altitudeKm = altitude / 10; // Convert to km for display
            
            // Update phases
            this.updatePhases();
            
            // Deploy parachute at correct time
            if (this.currentTime >= 260 && this.parachute && !this.parachute.visible) {
                this.parachute.visible = true;
                console.log('Parachute deployed!');
            }
            
            // Show landing effects when near surface
            if (altitudeKm < 1 && this.landingEffects) {
                this.landingEffects.visible = true;
                this.landingEffects.position.copy(this.spacecraft.position);
                this.landingEffects.position.y = 3395;
            }
            
            this.updateUI(altitudeKm);
        }
    }
    
    updatePhases() {
        for (let i = this.phases.length - 1; i >= 0; i--) {
            if (this.currentTime >= this.phases[i].startTime) {
                if (this.currentPhase !== i) {
                    this.currentPhase = i;
                    const phase = this.phases[i];
                    
                    // Update phase info UI
                    const phaseTitle = document.getElementById('phase-title');
                    const phaseDescription = document.getElementById('phase-description');
                    const currentPhaseSpan = document.getElementById('current-phase');
                    
                    if (phaseTitle) phaseTitle.textContent = phase.name;
                    if (phaseDescription) phaseDescription.textContent = phase.description;
                    if (currentPhaseSpan) currentPhaseSpan.textContent = phase.name;
                }
                break;
            }
        }
    }
    
    getTrajectoryAtTime(time) {
        if (this.trajectoryData.length === 0) return null;
        
        const index = this.trajectoryData.findIndex(point => point.time >= time);
        if (index === -1) return this.trajectoryData[this.trajectoryData.length - 1];
        if (index === 0) return this.trajectoryData[0];
        
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
    
    updateUI(altitude = 132) {
        const velocity = Math.max(100, 5800 - this.currentTime * 20);
        const gForce = Math.min(12, this.currentTime / 20);
        
        const elements = {
            'current-time': this.currentTime.toFixed(2) + 's',
            'current-altitude': altitude.toFixed(1) + 'km',
            'current-velocity': velocity.toFixed(0) + 'm/s',
            'current-gforce': gForce.toFixed(1) + 'g'
        };
        
        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) element.textContent = value;
        });
        
        // Update timeline slider
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
        if (btn) btn.innerHTML = '⏸ PAUSE';
    }
    
    pause() {
        this.isPlaying = false;
        const btn = document.getElementById('play-pause-btn');
        if (btn) btn.innerHTML = '▶ PLAY';
    }
    
    reset() {
        this.currentTime = 0;
        this.pause();
        if (this.parachute) this.parachute.visible = false;
        if (this.landingEffects) this.landingEffects.visible = false;
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

function initializeApp() {
    updateLoadingProgress(0, 'Checking Three.js...');
    
    if (!checkThreeJS()) return;
    
    updateLoadingProgress(5, 'Starting Mars EDL simulation...');
    
    window.EDLApp.simulation = new MarsEDLSimulation();
    window.EDLApp.simulation.init().then(() => {
        window.EDLApp.isInitialized = true;
        console.log('✅ Mars EDL Simulation ready with all features');
    }).catch(error => {
        console.error('❌ Simulation failed:', error);
        showError(error.message);
    });
}

// Initialize
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

console.log('Mars EDL Main script loaded with all features fixed');