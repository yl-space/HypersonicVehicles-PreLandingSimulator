/**
 * MarsLatLonGrid - Latitude and longitude line overlay for Mars
 *
 * Renders grid lines according to the official IAU/NASA Mars coordinate system:
 *   - Planetocentric latitude  : -90° (south pole) to +90° (north pole)
 *   - East-positive longitude  :   0° to 360°  (IAU 2000 convention)
 *
 * Grid spacing:
 *   - Major lines every 10° (parallels & meridians)
 *   - The equator (lat 0°) and prime meridian (lon 0°) are highlighted
 *   - Latitude/longitude labels rendered as billboard sprites
 *
 * Reference: IAU Working Group on Cartographic Coordinates and Rotational
 *            Elements (Archinal et al., 2018) — planetocentric, east-positive.
 *
 * Visual design goals:
 *   - Subtle: low opacity, thin lines
 *   - Non-obstructive: depthWrite off so terrain markers always sit on top
 *   - Elegant: smooth circles, renderOrder keeps grid behind markers
 */

import * as THREE from 'three';

// ─── Visual constants ───────────────────────────────────────────────────────

const MAJOR_STEP_DEG  = 10;   // degrees between major parallels / meridians
const CIRCLE_SEGMENTS = 256;  // smoothness per circle / semicircle

// Base colors (hex integers)
const COLOR_MAJOR    = 0xffffff;  // standard grid lines
const COLOR_SPECIAL  = 0xffffff;  // equator + prime meridian (same hue, higher opacity)

// Opacities
const OPACITY_MAJOR   = 0.15;  // regular grid lines  (denser → dimmer)
const OPACITY_SPECIAL = 0.50;  // equator / prime meridian

// Elevate lines 0.3 % above the surface to avoid z-fighting with tiles
const SURFACE_OFFSET = 1.003;

// Label constants
const LABEL_OFFSET = 1.015;   // labels sit slightly above the grid lines

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
        this.labelRadius = this.marsRadius * LABEL_OFFSET;
        this.majorStep   = options.majorStep   ?? MAJOR_STEP_DEG;
        this._lineRefs   = [];   // { geometry, material } for disposal
        this._labelRefs  = [];   // sprite references for disposal

        this._buildGrid();
        this._buildLabels();

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
        for (const { texture, material } of this._labelRefs) {
            texture.dispose();
            material.dispose();
        }
        this._labelRefs = [];
    }

    // ── Grid construction ─────────────────────────────────────────────────

    _buildGrid() {
        // Latitude parallels: from -90° to +90° inclusive
        for (let lat = -90; lat <= 90; lat += this.majorStep) {
            const isEquator = lat === 0;
            const is30deg = !isEquator && (lat % 30 === 0);
            this._addParallel(lat, isEquator, is30deg);
        }

        // Longitude meridians: 0° to (360 - step)
        for (let lon = 0; lon < 360; lon += this.majorStep) {
            const isPrime = lon === 0 || lon === 180;
            const is30deg = !isPrime && (lon % 30 === 0);
            this._addMeridian(lon, isPrime, is30deg);
        }
    }

    /**
     * Add a latitude parallel (circle of constant latitude).
     * Uses the project's Y-up coordinate convention:
     *   x = r·cos(lat)·cos(lon),  y = r·sin(lat),  z = r·cos(lat)·sin(lon)
     */
    _addParallel(latDeg, isSpecial, is30deg = false) {
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

        this._addLine(pts, isSpecial, is30deg);
    }

    /**
     * Add a longitude meridian (half great-circle from south to north pole).
     * The full meridian is a single loop that covers lon and lon+180° to form
     * a complete great circle, but we only draw the half from -90° to +90°
     * for `lon`, and the other half appears as the meridian at (lon + 180°).
     */
    _addMeridian(lonDeg, isSpecial, is30deg = false) {
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

        this._addLine(pts, isSpecial, is30deg);
    }

    /**
     * Create a THREE.Line from a point array and add it to the group.
     * Lines are rendered with:
     *   - depthWrite: false  → won't occlude terrain markers
     *   - renderOrder: 1     → drawn after the planet surface but before markers
     *   - transparent / low opacity for subtlety
     */
    _addLine(points, isSpecial, is30deg = false) {
        const opacity = isSpecial ? OPACITY_SPECIAL
                      : is30deg  ? 0.25
                      :            OPACITY_MAJOR;

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color       : isSpecial ? COLOR_SPECIAL : COLOR_MAJOR,
            transparent : true,
            opacity,
            depthWrite  : false,
        });

        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1;

        this.group.add(line);
        this._lineRefs.push({ geometry, material });
    }

    // ── Label creation ──────────────────────────────────────────────────

    /**
     * Place latitude/longitude labels at every 30° using billboard sprites.
     * Labels are positioned at the intersection of 30° parallels with lon 0°
     * and 30° meridians along the equator.
     */
    _buildLabels() {
        // Latitude labels (every 30°, placed along lon = 5° so they don't overlap the prime meridian)
        const labelLon = THREE.MathUtils.degToRad(5);
        for (let lat = -60; lat <= 60; lat += 30) {
            if (lat === 0) continue; // equator is obvious
            const label = lat > 0 ? `${lat}°N` : `${Math.abs(lat)}°S`;
            const latRad = THREE.MathUtils.degToRad(lat);
            const rXZ = this.labelRadius * Math.cos(latRad);
            const y   = this.labelRadius * Math.sin(latRad);
            const pos = new THREE.Vector3(rXZ * Math.cos(labelLon), y, rXZ * Math.sin(labelLon));
            this._addLabel(label, pos);
        }

        // Longitude labels (every 30°, placed along lat = 2° above equator)
        const labelLat = THREE.MathUtils.degToRad(2);
        const rXZ = this.labelRadius * Math.cos(labelLat);
        const y   = this.labelRadius * Math.sin(labelLat);
        for (let lon = 0; lon < 360; lon += 30) {
            const lonRad = THREE.MathUtils.degToRad(lon);
            const label = `${lon}°`;
            const pos = new THREE.Vector3(rXZ * Math.cos(lonRad), y, rXZ * Math.sin(lonRad));
            this._addLabel(label, pos);
        }
    }

    /**
     * Create a small billboard sprite label.
     */
    _addLabel(text, position) {
        const canvas = document.createElement('canvas');
        canvas.width  = 128;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 22px Roboto, Arial, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 64, 20);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;

        const material = new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
            sizeAttenuation: true,
        });

        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.scale.set(2.5, 0.8, 1);  // proportional to Mars radius
        sprite.renderOrder = 2;

        this.group.add(sprite);
        this._labelRefs.push({ texture, material });
    }
}

export default MarsLatLonGrid;
