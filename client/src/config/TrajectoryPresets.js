/**
 * TrajectoryPresets.js
 *
 * Pre-configured initial conditions for entry trajectory scenarios.
 * Each preset is fed into the existing backend API
 * (TrajectoryService.calculateTrajectory({ init: preset.init })) — no new
 * backend code is needed; sim-server already accepts init parameter
 * overrides.
 *
 * All angles are in radians.  Coordinates use IAU_MARS body-fixed frame
 * (matches DEFAULT_INIT in sim-server/constants/defaults.py).
 *
 * References:
 *   - MSL nominal: SPICE-derived from Curiosity actual entry trajectory
 *     (Li & Jiang 2014; Way et al. 2013)
 *   - Skip entry: hypothetical aerocapture-style profile for MSL-class
 *     vehicle returning from interplanetary trajectory (uses shallower
 *     flight path angle to skip out of atmosphere once)
 *   - Steep entry: high-deceleration profile for low-mass / dense vehicles
 *     entering near vertical (e.g. capsule-only mission)
 */

const D2R = Math.PI / 180;

export const TRAJECTORY_PRESETS = {
    msl: {
        id: 'msl',
        label: 'MSL (Curiosity) — Real Data',
        description: 'Reference Mars Science Laboratory entry from Earth-Mars cruise — shallow ballistic entry with bank-angle guidance.',
        init: {
            coord_type: 'spherical',
            h0:    125964.3,        // [m]   Entry altitude — SPICE
            vel0:    5844.585,      // [m/s] Entry velocity — SPICE
            theta0:  126.7413 * D2R, // [rad] Longitude — IAU_MARS
            phi0:    -3.9222 * D2R,  // [rad] Latitude — IAU_MARS
            gamma0:  -16.1304 * D2R, // [rad] Flight-path angle (steeper = more negative)
            psi0:    -3.3454 * D2R,  // [rad] Heading angle
        },
        defaultBankAngle: 0,
        spec: {
            'Entry altitude': '125.96 km',
            'Entry velocity': '5,845 m/s',
            'Flight path angle': '-16.13°',
            'Heading': '-3.35°',
            'Lat / Lon (entry)': '-3.92° N / 126.74° E',
            'Profile': 'Shallow ballistic',
        },
    },

    msl_skip: {
        id: 'msl_skip',
        label: 'MSL — Skip Entry',
        description: 'Aerocapture-like skip profile: shallower flight path angle (-9°) causes the vehicle to dip into the atmosphere, decelerate partially, and skip back out before re-entering. Useful for energy management on high-velocity arrivals.',
        init: {
            coord_type: 'spherical',
            h0:    125000,
            vel0:    6500,           // higher velocity (interplanetary arrival)
            theta0:  126.7413 * D2R,
            phi0:    -3.9222 * D2R,
            gamma0:  -9.0 * D2R,     // shallow — the key parameter for skipping
            psi0:    -3.3454 * D2R,
        },
        defaultBankAngle: 0,
        spec: {
            'Entry altitude': '125.00 km',
            'Entry velocity': '6,500 m/s',
            'Flight path angle': '-9.00° (shallow)',
            'Heading': '-3.35°',
            'Lat / Lon (entry)': '-3.92° N / 126.74° E',
            'Profile': 'Skip / aerocapture',
        },
    },

    msl_steep: {
        id: 'msl_steep',
        label: 'MSL — Steep Entry',
        description: 'Steep ballistic entry (-22°) — short atmospheric flight, high peak deceleration (>15 g) and peak heat rate. Used for quick atmospheric transit when target is directly under the entry point.',
        init: {
            coord_type: 'spherical',
            h0:    125000,
            vel0:    5844.585,
            theta0:  126.7413 * D2R,
            phi0:    -3.9222 * D2R,
            gamma0:  -22.0 * D2R,    // steep
            psi0:    -3.3454 * D2R,
        },
        defaultBankAngle: 0,
        spec: {
            'Entry altitude': '125.00 km',
            'Entry velocity': '5,845 m/s',
            'Flight path angle': '-22.00° (steep)',
            'Heading': '-3.35°',
            'Lat / Lon (entry)': '-3.92° N / 126.74° E',
            'Profile': 'Steep ballistic',
        },
    },
};

/**
 * Get a preset by id.  Returns the MSL nominal as a safe default if id
 * is unknown.
 */
export function getTrajectoryPreset(id) {
    return TRAJECTORY_PRESETS[id] || TRAJECTORY_PRESETS.msl;
}

/**
 * List of preset entries suitable for populating a <select> dropdown.
 */
export function listTrajectoryPresets() {
    return Object.values(TRAJECTORY_PRESETS).map(p => ({
        value: p.id,
        label: p.label,
        description: p.description,
    }));
}
