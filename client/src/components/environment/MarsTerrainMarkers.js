/**
 * MarsTerrainMarkers - 3D terrain feature markers for Mars visualization
 *
 * Renders named Mars features (craters, volcanoes, canyons, etc.) as 3D markers
 * on the planet surface. Uses billboard sprites that always face the camera.
 *
 * Features are loaded dynamically from MarsFeatureService which:
 * - Fetches from USGS Planetary Nomenclature database when available
 * - Uses localStorage caching for performance
 * - Falls back to curated local data when offline
 */

import * as THREE from 'three';
import { marsFeatureService } from '../../data/MarsFeatureService.js';

// Mars feature categories and their visual styles (matches USGS/IAU nomenclature)
const FEATURE_STYLES = {
    'AA': { color: 0xFFAA00, label: 'Crater' },
    'MO': { color: 0xFF3300, label: 'Mons' },
    'VA': { color: 0x00AAFF, label: 'Vallis' },
    'CH': { color: 0xFF0066, label: 'Chasma' },
    'PL': { color: 0x44FF44, label: 'Planitia' },
    'PM': { color: 0x88FF88, label: 'Planum' },
    'TH': { color: 0xFFCC00, label: 'Tholus' },
    'PA': { color: 0xFF8800, label: 'Patera' },
    'LF': { color: 0x00FF00, label: 'Landing Site' },
    'TE': { color: 0xCCAA88, label: 'Terra' },
    'FO': { color: 0x9966FF, label: 'Fossa' },
    'DO': { color: 0x66CCFF, label: 'Dorsum' },
    'LA': { color: 0xFF99CC, label: 'Labyrinthus' },
    'ME': { color: 0xFFCC99, label: 'Mensa' },
    'SC': { color: 0x99CCFF, label: 'Scopulus' },
    'CA': { color: 0xBB8844, label: 'Catena' },
    'CO': { color: 0xAACC77, label: 'Collis' },
    'FL': { color: 0x77AADD, label: 'Fluctus' },
    'RU': { color: 0xDD7799, label: 'Rupes' },
    'SU': { color: 0x99DD99, label: 'Sulcus' },
    'UN': { color: 0xDDCC66, label: 'Undae' },
    'VS': { color: 0xBBAA99, label: 'Vastitas' },
    'default': { color: 0xFFFFFF, label: 'Feature' }
};

// All trackable feature types (from USGS/IAU nomenclature)
const TRACKED_TYPES = ['LF', 'MO', 'AA', 'CH', 'PL', 'PM', 'VA', 'TE', 'TH', 'PA', 'FO', 'DO', 'LA', 'ME', 'SC', 'CA', 'CO', 'FL', 'RU', 'SU', 'UN', 'VS'];

export class MarsTerrainMarkers {
    constructor(options = {}) {
        this.group = new THREE.Group();
        this.group.name = 'MarsTerrainMarkers';

        // Mars radius in scene units
        this.marsRadius = options.marsRadius || 33.9;

        // Marker settings - subtle pin-point style
        this.baseMarkerSize = 0.05;

        // State
        this.markers = [];
        this.labelTextures = new Map();
        this.isLoaded = false;

        // Visibility settings
        this.maxSurfaceDistance = this.marsRadius * 1.5;
        this.minFeatureSize = 50; // km

        // Callbacks
        this.onFeatureHover = options.onFeatureHover || null;
        this.onFeatureClick = options.onFeatureClick || null;

        // Initialize asynchronously
        this.init();
    }

    async init() {
        try {
            // Load features from service (API with local fallback)
            const data = await marsFeatureService.loadFeatures();

            // Create markers for all features
            this.createMarkersFromData(data.all);
            this.isLoaded = true;

            console.log(`[MarsTerrainMarkers] Created ${this.markers.length} terrain markers`);
        } catch (error) {
            console.error('[MarsTerrainMarkers] Failed to load features:', error);
        }
    }

    /**
     * Create markers from feature data array
     */
    createMarkersFromData(features) {
        for (const feature of features) {
            this.createMarker(feature);
        }
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

        const fontSize = 24;
        ctx.font = `${fontSize}px Arial, sans-serif`;
        const textWidth = ctx.measureText(name).width;

        canvas.width = Math.ceil(textWidth + 16);
        canvas.height = fontSize + 8;

        // Semi-transparent background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.roundRect(0, 0, canvas.width, canvas.height, 4);
        ctx.fill();

        // Colored border
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
     * Create a single marker
     */
    createMarker(feature) {
        const style = FEATURE_STYLES[feature.type] || FEATURE_STYLES['default'];
        const position = this.latLonToPosition(feature.lat, feature.lon);

        const markerGroup = new THREE.Group();
        markerGroup.position.copy(position);

        // Size based on feature diameter
        const diameterKm = feature.diameter || 100;
        const sizeScale = Math.max(0.5, Math.min(1.2, Math.log10(diameterKm + 1) / 3));
        const markerSize = this.baseMarkerSize * sizeScale;

        // Pin-point marker (small sphere)
        const pinGeometry = new THREE.SphereGeometry(markerSize * 0.4, 8, 6);
        const markerMaterial = new THREE.MeshBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: 0.85
        });
        const markerMesh = new THREE.Mesh(pinGeometry, markerMaterial);

        const normal = position.clone().normalize();
        markerMesh.position.copy(normal.clone().multiplyScalar(markerSize * 0.3));
        markerGroup.add(markerMesh);

        // Vertical line from surface to pin
        const lineGeometry = new THREE.BufferGeometry();
        const linePositions = new Float32Array([
            0, 0, 0,
            normal.x * markerSize * 0.3,
            normal.y * markerSize * 0.3,
            normal.z * markerSize * 0.3
        ]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
        const lineMaterial = new THREE.LineBasicMaterial({
            color: style.color,
            transparent: true,
            opacity: 0.6
        });
        const line = new THREE.Line(lineGeometry, lineMaterial);
        markerGroup.add(line);

        // Label sprite
        const labelData = this.createLabelTexture(feature.name, style.color);
        const spriteMaterial = new THREE.SpriteMaterial({
            map: labelData.texture,
            transparent: true,
            depthTest: true,
            depthWrite: false,
            sizeAttenuation: true
        });
        const sprite = new THREE.Sprite(spriteMaterial);

        const spriteScale = markerSize * 1.5;
        const aspect = labelData.width / labelData.height;
        sprite.scale.set(spriteScale * aspect, spriteScale, 1);

        const labelOffset = normal.clone().multiplyScalar(markerSize * 0.8);
        sprite.position.copy(labelOffset);
        markerGroup.add(sprite);

        // Store feature data
        markerGroup.userData = { ...feature, style };

        this.markers.push({
            group: markerGroup,
            mesh: markerMesh,
            line: line,
            sprite: sprite,
            feature: feature,
            type: feature.type,
            position: position.clone()
        });

        this.group.add(markerGroup);
    }

    /**
     * Convert latitude/longitude to 3D position on Mars surface
     */
    latLonToPosition(lat, lon) {
        const latRad = THREE.MathUtils.degToRad(lat);
        let lonNorm = lon > 180 ? lon - 360 : lon;
        const lonRad = THREE.MathUtils.degToRad(lonNorm);

        const r = this.marsRadius * 1.002;

        // Y-up coordinate system (Three.js convention)
        const x = r * Math.cos(latRad) * Math.cos(lonRad);
        const y = r * Math.sin(latRad);
        const z = r * Math.cos(latRad) * Math.sin(lonRad);

        return new THREE.Vector3(x, y, z);
    }

    /**
     * Update marker visibility based on camera position
     */
    update(camera) {
        if (!camera || this.markers.length === 0) return;

        const cameraPos = camera.position.clone();
        const cameraDistance = cameraPos.length();
        const isCloseView = cameraDistance < this.marsRadius * 1.5;

        const cameraDir = new THREE.Vector3();
        camera.getWorldDirection(cameraDir);

        this.markers.forEach(marker => {
            const markerNormal = marker.position.clone().normalize();
            const toCamera = cameraPos.clone().sub(marker.position).normalize();
            const dotProduct = markerNormal.dot(toCamera);

            const distanceToMarker = cameraPos.distanceTo(marker.position);
            const cameraOnSurface = cameraPos.clone().normalize();
            const markerOnSurface = marker.position.clone().normalize();
            const angularDistance = Math.acos(Math.max(-1, Math.min(1, cameraOnSurface.dot(markerOnSurface))));
            const surfaceDistance = angularDistance * this.marsRadius;

            let isVisible = false;
            let scale = 1.0;
            let opacity = 1.0;

            if (isCloseView) {
                const featureSize = marker.feature.diameter || 100;
                const isRelevantFeature = TRACKED_TYPES.includes(marker.type) || featureSize > this.minFeatureSize;

                isVisible = dotProduct > -0.4 &&
                           surfaceDistance < this.maxSurfaceDistance &&
                           isRelevantFeature;

                if (isVisible) {
                    const sizeFactor = Math.log10(featureSize + 10) / 4;
                    scale = 0.8 + sizeFactor * 0.4;

                    const distanceRatio = surfaceDistance / this.maxSurfaceDistance;
                    opacity = THREE.MathUtils.clamp(1.0 - distanceRatio * 0.5, 0.4, 0.9);
                }
            } else {
                isVisible = dotProduct > -0.1 && distanceToMarker < cameraDistance * 2;

                if (isVisible) {
                    scale = Math.max(0.8, Math.min(1.5, cameraDistance / (this.marsRadius * 2)));

                    const angleToCameraCenter = Math.acos(Math.max(-1, Math.min(1, markerNormal.dot(cameraDir.clone().negate()))));
                    opacity = THREE.MathUtils.clamp(1.0 - (angleToCameraCenter / Math.PI) * 0.5, 0.3, 0.85);
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

    getObject3D() {
        return this.group;
    }

    getAllFeatures() {
        return this.markers.map(m => m.feature);
    }

    searchFeatures(query) {
        return marsFeatureService.searchFeatures(query);
    }

    getFeaturesNear(lat, lon, maxDistanceKm = 1000) {
        return marsFeatureService.getFeaturesNear(lat, lon, maxDistanceKm);
    }

    highlightFeature(name) {
        this.markers.forEach(marker => {
            if (marker.feature.name === name) {
                marker.mesh.material.emissive = new THREE.Color(0xFFFF00);
                marker.group.scale.setScalar(2);
            }
        });
    }

    clearHighlights() {
        this.markers.forEach(marker => {
            marker.mesh.material.emissive = new THREE.Color(0x000000);
        });
    }

    getFeatureAtPosition(raycaster) {
        const intersects = raycaster.intersectObjects(this.markers.map(m => m.mesh), false);
        if (intersects.length > 0) {
            const marker = this.markers.find(m => m.mesh === intersects[0].object);
            return marker ? marker.group.userData : null;
        }
        return null;
    }

    /**
     * Refresh features from API
     */
    async refreshFeatures() {
        // Clear existing markers
        this.markers.forEach(marker => {
            this.group.remove(marker.group);
            marker.mesh.geometry.dispose();
            marker.mesh.material.dispose();
            marker.line?.geometry.dispose();
            marker.line?.material.dispose();
            marker.sprite.material.map?.dispose();
            marker.sprite.material.dispose();
        });
        this.markers = [];

        // Reload from service
        const data = await marsFeatureService.clearCacheAndReload();
        this.createMarkersFromData(data.all);

        console.log(`[MarsTerrainMarkers] Refreshed ${this.markers.length} markers`);
    }

    dispose() {
        this.markers.forEach(marker => {
            marker.mesh.geometry.dispose();
            marker.mesh.material.dispose();
            marker.line?.geometry.dispose();
            marker.line?.material.dispose();
            marker.sprite.material.map?.dispose();
            marker.sprite.material.dispose();
        });

        this.labelTextures.forEach(data => data.texture.dispose());
        this.labelTextures.clear();
        this.markers = [];
    }
}

export default MarsTerrainMarkers;
