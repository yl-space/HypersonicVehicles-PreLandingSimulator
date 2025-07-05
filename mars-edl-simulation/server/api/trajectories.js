/**
 * Trajectories API Routes
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Get all available trajectories
router.get('/', async (req, res) => {
    try {
        const trajectoryDir = path.join(__dirname, '../data/trajectories');
        const files = await fs.readdir(trajectoryDir);
        const csvFiles = files.filter(file => file.endsWith('.csv'));
        
        const trajectories = csvFiles.map(file => ({
            id: file.replace('.csv', ''),
            name: file.replace('.csv', '').replace(/_/g, ' ').toUpperCase(),
            filename: file
        }));

        res.json(trajectories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific trajectory data
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(__dirname, '../data/trajectories', `${id}.csv`);
        
        // Check if file exists
        await fs.access(filePath);
        
        // Parse CSV data
        const jsonData = await csvtojson().fromFile(filePath);
        
        // Convert string numbers to floats
        const processedData = jsonData.map(row => ({
            time: parseFloat(row.Time),
            x: parseFloat(row.x),
            y: parseFloat(row.y),
            z: parseFloat(row.z)
        }));

        res.json({
            id,
            data: processedData,
            metadata: {
                pointCount: processedData.length,
                duration: Math.max(...processedData.map(p => p.time)) - Math.min(...processedData.map(p => p.time)),
                startTime: Math.min(...processedData.map(p => p.time)),
                endTime: Math.max(...processedData.map(p => p.time))
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Trajectory not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Get trajectory metadata only
router.get('/:id/metadata', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(__dirname, '../data/trajectories', `${id}.csv`);
        
        await fs.access(filePath);
        const jsonData = await csvtojson().fromFile(filePath);
        
        const times = jsonData.map(row => parseFloat(row.Time));
        const positions = jsonData.map(row => ({
            x: parseFloat(row.x),
            y: parseFloat(row.y),
            z: parseFloat(row.z)
        }));

        res.json({
            id,
            pointCount: jsonData.length,
            duration: Math.max(...times) - Math.min(...times),
            startTime: Math.min(...times),
            endTime: Math.max(...times),
            bounds: {
                x: { min: Math.min(...positions.map(p => p.x)), max: Math.max(...positions.map(p => p.x)) },
                y: { min: Math.min(...positions.map(p => p.y)), max: Math.max(...positions.map(p => p.y)) },
                z: { min: Math.min(...positions.map(p => p.z)), max: Math.max(...positions.map(p => p.z)) }
            }
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Trajectory not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

// Get trajectory data within time range
router.get('/:id/range', async (req, res) => {
    try {
        const { id } = req.params;
        const { start = 0, end = Infinity } = req.query;
        const filePath = path.join(__dirname, '../data/trajectories', `${id}.csv`);
        
        await fs.access(filePath);
        const jsonData = await csvtojson().fromFile(filePath);
        
        const filteredData = jsonData
            .map(row => ({
                time: parseFloat(row.Time),
                x: parseFloat(row.x),
                y: parseFloat(row.y),
                z: parseFloat(row.z)
            }))
            .filter(point => point.time >= parseFloat(start) && point.time <= parseFloat(end));

        res.json({
            id,
            data: filteredData,
            range: { start: parseFloat(start), end: parseFloat(end) },
            pointCount: filteredData.length
        });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Trajectory not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

export default router;