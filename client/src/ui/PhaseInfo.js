import * as Plot from "https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.7/+esm";

import { CONTROLS_CONFIG } from '../config/ControlsConfig.js';

/**
 * PhaseInfo.js
 * Displays current phase information and telemetry
 */

// Reference trajectory color - easily customizable
const REFERENCE_TRAJECTORY_COLOR = '#ffffff'; // white
const SHOW_LEGEND = false;

export class PhaseInfo {
    constructor(options) {
        this.options = {
            container: document.getElementById('phase-info'),
            onControlAdjust: null, // Callback for control adjustments
            ...options
        };
        
        this.onControlAdjust = this.options.onControlAdjust;
        
        this.elements = {};
        this.currentPhase = null;
        this.showingPlots = false;
        this.isVisible = true;
        
        // Data arrays for plots
        this.dataLimit = null; // No limit by default, can be set to a number to limit data points
        this.timeData = [];
        this.distanceData = [];
        this.altitudeData = [];
        this.velocityData = [];
        
        // Reference trajectory data arrays
        this.refTimeData = [];
        this.refDistanceData = [];
        this.refAltitudeData = [];
        this.refVelocityData = [];
        
        // Dynamic control data storage - one array per control
        this.controlsData = {};
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            this.controlsData[controlId] = [];
        });
        
        // Reference control data storage - one array per control
        this.refControlsData = {};
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            this.refControlsData[controlId] = []; // Will store 0 values for now
        });
        
        // Flags to track if we've started collecting valid data (velocity >= 100 mph)
        this.hasStartedSimData = false;
        this.hasStartedRefData = false;

        this.isReplayMode = false;
        this.currentTime = 0;
        
        // Track active hold intervals for continuous button press
        this.activeHoldInterval = null;
        this.activeHoldTimeout = null;
        
        this.init();
    }
    
    init() {
        this.createDOM();
    }

    reset() {
        this.isReplayMode = false;
        this.timeData = [];
        this.distanceData = [];
        this.altitudeData = [];
        this.velocityData = [];
        
        // Reset reference trajectory data
        this.refTimeData = [];
        this.refDistanceData = [];
        this.refAltitudeData = [];
        this.refVelocityData = [];
        
        // Reset all control data arrays
        Object.keys(this.controlsData).forEach(controlId => {
            this.controlsData[controlId] = [];
        });
        
        // Reset reference control data arrays
        Object.keys(this.refControlsData).forEach(controlId => {
            this.refControlsData[controlId] = [];
        });
        
        // Reset data collection flags
        this.hasStartedSimData = false;
        this.hasStartedRefData = false;
        
        this.currentTime = 0;
    }

    setReplayMode(isReplay) {
        this.isReplayMode = isReplay;
        
        // Enable/disable control buttons based on replay mode
        if (this.controlButtons) {
            this.setControlButtonsEnabled(!isReplay);
        }
    }
    
    createDOM() {
        const html = `
            <div class="toggle-icon" id="toggle-icon" title="Hide panel">
                <svg class="icon-collapse" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="11 17 6 12 11 7"></polyline>
                    <polyline points="18 17 13 12 18 7"></polyline>
                </svg>
                <svg class="icon-expand" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                    <polyline points="13 17 18 12 13 7"></polyline>
                    <polyline points="6 17 11 12 6 7"></polyline>
                </svg>
            </div>
            
            <div class="swap-icon" id="swap-icon" title="Show plots">
                <svg class="icon-chart" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                <svg class="icon-info" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                    <line x1="3" y1="6" x2="21" y2="6"></line>
                    <line x1="3" y1="12" x2="15" y2="12"></line>
                    <line x1="3" y1="18" x2="18" y2="18"></line>
                </svg>
            </div>
            
            <div class="content-wrapper" id="content-wrapper">
                <div class="telemetry-view" id="telemetry-view">
                    <h1 class="phase-title" id="phase-title">Entry Interface Point</h1>
                    
                    <div class="telemetry">
                        <div class="telemetry-item">
                            <span class="telemetry-value" id="distance-value">307.92</span>
                            <span class="telemetry-label">miles from landing site.</span>
                        </div>
                        <div class="telemetry-item">
                            <span class="telemetry-label">Altitude:</span>
                            <span class="telemetry-value" id="altitude-value">58.10 miles</span>
                        </div>
                        <div class="telemetry-item">
                            <span class="telemetry-label">Velocity:</span>
                            <span class="telemetry-value" id="velocity-value">11,984.75 mph</span>
                        </div>
                    </div>
                    
                    <div class="phase-description" id="phase-description">
                        The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.
                    </div>
                    
                    <div class="countdown">
                        <span class="countdown-label">Touchdown in</span>
                        <span class="countdown-value" id="countdown-value">0:06:22</span>
                    </div>
                    
                    <div class="next-phase">
                        <div class="next-phase-label">Next phase:</div>
                        <div class="next-phase-info">
                            <span id="next-phase-name">Guidance Start</span> in 
                            <span id="next-phase-time">0:26</span>
                        </div>
                    </div>
                    
                    <div class="phase-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" id="phase-progress-bar"></div>
                        </div>
                        <div class="progress-label" id="phase-progress-label">Phase Progress</div>
                    </div>
                    
                    <div class="additional-telemetry">
                        <div class="telemetry-grid" id="telemetry-grid">
                            <!-- Dynamic telemetry cells will be inserted here -->
                        </div>
                    </div>
                    
                    <div class="scroll-indicator" id="scroll-indicator">
                        <span>Scroll for next phase</span>
                        <svg width="20" height="20" viewBox="0 0 24 24">
                            <path d="M7 10l5 5 5-5z" fill="currentColor"/>
                        </svg>
                    </div>
                </div>
                
                <div class="plots-view" id="plots-view" style="display: none;">
                    <h1 class="phase-title">Trajectory Plots</h1>
                    <div class="plots-container" id="plots-container"></div>
                </div>
            </div>
        `;
        
        this.options.container.innerHTML = html;
        
        // Cache elements
        this.elements = {
            title: document.getElementById('phase-title'),
            distance: document.getElementById('distance-value'),
            altitude: document.getElementById('altitude-value'),
            velocity: document.getElementById('velocity-value'),
            description: document.getElementById('phase-description'),
            countdown: document.getElementById('countdown-value'),
            nextPhaseName: document.getElementById('next-phase-name'),
            nextPhaseTime: document.getElementById('next-phase-time'),
            progressBar: document.getElementById('phase-progress-bar'),
            progressLabel: document.getElementById('phase-progress-label'),
            telemetryGrid: document.getElementById('telemetry-grid'),
            scrollIndicator: document.getElementById('scroll-indicator'),
            toggleIcon: document.getElementById('toggle-icon'),
            swapIcon: document.getElementById('swap-icon'),
            telemetryView: document.getElementById('telemetry-view'),
            plotsView: document.getElementById('plots-view'),
            plotsContainer: document.getElementById('plots-container'),
            contentWrapper: document.getElementById('content-wrapper'),
            iconChart: this.options.container.querySelector('.icon-chart'),
            iconInfo: this.options.container.querySelector('.icon-info'),
            iconCollapse: this.options.container.querySelector('.icon-collapse'),
            iconExpand: this.options.container.querySelector('.icon-expand')
        };
        
        // Add toggle icon event listener
        this.elements.toggleIcon.addEventListener('click', () => this.toggleVisibility());
        
        // Add swap icon event listener
        this.elements.swapIcon.addEventListener('click', () => this.toggleView());
        
        // Create dynamic telemetry cells
        this.createTelemetryGrid();
    }
    
    /**
     * Create telemetry grid cells dynamically based on controls config
     * Always includes Mach and G-Force, plus all dynamic controls
     */
    createTelemetryGrid() {
        const telemetryGrid = this.elements.telemetryGrid;
        if (!telemetryGrid) return;
        
        // Store references to dynamically created elements
        this.telemetryElements = {};
        this.controlButtons = {}; // Store button references for enabling/disabling
        
        // Add dynamic control cells
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            const config = CONTROLS_CONFIG[controlId];
            const cell = document.createElement('div');
            cell.className = 'telemetry-cell';
            
            // Check if this is a slider-type control (NUMBER or ANGLE)
            const isSliderControl = config.type === 'number' || config.type === 'angle';
            
            if (isSliderControl) {
                // Use left/right arrows for angles, up/down for numbers
                const isAngle = config.type === 'angle';
                
                // Arrow SVGs based on control type
                const decreaseArrow = isAngle 
                    ? '<path d="M15 19l-7-7 7-7"/>'  // Left arrow
                    : '<path d="M7 10l5 5 5-5z"/>';  // Down arrow
                    
                const increaseArrow = isAngle
                    ? '<path d="M9 5l7 7-7 7"/>'     // Right arrow
                    : '<path d="M7 14l5-5 5 5z"/>';  // Up arrow
                
                // Create cell with arrow buttons for slider controls
                cell.innerHTML = `
                    <span class="cell-label">${config.label}</span>
                    <div class="cell-value-controls">
                        <button class="cell-arrow-btn ${isAngle ? 'cell-arrow-left' : 'cell-arrow-down'}" data-control-id="${controlId}" data-direction="decrease" title="Decrease ${config.label}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                ${decreaseArrow}
                            </svg>
                        </button>
                        <span class="cell-value" id="${controlId}-value">0.0${config.unit}</span>
                        <button class="cell-arrow-btn ${isAngle ? 'cell-arrow-right' : 'cell-arrow-up'}" data-control-id="${controlId}" data-direction="increase" title="Increase ${config.label}">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                ${increaseArrow}
                            </svg>
                        </button>
                    </div>
                `;
                telemetryGrid.appendChild(cell);
                
                // Store element references
                this.telemetryElements[controlId] = document.getElementById(`${controlId}-value`);
                
                // Store button references
                const decreaseBtn = cell.querySelector('[data-direction="decrease"]');
                const increaseBtn = cell.querySelector('[data-direction="increase"]');
                this.controlButtons[controlId] = { decreaseBtn, increaseBtn };
                
                // Add event listeners for continuous hold
                this.setupContinuousButton(decreaseBtn, controlId, 'decrease', config);
                this.setupContinuousButton(increaseBtn, controlId, 'increase', config);
            } else {
                // Regular cell without buttons for non-slider controls
                cell.innerHTML = `
                    <span class="cell-label">${config.label}</span>
                    <span class="cell-value" id="${controlId}-value">0.0${config.unit}</span>
                `;
                telemetryGrid.appendChild(cell);
                this.telemetryElements[controlId] = document.getElementById(`${controlId}-value`);
            }
        });
        
        // Add Mach cell
        const machCell = document.createElement('div');
        machCell.className = 'telemetry-cell';
        machCell.innerHTML = `
            <span class="cell-label">Mach</span>
            <span class="cell-value" id="mach-value">0.0</span>
        `;
        telemetryGrid.appendChild(machCell);
        this.telemetryElements.mach = document.getElementById('mach-value');
        
        // Add G-Force cell
        const gforceCell = document.createElement('div');
        gforceCell.className = 'telemetry-cell';
        gforceCell.innerHTML = `
            <span class="cell-label">G-Force</span>
            <span class="cell-value" id="gforce-value">0.0g</span>
        `;
        telemetryGrid.appendChild(gforceCell);
        this.telemetryElements.gforce = document.getElementById('gforce-value');
    }
    
    /**
     * Setup continuous button press behavior
     * @param {HTMLElement} button - Button element
     * @param {string} controlId - Control identifier
     * @param {string} direction - 'increase' or 'decrease'
     * @param {Object} config - Control configuration
     */
    setupContinuousButton(button, controlId, direction, config) {
        let isHolding = false;
        
        const startHold = () => {
            if (this.isReplayMode) return;
            
            // Immediate first action
            this.handleControlButtonClick(controlId, direction, config);
            
            // Delay before continuous firing starts (300ms)
            this.activeHoldTimeout = setTimeout(() => {
                isHolding = true;
                
                // Continuous firing while held (every 100ms)
                this.activeHoldInterval = setInterval(() => {
                    if (isHolding) {
                        this.handleControlButtonClick(controlId, direction, config);
                    }
                }, 100);
            }, 300);
        };
        
        const stopHold = () => {
            isHolding = false;
            if (this.activeHoldTimeout) {
                clearTimeout(this.activeHoldTimeout);
                this.activeHoldTimeout = null;
            }
            if (this.activeHoldInterval) {
                clearInterval(this.activeHoldInterval);
                this.activeHoldInterval = null;
            }
        };
        
        // Mouse events
        button.addEventListener('mousedown', startHold);
        button.addEventListener('mouseup', stopHold);
        button.addEventListener('mouseleave', stopHold);
        
        // Touch events for mobile
        button.addEventListener('touchstart', (e) => {
            e.preventDefault(); // Prevent mouse events from also firing
            startHold();
        });
        button.addEventListener('touchend', stopHold);
        button.addEventListener('touchcancel', stopHold);
    }
    
    /**
     * Handle control button clicks from telemetry grid
     * @param {string} controlId - Control identifier
     * @param {string} direction - 'increase' or 'decrease'
     * @param {Object} config - Control configuration
     */
    handleControlButtonClick(controlId, direction, config) {
        // Don't allow control changes during replay
        if (this.isReplayMode) {
            console.log('Control adjustments disabled during replay');
            return;
        }
        
        // Get current value from telemetry display
        const currentValueText = this.telemetryElements[controlId]?.textContent || '0';
        const currentValue = parseFloat(currentValueText);
        
        // Calculate adjustment based on keyboard step
        const step = config.keyboardStep || config.step || 1;
        const adjustment = direction === 'increase' ? step : -step;
        
        // Notify parent component (SimulationManager) of the control change
        if (this.onControlAdjust) {
            this.onControlAdjust(controlId, adjustment);
        }
    }
    
    /**
     * Enable or disable control buttons
     * @param {boolean} enabled - Whether buttons should be enabled
     */
    setControlButtonsEnabled(enabled) {
        Object.values(this.controlButtons).forEach(({ decreaseBtn, increaseBtn }) => {
            decreaseBtn.disabled = !enabled;
            increaseBtn.disabled = !enabled;
        });
    }
    
    
    toggleVisibility() {
        this.isVisible = !this.isVisible;
        
        if (this.isVisible) {
            // Show panel - slide in from left
            this.options.container.classList.remove('hidden');
            this.elements.contentWrapper.classList.remove('slide-out');
            this.elements.contentWrapper.classList.add('slide-in');
            this.elements.iconCollapse.style.display = 'block';
            this.elements.iconExpand.style.display = 'none';
            this.elements.toggleIcon.title = 'Hide panel';
            this.elements.swapIcon.style.display = 'flex';
        } else {
            // Hide panel - slide out to left
            this.elements.contentWrapper.classList.remove('slide-in');
            this.elements.contentWrapper.classList.add('slide-out');
            this.elements.iconCollapse.style.display = 'none';
            this.elements.iconExpand.style.display = 'block';
            this.elements.toggleIcon.title = 'Show panel';
            this.elements.swapIcon.style.display = 'none';
        }
    }
    
    toggleView() {
        this.showingPlots = !this.showingPlots;
        
        if (this.showingPlots) {
            // Showing plots - display info/text icon
            this.elements.telemetryView.style.display = 'none';
            this.elements.plotsView.style.display = 'block';
            this.elements.iconChart.style.display = 'none';
            this.elements.iconInfo.style.display = 'block';
            this.elements.swapIcon.title = 'Show telemetry';
            this.updatePlots();
        } else {
            // Showing telemetry - display chart/plot icon
            this.elements.telemetryView.style.display = 'block';
            this.elements.plotsView.style.display = 'none';
            this.elements.iconChart.style.display = 'block';
            this.elements.iconInfo.style.display = 'none';
            this.elements.swapIcon.title = 'Show plots';
        }
    }
    
    updatePlots() {
        if (!this.elements.plotsContainer || this.timeData.length === 0) return;
        
        // Clear previous plots
        this.elements.plotsContainer.innerHTML = '';

        // Prepare data for simulation plots
        const timeData = this.isReplayMode ? this.timeData.filter(time => time <= this.currentTime) : this.timeData;
        const plotData = timeData.map((time, i) => {
            const dataPoint = {
                time: time,
                distance: this.distanceData[i],
                altitude: this.altitudeData[i],
                velocity: this.velocityData[i]
            };
            
            // Add all control values to plot data
            Object.keys(CONTROLS_CONFIG).forEach(controlId => {
                dataPoint[controlId] = this.controlsData[controlId][i];
            });
            
            return dataPoint;
        });
        
        // Prepare reference trajectory data
        const refTimeData = this.isReplayMode ? this.refTimeData.filter(time => time <= this.currentTime) : this.refTimeData;
        const refPlotData = refTimeData.map((time, i) => {
            const dataPoint = {
                time: time,
                distance: this.refDistanceData[i],
                altitude: this.refAltitudeData[i],
                velocity: this.refVelocityData[i]
            };
            
            // Add all control values (0 for reference)
            Object.keys(CONTROLS_CONFIG).forEach(controlId => {
                dataPoint[controlId] = this.refControlsData[controlId][i] || 0;
            });
            
            return dataPoint;
        });

        const totalHeight = 500; 
        const plotHeight = totalHeight / 4;
        
        // Distance plot
        const distanceMarks = [
            Plot.line(plotData, {
                x: 'time',
                y: 'distance',
                stroke: '#ff6600',
                strokeWidth: 2
            }),
            Plot.dot(plotData.slice(-1), {
                x: 'time',
                y: 'distance',
                fill: '#ff6600',
                r: 4,
            }),
            Plot.text(plotData.slice(-1), { 
                x: "time", 
                y: "distance", 
                text: (d) => `${d.distance.toFixed(0)}`, 
                dy: -6, 
                lineAnchor: "bottom"
            })
        ];
        
        // Add reference trajectory line if available
        if (refPlotData.length > 0) {
            distanceMarks.unshift(
                Plot.line(refPlotData, {
                    x: 'time',
                    y: 'distance',
                    stroke: REFERENCE_TRAJECTORY_COLOR,
                    strokeWidth: 1,
                    strokeDasharray: "4,4"
                })
            );
        }
        
        const distancePlot = Plot.plot({
            width: 400,
            height: plotHeight,
            marginLeft: 50,
            marginBottom: 30,
            marginRight: 80,
            style: {
                background: 'transparent',
                color: '#fff'
            },
            x: {
                label: 'Time (s)',
                grid: true,
                tickFormat: d => d.toFixed(0)
            },
            y: {
                label: 'Distance (miles)',
                grid: true,
                tickFormat: d => d.toFixed(0)
            },
            marks: distanceMarks,
            // Add legend
            color: {
                legend: SHOW_LEGEND,
                domain: refPlotData.length > 0 ? ["Reference", "Current"] : ["Current"],
                range: refPlotData.length > 0 ? [REFERENCE_TRAJECTORY_COLOR, '#ff6600'] : ['#ff6600']
            }
        });
        
        // Altitude plot
        const altitudeMarks = [
            Plot.line(plotData, {
                x: 'time',
                y: 'altitude',
                stroke: '#00aaff',
                strokeWidth: 2
            }),
            Plot.dot(plotData.slice(-1), {
                x: 'time',
                y: 'altitude',
                fill: '#00aaff',
                r: 4
            }),
            Plot.text(plotData.slice(-1), { 
                x: "time", 
                y: "altitude", 
                text: (d) => `${d.altitude.toFixed(1)}`, 
                dy: -6, 
                lineAnchor: "bottom" 
            })
        ];
        
        // Add reference trajectory line if available
        if (refPlotData.length > 0) {
            altitudeMarks.unshift(
                Plot.line(refPlotData, {
                    x: 'time',
                    y: 'altitude',
                    stroke: REFERENCE_TRAJECTORY_COLOR,
                    strokeWidth: 1,
                    strokeDasharray: "4,4"
                })
            );
        }
        
        const altitudePlot = Plot.plot({
            width: 400,
            height: plotHeight,
            marginLeft: 50,
            marginBottom: 30,
            marginRight: 80,
            style: {
                background: 'transparent',
                color: '#fff'
            },
            x: {
                label: 'Time (s)',
                grid: true,
                tickFormat: d => d.toFixed(0)
            },
            y: {
                label: 'Altitude (miles)',
                grid: true,
                tickFormat: d => d.toFixed(1)
            },
            marks: altitudeMarks,
            // Add legend
            color: {
                legend: SHOW_LEGEND,
                domain: refPlotData.length > 0 ? ["Reference", "Current"] : ["Current"],
                range: refPlotData.length > 0 ? [REFERENCE_TRAJECTORY_COLOR, '#00aaff'] : ['#00aaff']
            }
        });
        
        // Velocity plot
        const velocityMarks = [
            Plot.line(plotData, {
                x: 'time',
                y: 'velocity',
                stroke: '#00ff88',
                strokeWidth: 2,
            }),
            Plot.dot(plotData.slice(-1), {
                x: 'time',
                y: 'velocity',
                fill: '#00ff88',
                r: 4,
            }),
            Plot.text(plotData.slice(-1), { 
                x: "time", 
                y: "velocity", 
                text: (d) => `${d.velocity.toFixed(0)}`, 
                dy: -6, 
                lineAnchor: "bottom" 
            })
        ];
        
        // Add reference trajectory line if available
        if (refPlotData.length > 0) {
            velocityMarks.unshift(
                Plot.line(refPlotData, {
                    x: 'time',
                    y: 'velocity',
                    stroke: REFERENCE_TRAJECTORY_COLOR,
                    strokeWidth: 1,
                    strokeDasharray: "4,4"
                })
            );
        }
        
        const velocityPlot = Plot.plot({
            width: 400,
            height: plotHeight,
            marginLeft: 50,
            marginBottom: 30,
            marginRight: 80,
            style: {
                background: 'transparent',
                color: '#fff'
            },
            x: {
                label: 'Time (s)',
                grid: true,
                tickFormat: d => d.toFixed(0)
            },
            y: {
                label: 'Velocity (mph)',
                grid: true,
                tickFormat: d => d.toFixed(0)
            },
            marks: velocityMarks,
            // Add legend
            color: {
                legend: SHOW_LEGEND,
                domain: refPlotData.length > 0 ? ["Reference", "Current"] : ["Current"],
                range: refPlotData.length > 0 ? [REFERENCE_TRAJECTORY_COLOR, '#00ff88'] : ['#00ff88']
            }
        });

        // Append base plots
        this.elements.plotsContainer.appendChild(distancePlot);
        this.elements.plotsContainer.appendChild(altitudePlot);
        this.elements.plotsContainer.appendChild(velocityPlot);
        
        // Create plots for all dynamic controls
        const controlColors = ['#ffaa00', '#ff66ff', '#66ffff', '#ffff66']; // Color palette for controls
        let colorIndex = 0;
        
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            const config = CONTROLS_CONFIG[controlId];
            const color = controlColors[colorIndex % controlColors.length];
            colorIndex++;
            
            const controlMarks = [
                Plot.line(plotData, {
                    x: 'time',
                    y: controlId,
                    stroke: color,
                    strokeWidth: 2
                }),
                Plot.dot(plotData.slice(-1), {
                    x: 'time',
                    y: controlId,
                    fill: color,
                    r: 4
                }),
                Plot.text(plotData.slice(-1), { 
                    x: "time", 
                    y: controlId, 
                    text: (d) => `${d[controlId].toFixed(1)}`, 
                    dy: -6, 
                    lineAnchor: "bottom" 
                })
            ];
            
            // Add reference trajectory line (0 for all controls)
            if (refPlotData.length > 0) {
                controlMarks.unshift(
                    Plot.line(refPlotData, {
                        x: 'time',
                        y: controlId,
                        stroke: REFERENCE_TRAJECTORY_COLOR,
                        strokeWidth: 1,
                        strokeDasharray: "4,4"
                    })
                );
            }
            
            const controlPlot = Plot.plot({
                width: 400,
                height: plotHeight,
                marginLeft: 50,
                marginBottom: 30,
                marginRight: 80,
                style: {
                    background: 'transparent',
                    color: '#fff'
                },
                x: {
                    label: 'Time (s)',
                    grid: true,
                    tickFormat: d => d.toFixed(0)
                },
                y: {
                    label: `${config.label} (${config.unit})`,
                    grid: true,
                    tickFormat: d => d.toFixed(1)
                },
                marks: controlMarks,
                // Add legend
                color: {
                    legend: SHOW_LEGEND,
                    domain: refPlotData.length > 0 ? ["Reference", "Current"] : ["Current"],
                    range: refPlotData.length > 0 ? [REFERENCE_TRAJECTORY_COLOR, color] : [color]
                }
            });
            
            this.elements.plotsContainer.appendChild(controlPlot);
        });
    }
    
    update(phase, vehicleData, currentTime, totalTime, controls = {}, refVehicleData = null) {
        if (!phase) return;
        
        // Update phase title with animation if changed
        if (this.currentPhase !== phase.name) {
            this.currentPhase = phase.name;
            this.animatePhaseChange(phase);
        }
        
        // Update telemetry with proper NaN and velocity handling
        if (vehicleData) {
            // Distance - handle NaN
            const distanceMiles = (vehicleData.distanceToLanding || 0) * 0.621371;
            this.elements.distance.textContent = isNaN(distanceMiles) ? '0.00' : distanceMiles.toFixed(2);
            
            // Altitude - handle NaN
            const altitudeMiles = (vehicleData.altitude || 0) * 0.621371;
            this.elements.altitude.textContent = isNaN(altitudeMiles) ? '0.00 miles' : `${altitudeMiles.toFixed(2)} miles`;
            
            // Velocity - handle different formats (Vector3, scalar, or velocityMagnitude)
            let velocityValue = 0;
            
            // First check for velocityMagnitude property (preferred)
            if (typeof vehicleData.velocityMagnitude === 'number' && !isNaN(vehicleData.velocityMagnitude)) {
                velocityValue = vehicleData.velocityMagnitude;
            }
            // Then check if velocity is a scalar number
            else if (typeof vehicleData.velocity === 'number' && !isNaN(vehicleData.velocity)) {
                velocityValue = Math.abs(vehicleData.velocity);
            }
            // Check if velocity is a Vector3 object
            else if (vehicleData.velocity && typeof vehicleData.velocity === 'object') {
                if (typeof vehicleData.velocity.length === 'function') {
                    velocityValue = vehicleData.velocity.length() * 100000; // Scale up if Vector3
                } else if (typeof vehicleData.velocity.x === 'number') {
                    // Calculate magnitude manually if needed
                    const v = vehicleData.velocity;
                    velocityValue = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) * 100000;
                }
            }
            
            const velocityMph = velocityValue * 0.621371;
            this.elements.velocity.textContent = isNaN(velocityMph) ? '0 mph' : `${Math.round(velocityMph).toLocaleString()} mph`;
            
            // Additional telemetry (including dynamic controls)
            this.updateAdditionalTelemetry(vehicleData, phase, controls);

            // Store data for plots (sample every ~0.25 seconds to avoid too many points)
            if (this.timeData.length === 0 || currentTime - this.timeData[this.timeData.length - 1] >= 0.25) {
                if (!this.isReplayMode) {
                    // Check if simulation data is valid (velocity >= 100 mph)
                    const simDataValid = !isNaN(distanceMiles) && !isNaN(altitudeMiles) && !isNaN(velocityMph) && velocityMph >= 100;
                    
                    if (!this.hasStartedSimData) {
                        if (simDataValid) {
                            this.hasStartedSimData = true;
                        } 
                    }
                    
                    // Store simulation data once we've started collecting
                    if (this.hasStartedSimData) {
                        this.timeData.push(currentTime);
                        this.distanceData.push(distanceMiles);
                        this.altitudeData.push(altitudeMiles);
                        this.velocityData.push(Math.round(velocityMph));
                        
                        // Store all control values
                        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
                            const value = controls[controlId] !== undefined ? controls[controlId] : CONTROLS_CONFIG[controlId].defaultValue;
                            this.controlsData[controlId].push(isNaN(value) ? 0 : value);
                        });
                    }
                    
                    // Store reference trajectory data if available
                    if (refVehicleData) {
                        const refDistanceMiles = (refVehicleData.distanceToLanding || 0) * 0.621371;
                        const refAltitudeMiles = (refVehicleData.altitude || 0) * 0.621371;
                        
                        let refVelocityValue = 0;
                        if (typeof refVehicleData.velocityMagnitude === 'number' && !isNaN(refVehicleData.velocityMagnitude)) {
                            refVelocityValue = refVehicleData.velocityMagnitude;
                        }
                        const refVelocityMph = refVelocityValue * 0.621371;
                        
                        // Check if reference data is valid (velocity >= 100 mph)
                        const refDataValid = !isNaN(refDistanceMiles) && !isNaN(refAltitudeMiles) && !isNaN(refVelocityMph) && refVelocityMph >= 100;
                        
                        if (!this.hasStartedRefData) {
                            if (refDataValid) {
                                this.hasStartedRefData = true;
                            }
                        }
                        
                        // Store reference data once we've started collecting
                        if (this.hasStartedRefData) {
                            this.refTimeData.push(currentTime);
                            this.refDistanceData.push(refDistanceMiles);
                            this.refAltitudeData.push(refAltitudeMiles);
                            this.refVelocityData.push(Math.round(refVelocityMph));
                            
                            // Store reference control values (0 for all controls as per requirement)
                            Object.keys(CONTROLS_CONFIG).forEach(controlId => {
                                this.refControlsData[controlId].push(0);
                            });
                        }
                    }
                    
                    if (this.dataLimit && this.timeData.length > this.dataLimit) {
                        this.timeData.shift();
                        this.distanceData.shift();
                        this.altitudeData.shift();
                        this.velocityData.shift();
                        
                        // Shift reference data
                        if (this.refTimeData.length > this.dataLimit) {
                            this.refTimeData.shift();
                            this.refDistanceData.shift();
                            this.refAltitudeData.shift();
                            this.refVelocityData.shift();
                        }
                        
                        // Shift all control data arrays
                        Object.keys(this.controlsData).forEach(controlId => {
                            this.controlsData[controlId].shift();
                        });
                        
                        // Shift reference control data arrays
                        Object.keys(this.refControlsData).forEach(controlId => {
                            if (this.refControlsData[controlId].length > this.dataLimit) {
                                this.refControlsData[controlId].shift();
                            }
                        });
                    }
                }
            }
        }

        if (this.isReplayMode) {
            this.currentTime = currentTime;
        }
        
        // Update plots if showing
        if (this.showingPlots) {
            this.updatePlots();
        }
        
        // Update countdown
        const timeRemaining = totalTime - currentTime;
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = Math.floor(timeRemaining % 60);
        this.elements.countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        // Update next phase info
        if (phase.nextPhase) {
            this.elements.nextPhaseName.textContent = phase.nextPhase;
            const timeToNext = phase.nextPhaseTime - currentTime;
            if (timeToNext > 0) {
                const nextMinutes = Math.floor(timeToNext / 60);
                const nextSeconds = Math.floor(timeToNext % 60);
                this.elements.nextPhaseTime.textContent = 
                    `${nextMinutes}:${nextSeconds.toString().padStart(2, '0')}`;
            }
        } else {
            this.elements.nextPhaseName.textContent = 'Landing';
            this.elements.nextPhaseTime.textContent = 'Soon';
        }
        
        // Update phase progress
        this.updatePhaseProgress(phase, currentTime);
        
        // Hide scroll indicator after first phase
        if (currentTime > 30) {
            this.elements.scrollIndicator.classList.add('hidden');
        }
    }
    
    animatePhaseChange(phase) {
        // Fade out and in effect
        this.elements.title.classList.add('no-animation');
        this.elements.description.classList.add('no-animation');
        
        setTimeout(() => {
            this.elements.title.textContent = phase.name;
            this.elements.description.textContent = phase.description;
            this.elements.title.classList.remove('no-animation');
            this.elements.description.classList.remove('no-animation');
            this.elements.title.classList.add('slide-in-animation');
            this.elements.description.classList.add('fade-in-delayed-animation');
        }, 50);
    }
    
    updateAdditionalTelemetry(vehicleData, phase, controls = {}) {
        // Extract velocity magnitude properly
        let velocity = 0;

        if (typeof vehicleData.velocityMagnitude === 'number' && !isNaN(vehicleData.velocityMagnitude)) {
            velocity = vehicleData.velocityMagnitude;
        } else if (typeof vehicleData.velocity === 'number' && !isNaN(vehicleData.velocity)) {
            velocity = Math.abs(vehicleData.velocity);
        } else if (vehicleData.velocity && typeof vehicleData.velocity === 'object') {
            if (typeof vehicleData.velocity.length === 'function') {
                velocity = vehicleData.velocity.length() * 100000;
            }
        }

        // Update all dynamic control values from controls object
        Object.keys(CONTROLS_CONFIG).forEach(controlId => {
            const config = CONTROLS_CONFIG[controlId];
            const element = this.telemetryElements[controlId];
            if (element) {
                // Get value from controls object, fallback to vehicleData, then config default
                let value = controls[controlId];
                if (value === undefined && vehicleData[controlId] !== undefined) {
                    value = vehicleData[controlId];
                }
                if (value === undefined) {
                    value = config.defaultValue;
                }
                
                element.textContent = `${value.toFixed(1)}${config.unit}`;
                
                // Apply special styling for certain controls
                if (controlId === 'angleOfAttack') {
                    // Highlight AoA when it changes (SUFR maneuver)
                    if (Math.abs(value) < 1) {
                        element.style.color = '#00ff00'; // Green for zero AoA
                    } else {
                        element.style.color = '#ffffff'; // White for trim AoA
                    }
                } else if (controlId === 'bankAngle') {
                    // Highlight bank angle when non-zero
                    if (Math.abs(value) > 5) {
                        element.style.color = '#ffaa00'; // Orange for active banking
                    } else {
                        element.style.color = '#ffffff'; // White for wings level
                    }
                }
            }
        });

        // Mach number - use actual calculation if available, otherwise simplified
        let mach = 0;
        if (vehicleData.mach !== undefined && !isNaN(vehicleData.mach)) {
            mach = vehicleData.mach;
        } else {
            // Speed of sound on Mars varies with altitude, approximate 240 m/s at surface
            const altitude = vehicleData.altitude || 0;
            const soundSpeed = 240 - (altitude * 0.5); // Rough approximation
            mach = velocity / Math.max(soundSpeed, 150);
        }
        this.telemetryElements.mach.textContent = isNaN(mach) ? '0.0' : mach.toFixed(1);

        // G-Force calculation (simplified based on deceleration)
        const gForce = Math.min(velocity / 5000, 8);
        this.telemetryElements.gforce.textContent = isNaN(gForce) ? '0.0g' : `${gForce.toFixed(1)}g`;

        // Color code values based on severity
        this.colorCodeValue(this.telemetryElements.gforce, gForce, 4, 6);
        this.colorCodeValue(this.telemetryElements.mach, mach, 10, 20);
    }
    
    colorCodeValue(element, value, warningThreshold, dangerThreshold) {
        if (!element || isNaN(value)) return;
        
        element.classList.remove('value-normal', 'value-warning', 'value-danger');
        
        if (value > dangerThreshold) {
            element.classList.add('value-danger');
        } else if (value > warningThreshold) {
            element.classList.add('value-warning');
        } else {
            element.classList.add('value-normal');
        }
    }
    
    updatePhaseProgress(phase, currentTime) {
        if (!phase.nextPhaseTime) {
            this.elements.progressBar.style.setProperty('--progress-width', '100%');
            return;
        }
        
        const phaseDuration = phase.nextPhaseTime - phase.time;
        const timeInPhase = currentTime - phase.time;
        const progress = Math.max(0, Math.min(100, (timeInPhase / phaseDuration) * 100));
        
        this.elements.progressBar.style.setProperty('--progress-width', `${progress}%`);
        this.elements.progressLabel.textContent = `Phase Progress - ${Math.round(progress)}%`;
    }
    
    showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `phase-alert alert-${type}`;
        alert.textContent = message;
        alert.classList.add('alert-slide-in');
        
        this.options.container.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('alert-slide-out');
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    }
    
    dispose() {
        // Clean up any active hold intervals
        if (this.activeHoldTimeout) {
            clearTimeout(this.activeHoldTimeout);
            this.activeHoldTimeout = null;
        }
        if (this.activeHoldInterval) {
            clearInterval(this.activeHoldInterval);
            this.activeHoldInterval = null;
        }
        
        // Clean up event listeners and DOM
        if (this.options.container) {
            this.options.container.innerHTML = '';
        }
        
        // Clear references
        this.elements = {};
        this.currentPhase = null;
    }
}