/**
 * Telemetry API Routes
 */

import express from 'express';
const router = express.Router();

// In-memory storage for demo (use database in production)
let telemetryData = [];

// Get telemetry data
router.get('/', (req, res) => {
    const { mission, limit = 100, offset = 0 } = req.query;
    
    let data = telemetryData;
    if (mission) {
        data = data.filter(t => t.mission === mission);
    }
    
    const paginatedData = data.slice(offset, offset + parseInt(limit));
    
    res.json({
        data: paginatedData,
        total: data.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
    });
});

// Add telemetry record
router.post('/', (req, res) => {
    const telemetry = {
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
        ...req.body
    };
    
    telemetryData.push(telemetry);
    
    // Keep only last 10000 records
    if (telemetryData.length > 10000) {
        telemetryData = telemetryData.slice(-10000);
    }
    
    res.status(201).json(telemetry);
});

// Get latest telemetry for mission
router.get('/mission/:id/latest', (req, res) => {
    const { id } = req.params;
    const missionTelemetry = telemetryData
        .filter(t => t.mission === id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json(missionTelemetry[0] || null);
});

export default router;