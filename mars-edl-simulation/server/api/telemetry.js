const express = require('express');
const router = express.Router();

// Import database models
const { Telemetry, Mission } = require('../database/models');

/**
 * GET /api/telemetry
 * Get telemetry data with optional filtering
 */
router.get('/', async (req, res) => {
    try {
        const {
            missionId,
            limit = 100,
            offset = 0,
            startTime,
            endTime,
            phase
        } = req.query;
        
        const whereClause = {};
        
        if (missionId) {
            whereClause.missionId = missionId;
        }
        
        if (startTime && endTime) {
            whereClause.timestamp = {
                [require('sequelize').Op.between]: [new Date(startTime), new Date(endTime)]
            };
        }
        
        if (phase) {
            whereClause.phase = phase;
        }
        
        const telemetry = await Telemetry.findAll({
            where: whereClause,
            order: [['timestamp', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset),
            include: [{
                model: Mission,
                as: 'mission',
                attributes: ['id', 'name', 'planet']
            }]
        });
        
        res.json({
            success: true,
            data: telemetry,
            count: telemetry.length
        });
        
    } catch (error) {
        console.error('Error fetching telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch telemetry data'
        });
    }
});

/**
 * GET /api/telemetry/:id
 * Get specific telemetry record
 */
router.get('/:id', async (req, res) => {
    try {
        const telemetry = await Telemetry.findByPk(req.params.id, {
            include: [{
                model: Mission,
                as: 'mission',
                attributes: ['id', 'name', 'planet']
            }]
        });
        
        if (!telemetry) {
            return res.status(404).json({
                success: false,
                error: 'Telemetry record not found'
            });
        }
        
        res.json({
            success: true,
            data: telemetry
        });
        
    } catch (error) {
        console.error('Error fetching telemetry record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch telemetry record'
        });
    }
});

/**
 * POST /api/telemetry
 * Create new telemetry record
 */
router.post('/', async (req, res) => {
    try {
        const {
            missionId,
            position,
            velocity,
            altitude,
            temperature,
            fuel,
            battery,
            gForce,
            phase
        } = req.body;
        
        // Validate required fields
        if (!missionId || !position || !velocity || altitude === undefined) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: missionId, position, velocity, altitude'
            });
        }
        
        // Create telemetry record
        const telemetry = await Telemetry.create({
            missionId,
            position: JSON.stringify(position),
            velocity: JSON.stringify(velocity),
            altitude,
            temperature: temperature || 300,
            fuel: fuel || 100,
            battery: battery || 100,
            gForce: gForce || 0,
            phase: phase || 'unknown',
            timestamp: new Date()
        });
        
        res.status(201).json({
            success: true,
            data: telemetry
        });
        
    } catch (error) {
        console.error('Error creating telemetry record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create telemetry record'
        });
    }
});

/**
 * GET /api/telemetry/mission/:missionId
 * Get telemetry for specific mission
 */
router.get('/mission/:missionId', async (req, res) => {
    try {
        const { limit = 1000, offset = 0 } = req.query;
        
        const telemetry = await Telemetry.findAll({
            where: { missionId: req.params.missionId },
            order: [['timestamp', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: telemetry,
            count: telemetry.length
        });
        
    } catch (error) {
        console.error('Error fetching mission telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mission telemetry'
        });
    }
});

/**
 * GET /api/telemetry/mission/:missionId/latest
 * Get latest telemetry for specific mission
 */
router.get('/mission/:missionId/latest', async (req, res) => {
    try {
        const telemetry = await Telemetry.findOne({
            where: { missionId: req.params.missionId },
            order: [['timestamp', 'DESC']]
        });
        
        if (!telemetry) {
            return res.status(404).json({
                success: false,
                error: 'No telemetry data found for mission'
            });
        }
        
        res.json({
            success: true,
            data: telemetry
        });
        
    } catch (error) {
        console.error('Error fetching latest telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest telemetry'
        });
    }
});

/**
 * GET /api/telemetry/mission/:missionId/stats
 * Get telemetry statistics for mission
 */
router.get('/mission/:missionId/stats', async (req, res) => {
    try {
        const { Sequelize } = require('sequelize');
        
        const stats = await Telemetry.findAll({
            where: { missionId: req.params.missionId },
            attributes: [
                [Sequelize.fn('MIN', Sequelize.col('altitude')), 'minAltitude'],
                [Sequelize.fn('MAX', Sequelize.col('altitude')), 'maxAltitude'],
                [Sequelize.fn('MIN', Sequelize.col('temperature')), 'minTemperature'],
                [Sequelize.fn('MAX', Sequelize.col('temperature')), 'maxTemperature'],
                [Sequelize.fn('MIN', Sequelize.col('fuel')), 'minFuel'],
                [Sequelize.fn('MAX', Sequelize.col('fuel')), 'maxFuel'],
                [Sequelize.fn('MIN', Sequelize.col('battery')), 'minBattery'],
                [Sequelize.fn('MAX', Sequelize.col('battery')), 'maxBattery'],
                [Sequelize.fn('MIN', Sequelize.col('gForce')), 'minGForce'],
                [Sequelize.fn('MAX', Sequelize.col('gForce')), 'maxGForce'],
                [Sequelize.fn('COUNT', Sequelize.col('id')), 'totalRecords']
            ]
        });
        
        if (stats.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No telemetry data found for mission'
            });
        }
        
        res.json({
            success: true,
            data: stats[0]
        });
        
    } catch (error) {
        console.error('Error fetching telemetry stats:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch telemetry statistics'
        });
    }
});

/**
 * DELETE /api/telemetry/mission/:missionId
 * Delete all telemetry for a mission
 */
router.delete('/mission/:missionId', async (req, res) => {
    try {
        const deletedCount = await Telemetry.destroy({
            where: { missionId: req.params.missionId }
        });
        
        res.json({
            success: true,
            message: `Deleted ${deletedCount} telemetry records`,
            deletedCount
        });
        
    } catch (error) {
        console.error('Error deleting mission telemetry:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete mission telemetry'
        });
    }
});

module.exports = router;
