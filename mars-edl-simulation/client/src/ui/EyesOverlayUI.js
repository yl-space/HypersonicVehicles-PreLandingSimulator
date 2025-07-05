const PHASES = [
  {
    key: 'Entry Interface',
    title: 'Entry Interface Point',
    desc: 'The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.',
    next: 'Guidance Start'
  },
  {
    key: 'Guidance Start',
    title: 'Guidance Start',
    desc: 'As it begins to descend through the atmosphere, the spacecraft encounters pockets of air that are more or less dense, which can nudge it off course. To compensate, it fires small thrusters on its backshell that adjust its angle and direction of lift.',
    next: 'Heading Alignment'
  },
  {
    key: 'Heading Alignment',
    title: 'Heading Alignment',
    desc: 'The guided entry algorithm corrects any remaining cross-range error.',
    next: 'Begin SUFR'
  },
  {
    key: 'Begin SUFR',
    title: 'Begin SUFR',
    desc: 'The spacecraft executes the "Straighten Up and Fly Right" maneuver, ejecting six more balance masses and setting the angle of attack to zero.',
    next: 'Parachute Deploy'
  },
  {
    key: 'Parachute Deployment',
    title: 'Parachute Deploy',
    desc: 'The parachute is triggered by calculating the distance to the landing site, and opening at the optimum time to hit a smaller target area. This is called a "Range Trigger."',
    next: 'Heat Shield Separation'
  }
];

export class EyesOverlayUI {
  constructor(sim, root, animateCallback) {
    this.sim = sim;
    this.root = root;
    this.animateCallback = animateCallback;
    this.currentPhase = PHASES[0].key;
    this.build();
  }

  build() {
    this.panel = document.createElement('div');
    this.panel.className = 'eyes-info-panel';
    this.root.appendChild(this.panel);

    this.timeline = document.createElement('div');
    this.timeline.className = 'eyes-timeline-bar';
    this.timeline.innerHTML = `
      <input type="range" min="0" max="260.65" step="0.01" value="0" id="timeline-slider">
      <span id="timeline-label">0:00</span>
    `;
    this.root.appendChild(this.timeline);

    this.controls = document.createElement('div');
    this.controls.className = 'eyes-controls';
    this.controls.innerHTML = `
      <button class="eyes-btn" id="play-btn">⏵</button>
      <button class="eyes-btn" id="pause-btn">⏸</button>
      <button class="eyes-btn" id="replay-btn">⟲</button>
      <select id="rate-select" class="eyes-btn">
        <option value="0.25">0.25x</option>
        <option value="0.5">0.5x</option>
        <option value="1" selected>1x</option>
        <option value="2">2x</option>
        <option value="5">5x</option>
      </select>
    `;
    this.root.appendChild(this.controls);

    // Event listeners
    this.timeline.querySelector('#timeline-slider').addEventListener('input', e => {
      this.sim.seekTo(parseFloat(e.target.value));
      this.sim.pause();
      this.update();
    });
    this.controls.querySelector('#play-btn').onclick = () => { this.sim.play(); this.animateCallback(); };
    this.controls.querySelector('#pause-btn').onclick = () => this.sim.pause();
    this.controls.querySelector('#replay-btn').onclick = () => { this.sim.reset(); this.sim.play(); this.animateCallback(); };
    this.controls.querySelector('#rate-select').onchange = e => this.sim.setPlaybackSpeed(parseFloat(e.target.value));
  }

  updatePhase(phase) {
    this.currentPhase = phase;
    this.update();
  }

  updateTelemetry(telemetry) {
    this.telemetry = telemetry;
    this.update();
  }

  showReplay() {
    this.sim.pause();
    this.controls.querySelector('#play-btn').disabled = false;
    this.controls.querySelector('#replay-btn').disabled = false;
  }

  update() {
    const state = this.sim.getState();
    const phaseObj = PHASES.find(p => p.key === state.currentPhase) || PHASES[0];
    const t = state.currentTime;
    const telemetry = state.telemetry || {};
    const mins = Math.floor(t / 60), secs = (t % 60).toFixed(1).padStart(4, '0');
    const touchdown = (260.65 - t);
    const tdMins = Math.floor(touchdown / 60), tdSecs = (touchdown % 60).toFixed(1).padStart(4, '0');

    this.panel.innerHTML = `
      <div class="eyes-phase-title">${phaseObj.title}</div>
      <div class="eyes-telemetry">
        <span><span class="label">Altitude:</span> ${(telemetry.altitude/1609.34).toFixed(2)} miles</span>
        <span><span class="label">Velocity:</span> ${(telemetry.velocity*2.23694).toFixed(2)} mph</span>
      </div>
      <div class="eyes-phase-desc">${phaseObj.desc}</div>
      <div class="eyes-countdown">Touchdown in <b>${tdMins}:${tdSecs}</b></div>
      <div class="eyes-next-phase">Next phase: ${phaseObj.next}</div>
    `;

    // Timeline
    this.timeline.querySelector('#timeline-slider').value = t;
    this.timeline.querySelector('#timeline-label').textContent = `${mins}:${secs}`;
  }
} 