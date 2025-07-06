export class TrajectoryManager {
    constructor() {
        this.data = [];
        this.interpolationEnabled = true;
    }
    
    async loadTrajectoryData(csvData) {
        if (typeof csvData === 'string') {
            this.data = this.parseCSV(csvData);
        } else {
            this.data = csvData;
        }
        console.log(`✅ Trajectory loaded: ${this.data.length} points`);
        return this.data;
    }
    
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            data.push({
                time: parseFloat(values[0]),
                x: parseFloat(values[1]),
                y: parseFloat(values[2]),
                z: parseFloat(values[3])
            });
        }
        return data;
    }
    
    getStateAtTime(time) {
        if (this.data.length === 0) return null;
        
        const index = this.data.findIndex(point => point.time >= time);
        if (index === -1) return this.data[this.data.length - 1];
        if (index === 0) return this.data[0];
        
        if (!this.interpolationEnabled) return this.data[index];
        
        const prev = this.data[index - 1];
        const next = this.data[index];
        const factor = (time - prev.time) / (next.time - prev.time);
        
        return {
            time: time,
            x: THREE.MathUtils.lerp(prev.x, next.x, factor),
            y: THREE.MathUtils.lerp(prev.y, next.y, factor),
            z: THREE.MathUtils.lerp(prev.z, next.z, factor)
        };
    }
    
    getEndTime() {
        return this.data.length > 0 ? this.data[this.data.length - 1].time : 0;
    }
}