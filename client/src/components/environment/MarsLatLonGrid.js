/**
 * MarsLatLonGrid - Latitude and longitude line overlay for Mars
 *
 * Renders grid lines according to the official IAU/NASA Mars coordinate system:
 *   - Planetocentric latitude  : -90° (south pole) to +90° (north pole)
 *   - East-positive longitude  :   0° to 360°  (IAU 2000 convention)
 *
 * Grid spacing hierarchy (IAU/USGS Mars cartographic standards):
 *   - Minor lines every 5° (barely visible)
 *   - Standard lines every 10°
 *   - Regional lines every 30°
 *   - Mars Tropics at ±25.19° (axial tilt = 25.19°, Archinal et al. 2018)
 *   - Mars Arctic/Antarctic circles at ±64.81°
 *   - Equator (lat 0°) and prime meridian (lon 0°/180°) highlighted
 *   - Labels every 15° for lat/lon
 *
 * Reference: IAU Working Group on Cartographic Coordinates and Rotational
 *            Elements (Archinal et al., 2018) — planetocentric, east-positive.
 */

import * as THREE from 'three';

// ─── Visual constants ───────────────────────────────────────────────────────

const CIRCLE_SEGMENTS = 256;

// Mars obliquity (axial tilt) — IAU 2018
const MARS_OBLIQUITY_DEG = 25.19;
const MARS_ARCTIC_DEG    = 90 - MARS_OBLIQUITY_DEG; // 64.81°

// Opacities — visual hierarchy
const OPACITY_5DEG     = 0.06;  // minor grid (barely visible)
const OPACITY_10DEG    = 0.12;  // standard
const OPACITY_15DEG    = 0.15;  // intermediate
const OPACITY_30DEG    = 0.25;  // regional
const OPACITY_SPECIAL  = 0.50;  // equator / prime meridian
const OPACITY_MARS     = 0.30;  // tropics / arctic circles

const COLOR_GRID    = 0xffffff;
const COLOR_SPECIAL = 0xffffff;
const COLOR_MARS    = 0xffb464;  // warm amber for Mars-specific lines

// Elevate lines above the surface to avoid z-fighting with tiles
const SURFACE_OFFSET = 1.003;
const LABEL_OFFSET   = 1.015;

// ────────────────────────────────────────────────────────────────────────────

export class MarsLatLonGrid {
    /**
     * @param {object} options
     * @param {number}  [options.marsRadius=33.9]  – Mars radius in scene units
     * @param {boolean} [options.visible=true]     – initial visibility
     */
    constructor(options = {}) {
        this.group = new THREE.Group();
        this.group.name = 'MarsLatLonGrid';

        this.marsRadius  = options.marsRadius  ?? 33.9;
        this.gridRadius  = this.marsRadius * SURFACE_OFFSET;
        this.labelRadius = this.marsRadius * LABEL_OFFSET;
        this._lineRefs   = [];
        this._labelRefs  = [];

        this._buildGrid();
        // Labels disabled — grid lines alone provide reference without visual clutter
        // this._buildLabels();

        this.group.visible = options.visible ?? true;
    }

    // ── Public API ────────────────────────────────────────────────────────

    setVisible(visible) { this.group.visible = visible; }
    isVisible()         { return this.group.visible; }
    getObject3D()       { return this.group; }

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
        // Collect latitudes to draw: 5° grid + exact Mars tropic/arctic values
        const drawnLats = new Set();

        // Exact Mars tropic/arctic parallels first (take priority over nearest 5° line)
        const specialLats = [MARS_OBLIQUITY_DEG, -MARS_OBLIQUITY_DEG, MARS_ARCTIC_DEG, -MARS_ARCTIC_DEG];
        for (const lat of specialLats) {
            drawnLats.add(lat.toFixed(2));
            this._addParallel(lat, {
                isTropic: Math.abs(lat) < 30,
                isArctic: Math.abs(lat) > 60
            });
        }

        // Latitude parallels: every 5° from -90° to +90°
        for (let lat = -90; lat <= 90; lat += 5) {
            const absLat = Math.abs(lat);
            // Skip if this is within 1° of an already-drawn tropic/arctic line
            const tooCloseToSpecial = specialLats.some(s => Math.abs(absLat - Math.abs(s)) < 1.0);
            if (tooCloseToSpecial && lat !== 0) continue;

            const isEquator = lat === 0;
            const is30deg   = !isEquator && (lat % 30 === 0);
            const is15deg   = !isEquator && !is30deg && (lat % 15 === 0);
            const is10deg   = !isEquator && !is30deg && !is15deg && (lat % 10 === 0);

            this._addParallel(lat, { isEquator, is30deg, is15deg, is10deg });
        }

        // Longitude meridians: every 5° from 0° to 355°
        for (let lon = 0; lon < 360; lon += 5) {
            const isPrime = lon === 0 || lon === 180;
            const is30deg = !isPrime && (lon % 30 === 0);
            const is15deg = !isPrime && !is30deg && (lon % 15 === 0);
            const is10deg = !isPrime && !is30deg && !is15deg && (lon % 10 === 0);

            this._addMeridian(lon, { isPrime, is30deg, is15deg, is10deg });
        }
    }

    _addParallel(latDeg, flags = {}) {
        const latRad = THREE.MathUtils.degToRad(latDeg);
        const rXZ    = this.gridRadius * Math.cos(latRad);
        const y      = this.gridRadius * Math.sin(latRad);

        if (rXZ < this.gridRadius * 0.005) return; // skip degenerate poles

        const pts = [];
        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            const theta = (i / CIRCLE_SEGMENTS) * Math.PI * 2;
            pts.push(new THREE.Vector3(rXZ * Math.cos(theta), y, rXZ * Math.sin(theta)));
        }

        this._addLine(pts, this._resolveStyle(flags));
    }

    _addMeridian(lonDeg, flags = {}) {
        const lonRad = THREE.MathUtils.degToRad(lonDeg);
        const pts    = [];

        for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
            const latRad = (i / CIRCLE_SEGMENTS) * Math.PI - Math.PI / 2;
            const rXZ    = this.gridRadius * Math.cos(latRad);
            const y      = this.gridRadius * Math.sin(latRad);
            pts.push(new THREE.Vector3(rXZ * Math.cos(lonRad), y, rXZ * Math.sin(lonRad)));
        }

        this._addLine(pts, this._resolveStyle(flags));
    }

    /**
     * Determine opacity and color from classification flags.
     */
    _resolveStyle(flags) {
        if (flags.isEquator || flags.isPrime)  return { opacity: OPACITY_SPECIAL, color: COLOR_SPECIAL };
        if (flags.isTropic || flags.isArctic)  return { opacity: OPACITY_MARS,    color: COLOR_MARS };
        if (flags.is30deg)                     return { opacity: OPACITY_30DEG,   color: COLOR_GRID };
        if (flags.is15deg)                     return { opacity: OPACITY_15DEG,   color: COLOR_GRID };
        if (flags.is10deg)                     return { opacity: OPACITY_10DEG,   color: COLOR_GRID };
        // Default: 5° minor
        return { opacity: OPACITY_5DEG, color: COLOR_GRID };
    }

    _addLine(points, { opacity, color }) {
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({
            color,
            transparent: true,
            opacity,
            depthWrite: false,
        });

        const line = new THREE.Line(geometry, material);
        line.renderOrder = 1;
        this.group.add(line);
        this._lineRefs.push({ geometry, material });
    }

    // ── Label creation ──────────────────────────────────────────────────

    _buildLabels() {
        const labelLonRad = THREE.MathUtils.degToRad(5); // offset from prime meridian

        // Latitude labels every 15° (from -75° to +75°, skip equator)
        for (let lat = -75; lat <= 75; lat += 15) {
            if (lat === 0) continue;
            const label  = lat > 0 ? `${lat}\u00B0N` : `${Math.abs(lat)}\u00B0S`;
            const latRad = THREE.MathUtils.degToRad(lat);
            const rXZ    = this.labelRadius * Math.cos(latRad);
            const y      = this.labelRadius * Math.sin(latRad);
            const pos    = new THREE.Vector3(rXZ * Math.cos(labelLonRad), y, rXZ * Math.sin(labelLonRad));
            this._addLabel(label, pos);
        }

        // Mars tropic/arctic labels
        const specialLats = [
            { deg: MARS_OBLIQUITY_DEG,  label: 'Tropic +25.2\u00B0' },
            { deg: -MARS_OBLIQUITY_DEG, label: 'Tropic -25.2\u00B0' },
            { deg: MARS_ARCTIC_DEG,     label: 'Arctic +64.8\u00B0' },
            { deg: -MARS_ARCTIC_DEG,    label: 'Antarctic -64.8\u00B0' },
        ];
        const specialLonRad = THREE.MathUtils.degToRad(15); // offset further to avoid overlap
        for (const { deg, label } of specialLats) {
            const latRad = THREE.MathUtils.degToRad(deg);
            const rXZ    = this.labelRadius * Math.cos(latRad);
            const y      = this.labelRadius * Math.sin(latRad);
            const pos    = new THREE.Vector3(rXZ * Math.cos(specialLonRad), y, rXZ * Math.sin(specialLonRad));
            this._addLabel(label, pos, 'rgba(255,180,100,0.8)');
        }

        // Longitude labels every 15° (along lat = 2° above equator)
        const labelLatRad = THREE.MathUtils.degToRad(2);
        const rXZ = this.labelRadius * Math.cos(labelLatRad);
        const y   = this.labelRadius * Math.sin(labelLatRad);
        for (let lon = 0; lon < 360; lon += 15) {
            const lonRad = THREE.MathUtils.degToRad(lon);
            const label  = `${lon}\u00B0`;
            const pos    = new THREE.Vector3(rXZ * Math.cos(lonRad), y, rXZ * Math.sin(lonRad));
            this._addLabel(label, pos);
        }
    }

    _addLabel(text, position, fillColor = 'rgba(255,255,255,0.7)') {
        const canvas = document.createElement('canvas');
        canvas.width  = 160;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = 'bold 20px Roboto, Arial, sans-serif';
        ctx.fillStyle = fillColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 80, 20);

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
        sprite.scale.set(2.5, 0.7, 1);
        sprite.renderOrder = 2;

        this.group.add(sprite);
        this._labelRefs.push({ texture, material });
    }
}

export default MarsLatLonGrid;
