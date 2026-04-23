/**
 * CustomLandmarks.js
 *
 * Hand-curated Mars surface features — craters, valleys, mensae, and
 * other landmarks — focused on the MSL / Curiosity landing corridor
 * (equatorial band around Gale Crater, longitude ~120°–150° E).
 *
 * These supplement the dynamically-fetched USGS Planetary Nomenclature
 * features.  Coordinates use the IAU_MARS convention:
 *   • Latitude  — geodetic, +N
 *   • Longitude — +E, 0° … 360° (MarsTerrainMarkers normalises >180°)
 *
 * Sources:
 *   • IAU/USGS Gazetteer of Planetary Nomenclature
 *     https://planetarynames.wr.usgs.gov/
 *   • NASA MSL EDL reference documentation
 *
 * `type` matches FEATURE_TYPES in MarsFeatureService.js so the existing
 * icon/colour mapping picks these up without changes.
 */

export const CUSTOM_LANDMARKS = [
    // ── Gale Crater region (MSL landing area) ─────────────────────────
    {
        name: 'Gale Crater',
        lat: -5.4,
        lon: 137.8,
        diameter: 154,
        type: 'AA',
        description: 'MSL landing site — impact crater with central mountain (Aeolis Mons)',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Aeolis Mons (Mount Sharp)',
        lat: -5.08,
        lon: 137.85,
        diameter: 100,
        type: 'MO',
        description: 'Central peak of Gale Crater, ~5.5 km tall — Curiosity primary target',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Peace Vallis',
        lat: -4.46,
        lon: 137.35,
        diameter: 40,
        type: 'VA',
        description: 'Valley feeding into Gale Crater alluvial fan',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Farah Vallis',
        lat: -4.2,
        lon: 138.3,
        diameter: 35,
        type: 'VA',
        description: 'Valley NE of Gale Crater',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Robert Sharp Crater',
        lat: -5.3,
        lon: 132.9,
        diameter: 152,
        type: 'AA',
        description: 'Large impact crater immediately west of Gale',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Knobel Crater',
        lat: -6.5,
        lon: 133.0,
        diameter: 124,
        type: 'AA',
        description: 'Impact crater SW of Gale',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Henry Crater',
        lat: 10.7,
        lon: 123.3,
        diameter: 167,
        type: 'AA',
        description: 'Large impact crater in highlands north of MSL track',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Nicholson Crater',
        lat: 0.1,
        lon: 164.5,
        diameter: 100,
        type: 'AA',
        description: 'Impact crater east of Gale',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Herschel Crater',
        lat: -14.9,
        lon: 129.7,
        diameter: 304,
        type: 'AA',
        description: 'Large impact basin south of MSL approach',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Gusev Crater',
        lat: -14.6,
        lon: 175.5,
        diameter: 166,
        type: 'AA',
        description: 'MER-A Spirit landing site (2004)',
        source: 'Custom (MSL reference)',
    },

    // ── Terrain along MSL entry corridor ──────────────────────────────
    {
        name: 'Aeolis Planum',
        lat: -3.0,
        lon: 144.0,
        diameter: 800,
        type: 'PM',
        description: 'Plateau east of Gale, part of the MSL approach ground track',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Zephyria Planum',
        lat: -0.5,
        lon: 152.0,
        diameter: 600,
        type: 'PM',
        description: 'Volcanic plain along Mars equator east of Gale',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Aeolis Mensae',
        lat: -3.0,
        lon: 140.0,
        diameter: 450,
        type: 'ME',
        description: 'Mensa field in the MSL entry corridor',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Nepenthes Mensae',
        lat: 9.5,
        lon: 119.5,
        diameter: 450,
        type: 'ME',
        description: 'Mensa field north of MSL entry interface point',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'Elysium Planitia',
        lat: 3.0,
        lon: 154.7,
        diameter: 2400,
        type: 'PL',
        description: 'Large volcanic plain — InSight landing site',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'MSL Entry Interface',
        lat: -3.9222,
        lon: 126.7413,
        diameter: 50,
        type: 'LF',
        description: 'Curiosity atmospheric entry point (125 km altitude, t=0)',
        source: 'Custom (MSL reference)',
    },
    {
        name: 'MSL Parachute Deploy',
        lat: -4.59,
        lon: 137.32,
        diameter: 30,
        type: 'LF',
        description: 'Approximate parachute deployment location (~7 km altitude)',
        source: 'Custom (MSL reference)',
    },

    // ── A few notable Mars-wide landmarks for orientation ─────────────
    {
        name: 'Olympus Mons',
        lat: 18.65,
        lon: 226.2,
        diameter: 600,
        type: 'MO',
        description: 'Largest volcano in the solar system (21.9 km tall)',
        source: 'Custom (reference)',
    },
    {
        name: 'Valles Marineris',
        lat: -14.0,
        lon: 301.55,
        diameter: 4000,
        type: 'VA',
        description: 'Grand canyon system, >4000 km long',
        source: 'Custom (reference)',
    },
    {
        name: 'Hellas Planitia',
        lat: -42.4,
        lon: 70.5,
        diameter: 2300,
        type: 'PL',
        description: 'Largest visible impact crater on Mars',
        source: 'Custom (reference)',
    },
];
