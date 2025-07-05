// server/api/trajectories.js
const express = require('express');
const router = express.Router();

// Import database models
const { Trajectory, Mission } = require('../database/models');

/**
 * GET /api/trajectories
 * Get trajectory data with optional filtering
 */
router.get('/', async (req, res) => {
    try {
        const {
            missionId,
            limit = 100,
            offset = 0,
            phase
        } = req.query;
        
        const whereClause = {};
        
        if (missionId) {
            whereClause.missionId = missionId;
        }
        
        if (phase) {
            whereClause.phase = phase;
        }
        
        const trajectories = await Trajectory.findAll({
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
            data: trajectories,
            count: trajectories.length
        });
        
    } catch (error) {
        console.error('Error fetching trajectories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trajectory data'
        });
    }
});

/**
 * GET /api/trajectories/:id
 * Get specific trajectory record
 */
router.get('/:id', async (req, res) => {
    try {
        const trajectory = await Trajectory.findByPk(req.params.id, {
            include: [{
                model: Mission,
                as: 'mission',
                attributes: ['id', 'name', 'planet']
            }]
        });
        
        if (!trajectory) {
            return res.status(404).json({
                success: false,
                error: 'Trajectory record not found'
            });
        }
        
        res.json({
            success: true,
            data: trajectory
        });
        
    } catch (error) {
        console.error('Error fetching trajectory record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trajectory record'
        });
    }
});

/**
 * POST /api/trajectories
 * Create new trajectory record
 */
router.post('/', async (req, res) => {
    try {
        const {
            missionId,
            trajectoryData,
            predictionData,
            phase
        } = req.body;
        
        // Validate required fields
        if (!missionId || !trajectoryData) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: missionId, trajectoryData'
            });
        }
        
        // Create trajectory record
        const trajectory = await Trajectory.create({
            missionId,
            trajectoryData: JSON.stringify(trajectoryData),
            predictionData: predictionData ? JSON.stringify(predictionData) : null,
            phase: phase || 'unknown',
            timestamp: new Date()
        });
        
        res.status(201).json({
            success: true,
            data: trajectory
        });
        
    } catch (error) {
        console.error('Error creating trajectory record:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create trajectory record'
        });
    }
});

/**
 * GET /api/trajectories/mission/:missionId
 * Get trajectories for specific mission
 */
router.get('/mission/:missionId', async (req, res) => {
    try {
        const { limit = 100, offset = 0 } = req.query;
        
        const trajectories = await Trajectory.findAll({
            where: { missionId: req.params.missionId },
            order: [['timestamp', 'ASC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });
        
        res.json({
            success: true,
            data: trajectories,
            count: trajectories.length
        });
        
    } catch (error) {
        console.error('Error fetching mission trajectories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch mission trajectories'
        });
    }
});

/**
 * GET /api/trajectories/mission/:missionId/latest
 * Get latest trajectory for specific mission
 */
router.get('/mission/:missionId/latest', async (req, res) => {
    try {
        const trajectory = await Trajectory.findOne({
            where: { missionId: req.params.missionId },
            order: [['timestamp', 'DESC']]
        });
        
        if (!trajectory) {
            return res.status(404).json({
                success: false,
                error: 'No trajectory data found for mission'
            });
        }
        
        res.json({
            success: true,
            data: trajectory
        });
        
    } catch (error) {
        console.error('Error fetching latest trajectory:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch latest trajectory'
        });
    }
});

/**
 * POST /api/trajectories/mission/:missionId/predict
 * Generate trajectory prediction for mission
 */
router.post('/mission/:missionId/predict', async (req, res) => {
    try {
        const { currentState, timeHorizon = 300 } = req.body;
        
        if (!currentState) {
            return res.status(400).json({
                success: false,
                error: 'Missing required field: currentState'
            });
        }
        
        // Get mission data
        const mission = await Mission.findByPk(req.params.missionId);
        if (!mission) {
            return res.status(404).json({
                success: false,
                error: 'Mission not found'
            });
        }
        
        // Generate trajectory prediction (simplified)
        const prediction = generateTrajectoryPrediction(currentState, mission, timeHorizon);
        
        // Store prediction
        const trajectory = await Trajectory.create({
            missionId: req.params.missionId,
            trajectoryData: JSON.stringify([currentState]),
            predictionData: JSON.stringify(prediction),
            phase: 'prediction',
            timestamp: new Date()
        });
        
        res.json({
            success: true,
            data: {
                trajectory,
                prediction
            }
        });
        
    } catch (error) {
        console.error('Error generating trajectory prediction:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to generate trajectory prediction'
        });
    }
});

/**
 * GET /api/trajectories/mission/:missionId/analysis
 * Get trajectory analysis for mission
 */
router.get('/mission/:missionId/analysis', async (req, res) => {
    try {
        const trajectories = await Trajectory.findAll({
            where: { missionId: req.params.missionId },
            order: [['timestamp', 'ASC']]
        });
        
        if (trajectories.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'No trajectory data found for mission'
            });
        }
        
        // Analyze trajectory data
        const analysis = analyzeTrajectories(trajectories);
        
        res.json({
            success: true,
            data: analysis
        });
        
    } catch (error) {
        console.error('Error analyzing trajectories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to analyze trajectories'
        });
    }
});

/**
 * DELETE /api/trajectories/mission/:missionId
 * Delete all trajectories for a mission
 */
router.delete('/mission/:missionId', async (req, res) => {
    try {
        const deletedCount = await Trajectory.destroy({
            where: { missionId: req.params.missionId }
        });
        
        res.json({
            success: true,
            message: `Deleted ${deletedCount} trajectory records`,
            deletedCount
        });
        
    } catch (error) {
        console.error('Error deleting mission trajectories:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete mission trajectories'
        });
    }
});

/**
 * Generate trajectory prediction
 */
function generateTrajectoryPrediction(currentState, mission, timeHorizon) {
    const prediction = [];
    const timeStep = 1; // 1 second steps
    
    // Clone current state
    let state = {
        position: { ...currentState.position },
        velocity: { ...currentState.velocity },
        altitude: currentState.altitude,
        mass: currentState.mass || 1000
    };
    
    // Simple physics simulation
    for (let time = 0; time < timeHorizon; time += timeStep) {
        // Calculate gravitational force
        const distance = Math.sqrt(
            state.position.x * state.position.x +
            state.position.y * state.position.y +
            state.position.z * state.position.z
        );
        
        // Planet-specific gravity (simplified)
        const planetGravity = getPlanetGravity(mission.planet);
        const gravityMagnitude = planetGravity * state.mass / (distance * distance);
        
        // Apply gravity
        const gravityDirection = {
            x: -state.position.x / distance,
            y: -state.position.y / distance,
            z: -state.position.z / distance
        };
        
        const acceleration = {
            x: gravityDirection.x * gravityMagnitude / state.mass,
            y: gravityDirection.y * gravityMagnitude / state.mass,
            z: gravityDirection.z * gravityMagnitude / state.mass
        };
        
        // Update velocity
        state.velocity.x += acceleration.x * timeStep;
        state.velocity.y += acceleration.y * timeStep;
        state.velocity.z += acceleration.z * timeStep;
        
        // Update position
        state.position.x += state.velocity.x * timeStep;
        state.position.y += state.velocity.y * timeStep;
        state.position.z += state.velocity.z * timeStep;
        
        // Update altitude
        state.altitude = distance - getPlanetRadius(mission.planet);
        
        // Store prediction point
        prediction.push({
            time: time,
            position: { ...state.position },
            velocity: { ...state.velocity },
            altitude: state.altitude
        });
        
        // Check for landing
        if (state.altitude <= 0) {
            break;
        }
    }
    
    return prediction;
}

/**
 * Analyze trajectory data
 */
function analyzeTrajectories(trajectories) {
    const analysis = {
        totalRecords: trajectories.length,
        phases: {},
        altitudeRange: { min: Infinity, max: -Infinity },
        velocityRange: { min: Infinity, max: -Infinity },
        timeRange: { start: null, end: null }
    };
    
    trajectories.forEach(trajectory => {
        const data = JSON.parse(trajectory.trajectoryData);
        
        // Phase analysis
        if (!analysis.phases[trajectory.phase]) {
            analysis.phases[trajectory.phase] = 0;
        }
        analysis.phases[trajectory.phase]++;
        
        // Time range
        if (!analysis.timeRange.start || trajectory.timestamp < analysis.timeRange.start) {
            analysis.timeRange.start = trajectory.timestamp;
        }
        if (!analysis.timeRange.end || trajectory.timestamp > analysis.timeRange.end) {
            analysis.timeRange.end = trajectory.timestamp;
        }
        
        // Analyze trajectory points
        data.forEach(point => {
            if (point.altitude !== undefined) {
                analysis.altitudeRange.min = Math.min(analysis.altitudeRange.min, point.altitude);
                analysis.altitudeRange.max = Math.max(analysis.altitudeRange.max, point.altitude);
            }
            
            if (point.velocity) {
                const velocity = Math.sqrt(
                    point.velocity.x * point.velocity.x +
                    point.velocity.y * point.velocity.y +
                    point.velocity.z * point.velocity.z
                );
                analysis.velocityRange.min = Math.min(analysis.velocityRange.min, velocity);
                analysis.velocityRange.max = Math.max(analysis.velocityRange.max, velocity);
            }
        });
    });
    
    return analysis;
}

/**
 * Get planet gravity (m/s²)
 */
function getPlanetGravity(planet) {
    const gravities = {
        mars: 3.71,
        venus: 8.87,
        titan: 1.352,
        earth: 9.81
    };
    return gravities[planet] || 9.81;
}

/**
 * Get planet radius (meters)
 */
function getPlanetRadius(planet) {
    const radii = {
        mars: 3389500,
        venus: 6051800,
        titan: 2575000,
        earth: 6371000
    };
    return radii[planet] || 6371000;
}

module.exports = router;