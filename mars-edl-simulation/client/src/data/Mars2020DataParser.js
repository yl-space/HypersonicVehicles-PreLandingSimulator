/**
 * Mars 2020 EDL Data Parser
 * 
 * Parses CSV data for Mars 2020 Entry, Descent, Landing trajectory
 * Data format: time(s), x(m), y(m), z(m) in J2000 frame
 * Time is calculated from Entry Interface (EI) at ~132 km altitude
 * Data ends at parachute deployment at 260.65s after EI at 13462.9m altitude
 */

export class Mars2020DataParser {
    constructor() {
        this.trajectoryData = [];
        this.entryInterfaceTime = 0; // EI time reference
        this.parachuteDeploymentTime = 260.65; // seconds after EI
        this.entryInterfaceAltitude = 132000; // meters
        this.parachuteDeploymentAltitude = 13462.9; // meters
        this.isDataLoaded = false;
    }

    /**
     * Parse CSV data from string
     * @param {string} csvData - Raw CSV data
     * @returns {Array} Parsed trajectory data
     */
    parseCSV(csvData) {
        const lines = csvData.trim().split('\n');
        const trajectory = [];

        // Skip header if present (check if first line contains non-numeric data)
        const startIndex = this.isHeaderLine(lines[0]) ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const values = line.split(',').map(val => parseFloat(val.trim()));
            
            if (values.length >= 4 && !values.some(isNaN)) {
                const [time, x, y, z] = values;
                
                // Validate time range (0 to 260.65 seconds after EI)
                if (time >= 0 && time <= this.parachuteDeploymentTime) {
                    trajectory.push({
                        time: time,
                        position: { x: x, y: y, z: z },
                        altitude: this.calculateAltitude(x, y, z),
                        velocity: this.calculateVelocity(trajectory, time, x, y, z),
                        phase: this.determinePhase(time, this.calculateAltitude(x, y, z))
                    });
                }
            }
        }

        this.trajectoryData = trajectory;
        this.isDataLoaded = true;
        
        console.log(`Parsed ${trajectory.length} trajectory points`);
        console.log(`Time range: ${trajectory[0]?.time}s to ${trajectory[trajectory.length-1]?.time}s`);
        console.log(`Altitude range: ${trajectory[0]?.altitude}m to ${trajectory[trajectory.length-1]?.altitude}m`);
        
        return trajectory;
    }

    /**
     * Load CSV data from file
     * @param {File} file - CSV file object
     * @returns {Promise<Array>} Parsed trajectory data
     */
    async loadFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (event) => {
                try {
                    const csvData = event.target.result;
                    const trajectory = this.parseCSV(csvData);
                    resolve(trajectory);
                } catch (error) {
                    reject(error);
                }
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Load CSV data from URL
     * @param {string} url - URL to CSV file
     * @returns {Promise<Array>} Parsed trajectory data
     */
    async loadFromURL(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const csvData = await response.text();
            return this.parseCSV(csvData);
        } catch (error) {
            console.error('Failed to load CSV from URL:', error);
            throw error;
        }
    }

    /**
     * Check if line is a header
     * @param {string} line - CSV line
     * @returns {boolean} True if header line
     */
    isHeaderLine(line) {
        const firstValue = line.split(',')[0].trim().toLowerCase();
        return isNaN(firstValue) || firstValue.includes('time') || firstValue.includes('t');
    }

    /**
     * Calculate altitude from J2000 coordinates
     * @param {number} x - X coordinate in meters
     * @param {number} y - Y coordinate in meters  
     * @param {number} z - Z coordinate in meters
     * @returns {number} Altitude in meters
     */
    calculateAltitude(x, y, z) {
        // Mars radius (approximate)
        const marsRadius = 3389500; // meters
        
        // Distance from Mars center
        const distance = Math.sqrt(x*x + y*y + z*z);
        
        // Altitude above Mars surface
        return distance - marsRadius;
    }

    /**
     * Calculate velocity from position data
     * @param {Array} trajectory - Previous trajectory points
     * @param {number} time - Current time
     * @param {number} x - Current X position
     * @param {number} y - Current Y position
     * @param {number} z - Current Z position
     * @returns {number} Velocity magnitude in m/s
     */
    calculateVelocity(trajectory, time, x, y, z) {
        if (trajectory.length === 0) return 0;
        
        const prevPoint = trajectory[trajectory.length - 1];
        const dt = time - prevPoint.time;
        
        if (dt <= 0) return prevPoint.velocity || 0;
        
        const dx = x - prevPoint.position.x;
        const dy = y - prevPoint.position.y;
        const dz = z - prevPoint.position.z;
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        return distance / dt;
    }

    /**
     * Determine mission phase based on time and altitude
     * @param {number} time - Time after EI in seconds
     * @param {number} altitude - Altitude in meters
     * @returns {string} Mission phase
     */
    determinePhase(time, altitude) {
        if (time < 10) return 'Entry Interface';
        if (altitude > 80000) return 'Early Entry';
        if (altitude > 50000) return 'Peak Heating';
        if (altitude > 20000) return 'Peak Deceleration';
        if (altitude > 15000) return 'Approach';
        if (time >= this.parachuteDeploymentTime) return 'Parachute Deployment';
        return 'Final Approach';
    }

    /**
     * Get trajectory data at specific time
     * @param {number} time - Time after EI in seconds
     * @returns {Object|null} Trajectory point or null if not found
     */
    getDataAtTime(time) {
        if (!this.isDataLoaded || this.trajectoryData.length === 0) {
            return null;
        }

        // Find exact match or interpolate
        for (let i = 0; i < this.trajectoryData.length; i++) {
            if (Math.abs(this.trajectoryData[i].time - time) < 0.01) {
                return this.trajectoryData[i];
            }
        }

        // Interpolate between points
        return this.interpolateData(time);
    }

    /**
     * Interpolate trajectory data between known points
     * @param {number} time - Target time
     * @returns {Object|null} Interpolated trajectory point
     */
    interpolateData(time) {
        if (this.trajectoryData.length < 2) return null;

        // Find surrounding points
        let before = null;
        let after = null;

        for (let i = 0; i < this.trajectoryData.length - 1; i++) {
            if (this.trajectoryData[i].time <= time && 
                this.trajectoryData[i + 1].time >= time) {
                before = this.trajectoryData[i];
                after = this.trajectoryData[i + 1];
                break;
            }
        }

        if (!before || !after) return null;

        // Linear interpolation
        const t = (time - before.time) / (after.time - before.time);
        
        return {
            time: time,
            position: {
                x: before.position.x + (after.position.x - before.position.x) * t,
                y: before.position.y + (after.position.y - before.position.y) * t,
                z: before.position.z + (after.position.z - before.position.z) * t
            },
            altitude: before.altitude + (after.altitude - before.altitude) * t,
            velocity: before.velocity + (after.velocity - before.velocity) * t,
            phase: before.phase
        };
    }

    /**
     * Get mission statistics
     * @returns {Object} Mission statistics
     */
    getMissionStats() {
        if (!this.isDataLoaded || this.trajectoryData.length === 0) {
            return null;
        }

        const first = this.trajectoryData[0];
        const last = this.trajectoryData[this.trajectoryData.length - 1];
        
        // Find peak values
        let maxVelocity = 0;
        let maxAltitude = 0;
        let minAltitude = Infinity;

        this.trajectoryData.forEach(point => {
            maxVelocity = Math.max(maxVelocity, point.velocity);
            maxAltitude = Math.max(maxAltitude, point.altitude);
            minAltitude = Math.min(minAltitude, point.altitude);
        });

        return {
            duration: last.time - first.time,
            altitudeRange: {
                start: first.altitude,
                end: last.altitude,
                max: maxAltitude,
                min: minAltitude
            },
            velocityRange: {
                start: first.velocity,
                end: last.velocity,
                max: maxVelocity
            },
            totalDistance: this.calculateTotalDistance(),
            phases: this.getPhaseBreakdown()
        };
    }

    /**
     * Calculate total distance traveled
     * @returns {number} Total distance in meters
     */
    calculateTotalDistance() {
        let totalDistance = 0;
        
        for (let i = 1; i < this.trajectoryData.length; i++) {
            const prev = this.trajectoryData[i - 1];
            const curr = this.trajectoryData[i];
            
            const dx = curr.position.x - prev.position.x;
            const dy = curr.position.y - prev.position.y;
            const dz = curr.position.z - prev.position.z;
            
            totalDistance += Math.sqrt(dx*dx + dy*dy + dz*dz);
        }
        
        return totalDistance;
    }

    /**
     * Get breakdown of mission phases
     * @returns {Object} Phase breakdown
     */
    getPhaseBreakdown() {
        const phases = {};
        
        this.trajectoryData.forEach(point => {
            if (!phases[point.phase]) {
                phases[point.phase] = {
                    startTime: point.time,
                    endTime: point.time,
                    startAltitude: point.altitude,
                    endAltitude: point.altitude
                };
            } else {
                phases[point.phase].endTime = point.time;
                phases[point.phase].endAltitude = point.altitude;
            }
        });
        
        return phases;
    }

    /**
     * Export trajectory data as CSV
     * @returns {string} CSV formatted data
     */
    exportAsCSV() {
        if (!this.isDataLoaded) return '';
        
        const header = 'Time(s),X(m),Y(m),Z(m),Altitude(m),Velocity(m/s),Phase\n';
        const rows = this.trajectoryData.map(point => 
            `${point.time},${point.position.x},${point.position.y},${point.position.z},${point.altitude},${point.velocity},${point.phase}`
        ).join('\n');
        
        return header + rows;
    }
} 