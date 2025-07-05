/**
 * Missions API Routes
 */

import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const router = express.Router();

// Get all missions
router.get('/', async (req, res) => {
    try {
        const missionDir = path.join(__dirname, '../data/missions');
        const files = await fs.readdir(missionDir);
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        const missions = [];
        for (const file of jsonFiles) {
            const filePath = path.join(missionDir, file);
            const content = await fs.readFile(filePath, 'utf8');
            const mission = JSON.parse(content);
            missions.push({
                id: file.replace('.json', ''),
                name: mission.name,
                vehicle: mission.vehicle,
                planet: mission.planet,
                landingDate: mission.landingDate
            });
        }

        res.json(missions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get specific mission
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const filePath = path.join(__dirname, '../data/missions', `${id}.json`);
        
        const content = await fs.readFile(filePath, 'utf8');
        const mission = JSON.parse(content);
        
        res.json({ id, ...mission });
    } catch (error) {
        if (error.code === 'ENOENT') {
            res.status(404).json({ error: 'Mission not found' });
        } else {
            res.status(500).json({ error: error.message });
        }
    }
});

export default router;