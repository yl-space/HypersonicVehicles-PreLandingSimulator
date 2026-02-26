/**
 * MarsLatLonGrid - Latitude and longitude line overlay for Mars
 *
 * Renders subtle grid lines according to the official IAU Mars coordinate system:
 *   - Planetocentric latitude  : -90° (south pole) to +90° (north pole)
 *   - East-positive longitude  :   0° to 360°  (modern IAU convention)
 *
 * Major parallels and meridians are drawn every 30°.
 * The equator (lat 0°) and prime meridian (lon 0°) receive a slightly
 * higher opacity to serve as clear reference lines.
 *
 * Visual design goals:
 *   - Subtle: low opacity, thin lines, no labels
 *   - Non-obstructive: depthWrite off so terrain markers always sit on top
 *   - Elegant: smooth circles, renderOrder keeps grid behind markers
 */

import * as THREE from 'three';

// ─── Visual constants ───────────────────────────────────────────────────────

const MAJOR_STEP_DEG  = 30;   // degrees between major parallels / meridians
const CIRCLE_SEGMENTS = 256;  // smoothness per circle / semicircle

// Base colors (hex integers)
const COLOR_MAJOR    = 0xffffff;  // standard grid lines
const COLOR_SPECIAL  = 0xffffff;  // equator + prime meridian (same hue, higher opacity)

// Opacities
const OPACITY_MAJOR   = 0.30;  // regular grid lines
const OPACITY_SPECIAL = 0.55;  // equator / prime meridian

// Elevate lines 0.3 % above the surface to avoid z-fighting with tiles
const SURFACE_OFFSET = 1.003;

// ────────────────────────────────────────────────────────────────────────────

export class MarsLatLonGrid {
    /**
     * @param {object} options
     * @param {number}  [options.marsRadius=33.9]  – Mars radius in scene units
     * @param {boolean} [options.visible=true]     – initial visibility
     * @param {number}  [options.majorStep=30]     – degrees between grid lines
     */
    constructor(options = {}) {
        this.group = new THREE.Group();
        this.group.name = 'MarsLatLonGrid';

        this.marsRadius  = options.marsRadius  ?? 33.9;
        this.gridRadius  = this.marsRadius * SURFACE_OFFSET;
        this.majorStep   = options.majorStep   ?? MAJOR_STEP_DEG;
        this._lineRefs   = [];   // { geometry, material } for disposal

        this._buildGrid();

        this.group.visible = options.visible ?? true;
    }

    // ── Public API ────────────────────────────────────────────────────────

    /** Show or hide the entire grid */
    setVisible(visible) {
        this.group.visible = visible;
    }

    /** Returns whether the grid is currently visible */
    isVisible() {
        return this.group.visible;
    }

    /** Returns the THREE.Object3D to add to the scene */
    getObject3D() {
        return this.group;
    }

    /** Free GPU resources */
    dispose() {
        for (const { geometry, material } of this._lineRefs) {
            geometry.dispose();
            material.dispose();
        }
        this._lineRefs = [];
    }

    // ── Grid construction ─────────────────────────────────────────────────

    _buildGrid() {
        // Latitude parallels: from -90° to +90° inclusive
        for (let lat = -90; lat <= 90; lat += this.majorStep) {
            this._addParallel(lat, lat === 0 /* equator */);
        }

        // Longitude meridians: 0° to 330° (0° and 180° are the special ones)
        for (let lon = 0; lon < 360; lon += this.majorStep) {
            this._addMeridian(lon, lon === 0 || lon === 180);
        }
    }

    /**
     * Add a latitude parallel (circle of constant latitude).
     * Uses the project's Y-up coordinate convention:
     *   x = r·cos(lat)·cos(lon),  y = r·sin(lat),  z = r·cos(lat)·sin(lon)
     */
    _addParallel(latDeg, isSpecial) {
        const latRad = THREE.MathUtils.degToRad(latDeg);
        const rXZ    = this.gridRadius * Math.cos(latRad);   // radius in the XZ plane
        const y      = this.gridRadius * Math.sin(latRad);   // fixed height

        // Skip degenerate circles at exact poles (rXZ ≈ 0)
        if (rXZ < this.gridRadius * 0.005) return;

        const pts = [];
        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            const θ = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            pts.push(new THREE.Vector3(rXZ * Math.cos(θ), y, rXZ * Math.sin(θ)));
        }

        this._addLine(pts, isSpecial);
    }

    /**
     * Add a longitude meridian (half great-circle from south to north pole).
     * The full meridian is a single loop that covers lon and lon+180° to form
     * a complete great circle, but we only draw the half from -90° to +90°
     * for `lon`, and the other half appears as the meridian at (lon + 180°).
     */
    _addMeridian(lonDeg, isSpecial) {
        const lonRad = THREE.MathUtils.degToRad(lonDeg);
        const pts    = [];

        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            // Map i to latitude from -90° to +90°
            const latRad = (i / CIRCLE_SEGMENTS) * Math.PI - Math.PI / 2;
            const rXZ    = this.gridRadius * Math.cos(latRad);
            const y      = this.gridRadius * Math.sin(latRad);
            pts.push(new THREE.Vector3(
                rXZ * Math.cos(lonRad),
                y,
                rXZ * Math.sin(lonRad)
            ));
        }

        this._addLine(pts, isSpecial);
    }

    /**
     * Create a THREE.Line from a point array and add it to the group.
     * Lines are rendered with:
     *   - depthWrite: false  → won't occlude terrain markers
     *   - renderOrder: 1     → drawn after the planet surface but before markers
     *   - transparent / low opacity for subtlety
     */
    _addLine(points, isSpecial) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color       : isSpecial ? COLOR_SPECIAL : COLOR_MAJOR,
            transparent : true,
            opacity     : isSpecial ? OPACITY_SPECIAL : OPACITY_MAJOR,
            depthWrite  : false,
        });

        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1;

        this.group.add(line);
        this._lineRefs.push({ geometry, material });
    }
}

export default MarsLatLonGrid;
