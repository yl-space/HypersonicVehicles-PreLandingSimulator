import { Mars2020EDLSimulation } from './simulation/Mars2020EDLSimulation.js';
import { EyesOverlayUI } from './ui/EyesOverlayUI.js';
import * as THREE from 'three';

class EyesApp {
  constructor() {
    this.sceneContainer = document.getElementById('scene-container');
    this.overlayRoot = document.getElementById('overlay-root');
    this.init3D();
    this.sim = new Mars2020EDLSimulation(this.scene, this.camera, this.renderer);
    this.ui = new EyesOverlayUI(this.sim, this.overlayRoot, () => this.animate());
    this.sim.onPhaseChange = (phase) => this.ui.updatePhase(phase);
    this.sim.onTelemetryUpdate = (telemetry) => this.ui.updateTelemetry(telemetry);
    this.sim.onMissionComplete = () => this.ui.showReplay();
    this.sim.loadTrajectoryData('/api/data/msl-trajectory').then(() => {
      this.sim.play();
      this.animate();
    });
  }

  init3D() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a0a);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1000, 1e8);
    this.camera.position.set(0, 1e6, 2e6);
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.sceneContainer.appendChild(this.renderer.domElement);
    window.addEventListener('resize', () => this.onResize());
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    this.sim.update(1/60);
    this.ui.update();
    this.renderer.render(this.scene, this.camera);
    if (this.sim.isPlaying) requestAnimationFrame(() => this.animate());
  }
}

window.addEventListener('DOMContentLoaded', () => new EyesApp()); 