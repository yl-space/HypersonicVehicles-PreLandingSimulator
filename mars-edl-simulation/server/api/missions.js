const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Import database models
const { Mission, MissionEvent } = require('../database/models');

/**
 * GET /api/missions
 * Get all missions
 */
router.get('/', async (req, res) => {
    try {
        const missions = await Mission.findAll({
            order: [['createdAt', 'DESC']],
            include: [{
                model: MissionEvent,
                as: 'events',
                limit: 10,
                order: [['timestamp', 'DESC']]
            }]
        });
        
        res.json({
            success: true,
            data: missions,
            count: missions.length
        });
        
    } catch (error) {
        console.error('Error fetching missions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch missions'
        });
    }
});

/**
 * GET /api/missions/:id
 * Get mission by ID
 */
router.get('/:id', async (req, res) => {
    try {
        const mission = await Mission.findByPk(req.params.id, {
            include: [{
                model: MissionEvent,
                as: 'events',
                order: [['timestamp', 'DESC']]
            }]
        });
        
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        res.json({
            success: true,
            data: mission
        });
        
    } catch (error) {
        console.error('Error fetching mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mission'
        });
    }
});

/**
 * POST /api/missions
 * Create new mission
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            planet,
            vehicleType,
            targetLatitude,
            targetLongitude,
            entryVelocity,
            entryAngle,
            description
        } = req.body;
        
        // Validate required fields
        if (!name || !planet || !vehicleType) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: name, planet, vehicleType'
            });
        }
        
        // Create mission
        const mission = await Mission.create({
            id: uuidv4(),
            name,
            planet,
            vehicleType,
            targetLatitude: targetLatitude || 0,
            targetLongitude: targetLongitude || 0,
            entryVelocity: entryVelocity || 5000,
            entryAngle: entryAngle || 15,
            description: description || '',
            status: 'planned',
            startTime: null,
            endTime: null
        });
        
        // Log mission creation event
        await MissionEvent.create({
            missionId: mission.id,
            eventType: 'mission_created',
            description: `Mission "${name}" created for ${planet}`,
            phase: 'planning',
            timestamp: new Date()
        });
        
        res.status(201).json({
            success: true,
            data: mission
        });
        
    } catch (error) {
        console.error('Error creating mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create mission'
        });
    }
});

/**
 * PUT /api/missions/:id
 * Update mission
 */
router.put('/:id', async (req, res) => {
    try {
        const mission = await Mission.findByPk(req.params.id);
        
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        // Update mission
        const updatedMission = await mission.update(req.body);
        
        // Log mission update event
        await MissionEvent.create({
            missionId: mission.id,
            eventType: 'mission_updated',
            description: 'Mission parameters updated',
            phase: mission.status === 'active' ? 'active' : 'planning',
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            data: updatedMission
        });
        
    } catch (error) {
        console.error('Error updating mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update mission'
        });
    }
});

/**
 * DELETE /api/missions/:id
 * Delete mission
 */
router.delete('/:id', async (req, res) => {
    try {
        const mission = await Mission.findByPk(req.params.id);
        
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        // Check if mission is active
        if (mission.status === 'active') {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete active mission'
            });
        }
        
        // Delete mission and associated events
        await MissionEvent.destroy({
            where: { missionId: mission.id }
        });
        
        await mission.destroy();
        
        res.json({
            success: true,
            message: 'Mission deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete mission'
        });
    }
});

/**
 * POST /api/missions/:id/start
 * Start mission
 */
router.post('/:id/start', async (req, res) => {
    try {
        const mission = await Mission.findByPk(req.params.id);
        
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        if (mission.status !== 'planned') {
            return res.status(400).json({
                success: false,
                error: 'Mission can only be started if it is in planned status'
            });
        }
        
        // Update mission status
        await mission.update({
            status: 'active',
            startTime: new Date()
        });
        
        // Log mission start event
        await MissionEvent.create({
            missionId: mission.id,
            eventType: 'mission_started',
            description: `Mission "${mission.name}" started`,
            phase: 'cruise',
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            data: mission
        });
        
    } catch (error) {
        console.error('Error starting mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to start mission'
        });
    }
});

/**
 * POST /api/missions/:id/complete
 * Complete mission
 */
router.post('/:id/complete', async (req, res) => {
    try {
        const mission = await Mission.findByPk(req.params.id);
        
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        if (mission.status !== 'active') {
            return res.status(400).json({
                success: false,
                error: 'Mission can only be completed if it is active'
            });
        }
        
        const { success, reason } = req.body;
        
        // Update mission status
        await mission.update({
            status: success ? 'completed' : 'failed',
            endTime: new Date(),
            result: reason || (success ? 'Mission completed successfully' : 'Mission failed')
        });
        
        // Log mission completion event
        await MissionEvent.create({
            missionId: mission.id,
            eventType: success ? 'mission_completed' : 'mission_failed',
            description: success ? 'Mission completed successfully' : `Mission failed: ${reason}`,
            phase: 'landing',
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            data: mission
        });
        
    } catch (error) {
        console.error('Error completing mission:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to complete mission'
        });
    }
});

/**
 * GET /api/missions/:id/events
 * Get mission events
 */
router.get('/:id/events', async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        
        const events = await MissionEvent.findAll({
            where: { missionId: req.params.id },
            order: [['timestamp', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: events,
            count: events.length
        });
        
    } catch (error) {
        console.error('Error fetching mission events:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mission events'
        });
    }
});

/**
 * POST /api/missions/:id/events
 * Add mission event
 */
router.post('/:id/events', async (req, res) => {
    try {
        const { eventType, description, phase } = req.body;
        
        if (!eventType || !description) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: eventType, description'
            });
        }
        
        const event = await MissionEvent.create({
            missionId: req.params.id,
            eventType,
            description,
            phase: phase || 'unknown',
            timestamp: new Date()
        });
        
        res.status(201).json({
            success: true,
            data: event
        });
        
    } catch (error) {
        console.error('Error creating mission event:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create mission event'
        });
    }
});

/**
 * GET /api/missions/stats/summary
 * Get mission statistics
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const totalMissions = await Mission.count();
        const activeMissions = await Mission.count({ where: { status: 'active' } });
        const completedMissions = await Mission.count({ where: { status: 'completed' } });
        const failedMissions = await Mission.count({ where: { status: 'failed' } });
        
        const planetStats = await Mission.findAll({
            attributes: [
                'planet',
                [Mission.sequelize.fn('COUNT', Mission.sequelize.col('id')), 'count']
            ],
            group: ['planet']
        });
        
        res.json({
            success: true,
            data: {
                total: totalMissions,
                active: activeMissions,
                completed: completedMissions,
                failed: failedMissions,
                successRate: totalMissions > 0 ? (completedMissions / totalMissions * 100).toFixed(2) : 0,
                byPlanet: planetStats
            }
        });
        
    } catch (error) {
        console.error('Error fetching mission stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mission statistics'
        });
    }
});

module.exports = router;
