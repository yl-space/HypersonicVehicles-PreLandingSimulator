/**
 * FlightComputer.js
 *
 * Real-time flight instrument calculations.  All equations follow the
 * side-panel specification document (equations_sidepanel.pdf).
 *
 *   1.1  Altitude        h = (|r| − Rp) / 1000                 [km]
 *   1.2  Velocity        V = |V⃗|                              [m/s]
 *   1.3  g-load          gload = Faero / (m · gEarth)           [-]
 *          where Faero = √(L² + D²), L = qArefCL, D = qArefCD,
 *          q = ½ρV², CD = m/(Aref·β), CL = CD·L/D
 *   1.4  Mach number     M = V / a                              [-]
 *
 * Atmospheric ρ(h) and a(h) come from AtmosphericModel (mars-gram-avg).
 * Vehicle and planet parameters come from VEHICLE_PARAMS / PLANET_PARAMS
 * below, hard-coded until the backend exposes them via an API.
 */

// ── Planet parameters (Mars) ──────────────────────────────────────────
// Matches sim-server/src/sim_server/constants/planets.py PLANETS["mars"]
export const PLANET_PARAMS = {
    Rp: 3396e3,        // [m] radius of Mars
    gEarth: 9.80665,   // [m/s²] Earth surface gravity (for g-load normalisation)
};

// ── Spacecraft parameters (MSL / Dragon-like) ─────────────────────────
// Ref: Li & Jiang 2014, Dyakonov et al. 2012
export const VEHICLE_PARAMS = {
    m: 2920,            // [kg] mass
    Aref: 15.9043,      // [m²] reference area
    beta: 115,          // [kg/m²] ballistic coefficient
    LD: 0.24,           // [-]  lift-to-drag ratio
};

export class FlightComputer {
    /**
     * @param {AtmosphericModel} atm - loaded atmospheric model
     * @param {Object} [planetParams] - override PLANET_PARAMS
     * @param {Object} [vehicleParams] - override VEHICLE_PARAMS
     */
    constructor(atm, planetParams = PLANET_PARAMS, vehicleParams = VEHICLE_PARAMS) {
        this.atm = atm;
        this.planet = planetParams;
        this.vehicle = vehicleParams;
    }

    /**
     * Altitude above mean planet radius.  Accepts a Vector3-like {x,y,z}
     * in metres (backend convention).
     * @returns {number} altitude in kilometres
     */
    altitudeKm(posMeters) {
        if (!posMeters) return 0;
        const r = Math.sqrt(
            posMeters.x * posMeters.x +
            posMeters.y * posMeters.y +
            posMeters.z * posMeters.z
        );
        return (r - this.planet.Rp) / 1000;
    }

    /**
     * Scalar speed from a velocity Vector3 in m/s.
     * @returns {number} velocity magnitude [m/s]
     */
    speed(velMetersPerSec) {
        if (!velMetersPerSec) return 0;
        return Math.sqrt(
            velMetersPerSec.x * velMetersPerSec.x +
            velMetersPerSec.y * velMetersPerSec.y +
            velMetersPerSec.z * velMetersPerSec.z
        );
    }

    /**
     * Mach number = V / a(h) using linear-interpolated speed of sound.
     * @param {number} velocityMS - scalar velocity [m/s]
     * @param {number} altitudeM - altitude [m]
     * @returns {number} Mach (dimensionless)
     */
    mach(velocityMS, altitudeM) {
        const a = this.atm?.getSpeedOfSound(altitudeM);
        if (!a || a <= 0) return 0;
        return velocityMS / a;
    }

    /**
     * Aerodynamic g-load per PDF eq. 3a–3g.
     * gload = √(L² + D²) / (m · gEarth)
     *
     * @param {number} velocityMS - scalar velocity [m/s]
     * @param {number} altitudeM - altitude [m]
     * @returns {number} g-load (Earth g's)
     */
    gLoad(velocityMS, altitudeM) {
        const { m, Aref, beta, LD } = this.vehicle;
        const rho = this.atm?.getDensity(altitudeM) ?? 0;

        if (rho <= 0 || velocityMS <= 0) return 0;

        const CD = m / (Aref * beta);       // eq. 3a
        const CL = CD * LD;                  // eq. 3b
        const q  = 0.5 * rho * velocityMS * velocityMS; // eq. 3c
        const L  = q * Aref * CL;            // eq. 3d
        const D  = q * Aref * CD;            // eq. 3e
        const Faero = Math.sqrt(L * L + D * D); // eq. 3f
        return Faero / (m * this.planet.gEarth); // eq. 3g
    }

    /**
     * Compute all four side-panel instrument values from a single state.
     * @param {{x,y,z}} posMeters - position vector [m] (backend frame)
     * @param {{x,y,z}} velMetersPerSec - velocity vector [m/s]
     * @returns {{altitudeKm, velocityMS, mach, gLoad, altitudeM}}
     */
    computeAll(posMeters, velMetersPerSec) {
        const altKm = this.altitudeKm(posMeters);
        const altM  = altKm * 1000;
        const v     = this.speed(velMetersPerSec);
        return {
            altitudeKm: altKm,
            altitudeM:  altM,
            velocityMS: v,
            mach:       this.mach(v, altM),
            gLoad:      this.gLoad(v, altM),
        };
    }
}
