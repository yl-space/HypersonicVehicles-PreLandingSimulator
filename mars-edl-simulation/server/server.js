/**
 * server.js
 * Express server for Mars EDL Simulation API
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs/promises';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist')));

// File upload configuration
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv') {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'));
        }
    }
});

// API Routes

// Get mission configuration
app.get('/api/missions/:missionId/config', async (req, res) => {
    try {
        const { missionId } = req.params;
        const configPath = path.join(__dirname, `data/missions/${missionId}.json`);
        
        const configData = await fs.readFile(configPath, 'utf8');
        res.json(JSON.parse(configData));
    } catch (error) {
        console.error('Error loading mission config:', error);
        res.status(404).json({ error: 'Mission configuration not found' });
    }
});

// Get trajectory data
app.get('/api/trajectories/:missionId', async (req, res) => {
    try {
        const { missionId } = req.params;
        const csvPath = path.join(__dirname, `data/trajectories/${missionId}_position_J2000.csv`);
        
        const csvData = await fs.readFile(csvPath, 'utf8');
        res.type('text/csv').send(csvData);
    } catch (error) {
        console.error('Error loading trajectory data:', error);
        res.status(404).json({ error: 'Trajectory data not found' });
    }
});

// Upload custom trajectory
app.post('/api/trajectories/upload', upload.single('trajectory'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        // Process and validate CSV
        const csvData = await fs.readFile(req.file.path, 'utf8');
        const lines = csvData.trim().split('\n');
        
        // Basic validation
        if (lines.length < 2) {
            throw new Error('CSV file is empty or invalid');
        }
        
        const headers = lines[0].split(',').map(h => h.trim());
        if (!headers.includes('Time') || !headers.includes('x') || 
            !headers.includes('y') || !headers.includes('z')) {
            throw new Error('CSV must contain Time, x, y, z columns');
        }
        
        // Save to custom trajectories
        const customId = `custom_${Date.now()}`;
        const customPath = path.join(__dirname, `data/trajectories/${customId}.csv`);
        await fs.writeFile(customPath, csvData);
        
        // Clean up upload
        await fs.unlink(req.file.path);
        
        res.json({ 
            success: true, 
            trajectoryId: customId,
            pointCount: lines.length - 1
        });
        
    } catch (error) {
        console.error('Error processing trajectory upload:', error);
        res.status(400).json({ error: error.message });
    }
});

// Get telemetry data for a specific time range
app.get('/api/telemetry/:missionId', async (req, res) => {
    try {
        const { missionId } = req.params;
        const { startTime = 0, endTime = 300, interval = 1 } = req.query;
        
        // This would typically query a database
        // For now, return sample data
        const telemetryData = [];
        for (let t = parseFloat(startTime); t <= parseFloat(endTime); t += parseFloat(interval)) {
            telemetryData.push({
                time: t,
                altitude: 132000 * Math.exp(-3.5 * Math.pow(t / 260.65, 1.8)),
                velocity: 5800 - (5800 - 430) * (t / 260.65),
                temperature: 300 + (t < 150 ? t * 10 : 1500 - (t - 150) * 5),
                gforce: t < 200 ? Math.sin(t / 50) * 8 : 0
            });
        }
        
        res.json(telemetryData);
    } catch (error) {
        console.error('Error loading telemetry data:', error);
        res.status(500).json({ error: 'Failed to load telemetry data' });
    }
});

// Export telemetry data
app.post('/api/telemetry/export', async (req, res) => {
    try {
        const { missionId, format = 'csv' } = req.body;
        
        // Generate export data
        const data = []; // Would fetch from database
        
        if (format === 'csv') {
            let csv = 'Time,Altitude,Velocity,Temperature,GForce\n';
            // Add data rows
            res.type('text/csv').send(csv);
        } else if (format === 'json') {
            res.json(data);
        } else {
            res.status(400).json({ error: 'Invalid export format' });
        }
    } catch (error) {
        console.error('Error exporting telemetry:', error);
        res.status(500).json({ error: 'Export failed' });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Serve React app for all other routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// Create required directories
async function ensureDirectories() {
    const dirs = [
        'uploads',
        'data/missions',
        'data/trajectories'
    ];
    
    for (const dir of dirs) {
        await fs.mkdir(path.join(__dirname, dir), { recursive: true });
    }
}

// Initialize demo data
async function initializeDemoData() {
    // Create MSL mission config
    const mslConfig = {
        name: "Mars Science Laboratory",
        vehicle: "msl_aeroshell",
        planet: "mars",
        launchDate: "2011-11-26",
        landingDate: "2012-08-06",
        entryInterface: {
            altitude: 132000,
            velocity: 5800,
            angle: -15.5,
            latitude: -4.6,
            longitude: 137.4
        },
        phases: [
            { 
                name: "Entry Interface", 
                startTime: 0, 
                altitude: 132000,
                description: "Atmospheric entry begins"
            },
            { 
                name: "Peak Heating", 
                startTime: 80, 
                altitude: 60000,
                description: "Maximum thermal stress on heat shield"
            },
            { 
                name: "Peak Deceleration", 
                startTime: 150, 
                altitude: 25000,
                description: "Maximum g-forces experienced"
            },
            { 
                name: "Parachute Deploy", 
                startTime: 260.65, 
                altitude: 13462.9,
                description: "Supersonic parachute deployment"
            }
        ],
        landingSite: {
            name: "Gale Crater",
            latitude: -5.4,
            longitude: 137.8,
            elevation: -4500
        },
        vehicle_specs: {
            mass: 3893,
            diameter: 4.5,
            heatShieldMaterial: "PICA",
            parachuteDiameter: 21.5
        }
    };
    
    const configPath = path.join(__dirname, 'data/missions/msl.json');
    await fs.writeFile(configPath, JSON.stringify(mslConfig, null, 2));
    
    // Create demo trajectory CSV if MSL data doesn't exist
    const trajectoryPath = path.join(__dirname, 'data/trajectories/msl_position_J2000.csv');
    try {
        await fs.access(trajectoryPath);
    } catch {
        // Generate demo trajectory
        let csv = 'Time,x,y,z\n';
        const marsRadius = 3389500;
        
        for (let t = 0; t <= 260.65; t += 0.5) {
            const progress = t / 260.65;
            const altitude = 132000 * Math.exp(-3.5 * Math.pow(progress, 1.8));
            const r = marsRadius + altitude;
            
            const angle = progress * 0.035;
            const lat = -0.27 + progress * 0.1;
            
            const x = r * Math.cos(lat) * Math.cos(angle);
            const y = r * Math.cos(lat) * Math.sin(angle);
            const z = r * Math.sin(lat);
            
            csv += `${t},${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}\n`;
        }
        
        await fs.writeFile(trajectoryPath, csv);
        console.log('Demo trajectory data created');
    }
}

// Start server
async function startServer() {
    try {
        await ensureDirectories();
        await initializeDemoData();
        
        app.listen(PORT, () => {
            console.log(`Server running on http://localhost:${PORT}`);
            console.log(`API available at http://localhost:${PORT}/api`);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

startServer();