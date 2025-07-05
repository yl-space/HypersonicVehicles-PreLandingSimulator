/**
 * Timeline.js
 * Timeline UI component for simulation control
 */

export class Timeline {
    constructor(trajectoryManager) {
        this.trajectoryManager = trajectoryManager;
        this.element = null;
        this.progressBar = null;
        this.handle = null;
        this.isDragging = false;
        
        this.create();
        this.setupEventListeners();
    }
    
    create() {
        this.element = document.createElement('div');
        this.element.className = 'timeline-container';
        this.element.innerHTML = `
            <div class="timeline-header">
                <h3>Mission Timeline</h3>
                <div class="timeline-time">
                    <span id="current-time">0.0</span>s / <span id="total-time">0.0</span>s
                </div>
            </div>
            <div class="timeline-track" id="timeline-track">
                <div class="timeline-progress" id="timeline-progress"></div>
                <div class="timeline-handle" id="timeline-handle"></div>
                <div class="timeline-markers" id="timeline-markers"></div>
            </div>
        `;
        
        this.progressBar = this.element.querySelector('#timeline-progress');
        this.handle = this.element.querySelector('#timeline-handle');
        this.track = this.element.querySelector('#timeline-track');
    }
    
    setupEventListeners() {
        // Mouse events for scrubbing
        this.handle.addEventListener('mousedown', (e) => this.startDrag(e));
        this.track.addEventListener('click', (e) => this.handleTrackClick(e));
        
        document.addEventListener('mousemove', (e) => this.handleDrag(e));
        document.addEventListener('mouseup', () => this.endDrag());
        
        // Touch events for mobile
        this.handle.addEventListener('touchstart', (e) => this.startDrag(e.touches[0]));
        document.addEventListener('touchmove', (e) => {
            if (this.isDragging) {
                e.preventDefault();
                this.handleDrag(e.touches[0]);
            }
        });
        document.addEventListener('touchend', () => this.endDrag());
    }
    
    startDrag(e) {
        this.isDragging = true;
        this.handle.classList.add('dragging');
        this.trajectoryManager.pause();
    }
    
    handleDrag(e) {
        if (!this.isDragging) return;
        
        const rect = this.track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(1, x / rect.width));
        
        const time = progress * this.trajectoryManager.totalDuration;
        this.trajectoryManager.setTime(time);
    }
    
    endDrag() {
        this.isDragging = false;
        this.handle.classList.remove('dragging');
    }
    
    handleTrackClick(e) {
        if (this.isDragging) return;
        
        const rect = this.track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const progress = Math.max(0, Math.min(1, x / rect.width));
        
        const time = progress * this.trajectoryManager.totalDuration;
        this.trajectoryManager.setTime(time);
    }
    
    update() {
        const progress = this.trajectoryManager.currentTime / this.trajectoryManager.totalDuration;
        const percentage = (progress * 100).toFixed(1);
        
        this.progressBar.style.width = `${percentage}%`;
        this.handle.style.left = `${percentage}%`;
        
        // Update time display
        this.element.querySelector('#current-time').textContent = 
            this.trajectoryManager.currentTime.toFixed(1);
        this.element.querySelector('#total-time').textContent = 
            this.trajectoryManager.totalDuration.toFixed(1);
    }
    
    addPhaseMarkers(phases) {
        const markersContainer = this.element.querySelector('#timeline-markers');
        markersContainer.innerHTML = '';
        
        phases.forEach((phase, index) => {
            const progress = phase.startTime / this.trajectoryManager.totalDuration;
            const marker = document.createElement('div');
            marker.className = 'timeline-marker';
            marker.style.left = `${progress * 100}%`;
            marker.title = phase.name;
            marker.setAttribute('data-phase', index);
            
            markersContainer.appendChild(marker);
        });
    }
}

export default Timeline;