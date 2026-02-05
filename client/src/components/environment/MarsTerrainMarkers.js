/**
 * MarsTerrainMarkers - 3D terrain feature markers for Mars visualization
 *
 * Renders named Mars features (craters, volcanoes, canyons, etc.) as 3D markers
 * on the planet surface. Uses billboard sprites that always face the camera
 * for optimal visibility at any angle.
 *
 * Features:
 * - Camera-facing billboard sprites with labels
 * - LOD-based visibility scaled for spacecraft view
 * - Only renders markers within camera frustum
 * - Category-based styling (different colors for craters vs volcanoes)
 */

import * as THREE from 'three';

// Mars feature categories and their visual styles
const FEATURE_STYLES = {
    'AA': { // Crater
        color: 0xFFAA00, // Orange
        emissive: 0x442200,
        label: 'Crater'
    },
    'MO': { // Mons (mountain/volcano)
        color: 0xFF3300, // Red-orange
        emissive: 0x661100,
        label: 'Mons'
    },
    'VA': { // Vallis (valley)
        color: 0x00AAFF, // Light blue
        emissive: 0x002244,
        label: 'Vallis'
    },
    'CH': { // Chasma (canyon)
        color: 0xFF0066, // Magenta
        emissive: 0x440022,
        label: 'Chasma'
    },
    'PL': { // Planitia (low plain)
        color: 0x44FF44, // Green
        emissive: 0x114411,
        label: 'Planitia'
    },
    'PM': { // Planum (high plain/plateau)
        color: 0x88FF88, // Light green
        emissive: 0x224422,
        label: 'Planum'
    },
    'TH': { // Tholus (small dome mountain)
        color: 0xFFCC00, // Gold
        emissive: 0x443300,
        label: 'Tholus'
    },
    'PA': { // Patera (shallow crater)
        color: 0xFF8800, // Dark orange
        emissive: 0x442200,
        label: 'Patera'
    },
    'LF': { // Landing site
        color: 0x00FF00, // Bright green
        emissive: 0x00AA00,
        label: 'Landing Site'
    },
    'TE': { // Terra
        color: 0xCCAA88, // Tan
        emissive: 0x332211,
        label: 'Terra'
    },
    'default': {
        color: 0xFFFFFF,
        emissive: 0x333333,
        label: 'Feature'
    }
};

// Mars landing sites with exact coordinates
const LANDING_SITES = [
    { name: 'Curiosity', lat: -4.5895, lon: 137.4417, year: 2012, mission: 'MSL', diameter: 154 },
    { name: 'Perseverance', lat: 18.4446, lon: 77.4509, year: 2021, mission: 'Mars 2020', diameter: 49 },
    { name: 'InSight', lat: 4.5024, lon: 135.6234, year: 2018, mission: 'InSight', diameter: 0 },
    { name: 'Viking 1', lat: 22.697, lon: -47.951, year: 1976, mission: 'Viking', diameter: 0 },
    { name: 'Viking 2', lat: 48.269, lon: 134.251, year: 1976, mission: 'Viking', diameter: 0 },
    { name: 'Pathfinder', lat: 19.13, lon: -33.22, year: 1997, mission: 'Pathfinder', diameter: 0 },
    { name: 'Spirit', lat: -14.5684, lon: 175.4726, year: 2004, mission: 'MER-A', diameter: 0 },
    { name: 'Opportunity', lat: -1.9462, lon: 354.4734, year: 2004, mission: 'MER-B', diameter: 0 },
    { name: 'Phoenix', lat: 68.2188, lon: -125.7492, year: 2008, mission: 'Phoenix', diameter: 0 },
    { name: 'Zhurong', lat: 25.066, lon: 109.925, year: 2021, mission: 'Tianwen-1', diameter: 0 }
];

// Major Mars features with accurate coordinates
const MARS_FEATURES = [
    // Major Volcanoes (Tharsis region)
    { name: 'Olympus Mons', lat: 18.65, lon: -133.8, diameter: 624, type: 'MO' },
    { name: 'Ascraeus Mons', lat: 11.92, lon: -104.5, diameter: 460, type: 'MO' },
    { name: 'Pavonis Mons', lat: 1.48, lon: -113.4, diameter: 375, type: 'MO' },
    { name: 'Arsia Mons', lat: -8.35, lon: -120.09, diameter: 475, type: 'MO' },
    { name: 'Alba Mons', lat: 40.5, lon: -109.6, diameter: 350, type: 'MO' },
    { name: 'Elysium Mons', lat: 25.02, lon: 147.21, diameter: 240, type: 'MO' },

    // Valles Marineris canyon system
    { name: 'Valles Marineris', lat: -14.0, lon: -59.2, diameter: 4000, type: 'CH' },
    { name: 'Coprates Chasma', lat: -13.5, lon: -61.0, diameter: 966, type: 'CH' },
    { name: 'Ius Chasma', lat: -7.0, lon: -85.0, diameter: 840, type: 'CH' },
    { name: 'Candor Chasma', lat: -6.5, lon: -71.0, diameter: 813, type: 'CH' },

    // Major Impact Basins / Plains
    { name: 'Hellas Planitia', lat: -42.7, lon: 70.0, diameter: 2300, type: 'PL' },
    { name: 'Argyre Planitia', lat: -49.7, lon: -316.0, diameter: 1800, type: 'PL' },
    { name: 'Isidis Planitia', lat: 12.9, lon: 87.0, diameter: 1500, type: 'PL' },
    { name: 'Utopia Planitia', lat: 49.7, lon: 118.0, diameter: 3300, type: 'PL' },
    { name: 'Acidalia Planitia', lat: 46.7, lon: -22.0, diameter: 0, type: 'PL' },
    { name: 'Chryse Planitia', lat: 28.4, lon: -40.0, diameter: 1600, type: 'PL' },

    // Major Craters - distributed across Mars
    { name: 'Gale Crater', lat: -5.4, lon: 137.8, diameter: 154, type: 'AA' },
    { name: 'Jezero Crater', lat: 18.38, lon: 77.58, diameter: 49, type: 'AA' },
    { name: 'Schiaparelli', lat: -2.77, lon: -16.75, diameter: 461, type: 'AA' },
    { name: 'Huygens', lat: -14.0, lon: -55.6, diameter: 467, type: 'AA' },
    { name: 'Newton', lat: -40.8, lon: -158.1, diameter: 287, type: 'AA' },
    // Southern hemisphere craters (near Argyre region)
    { name: 'Hooke', lat: -45.0, lon: 44.4, diameter: 138, type: 'AA' },
    { name: 'Galle', lat: -51.0, lon: -31.0, diameter: 230, type: 'AA' },
    { name: 'Lowell', lat: -52.0, lon: -81.0, diameter: 203, type: 'AA' },
    { name: 'Liais', lat: -49.5, lon: 47.0, diameter: 130, type: 'AA' },
    { name: 'Green', lat: -52.7, lon: 8.3, diameter: 184, type: 'AA' },
    { name: 'Maraldi', lat: -62.0, lon: 32.0, diameter: 120, type: 'AA' },
    { name: 'Barnard', lat: -61.5, lon: -61.5, diameter: 128, type: 'AA' },
    // Hellas region craters
    { name: 'Terby', lat: -28.0, lon: 74.0, diameter: 174, type: 'AA' },
    { name: 'Iazu', lat: -34.8, lon: 83.5, diameter: 100, type: 'AA' },

    // Highland Regions
    { name: 'Syrtis Major', lat: 8.4, lon: 69.5, diameter: 1500, type: 'PM' },
    { name: 'Tharsis', lat: 0.0, lon: -100.0, diameter: 5000, type: 'PM' },
    { name: 'Arabia Terra', lat: 20.0, lon: 5.0, diameter: 0, type: 'TE' },

    // Channels
    { name: 'Kasei Valles', lat: 24.6, lon: -65.0, diameter: 2400, type: 'VA' },
    { name: 'Ares Vallis', lat: 10.0, lon: -23.4, diameter: 1700, type: 'VA' }
];

export class MarsTerrainMarkers {
    constructor(options = {}) {
        this.group = new THREE.Group();
        this.group.name = 'MarsTerrainMarkers';

        // Mars radius in scene units (same as Mars.js)
        this.marsRadius = options.marsRadius || 33.9; // 3,390 km / 100

        // Scale factor: 1 scene unit = 100 km
        this.kmPerUnit = 100;

        // Feature data
        this.features = [];
        this.landingSites = LANDING_SITES;
        this.isLoaded = false;

        // Marker size settings (in scene units)
        // Subtle pin-point markers - much smaller than before
        this.baseMarkerSize = 0.05; // Small, subtle markers

        // Rendering
        this.markers = [];
        this.labelCanvas = null;
        this.labelTextures = new Map();

        // Visibility settings
        this.showLabels = true;
        this.maxVisibleDistance = this.marsRadius * 3; // Only show when viewing planet
        this.minVisibleDistance = 0.1; // Very close to surface

        // Callbacks
        this.onFeatureHover = options.onFeatureHover || null;
        this.onFeatureClick = options.onFeatureClick || null;

        // Initialize
        this.init();
    }

    init() {
        // Load features
        this.features = [...MARS_FEATURES];

        // Create markers for all features
        this.createAllMarkers();

        console.log(`[MarsTerrainMarkers] Created ${this.markers.length} terrain markers`);
    }

    /**
     * Create a label texture for a feature name
     */
    createLabelTexture(name, color) {
        const cacheKey = `${name}_${color}`;
        if (this.labelTextures.has(cacheKey)) {
            return this.labelTextures.get(cacheKey);
        }

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Smaller, more subtle text
        const fontSize = 24;
        ctx.font = `${fontSize}px Arial, sans-serif`;
        const metrics = ctx.measureText(name);
        const textWidth = metrics.width;

        canvas.width = Math.ceil(textWidth + 16);
        canvas.height = fontSize + 8;

        // Subtle semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.roundRect(0, 0, canvas.width, canvas.height, 4);
        ctx.fill();

        // Thin colored border
        ctx.strokeStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.lineWidth = 1;
        ctx.roundRect(1, 1, canvas.width - 2, canvas.height - 2, 3);
        ctx.stroke();

        // Text
        ctx.font = `${fontSize}px Arial, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(name, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        this.labelTextures.set(cacheKey, { texture, width: canvas.width, height: canvas.height });

        return { texture, width: canvas.width, height: canvas.height };
    }

    /**
     * Create all markers
     */
    createAllMarkers() {
        // Create feature markers
        this.features.forEach(feature => {
            this.createMarker(feature, feature.type);
        });

        // Create landing site markers
        this.landingSites.forEach(site => {
            this.createMarker({
                name: site.name,
                lat: site.lat,
                lon: site.lon,
                diameter: site.diameter || 50,
                mission: site.mission,
                year: site.year
            }, 'LF');
        });
    }

    /**
     * Create a single marker with label sprite
     */
    createMarker(feature, type) {
        const style = FEATURE_STYLES[type] || FEATURE_STYLES['default'];

        // Calculate position on Mars surface
        const position = this.latLonToPosition(feature.lat, feature.lon);

        // Create marker group
        const markerGroup = new THREE.Group();
        markerGroup.position.copy(position);

        // Calculate marker size - keep subtle and small
        const diameterKm = feature.diameter || 100;
        const sizeScale = Math.max(0.5, Math.min(1.2, Math.log10(diameterKm + 1) / 3));
        const markerSize = this.baseMarkerSize * sizeScale;

        // Create pin-point marker (small sphere with vertical line)
        const pinGeometry = new THREE.SphereGeometry(markerSize * 0.4, 8, 6);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: 0.85
        });
        const markerMesh = new THREE.Mesh(pinGeometry, markerMaterial);

        // Position pin slightly above surface
        const normal = position.clone().normalize();
        markerMesh.position.copy(normal.clone().multiplyScalar(markerSize * 0.3));

        markerGroup.add(markerMesh);

        // Add thin vertical line from surface to pin
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = new Float32Array([
            0, 0, 0,
            normal.x * markerSize * 0.3, normal.y * markerSize * 0.3, normal.z * markerSize * 0.3
        ]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: 0.6
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        markerGroup.add(line);

        // Create small label sprite
        const labelData = this.createLabelTexture(feature.name, style.color);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: labelData.texture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            sizeAttenuation: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        // Keep label small and subtle
        const spriteScale = markerSize * 1.5;
        const aspect = labelData.width / labelData.height;
        sprite.scale.set(spriteScale * aspect, spriteScale, 1);

        // Position label just above the pin
        const labelOffset = normal.clone().multiplyScalar(markerSize * 0.8);
        sprite.position.copy(labelOffset);

        markerGroup.add(sprite);

        // Store feature data
        markerGroup.userData = {
            type: type,
            name: feature.name,
            lat: feature.lat,
            lon: feature.lon,
            diameter: feature.diameter,
            mission: feature.mission,
            year: feature.year,
            style: style
        };

        this.markers.push({
            group: markerGroup,
            mesh: markerMesh,
            line: line,
            sprite: sprite,
            feature: feature,
            type: type,
            position: position.clone()
        });

        this.group.add(markerGroup);
    }

    /**
     * Convert latitude/longitude to 3D position on Mars surface
     * Uses Y as polar axis to match PlanetTileManager coordinate system
     */
    latLonToPosition(lat, lon) {
        const latRad = THREE.MathUtils.degToRad(lat);
        let lonNorm = lon;
        if (lonNorm > 180) lonNorm -= 360;
        const lonRad = THREE.MathUtils.degToRad(lonNorm);

        // Position slightly above surface
        const r = this.marsRadius * 1.002;

        // Y-up coordinate system (matches Three.js SphereGeometry and PlanetTileManager)
        // X = r * cos(lat) * cos(lon)
        // Y = r * sin(lat)  -- Y is the polar axis (north)
        // Z = r * cos(lat) * sin(lon)
        const x = r * Math.cos(latRad) * Math.cos(lonRad);
        const y = r * Math.sin(latRad);
        const z = r * Math.cos(latRad) * Math.sin(lonRad);

        return new THREE.Vector3(x, y, z);
    }

    /**
     * Update marker visibility based on camera position
     * Works in two modes:
     * 1. Planet view (far): Shows all visible markers on camera-facing hemisphere
     * 2. Spacecraft view (close): Shows nearby features as horizon indicators
     */
    update(camera) {
        if (!camera) return;

        const cameraPos = camera.position.clone();
        const cameraDistance = cameraPos.length();

        // Determine if we're in close (spacecraft) or far (planet) view
        const isCloseView = cameraDistance < this.marsRadius * 1.5;

        // Debug logging (every 300 frames - less frequent)
        if (!this._debugCounter) this._debugCounter = 0;
        const shouldLog = (++this._debugCounter % 300 === 0);

        if (shouldLog) {
            const visibleCount = this.markers.filter(m => m.group.visible).length;
            console.log(`[MarsTerrainMarkers] dist=${cameraDistance.toFixed(1)}, isClose=${isCloseView}, visible=${visibleCount}/${this.markers.length}`);
        }

        // Camera direction for visibility checks
        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        // Camera position on planet surface (for close view distance calculations)
        const cameraSurfacePoint = cameraPos.clone().normalize().multiplyScalar(this.marsRadius);

        // Update each marker
        this.markers.forEach(marker => {
            // Check if marker is on camera-facing side of planet
            const markerNormal = marker.position.clone().normalize();
            const toCamera = cameraPos.clone().sub(marker.position).normalize();
            const dotProduct = markerNormal.dot(toCamera);

            // Calculate distance from camera to marker
            const distanceToMarker = cameraPos.distanceTo(marker.position);

            // Calculate angular distance on planet surface (great circle)
            const cameraOnSurface = cameraPos.clone().normalize();
            const markerOnSurface = marker.position.clone().normalize();
            const angularDistance = Math.acos(Math.max(-1, Math.min(1, cameraOnSurface.dot(markerOnSurface))));
            const surfaceDistance = angularDistance * this.marsRadius; // in scene units

            let isVisible = false;
            let scale = 1.0;
            let opacity = 1.0;

            if (isCloseView) {
                // CLOSE VIEW (spacecraft descent mode)
                // Show markers that are:
                // 1. On the visible hemisphere (not behind planet)
                // 2. Within a reasonable surface distance
                // 3. Relevant features (craters, landing sites, mountains, or large features)

                const maxSurfaceDistance = this.marsRadius * 1.5; // ~5000 km - wide range for context
                const featureSize = marker.feature.diameter || 100;

                // Show all feature types that are relevant landmarks:
                // - LF: Landing sites
                // - MO: Mountains/volcanoes
                // - AA: Craters
                // - CH: Chasms/canyons
                // - PL: Planitia (low plains/basins)
                // - PM: Planum (high plains/plateaus)
                // - VA: Vallis (valleys)
                // - TE: Terra (highland regions)
                // - Any feature > 50km diameter
                const isRelevantFeature = marker.type === 'LF' ||
                                         marker.type === 'MO' ||
                                         marker.type === 'AA' ||
                                         marker.type === 'CH' ||
                                         marker.type === 'PL' ||
                                         marker.type === 'PM' ||
                                         marker.type === 'VA' ||
                                         marker.type === 'TE' ||
                                         featureSize > 50;

                // Check visibility
                isVisible = dotProduct > -0.4 && // On visible side (more permissive)
                           surfaceDistance < maxSurfaceDistance && // Within range
                           isRelevantFeature; // Relevant features

                if (isVisible) {
                    // Subtle, consistent scaling for pin-point markers
                    // Slight size variation based on feature importance, but keep small
                    const sizeFactor = Math.log10(featureSize + 10) / 4; // Range ~0.5-1.0
                    scale = 0.8 + sizeFactor * 0.4; // Range 0.8-1.2, very subtle

                    // Higher opacity for nearby features, fade distant ones
                    const distanceRatio = surfaceDistance / maxSurfaceDistance;
                    opacity = THREE.MathUtils.clamp(
                        1.0 - distanceRatio * 0.5,
                        0.4,
                        0.9
                    );
                }
            } else {
                // FAR VIEW (planet view mode)
                // Show markers on the visible hemisphere

                isVisible = dotProduct > -0.1 && // On visible side
                           distanceToMarker < cameraDistance * 2; // Not too far

                if (isVisible) {
                    // Subtle scaling - slightly larger when further away for visibility
                    scale = Math.max(0.8, Math.min(1.5, cameraDistance / (this.marsRadius * 2)));

                    // Fade based on angle from camera center
                    const angleToCameraCenter = Math.acos(Math.max(-1, Math.min(1, markerNormal.dot(cameraDir.clone().negate()))));
                    opacity = THREE.MathUtils.clamp(
                        1.0 - (angleToCameraCenter / Math.PI) * 0.5,
                        0.3,
                        0.85
                    );
                }
            }

            marker.group.visible = isVisible;

            if (isVisible) {
                marker.group.scale.setScalar(scale);
                marker.mesh.material.opacity = opacity;
                marker.sprite.material.opacity = opacity;
            }
        });
    }

    /**
     * Get the Object3D group for adding to scene
     */
    getObject3D() {
        return this.group;
    }

    /**
     * Get all features
     */
    getAllFeatures() {
        return [...this.features, ...this.landingSites.map(s => ({
            ...s,
            type: 'LF'
        }))];
    }

    /**
     * Search features by name
     */
    searchFeatures(query) {
        const lowerQuery = query.toLowerCase();
        return this.getAllFeatures().filter(f =>
            f.name.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Highlight a specific feature
     */
    highlightFeature(name) {
        this.markers.forEach(marker => {
            if (marker.feature.name === name) {
                marker.mesh.material.emissive = new THREE.Color(0xFFFF00);
                marker.group.scale.setScalar(2);
            }
        });
    }

    /**
     * Clear all highlights
     */
    clearHighlights() {
        this.markers.forEach(marker => {
            const style = FEATURE_STYLES[marker.type] || FEATURE_STYLES['default'];
            marker.mesh.material.emissive = new THREE.Color(style.emissive || 0x000000);
        });
    }

    /**
     * Get feature at raycaster intersection
     */
    getFeatureAtPosition(raycaster) {
        const intersects = raycaster.intersectObjects(
            this.markers.map(m => m.mesh),
            false
        );

        if (intersects.length > 0) {
            const hit = intersects[0].object;
            const marker = this.markers.find(m => m.mesh === hit);
            if (marker) {
                return marker.group.userData;
            }
        }

        return null;
    }

    /**
     * Dispose of resources
     */
    dispose() {
        this.markers.forEach(marker => {
            marker.mesh.geometry.dispose();
            marker.mesh.material.dispose();
            if (marker.line) {
                marker.line.geometry.dispose();
                marker.line.material.dispose();
            }
            marker.sprite.material.map?.dispose();
            marker.sprite.material.dispose();
        });

        this.labelTextures.forEach(data => {
            data.texture.dispose();
        });
        this.labelTextures.clear();

        this.markers = [];
    }
}

export default MarsTerrainMarkers;
