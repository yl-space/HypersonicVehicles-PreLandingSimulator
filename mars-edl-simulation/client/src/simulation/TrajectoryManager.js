export class TrajectoryManager {
    constructor() {
        this.data = [];
        this.currentIndex = 0;
        this.interpolationEnabled = true;
    }
    
    async loadTrajectoryData(csvData) {
        if (typeof csvData === 'string') {
            this.data = this.parseCSV(csvData);
        } else {
            this.data = csvData;
        }
        
        console.log(`Loaded ${this.data.length} trajectory points`);
        return this.data;
    }
    
    parseCSV(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        const data = [];
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',');
            const point = {
                time: parseFloat(values[0]),
                x: parseFloat(values[1]),
                y: parseFloat(values[2]),
                z: parseFloat(values[3])
            };
            data.push(point);
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
            x: prev.x + (next.x - prev.x) * factor,
            y: prev.y + (next.y - prev.y) * factor,
            z: prev.z + (next.z - prev.z) * factor
        };
    }
    
    getDuration() {
        if (this.data.length === 0) return 0;
        return this.data[this.data.length - 1].time - this.data[0].time;
    }
    
    getStartTime() {
        return this.data.length > 0 ? this.data[0].time : 0;
    }
    
    getEndTime() {
        return this.data.length > 0 ? this.data[this.data.length - 1].time : 0;
    }
}