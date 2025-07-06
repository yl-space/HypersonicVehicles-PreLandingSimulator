/**
 * missions.js
 * API routes for mission configurations
 */

import express from 'express';
const router = express.Router();

// Mission database (in production, use a real database)
const missions = {
    msl: {
        id: 'msl',
        name: 'Jupiter Science Laboratory',
        vehicle: 'Curiosity Rover',
        launchDate: '2011-11-26',
        landingDate: '2012-08-06',
        landingSite: {
            name: 'Gale Crater',
            latitude: -4.5895,
            longitude: 137.4417
        },
        entryInterface: {
            altitude: 132, // km
            velocity: 19300, // km/h
            angle: -15.5 // degrees
        },
        phases: [
            {
                name: 'Entry Interface Point',
                time: 0,
                altitude: 132,
                velocity: 19300,
                description: 'The spacecraft enters the Martian atmosphere, drastically slowing it down while also heating it up.',
                nextPhase: 'Guidance Start',
                nextPhaseTime: 26
            },
            {
                name: 'Guidance Start',
                time: 26,
                altitude: 90,
                velocity: 19200,
                description: 'As it begins to descend through the atmosphere, the spacecraft encounters pockets of air that are more or less dense, which can nudge it off course. To compensate, it fires small thrusters on its backshell that adjust its angle and direction of lift.',
                nextPhase: 'Heading Alignment',
                nextPhaseTime: 87
            },
            {
                name: 'Heading Alignment',
                time: 87,
                altitude: 55,
                velocity: 8500,
                description: 'The guided entry algorithm corrects any remaining cross-range error.',
                nextPhase: 'Begin SUFR',
                nextPhaseTime: 174
            },
            {
                name: 'Begin SUFR',
                time: 174,
                altitude: 21,
                velocity: 1900,
                description: 'The spacecraft executes the "Straighten Up and Fly Right" maneuver, ejecting six more balance masses and setting the angle of attack to zero.',
                nextPhase: 'Parachute Deploy',
                nextPhaseTime: 240
            },
            {
                name: 'Parachute Deploy',
                time: 240,
                altitude: 13.463,
                velocity: 1450,
                description: 'The parachute is triggered by calculating the distance to the landing site, and opening at the optimum time to hit a smaller target area. This is called a "Range Trigger."',
                nextPhase: 'Heat Shield Separation',
                nextPhaseTime: 260
            },
            {
                name: 'Heat Shield Separation',
                time: 260,
                altitude: 10,
                velocity: 580,
                description: 'The heat shield separates to expose the rover and landing system.',
                nextPhase: 'Backshell Separation',
                nextPhaseTime: 280
            },
            {
                name: 'Backshell Separation',
                time: 280,
                altitude: 1.6,
                velocity: 290,
                description: 'The backshell and parachute separate, and the sky crane begins powered descent.',
                nextPhase: 'Sky Crane',
                nextPhaseTime: 340
            },
            {
                name: 'Sky Crane',
                time: 340,
                altitude: 0.02,
                velocity: 2.7,
                description: 'The sky crane lowers the rover on tethers to the surface.',
                nextPhase: null,
                nextPhaseTime: null
            }
        ],
        vehicleConfig: {
            mass: 899, // kg
            heatShieldDiameter: 4.5, // meters
            parachuteDiameter: 21.5, // meters
            entryAngle: -15.5, // degrees
            landingEllipse: {
                major: 25, // km
                minor: 20 // km
            }
        }
    },
    
    perseverance: {
        id: 'perseverance',
        name: 'Jupiter 2020',
        vehicle: 'Perseverance Rover',
        launchDate: '2020-07-30',
        landingDate: '2021-02-18',
        landingSite: {
            name: 'Jezero Crater',
            latitude: 18.38,
            longitude: 77.58
        },
        entryInterface: {
            altitude: 132,
            velocity: 19500,
            angle: -15.7
        },
        phases: [
            // Similar phases with updated values
            {
                name: 'Entry Interface Point',
                time: 0,
                altitude: 132,
                velocity: 19500,
                description: 'Perseverance enters the Martian atmosphere at hypersonic speed.',
                nextPhase: 'Guidance Start',
                nextPhaseTime: 24
            },
            // ... additional phases
        ],
        vehicleConfig: {
            mass: 1025,
            heatShieldDiameter: 4.5,
            parachuteDiameter: 21.5,
            entryAngle: -15.7,
            landingEllipse: {
                major: 7.7,
                minor: 6.6
            }
        }
    }
};

/**
 * GET /api/missions
 * List all available missions
 */
router.get('/', (req, res) => {
    const missionList = Object.values(missions).map(mission => ({
        id: mission.id,
        name: mission.name,
        vehicle: mission.vehicle,
        landingDate: mission.landingDate,
        landingSite: mission.landingSite.name
    }));
    
    res.json({
        count: missionList.length,
        missions: missionList
    });
});

/**
 * GET /api/missions/:id
 * Get specific mission configuration
 */
router.get('/:id', (req, res) => {
    const { id } = req.params;
    const mission = missions[id.toLowerCase()];
    
    if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
    }
    
    res.json(mission);
});

/**
 * GET /api/missions/:id/phases
 * Get mission phases
 */
router.get('/:id/phases', (req, res) => {
    const { id } = req.params;
    const mission = missions[id.toLowerCase()];
    
    if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
    }
    
    res.json({
        missionId: id,
        phases: mission.phases,
        totalDuration: mission.phases[mission.phases.length - 1].time
    });
});

/**
 * GET /api/missions/:id/phase/:phaseName
 * Get specific phase details
 */
router.get('/:id/phase/:phaseName', (req, res) => {
    const { id, phaseName } = req.params;
    const mission = missions[id.toLowerCase()];
    
    if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
    }
    
    const phase = mission.phases.find(p => 
        p.name.toLowerCase() === phaseName.toLowerCase().replace(/-/g, ' ')
    );
    
    if (!phase) {
        return res.status(404).json({ error: 'Phase not found' });
    }
    
    res.json({
        missionId: id,
        phase,
        phaseIndex: mission.phases.indexOf(phase),
        totalPhases: mission.phases.length
    });
});

/**
 * POST /api/missions
 * Create custom mission configuration
 */
router.post('/', (req, res) => {
    const { id, name, vehicle, phases, vehicleConfig } = req.body;
    
    // Validate required fields
    if (!id || !name || !phases || phases.length === 0) {
        return res.status(400).json({ 
            error: 'Missing required fields: id, name, phases' 
        });
    }
    
    // Create new mission
    const newMission = {
        id,
        name,
        vehicle: vehicle || 'Custom Vehicle',
        launchDate: new Date().toISOString().split('T')[0],
        landingDate: null,
        landingSite: {
            name: 'Custom Landing Site',
            latitude: 0,
            longitude: 0
        },
        phases,
        vehicleConfig: vehicleConfig || {
            mass: 1000,
            heatShieldDiameter: 4.5,
            parachuteDiameter: 20,
            entryAngle: -15
        }
    };
    
    // In production, save to database
    missions[id] = newMission;
    
    res.status(201).json({
        message: 'Mission created successfully',
        mission: newMission
    });
});

/**
 * PUT /api/missions/:id
 * Update mission configuration
 */
router.put('/:id', (req, res) => {
    const { id } = req.params;
    const mission = missions[id.toLowerCase()];
    
    if (!mission) {
        return res.status(404).json({ error: 'Mission not found' });
    }
    
    // Update mission fields
    Object.assign(mission, req.body);
    
    res.json({
        message: 'Mission updated successfully',
        mission
    });
});

/**
 * GET /api/missions/compare
 * Compare multiple missions
 */
router.get('/compare', (req, res) => {
    const { ids } = req.query;
    
    if (!ids) {
        return res.status(400).json({ error: 'Mission IDs required' });
    }
    
    const missionIds = ids.split(',');
    const comparison = missionIds.map(id => {
        const mission = missions[id.toLowerCase()];
        if (!mission) return null;
        
        return {
            id: mission.id,
            name: mission.name,
            vehicle: mission.vehicle,
            landingDate: mission.landingDate,
            entryVelocity: mission.entryInterface.velocity,
            landingEllipse: mission.vehicleConfig.landingEllipse,
            phaseDurations: mission.phases.map(p => ({
                name: p.name,
                duration: p.nextPhaseTime ? p.nextPhaseTime - p.time : 0
            }))
        };
    }).filter(Boolean);
    
    res.json({
        missions: comparison,
        count: comparison.length
    });
});

export default router;