export class DataManager {
    constructor() {
        this.baseURL = '/api';
    }
    
    async loadMissionConfig(missionId) {
        try {
            const response = await fetch(`${this.baseURL}/missions/${missionId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.warn('Using default mission config');
            return this.getDefaultMissionConfig();
        }
    }
    
    async loadTrajectoryData(missionId) {
        try {
            const response = await fetch(`${this.baseURL}/trajectories/${missionId}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.warn('Using demo trajectory data');
            return this.generateDemoTrajectory();
        }
    }
    
    getDefaultMissionConfig() {
        return {
            name: 'Mars Science Laboratory',
            phases: [
                { name: 'Entry Interface', startTime: 0, altitude: 132000, description: 'Atmospheric entry begins at hypersonic speeds' },
                { name: 'Peak Heating', startTime: 80, altitude: 60000, description: 'Maximum thermal stress on heat shield' },
                { name: 'Peak Deceleration', startTime: 150, altitude: 25000, description: 'Maximum g-forces experienced' },
                { name: 'Parachute Deploy', startTime: 260.65, altitude: 13462.9, description: 'Supersonic parachute deployment' }
            ]
        };
    }
    
    generateDemoTrajectory() {
        const data = [];
        for (let t = 0; t <= 260.65; t += 0.5) {
            const progress = t / 260.65;
            const altitude = 132000 * (1 - progress);
            const angle = t * 0.01;
            
            data.push({
                time: t,
                x: -600000 - t * 2000 + Math.sin(angle) * 10000,
                y: 3000000 + Math.cos(angle) * 50000,
                z: 1600000 + altitude
            });
        }
        return data;
    }
}