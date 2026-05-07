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
        name: 'Mars Science Laboratory',
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
        // Five EDL phases keyed to the backend phases_calculation
        // (transitions t12, t23, t34, t45 from /high-fidelity/ response).
        // Names + descriptions are physics-driven and match the team's
        // current convention.  Times here are MSL nominal placeholders;
        // PhaseController.setPhaseTimestamps overrides them per-trajectory.
        phases: [
            {
                name: 'Gravity-dominated motion in a rarefied atmosphere',
                time: 0,
                altitude: 125,
                velocity: 5845,
                description: 'The vehicle enters the Martian atmosphere, where the upper atmosphere is still too rarefied to generate significant aerodynamic forces and heating.',
                nextPhase: 'Aerothermal build-up',
                nextPhaseTime: 26.1
            },
            {
                name: 'Aerothermal build-up',
                time: 26.1,
                altitude: 90,
                velocity: 5500,
                description: 'As atmospheric density increases, aerodynamic drag and heating rise rapidly, marking the onset of significant aerothermal effects.',
                nextPhase: 'Peak heating and aerodynamic load',
                nextPhaseTime: 53.7
            },
            {
                name: 'Peak heating and aerodynamic load',
                time: 53.7,
                altitude: 60,
                velocity: 4500,
                description: 'The vehicle encounters its most severe thermal environment and largest aerodynamic loads as velocity remains high in denser layers of the atmosphere.',
                nextPhase: 'Hypersonic glide control phase',
                nextPhaseTime: 84.0
            },
            {
                name: 'Hypersonic glide control phase',
                time: 84.0,
                altitude: 35,
                velocity: 2500,
                description: 'The vehicle uses bank-angle control during hypersonic flight to shape its trajectory, manage energy, and maximize parachute deployment altitude.',
                nextPhase: 'SUFR: “Straighten Up and Fly Right”',
                nextPhaseTime: 318.2
            },
            {
                name: 'SUFR: “Straighten Up and Fly Right”',
                time: 318.2,
                altitude: 11,
                velocity: 425,
                description: 'The vehicle ejects balance masses to achieve near-zero angle of attack and reorients for safe parachute deployment and onboard radar altimeter ground acquisition.',
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
        name: 'Mars 2020',
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