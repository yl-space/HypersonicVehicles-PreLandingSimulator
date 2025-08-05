const express = require('express');
const path = require('path');
const fs = require('fs').promises;

const router = express.Router();

/**
 * Serve MSL trajectory data
 * GET /api/data/msl-trajectory
 */
router.get('/msl-trajectory', async (req, res) => {
    try {
        const dataPath = path.join(__dirname, '../database/data/MSL_position_J2000.csv');
        
        // Check if file exists
        try {
            await fs.access(dataPath);
        } catch (error) {
            return res.status(404).json({
                error: 'MSL trajectory data file not found',
                path: dataPath
            });
        }
        
        // Read and return CSV data
        const csvData = await fs.readFile(dataPath, 'utf8');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="MSL_position_J2000.csv"');
        res.send(csvData);
        
    } catch (error) {
        console.error('Error serving MSL trajectory data:', error);
        res.status(500).json({
            error: 'Failed to load trajectory data',
            message: error.message
        });
    }
});

/**
 * Get MSL trajectory metadata
 * GET /api/data/msl-trajectory/metadata
 */
router.get('/msl-trajectory/metadata', async (req, res) => {
    try {
        const dataPath = path.join(__dirname, '../database/data/MSL_position_J2000.csv');
        
        // Check if file exists
        try {
            await fs.access(dataPath);
        } catch (error) {
            return res.status(404).json({
                error: 'MSL trajectory data file not found'
            });
        }
        
        // Read file and parse metadata
        const csvData = await fs.readFile(dataPath, 'utf8');
        const lines = csvData.trim().split('\n');
        
        if (lines.length < 2) {
            return res.status(400).json({
                error: 'Invalid CSV file format'
            });
        }
        
        // Parse header
        const header = lines[0].split(',');
        
        // Parse first and last data points
        const firstDataPoint = lines[1].split(',').map(val => parseFloat(val.trim()));
        const lastDataPoint = lines[lines.length - 1].split(',').map(val => parseFloat(val.trim()));
        
        // Calculate statistics
        const timeRange = {
            start: firstDataPoint[0],
            end: lastDataPoint[0],
            duration: lastDataPoint[0] - firstDataPoint[0]
        };
        
        const positionRange = {
            x: { min: firstDataPoint[1], max: lastDataPoint[1] },
            y: { min: firstDataPoint[2], max: lastDataPoint[2] },
            z: { min: firstDataPoint[3], max: lastDataPoint[3] }
        };
        
        // Calculate altitude range (approximate)
        const MarsRadius = 3389500; // meters
        const startAltitude = Math.sqrt(
            firstDataPoint[1] * firstDataPoint[1] + 
            firstDataPoint[2] * firstDataPoint[2] + 
            firstDataPoint[3] * firstDataPoint[3]
        ) - MarsRadius;
        
        const endAltitude = Math.sqrt(
            lastDataPoint[1] * lastDataPoint[1] + 
            lastDataPoint[2] * lastDataPoint[2] + 
            lastDataPoint[3] * lastDataPoint[3]
        ) - MarsRadius;
        
        const metadata = {
            filename: 'MSL_position_J2000.csv',
            format: 'CSV',
            columns: header,
            dataPoints: lines.length - 1,
            timeRange,
            positionRange,
            altitudeRange: {
                start: startAltitude,
                end: endAltitude
            },
            coordinateSystem: 'J2000',
            mission: 'Mars Science Laboratory (JSL)',
            description: 'JSL trajectory data from Entry Interface to Parachute Deployment'
        };
        
        res.json(metadata);
        
    } catch (error) {
        console.error('Error getting MSL trajectory metadata:', error);
        res.status(500).json({
            error: 'Failed to get trajectory metadata',
            message: error.message
        });
    }
});

/**
 * Get MSL trajectory data points within time range
 * GET /api/data/msl-trajectory/range?start=0&end=100
 */
router.get('/msl-trajectory/range', async (req, res) => {
    try {
        const startTime = parseFloat(req.query.start) || 0;
        const endTime = parseFloat(req.query.end) || 260.65;
        const limit = parseInt(req.query.limit) || 1000;
        
        const dataPath = path.join(__dirname, '../database/data/MSL_position_J2000.csv');
        
        // Check if file exists
        try {
            await fs.access(dataPath);
        } catch (error) {
            return res.status(404).json({
                error: 'MSL trajectory data file not found'
            });
        }
        
        // Read file
        const csvData = await fs.readFile(dataPath, 'utf8');
        const lines = csvData.trim().split('\n');
        
        if (lines.length < 2) {
            return res.status(400).json({
                error: 'Invalid CSV file format'
            });
        }
        
        // Parse header
        const header = lines[0].split(',');
        
        // Filter data points within time range
        const filteredData = [];
        let count = 0;
        
        for (let i = 1; i < lines.length && count < limit; i++) {
            const values = lines[i].split(',').map(val => parseFloat(val.trim()));
            const time = values[0];
            
            if (time >= startTime && time <= endTime) {
                const dataPoint = {
                    time: values[0],
                    x: values[1],
                    y: values[2],
                    z: values[3]
                };
                filteredData.push(dataPoint);
                count++;
            }
        }
        
        res.json({
            header,
            data: filteredData,
            count: filteredData.length,
            timeRange: { start: startTime, end: endTime }
        });
        
    } catch (error) {
        console.error('Error getting MSL trajectory range:', error);
        res.status(500).json({
            error: 'Failed to get trajectory range',
            message: error.message
        });
    }
});

/**
 * Get MSL trajectory data at specific time
 * GET /api/data/msl-trajectory/at-time?time=100.5
 */
router.get('/msl-trajectory/at-time', async (req, res) => {
    try {
        const targetTime = parseFloat(req.query.time);
        
        if (isNaN(targetTime)) {
            return res.status(400).json({
                error: 'Invalid time parameter'
            });
        }
        
        const dataPath = path.join(__dirname, '../database/data/MSL_position_J2000.csv');
        
        // Check if file exists
        try {
            await fs.access(dataPath);
        } catch (error) {
            return res.status(404).json({
                error: 'MSL trajectory data file not found'
            });
        }
        
        // Read file
        const csvData = await fs.readFile(dataPath, 'utf8');
        const lines = csvData.trim().split('\n');
        
        if (lines.length < 2) {
            return res.status(400).json({
                error: 'Invalid CSV file format'
            });
        }
        
        // Find closest data point to target time
        let closestPoint = null;
        let minDifference = Infinity;
        
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(val => parseFloat(val.trim()));
            const time = values[0];
            const difference = Math.abs(time - targetTime);
            
            if (difference < minDifference) {
                minDifference = difference;
                closestPoint = {
                    time: values[0],
                    x: values[1],
                    y: values[2],
                    z: values[3]
                };
            }
        }
        
        if (!closestPoint) {
            return res.status(404).json({
                error: 'No data point found'
            });
        }
        
        res.json({
            targetTime,
            closestPoint,
            timeDifference: minDifference
        });
        
    } catch (error) {
        console.error('Error getting MSL trajectory at time:', error);
        res.status(500).json({
            error: 'Failed to get trajectory at time',
            message: error.message
        });
    }
});

module.exports = router; 