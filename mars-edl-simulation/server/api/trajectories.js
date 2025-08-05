/**
 * trajectories.js
 * API routes for trajectory data
 */

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';

const router = express.Router();

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Trajectory data directory
const dataDir = path.join(__dirname, '..', '..', 'client', 'assets', 'data');

/**
 * GET /api/trajectories
 * List available trajectory files
 */
router.get('/', async (req, res) => {
    try {
        const files = await fs.readdir(dataDir);
        const trajectoryFiles = files.filter(file => file.endsWith('.csv'));
        
        const trajectories = await Promise.all(
            trajectoryFiles.map(async (file) => {
                const stats = await fs.stat(path.join(dataDir, file));
                return {
                    filename: file,
                    size: stats.size,
                    modified: stats.mtime,
                    mission: extractMissionName(file)
                };
            })
        );
        
        res.json({
            count: trajectories.length,
            trajectories
        });
    } catch (error) {
        console.error('Error listing trajectories:', error);
        res.status(500).json({ error: 'Failed to list trajectories' });
    }
});

/**
 * GET /api/trajectories/:filename
 * Get specific trajectory data
 */
router.get('/:filename', async (req, res) => {
    const { filename } = req.params;
    const { format = 'json', limit, offset = 0 } = req.query;
    
    // Validate filename
    if (!filename.endsWith('.csv')) {
        return res.status(400).json({ error: 'Invalid file format' });
    }
    
    const filePath = path.join(dataDir, filename);
    
    try {
        // Check if file exists
        await fs.access(filePath);
        
        if (format === 'csv') {
            // Return raw CSV
            const csvData = await fs.readFile(filePath, 'utf-8');
            res.type('text/csv');
            res.send(csvData);
        } else {
            // Convert to JSON
            const jsonData = await csvtojson().fromFile(filePath);
            
            // Apply pagination if requested
            let result = jsonData;
            if (limit) {
                const start = parseInt(offset);
                const end = start + parseInt(limit);
                result = jsonData.slice(start, end);
            }
            
            res.json({
                filename,
                mission: extractMissionName(filename),
                totalPoints: jsonData.length,
                points: result,
                metadata: extractMetadata(jsonData)
            });
        }
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Trajectory file not found' });
        } else {
            console.error('Error reading trajectory:', error);
            res.status(500).json({ error: 'Failed to read trajectory data' });
        }
    }
});

/**
 * POST /api/trajectories/analyze
 * Analyze trajectory data
 */
router.post('/analyze', async (req, res) => {
    const { filename, startTime, endTime } = req.body;
    
    if (!filename) {
        return res.status(400).json({ error: 'Filename is required' });
    }
    
    const filePath = path.join(dataDir, filename);
    
    try {
        const jsonData = await csvtojson().fromFile(filePath);
        
        // Filter by time range if provided
        let filteredData = jsonData;
        if (startTime !== undefined || endTime !== undefined) {
            filteredData = jsonData.filter(point => {
                const time = parseFloat(point.Time || point.time);
                return (!startTime || time >= startTime) && 
                       (!endTime || time <= endTime);
            });
        }
        
        // Perform analysis
        const analysis = analyzeTrajectory(filteredData);
        
        res.json({
            filename,
            timeRange: {
                start: startTime || analysis.timeRange.min,
                end: endTime || analysis.timeRange.max
            },
            analysis
        });
    } catch (error) {
        console.error('Error analyzing trajectory:', error);
        res.status(500).json({ error: 'Failed to analyze trajectory' });
    }
});

/**
 * GET /api/trajectories/:filename/interpolate
 * Get interpolated position at specific time
 */
router.get('/:filename/interpolate', async (req, res) => {
    const { filename } = req.params;
    const { time } = req.query;
    
    if (!time) {
        return res.status(400).json({ error: 'Time parameter is required' });
    }
    
    const filePath = path.join(dataDir, filename);
    const targetTime = parseFloat(time);
    
    try {
        const jsonData = await csvtojson().fromFile(filePath);
        
        // Find surrounding points
        let before = null;
        let after = null;
        
        for (const point of jsonData) {
            const pointTime = parseFloat(point.Time || point.time);
            
            if (pointTime <= targetTime) {
                before = point;
            }
            if (pointTime >= targetTime && !after) {
                after = point;
                break;
            }
        }
        
        if (!before || !after) {
            return res.status(400).json({ 
                error: 'Time out of range',
                validRange: extractMetadata(jsonData).timeRange
            });
        }
        
        // Interpolate
        const interpolated = interpolatePoint(before, after, targetTime);
        
        res.json({
            time: targetTime,
            interpolated,
            before,
            after
        });
    } catch (error) {
        console.error('Error interpolating trajectory:', error);
        res.status(500).json({ error: 'Failed to interpolate trajectory' });
    }
});

// Helper functions

function extractMissionName(filename) {
    // Extract mission name from filename
    const match = filename.match(/^([A-Za-z0-9]+)_/);
    return match ? match[1].toUpperCase() : 'Unknown';
}

function extractMetadata(data) {
    if (!data || data.length === 0) {
        return null;
    }
    
    const times = data.map(p => parseFloat(p.Time || p.time || 0));
    const positions = data.map(p => ({
        x: parseFloat(p.x || 0),
        y: parseFloat(p.y || 0),
        z: parseFloat(p.z || 0)
    }));
    
    const altitudes = positions.map(p => 
        Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z)
    );
    
    return {
        pointCount: data.length,
        timeRange: {
            min: Math.min(...times),
            max: Math.max(...times)
        },
        altitudeRange: {
            min: Math.min(...altitudes),
            max: Math.max(...altitudes)
        },
        duration: Math.max(...times) - Math.min(...times)
    };
}

function analyzeTrajectory(data) {
    const metadata = extractMetadata(data);
    
    // Calculate velocities
    const velocities = [];
    for (let i = 1; i < data.length; i++) {
        const dt = parseFloat(data[i].Time) - parseFloat(data[i-1].Time);
        const dx = parseFloat(data[i].x) - parseFloat(data[i-1].x);
        const dy = parseFloat(data[i].y) - parseFloat(data[i-1].y);
        const dz = parseFloat(data[i].z) - parseFloat(data[i-1].z);
        
        const distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
        const velocity = distance / dt;
        velocities.push(velocity);
    }
    
    // Calculate accelerations
    const accelerations = [];
    for (let i = 1; i < velocities.length; i++) {
        const dt = parseFloat(data[i+1].Time) - parseFloat(data[i].Time);
        const dv = velocities[i] - velocities[i-1];
        accelerations.push(dv / dt);
    }
    
    return {
        ...metadata,
        velocity: {
            min: Math.min(...velocities),
            max: Math.max(...velocities),
            average: velocities.reduce((a, b) => a + b, 0) / velocities.length
        },
        acceleration: {
            min: Math.min(...accelerations),
            max: Math.max(...accelerations),
            average: accelerations.reduce((a, b) => a + b, 0) / accelerations.length
        }
    };
}

function interpolatePoint(before, after, targetTime) {
    const t1 = parseFloat(before.Time || before.time);
    const t2 = parseFloat(after.Time || after.time);
    const factor = (targetTime - t1) / (t2 - t1);
    
    return {
        x: lerp(parseFloat(before.x), parseFloat(after.x), factor),
        y: lerp(parseFloat(before.y), parseFloat(after.y), factor),
        z: lerp(parseFloat(before.z), parseFloat(after.z), factor),
        // Calculate derived values
        altitude: calculateAltitude(
            lerp(parseFloat(before.x), parseFloat(after.x), factor),
            lerp(parseFloat(before.y), parseFloat(after.y), factor),
            lerp(parseFloat(before.z), parseFloat(after.z), factor)
        )
    };
}

function lerp(a, b, t) {
    return a + (b - a) * t;
}

function calculateAltitude(x, y, z) {
    const MarsRadius = 3389500; // meters
    return Math.sqrt(x*x + y*y + z*z) - MarsRadius;
}

export default router;