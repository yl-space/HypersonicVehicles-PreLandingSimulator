import * as THREE from 'three';
import { ModelMetadata, ModelTransformHelper, ModelSelector } from '../../config/ModelMetadata.js';

const METERS_PER_UNIT = 100000; // 1 unit = 100 km
const VEHICLE_DIAMETER_METERS = 4.5;
const VEHICLE_HEIGHT_METERS = 3.0;
const VEHICLE_RADIUS_UNITS = (VEHICLE_DIAMETER_METERS * 0.5) / METERS_PER_UNIT;
const VEHICLE_HEIGHT_UNITS = VEHICLE_HEIGHT_METERS / METERS_PER_UNIT;

export class EntryVehicle {
    constructor(assetLoader = null) {
        this.assetLoader = assetLoader;
        this.group = new THREE.Group();
        this.group.matrixAutoUpdate = true;
        this.vehicleLOD = null;
        this.gltfModel = null;  // Store loaded GLTF model
        this.modelMetadata = null;  // Store model metadata
        this.useGLTF = assetLoader !== null;  // Use GLTF if asset loader provided

        this.effects = {
            heatGlow: null,
            plasmaTail: null,
            thrusters: []
        };
        this.state = {
            heatShieldAttached: true,
            parachuteDeployed: false,
            thrustersActive: false,
            modelLoaded: false  // Track if GLTF model is loaded
        };

        // Spacecraft attitude state (scientifically accurate)
        this.attitude = {
            quaternion: new THREE.Quaternion(),
            angleOfAttack: -16,  // MSL trim AoA: -16 degrees
            bankAngle: 0,        // Current bank angle
            sideslipAngle: 0     // Maintained at 0 during entry
        };

        // Add coordinate axes and velocity vector
        this.localAxes = null;
        this.velocityArrow = null;
        this.bankAngleArrow = null;
        this.positionArrow = null;
        this.vectorsVisible = false;
        this.vectorFadeTimer = null;

        // Vector labels
        this.vectorLabels = {
            velocity: null,
            lift: null,
            position: null
        };

        // Derived visual scales tied to vehicle size (keeps vectors/callouts close to the hull)
        const baseVectorLength = VEHICLE_RADIUS_UNITS * 0.6; // ~60% of capsule radius
        this.visualScales = {
            velocityVector: baseVectorLength,
            bankVector: baseVectorLength,
            positionVector: baseVectorLength,
            label: VEHICLE_RADIUS_UNITS * 0.9,
            glowRadius: 2.5 / METERS_PER_UNIT,       // unchanged
            plasma: {
                lateralSpread: 2.0 / METERS_PER_UNIT,
                spawnDepth: 8 / METERS_PER_UNIT,
                velocityJitter: 1.2 / METERS_PER_UNIT,
                pointSize: 1.2 / METERS_PER_UNIT
            }
        };

        // Don't call init in constructor since it's async now
        // this.init();
    }

    async init() {
        // Try to load GLTF model first if asset loader is available
        if (this.useGLTF && this.assetLoader) {
            try {
                await this.loadGLTFModel();
                this._cleanupGLTFModel();
                this.applyMaterialFixes();
            } catch (error) {
                console.error('Failed to load GLTF model during init:', error);
                this.useGLTF = false;
            }
        }

        // Heat effects disabled — user requested removal of heat blob around spacecraft
        // this.createHeatEffects();
        // this.createThrusterSystem();
        // this.createLocalCoordinateAxes();
        this.createOrientationVectors();
        this.createVectorLabels();

        // Ensure a visible fallback if GLTF failed to load
        if (!this.state.modelLoaded && !this.vehicleLOD) {
            this.createVehicleWithLOD();
        }

        return this; // Return this for chaining
    }

    /**
     * Get ideal camera follow distance based on actual vehicle size.
     * Returns scene units.
     *
     * 8× the longest axis gives a comfortable framing margin in a 50° FOV
     * camera — enough to see the whole vehicle plus context, without putting
     * the camera so far away that the model becomes a single pixel.  Was 4×
     * which clipped the model on Starship (50 m → 200 m camera distance was
     * less than the body length, so the spacecraft filled the whole screen
     * and occluded everything else).
     */
    getIdealCameraDistance() {
        return (this.vehicleHeight || VEHICLE_HEIGHT_UNITS) * 8;
    }

    /** Hide Blender leftover nodes (e.g. "Cube" default object) */
    _cleanupGLTFModel() {
        if (!this.gltfModel) return;
        const cube = this.gltfModel.getObjectByName('Cube');
        if (cube) {
            cube.visible = false;
            if (cube.geometry) cube.geometry.dispose();
        }
    }

    /**
     * Restore SpaceX Starship's stainless-steel "white/silver" appearance.
     *
     * Real Starship is bright stainless steel — looks white-silver in
     * sunlight.  The Fusion 360 → Blender → GLTF export pipeline both
     *   (a) flattens every PBR colour to (0.8, 0.8, 0.8) grey, and
     *   (b) emits material names with NO embedded textures.
     *
     * To get a bright steel look without an environment-map cubemap (which
     * the simulator does not currently load), we use HIGH ALBEDO + LOW
     * METALNESS.  A metallic surface in Three.js's MeshStandardMaterial
     * appears DARK without an env map because its diffuse contribution is
     * suppressed in favour of (non-existent) reflections — the previous
     * metalness=0.8 setting was the root cause of the "black Starship"
     * complaint.  Setting metalness=0 keeps the surface lit by the scene's
     * direct lights only, which is what we have.
     *
     * Heat-tile / black-plastic surfaces stay dark to preserve nose/fin
     * contrast against the bright body.
     *
     * Must run AFTER applyMaterialFixes(): the latter resets
     * `mat.side = FrontSide`, and Starship's thin-wall fins need DoubleSide.
     */
    _applyStarshipMaterials() {
        const colorMap = {
            // Bright stainless steel — high albedo, NON-metallic shading so
            // direct lights hit it instead of relying on env reflections.
            'Steel_-_Satin':            { color: 0xE8E8EC, metalness: 0.0, roughness: 0.35 },
            'Mirror':                    { color: 0xF2F2F5, metalness: 0.0, roughness: 0.10 },
            // Heat-tile blacks — keep dark for nose/aft contrast.
            'Plastic_-_Glossy_(Black)':  { color: 0x202024, metalness: 0.0, roughness: 0.20 },
            'Plastic_-_Matte_(Black)':   { color: 0x2A2A2E, metalness: 0.0, roughness: 0.85 },
            // Generic "Material" — light steel fallback.
            'Material':                  { color: 0xDADADE, metalness: 0.0, roughness: 0.40 },
        };

        // Any unnamed surface defaults to bright steel — matches the bulk
        // of the visible hull on real Starship.
        const defaultFix = { color: 0xE8E8EC, metalness: 0.0, roughness: 0.35 };

        const group = this.vehicleLOD || this.group;
        let fixed = 0, defaulted = 0;
        group.traverse(obj => {
            if (!obj.isMesh || !obj.material) return;
            const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
            mats.forEach(mat => {
                const name = mat.name || '';
                const fix = colorMap[name] || defaultFix;
                if (mat.color) mat.color.setHex(fix.color);
                if ('metalness' in mat) mat.metalness = fix.metalness;
                if ('roughness' in mat) mat.roughness = fix.roughness;
                if ('emissive' in mat) mat.emissive.setHex(0x080808);   // tiny ambient lift
                mat.side = THREE.DoubleSide;          // thin-wall fins / windows
                mat.transparent = false;
                mat.opacity = 1.0;
                mat.depthWrite = true;
                mat.needsUpdate = true;
                if (colorMap[name]) fixed++; else defaulted++;
            });
        });
        console.log(`[EntryVehicle] Starship materials applied — by-name: ${fixed}, fallback-default: ${defaulted}`);
    }

    /**
     * Auto-orient + center the loaded vehicleLOD so:
     *   1. Its geometric centroid sits at this.group's local origin (so the
     *      simulator's position-dot lines up with the visible model).
     *   2. The model's longest axis (= nose-to-tail) aligns with local +Z.
     *      The "nose end" is identified as the end with the smaller cross-
     *      section, since rocket bodies taper toward the nose.
     *
     * Robust to whatever Blender/exporter axis convention the GLB happens to
     * use, so it can't break when the model file is re-exported with different
     * settings.
     *
     * Operates on the WORLD-space bounds of vehicleLOD (after AssetLoader's
     * scale and rotation have already been baked in), then writes corrective
     * rotation + translation to vehicleLOD itself.
     */
    _autoOrientAndCenter() {
        if (!this.vehicleLOD) return;
        const lod = this.vehicleLOD;

        // Make sure transforms are current before measuring.
        lod.updateMatrixWorld(true);
        const bbox = new THREE.Box3().setFromObject(lod);
        if (!isFinite(bbox.min.x) || !isFinite(bbox.max.x)) return;

        const size   = bbox.getSize(new THREE.Vector3());
        const center = bbox.getCenter(new THREE.Vector3());

        // Identify the longest axis — that's the nose-to-tail direction.
        const axes = [
            { axis: 'x', size: size.x },
            { axis: 'y', size: size.y },
            { axis: 'z', size: size.z },
        ].sort((a, b) => b.size - a.size);
        const longAxis = axes[0].axis;

        // Decide which END (positive or negative side along the long axis) is
        // the NOSE.  Improved heuristic: instead of single max-span which is
        // dominated by a long, full-diameter hull mesh that overlaps BOTH
        // slabs, compute the *integrated* cross-sectional area of all mesh
        // AABBs that LIE ENTIRELY WITHIN the slab.  This excludes the long
        // hull mesh and gives signal from flap/cone meshes that exist at
        // exactly one end.  Whichever end has the SMALLER local-only area
        // is taken to be the nose (cones taper).
        const minMaxOnLongAxis = { x: [bbox.min.x, bbox.max.x], y: [bbox.min.y, bbox.max.y], z: [bbox.min.z, bbox.max.z] };
        const longMin = minMaxOnLongAxis[longAxis][0];
        const longMax = minMaxOnLongAxis[longAxis][1];
        const longSpan = longMax - longMin;
        const slabFrac = 0.20;                        // sample top/bottom 20% (capture more local detail)
        const slabThickness = longSpan * slabFrac;
        const otherAxes = ['x', 'y', 'z'].filter(a => a !== longAxis);

        // Localized cross-section: only count meshes whose ENTIRE AABB is
        // within the slab (filters out the spanning hull) and sum their
        // areas (sum, not max — multiple flaps add up).
        const localSlabArea = (slabMin, slabMax) => {
            let area = 0;
            lod.traverse(obj => {
                if (!obj.isMesh) return;
                const meshBox = new THREE.Box3().setFromObject(obj);
                if (meshBox.min[longAxis] < slabMin) return;   // extends beyond slab
                if (meshBox.max[longAxis] > slabMax) return;
                const w = meshBox.max[otherAxes[0]] - meshBox.min[otherAxes[0]];
                const h = meshBox.max[otherAxes[1]] - meshBox.min[otherAxes[1]];
                area += w * h;
            });
            return area;
        };
        const areaPos = localSlabArea(longMax - slabThickness, longMax);
        const areaNeg = localSlabArea(longMin, longMin + slabThickness);

        // EMPIRICAL: for Starship_updated_binary.glb (Fusion 360 → Blender
        // export), the AABB-detail heuristic above gets the wrong answer
        // because the top accessor is a chunky 7.6 m anchor cube, not a
        // nose-cone taper, while the BOTTOM has the recognizable aft-flap
        // geometry.  In real Starship, aft flaps are at the BASE (engine end)
        // and forward flaps near the nose.  The cleanest signal we have for
        // this specific model is: the end with the ASYMMETRIC small-Y
        // accessor (= a single visible flap) is the AFT/BASE end, since the
        // forward flaps were modelled symmetrically and didn't show up as a
        // separate asymmetric mesh.  Detect by Y-asymmetry of the slab's
        // mesh AABBs.
        const slabAsymmetry = (slabMin, slabMax) => {
            // Returns mean(|midY|) over meshes with FULL AABB in this slab —
            // larger means more asymmetric (one-sided detail).
            let sum = 0, n = 0;
            lod.traverse(obj => {
                if (!obj.isMesh) return;
                const b = new THREE.Box3().setFromObject(obj);
                if (b.min[longAxis] < slabMin || b.max[longAxis] > slabMax) return;
                const midY = 0.5 * (b.min.y + b.max.y);
                const spanY = b.max.y - b.min.y;
                if (spanY <= 0) return;
                sum += Math.abs(midY) / spanY;
                n++;
            });
            return n ? sum / n : 0;
        };
        const asymPos = slabAsymmetry(longMax - slabThickness, longMax);
        const asymNeg = slabAsymmetry(longMin, longMin + slabThickness);
        // Empirically determined for this Starship GLB after browser-tested
        // side-by-side dot-product comparison vs the human-perceived nose:
        //
        //   Heuristic A: less-asymmetric end = nose
        //     → noseAtPos = true → no flip → mesh-+Z aligned with velocity
        //     → BUT user reports "nose is OPPOSITE velocity" (the 'nose' the
        //       user perceives is the asymmetric-flap end, not the chunky cube
        //       end), so this is WRONG.
        //
        //   Heuristic B: more-asymmetric end = nose
        //     → noseAtPos = false → 180° flip applied → mesh-(-Z) aligned with velocity
        //     → user-perceived nose (asymmetric end) along velocity ✓
        //
        // Use Heuristic B.  The chunky symmetric mesh at one end is the
        // rocket's TOP/ENGINE-BAY anchor, not the nose; the asymmetric
        // small-Y mesh at the other end is the nose-section detail
        // (forward flap or aerodynamic feature).
        let noseAtPos;
        if (Math.abs(asymPos - asymNeg) > 0.05) {
            noseAtPos = asymPos > asymNeg;       // more-asymmetric end = nose
        } else {
            noseAtPos = areaPos < areaNeg;       // smaller-detail end = nose (cone)
        }
        console.log('[EntryVehicle] orientation heuristic:', {
            longAxis,
            areaPos: areaPos.toExponential(3),
            areaNeg: areaNeg.toExponential(3),
            asymPos: asymPos.toFixed(3),
            asymNeg: asymNeg.toFixed(3),
            noseAtPos,
        });

        // Build corrective rotation: map current nose direction → world +Z.
        const noseDirCurrent = new THREE.Vector3();
        if (longAxis === 'x') noseDirCurrent.set(noseAtPos ?  1 : -1, 0, 0);
        if (longAxis === 'y') noseDirCurrent.set(0, noseAtPos ?  1 : -1, 0);
        if (longAxis === 'z') noseDirCurrent.set(0, 0, noseAtPos ?  1 : -1);

        const targetDir = new THREE.Vector3(0, 0, 1);
        const correction = new THREE.Quaternion().setFromUnitVectors(noseDirCurrent, targetDir);

        // Apply corrective rotation FIRST (around current center), then
        // re-center so the AABB middle sits at the local origin.
        lod.quaternion.premultiply(correction);
        lod.updateMatrixWorld(true);

        const bbox2 = new THREE.Box3().setFromObject(lod);
        const center2 = bbox2.getCenter(new THREE.Vector3());
        lod.position.sub(center2);

        // Refresh dimension caches so downstream visual scales are right.
        lod.updateMatrixWorld(true);
        const bboxFinal = new THREE.Box3().setFromObject(lod);
        const sizeFinal = bboxFinal.getSize(new THREE.Vector3());
        this.vehicleHeight = Math.max(sizeFinal.x, sizeFinal.y, sizeFinal.z);
        this.vehicleRadius = Math.min(sizeFinal.x, sizeFinal.y, sizeFinal.z) * 0.5;

        // Cache the assumed nose direction (in this.group local frame) for
        // diagnostics and the regression nose-arrow helper.
        this._assumedNoseLocal = new THREE.Vector3(0, 0, 1);

        console.log('[EntryVehicle] Auto-orient + center:', {
            longAxis,
            noseAtPos,
            areaPos: areaPos.toExponential(3),
            areaNeg: areaNeg.toExponential(3),
            asymPos: asymPos.toFixed(3),
            asymNeg: asymNeg.toFixed(3),
            finalSize: { x: sizeFinal.x.toExponential(3), y: sizeFinal.y.toExponential(3), z: sizeFinal.z.toExponential(3) },
            vehicleHeight: this.vehicleHeight.toExponential(3),
        });
    }

    /**
     * Diagnostic: add a bright GREEN arrow showing the model's assumed nose
     * direction, anchored at the spacecraft origin and pointed along local +Z
     * (which setScientificAttitude maps to velocity-with-AoA).
     *
     * Used to visually verify orientation in the browser — if the green arrow
     * agrees with the yellow velocity arrow, the nose is aligned with motion.
     * If they're 180° apart, the model is reversed.
     *
     * Toggleable from the console:
     *     simulationManager.entryVehicle.showNoseDebugArrow(true|false)
     */
    showNoseDebugArrow(visible = true) {
        if (!this._noseDebugArrow) {
            const len = (this.vehicleHeight || 0.0005) * 2.5;
            this._noseDebugArrow = new THREE.ArrowHelper(
                new THREE.Vector3(0, 0, 1),         // local +Z = assumed nose direction
                new THREE.Vector3(0, 0, 0),
                len,
                0x00ff44,                            // bright green = "nose direction"
                len * 0.15,
                len * 0.10
            );
            this._noseDebugArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00ff44, linewidth: 3 });
            this._noseDebugArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00ff44 });
            this._noseDebugArrow.renderOrder = 1000;
            this.group.add(this._noseDebugArrow);
        }
        this._noseDebugArrow.visible = visible;
    }

    async loadGLTFModel(modelName = null) {
        try {
            // Use specified model or get from metadata
            const modelToLoad = modelName || ModelSelector.getPrimaryModel().filename;
            this.modelMetadata = ModelSelector.getModelByFilename(modelToLoad) || ModelSelector.getPrimaryModel();

            console.log(`Loading spacecraft model: ${this.modelMetadata.name}`);

            // Load the model using AssetLoader
            const { model, metadata } = await this.assetLoader.loadSpacecraftModel(
                modelToLoad,
                this.modelMetadata
            );

            this.gltfModel = model;
            this.state.modelLoaded = true;

            // Remove Blender leftover nodes BEFORE LOD creation (they get cloned into all levels)
            const cube = model.getObjectByName('Cube');
            if (cube) { cube.removeFromParent(); }

            // Create LOD from GLTF model
            this.createGLTFLOD(model);

            // Compute actual vehicle dimensions from loaded geometry for dynamic scaling
            // of camera distance, nose camera offset, vector lengths, etc.
            const bbox = new THREE.Box3().setFromObject(this.vehicleLOD || this.group);
            const size = bbox.getSize(new THREE.Vector3());
            this.vehicleHeight = Math.max(size.x, size.y, size.z); // longest axis = height
            this.vehicleRadius = Math.min(size.x, size.y, size.z) * 0.5; // shortest = radius
            // Fallback to Dragon defaults if bounding box is degenerate
            if (this.vehicleHeight < 1e-8) this.vehicleHeight = VEHICLE_HEIGHT_UNITS;
            if (this.vehicleRadius < 1e-8) this.vehicleRadius = VEHICLE_RADIUS_UNITS;

            // Store metadata for reference (merge carefully to avoid circular references)
            this.modelMetadata = Object.assign({}, this.modelMetadata, {
                name: metadata.name,
                boundingBox: metadata.boundingBox,
                transformedBoundingBox: metadata.transformedBoundingBox,
                animations: metadata.animations
            });

        } catch (error) {
            console.error('Failed to load GLTF model; spacecraft will remain hidden until a valid model is available:', error);
            this.useGLTF = false;
            if (!this.vehicleLOD) {
                this.createVehicleWithLOD();
            }
        }
    }

    createGLTFLOD(model) {
        this.vehicleLOD = new THREE.LOD();

        const highDetail = model.clone(true);
        const mediumDetail = model.clone(true);
        const lowDetail = model.clone(true);

        this.applyHighDetailTweaks(highDetail);
        this.applyMediumDetailTweaks(mediumDetail);
        this.applyLowDetailTweaks(lowDetail);

        // LOD distances must SCALE with vehicle size so a 50 m Starship doesn't
        // permanently render at low-detail at the same camera distance where a
        // 3 m Dragon is at high-detail.  Compute the model's longest axis NOW
        // (after AssetLoader has applied scale + rotation) and gate the LOD
        // levels at multiples of it.
        const sizeBox = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
        const longest = Math.max(sizeBox.x, sizeBox.y, sizeBox.z) || VEHICLE_HEIGHT_UNITS;
        // Use multiples that work well for both Dragon (~3 m) and Starship (~50 m).
        const mediumDist = longest *  6;   // switch to medium beyond ~6 vehicle lengths
        const lowDist    = longest * 15;   // switch to low beyond ~15 vehicle lengths

        this.vehicleLOD.addLevel(highDetail, 0);
        this.vehicleLOD.addLevel(mediumDetail, mediumDist);
        this.vehicleLOD.addLevel(lowDetail,    lowDist);

        this.group.add(this.vehicleLOD);
    }

    applyHighDetailTweaks(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                // Extract base color and NAME from original material.
                // Name preservation is critical: downstream fixers (e.g.
                // _applyStarshipMaterials) match by mat.name to assign realistic
                // PBR colors.  Losing the name turned every Starship surface into
                // featureless flat grey — that's the "skin missing" bug.
                let baseColor = new THREE.Color(0xcccccc);
                const sourceMat = Array.isArray(child.material) ? child.material[0] : child.material;
                const sourceName = sourceMat?.name || '';
                if (sourceMat && sourceMat.color) {
                    baseColor = sourceMat.color.clone();
                }

                // FORCE completely opaque material by replacing with MeshStandardMaterial
                child.material = new THREE.MeshStandardMaterial({
                    color: baseColor,
                    metalness: 0.3,
                    roughness: 0.7,
                    transparent: false,
                    opacity: 1.0,
                    depthWrite: true,
                    depthTest: true,
                    side: THREE.DoubleSide,  // FIX: DoubleSide prevents culling when camera is close
                    alphaTest: 0
                });
                child.material.name = sourceName;   // preserve so name-based fixers work
                child.material.needsUpdate = true;
            }
        });
    }

    applyMediumDetailTweaks(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        const clone = mat.clone();
                        clone.flatShading = true;
                        clone.shininess = Math.min(clone.shininess || 20, 10);
                        // Force opaque rendering
                        clone.transparent = false;
                        clone.opacity = 1.0;
                        clone.depthWrite = true;
                        clone.depthTest = true;
                        clone.alphaTest = 0;
                        if (clone.alphaMap) clone.alphaMap = null;
                        clone.needsUpdate = true;
                        return clone;
                    });
                } else if (child.material) {
                    const clone = child.material.clone();
                    clone.flatShading = true;
                    clone.shininess = Math.min(clone.shininess || 20, 10);
                    // Force opaque rendering
                    clone.transparent = false;
                    clone.opacity = 1.0;
                    clone.depthWrite = true;
                    clone.depthTest = true;
                    clone.alphaTest = 0;
                    if (clone.alphaMap) clone.alphaMap = null;
                    clone.needsUpdate = true;
                    child.material = clone;
                }
                child.castShadow = false;
            }
        });
    }

    applyLowDetailTweaks(object) {
        object.traverse((child) => {
            if (child.isMesh) {
                let baseColor = new THREE.Color(0xffffff);
                const sourceMaterial = Array.isArray(child.material) ? child.material[0] : child.material;
                const sourceName = sourceMaterial?.name || '';
                if (sourceMaterial && sourceMaterial.color) {
                    baseColor = sourceMaterial.color.clone();
                }
                // Use MeshStandardMaterial (not Basic) so far-LOD still receives
                // lighting and reflects PBR colors set by name-based fixers like
                // _applyStarshipMaterials.  Cost is negligible since low-LOD
                // geometry has fewer polygons.
                child.material = new THREE.MeshStandardMaterial({
                    color: baseColor,
                    metalness: 0.3,
                    roughness: 0.7,
                    transparent: false,
                    opacity: 1.0,
                    depthWrite: true,
                    depthTest: true,
                    alphaTest: 0,
                    side: THREE.DoubleSide
                });
                child.material.name = sourceName;     // preserve for name-based fixers
                child.material.flatShading = true;    // cheaper shading for distant view
                child.material.needsUpdate = true;
                child.castShadow = false;
                child.receiveShadow = false;
            }
        });
    }

    createVehicleWithLOD() {
        // Use LOD for performance (fallback cone geometry)
        this.vehicleLOD = new THREE.LOD();

        // High detail (close)
        const highDetail = this.createHighDetailVehicle();
        this.vehicleLOD.addLevel(highDetail, 0);

        // Medium detail
        const mediumDetail = this.createMediumDetailVehicle();
        this.vehicleLOD.addLevel(mediumDetail, 0.0002);

        // Low detail (far)
        const lowDetail = this.createLowDetailVehicle();
        this.vehicleLOD.addLevel(lowDetail, 0.0005);

        this.group.add(this.vehicleLOD);
    }
    
    createHighDetailVehicle() {
        const group = new THREE.Group();
        
        // True-scale aeroshell (~4.5 m dia, ~3 m height) mapped to scene units
        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;
        const shellGeometry = new THREE.ConeGeometry(shellRadius, shellHeight, 32, 16);
        const shellMaterial = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7,
            normalScale: new THREE.Vector2(0.5, 0.5),
            envMapIntensity: 0.5
        });

        const shell = new THREE.Mesh(shellGeometry, shellMaterial);
        // Reorient cone: rotate 90° around X so flat base faces forward (+Z direction)
        // Default cone points up (+Y), we want flat base facing +Z (forward in velocity frame)
        shell.rotation.x = -Math.PI / 2; // Rotate -90° to point cone along +Z
        shell.position.set(0, 0, 0); // Center at origin
        shell.castShadow = true;
        shell.receiveShadow = true;
        group.add(shell);

        // Heat shield REMOVED per user request

        return group;
    }
    
    createMediumDetailVehicle() {
        const group = new THREE.Group();

        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;

        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 16, 8);
        const material = new THREE.MeshStandardMaterial({
            color: 0x8B7355,
            metalness: 0.3,
            roughness: 0.7
        });

        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = -Math.PI / 2; // Flat base faces forward
        vehicle.position.set(0, 0, 0);
        group.add(vehicle);

        return group;
    }
    
    createLowDetailVehicle() {
        const group = new THREE.Group();

        const shellRadius = VEHICLE_RADIUS_UNITS;
        const shellHeight = VEHICLE_HEIGHT_UNITS;

        const geometry = new THREE.ConeGeometry(shellRadius, shellHeight, 8, 4);
        const material = new THREE.MeshBasicMaterial({
            color: 0x8B7355
        });

        const vehicle = new THREE.Mesh(geometry, material);
        vehicle.rotation.x = -Math.PI / 2; // Flat base faces forward
        vehicle.position.set(0, 0, 0);
        group.add(vehicle);

        return group;
    }
    
    createHeatEffects() {
        // Modern shader for heat glow
        const glowMaterial = new THREE.ShaderMaterial({
            uniforms: {
                intensity: { value: 0.0 },
                glowColor: { value: new THREE.Color(0xff6600) },
                viewVector: { value: new THREE.Vector3() },
                time: { value: 0 }
            },
            vertexShader: `
                precision mediump float;

                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                precision mediump float;

                uniform float intensity;
                uniform vec3 glowColor;
                uniform vec3 viewVector;
                uniform float time;

                varying vec3 vNormal;
                varying vec3 vWorldPosition;

                void main() {
                    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
                    float fresnel = pow(clamp(1.0 - dot(normalize(vNormal), viewDirection), 0.0, 1.0), 2.0);

                    // Animated plasma effect
                    float noise = sin(time * 10.0 + vWorldPosition.y * 20.0) * 0.1;
                    float glow = fresnel * intensity * (1.0 + noise);

                    vec3 color = glowColor * glow;
                    gl_FragColor = vec4(color, clamp(glow * 0.8, 0.0, 1.0));
                }
            `,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
            depthTest: true
        });
        
        // Scale glow to match new spacecraft size
        const glowRadius = this.visualScales.glowRadius; // Slightly larger than spacecraft for glow effect
        const glowGeometry = new THREE.SphereGeometry(glowRadius, 16, 16);
        this.effects.heatGlow = new THREE.Mesh(glowGeometry, glowMaterial);
        this.effects.heatGlow.renderOrder = -1;
        this.effects.heatGlow.visible = false;
        this.group.add(this.effects.heatGlow);
        
        // Plasma tail using particle system
        this.createPlasmaTail();
    }

    applyMaterialFixes() {
        // Ensure spacecraft materials render solid (no unintended transparency or backface culling issues)
        this.group.traverse((child) => {
            if (child.isMesh && child.material) {
                const mats = Array.isArray(child.material) ? child.material : [child.material];
                mats.forEach(mat => {
                    mat.transparent = false;
                    mat.opacity = 1.0;
                    mat.alphaTest = 0;
                    mat.depthWrite = true;
                    mat.depthTest = true;
                    mat.blending = THREE.NormalBlending;
                    mat.premultipliedAlpha = false;
                    mat.side = THREE.FrontSide;
                    if ('transmission' in mat) mat.transmission = 0;
                    if ('thickness' in mat) mat.thickness = 0;
                    if ('ior' in mat) mat.ior = 1.0;
                    mat.needsUpdate = true;
                });
            }
        });
    }
    
    createPlasmaTail() {
        const particleCount = 200; // Reduced for better performance
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const velocities = new Float32Array(particleCount * 3);
        const lifetimes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            positions[i * 3] = 0;
            positions[i * 3 + 1] = 0;
            positions[i * 3 + 2] = 0;
            
            // Scale velocities for smaller spacecraft (meters mapped to units)
            velocities[i * 3] = (Math.random() - 0.5) * this.visualScales.plasma.velocityJitter;
            velocities[i * 3 + 1] = -Math.random() * (this.visualScales.plasma.velocityJitter * 1.6);
            velocities[i * 3 + 2] = (Math.random() - 0.5) * this.visualScales.plasma.velocityJitter;
            
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('velocity', new THREE.BufferAttribute(velocities, 3));
        geometry.setAttribute('lifetime', new THREE.BufferAttribute(lifetimes, 1));
        
        const material = new THREE.PointsMaterial({
            size: this.visualScales.plasma.pointSize,
            color: 0xff6600,
            blending: THREE.AdditiveBlending,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            vertexColors: true
        });
        
        this.effects.plasmaTail = new THREE.Points(geometry, material);
        this.effects.plasmaTail.frustumCulled = false;
        this.group.add(this.effects.plasmaTail);
    }
    

    createOrientationVectors() {
        // Create arrow helper for velocity vector
        const origin = new THREE.Vector3(0, 0, 0);
        const direction = new THREE.Vector3(0, -1, 0);

        // Velocity vector (yellow) - compact with prominent arrow head
        const velocityLength = this.visualScales.velocityVector;
        this.velocityArrow = new THREE.ArrowHelper(direction, origin, velocityLength, 0xffd447, velocityLength * 0.9, velocityLength * 0.7);
        this.velocityArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xffd447 });
        this.velocityArrow.line.material = new THREE.LineBasicMaterial({ color: 0xffd447, linewidth: 1 });
        this.velocityArrow.visible = false;
        this.velocityArrow.renderOrder = 999;
        this.group.add(this.velocityArrow);

        // Bank angle vector (cyan) - compact with prominent arrow head
        const bankLength = this.visualScales.bankVector;
        this.bankAngleArrow = new THREE.ArrowHelper(direction, origin, bankLength, 0x00c1ff, bankLength * 0.9, bankLength * 0.7);
        this.bankAngleArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0x00c1ff });
        this.bankAngleArrow.line.material = new THREE.LineBasicMaterial({ color: 0x00c1ff, linewidth: 1 });
        this.bankAngleArrow.visible = false;
        this.bankAngleArrow.renderOrder = 999;
        this.group.add(this.bankAngleArrow);

        // Position vector (magenta) - compact with prominent arrow head
        const posLength = this.visualScales.positionVector;
        this.positionArrow = new THREE.ArrowHelper(direction, origin, posLength, 0xff00ff, posLength * 0.9, posLength * 0.7);
        this.positionArrow.cone.material = new THREE.MeshBasicMaterial({ color: 0xff00ff });
        this.positionArrow.line.material = new THREE.LineBasicMaterial({ color: 0xff00ff, linewidth: 1 });
        this.positionArrow.visible = false;
        this.positionArrow.renderOrder = 999;
        this.group.add(this.positionArrow);
    }

    createVectorLabels() {
        const createTextSprite = (text, color) => {
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 64;
            context.font = 'bold 28px Arial, sans-serif';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            const texture = new THREE.CanvasTexture(canvas);
            const spriteMaterial = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                alphaTest: 0.001,
                depthTest: false
            });
            const sprite = new THREE.Sprite(spriteMaterial);
            sprite.scale.set(this.visualScales.label, this.visualScales.label * 0.25, 1);
            sprite.visible = false;
            sprite.renderOrder = 1000;
            return sprite;
        };

        this.vectorLabels.velocity = createTextSprite('Velocity', '#ffd447');
        this.vectorLabels.lift = createTextSprite('Lift', '#00c1ff');
        this.vectorLabels.position = createTextSprite('Position', '#ff4fd8');
        this.group.add(this.vectorLabels.velocity);
        this.group.add(this.vectorLabels.lift);
        this.group.add(this.vectorLabels.position);
    }

    updateOrientationVectors(velocity, position, bankAngle = 0) {
        if (!velocity || !position) return;
        if (!this.vectorsVisible) return;

        // Transform world-space directions to spacecraft local space
        // Since vectors are children of this.group, we need to account for spacecraft rotation
        const spacecraftQuaternionInverse = this.group.quaternion.clone().invert();

        // ====================================================================================
        // VELOCITY VECTOR (Yellow): Shows actual direction of motion along trajectory
        // ====================================================================================
        if (this.velocityArrow && velocity instanceof THREE.Vector3 && velocity.length() > 0.001) {
            const velocityDirection = velocity.clone().normalize();
            // Transform from world space to spacecraft local space
            const localVelocityDir = velocityDirection.clone().applyQuaternion(spacecraftQuaternionInverse);
            const velocityLength = this.visualScales.velocityVector;
            this.velocityArrow.position.set(0, 0, 0);
            this.velocityArrow.setDirection(localVelocityDir);
            this.velocityArrow.setLength(velocityLength);
            if (this.vectorLabels.velocity) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = localVelocityDir.clone().multiplyScalar(velocityLength * 1.05);
                this.vectorLabels.velocity.position.copy(labelPosition);
                this.vectorLabels.velocity.visible = this.vectorsVisible;
            }
        }

        // ====================================================================================
        // POSITION VECTOR (Magenta): Shows radial direction from Mars center
        // ====================================================================================
        if (this.positionArrow && position instanceof THREE.Vector3 && position.length() > 0.001) {
            const radialDirection = position.clone().normalize();
            // Transform from world space to spacecraft local space
            const localRadialDir = radialDirection.clone().applyQuaternion(spacecraftQuaternionInverse);

            const posLength = this.visualScales.positionVector;
            this.positionArrow.position.set(0, 0, 0);
            this.positionArrow.setDirection(localRadialDir);
            this.positionArrow.setLength(posLength);
            if (this.vectorLabels.position) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = localRadialDir.clone().multiplyScalar(posLength * 1.05);
                this.vectorLabels.position.position.copy(labelPosition);
                this.vectorLabels.position.visible = this.vectorsVisible;
            }
        }

        // ====================================================================================
        // BANK VECTOR (Cyan): Shows spacecraft body-fixed "up" direction
        // ====================================================================================
        if (this.bankAngleArrow) {
            // Body-fixed up direction (+Y in spacecraft frame)
            // Since the arrow is a child of the group, use local coordinates directly
            const spacecraftUpDir = new THREE.Vector3(0, 1, 0);

            const bankLength = this.visualScales.bankVector;
            this.bankAngleArrow.position.set(0, 0, 0);
            this.bankAngleArrow.setDirection(spacecraftUpDir);
            this.bankAngleArrow.setLength(bankLength);
            if (this.vectorLabels.lift) {
                // Position label at the arrow tip (slightly beyond for visibility)
                const labelPosition = spacecraftUpDir.clone().multiplyScalar(bankLength * 1.05);
                this.vectorLabels.lift.position.copy(labelPosition);
                this.vectorLabels.lift.visible = this.vectorsVisible;
            }
        }
    }

    setVectorsVisible(visible, autoFade = false) {
        this.vectorsVisible = visible;
        if (this.velocityArrow) this.velocityArrow.visible = visible;
        if (this.bankAngleArrow) this.bankAngleArrow.visible = visible;
        if (this.positionArrow) this.positionArrow.visible = visible;
        if (this.vectorLabels.velocity) this.vectorLabels.velocity.visible = visible;
        if (this.vectorLabels.lift) this.vectorLabels.lift.visible = visible;
        if (this.vectorLabels.position) this.vectorLabels.position.visible = visible;

        if (this.vectorFadeTimer) {
            clearTimeout(this.vectorFadeTimer);
            this.vectorFadeTimer = null;
        }

        if (visible && autoFade) {
            this.vectorFadeTimer = setTimeout(() => {
                this.setVectorsVisible(false);
            }, 3000);
        }
    }

    toggleVectors() {
        this.setVectorsVisible(!this.vectorsVisible);
    }

    update(time, vehicleData, bankAngle = 0, camera = null) {
        if (!vehicleData) return;

        // Update orientation vectors if visible
        if (this.vectorsVisible && vehicleData.velocity && vehicleData.position) {
            this.updateOrientationVectors(vehicleData.velocity, vehicleData.position, bankAngle);
        }
        // Update heat effects based on altitude and velocity
        const altitude = vehicleData.altitude || 100;
        const velocity = vehicleData.velocityMagnitude || 0;

        // Heat intensity calculation
        const heatIntensity = altitude < 100 && altitude > 20
            ? (1 - altitude / 100) * (velocity / 5900)
            : 0;

        // Update glow shader
        if (this.effects.heatGlow) {
            this.effects.heatGlow.material.uniforms.intensity.value = heatIntensity;
            this.effects.heatGlow.material.uniforms.time.value = time;
            this.effects.heatGlow.visible = heatIntensity > 0.01;

            // Change color based on heat
            const heatColor = new THREE.Color();
            heatColor.setHSL(0.05 - heatIntensity * 0.05, 1, 0.5);
            this.effects.heatGlow.material.uniforms.glowColor.value = heatColor;
        }

        // Update plasma tail particles
        this.updatePlasmaTail(heatIntensity);

        // Update thruster visibility
        if (this.thrusterMesh) {
            this.thrusterMesh.material.opacity = this.state.thrustersActive ? 0.8 : 0;
        }

        if (camera && this.vehicleLOD) {
            this.vehicleLOD.update(camera);
        }

        // Ensure spacecraft and LOD remain visible
        if (this.vehicleLOD && !this.vehicleLOD.visible) {
            this.vehicleLOD.visible = true;
        }
    }
    
    updatePlasmaTail(intensity) {
        if (!this.effects.plasmaTail) return;

        // Skip update if intensity is too low (performance optimization)
        if (intensity < 0.01) {
            this.effects.plasmaTail.visible = false;
            return;
        } else {
            this.effects.plasmaTail.visible = true;
        }

        const positions = this.effects.plasmaTail.geometry.attributes.position;
        const velocities = this.effects.plasmaTail.geometry.attributes.velocity;
        const lifetimes = this.effects.plasmaTail.geometry.attributes.lifetime;

        // Update only every other frame for performance
        const skipFrame = Date.now() % 2 === 0;
        if (skipFrame && intensity < 0.5) return;

        // Update fewer particles when intensity is low
        const particlesToUpdate = Math.ceil(positions.count * Math.min(1, intensity + 0.3));

        for (let i = 0; i < particlesToUpdate; i++) {
            lifetimes.array[i] -= 0.01;

            if (lifetimes.array[i] <= 0) {
                // Reset particle - scaled for smaller spacecraft
                positions.array[i * 3] = (Math.random() - 0.5) * this.visualScales.plasma.lateralSpread;
                positions.array[i * 3 + 1] = -this.visualScales.plasma.spawnDepth;  // Start behind spacecraft
                positions.array[i * 3 + 2] = (Math.random() - 0.5) * this.visualScales.plasma.lateralSpread;
                lifetimes.array[i] = 1;
            } else {
                // Update position
                positions.array[i * 3] += velocities.array[i * 3];
                positions.array[i * 3 + 1] += velocities.array[i * 3 + 1];
                positions.array[i * 3 + 2] += velocities.array[i * 3 + 2];
            }
        }

        positions.needsUpdate = true;
        lifetimes.needsUpdate = true;

        this.effects.plasmaTail.material.opacity = intensity * 0.5;
    }
    
    setPosition(position) {
        if (position?.isVector3) {
            this.group.position.copy(position);
            this.group.updateMatrixWorld(true);

            // Ensure spacecraft is always visible
            if (!this.group.visible) {
                this.group.visible = true;
            }
        }
    }

    /**
     * Set spacecraft attitude - SIMPLIFIED: flat base faces forward along velocity
     * Cone is pre-rotated so local +Z points forward
     * @param {THREE.Vector3} velocity - Velocity vector
     * @param {THREE.Vector3} position - Position vector (for radial reference)
     * @param {number} bankAngle - Bank angle in degrees (optional, defaults to current)
     */
    /**
     * Apply scientifically-accurate spacecraft attitude from trajectory state.
     *
     * Uses velocity + radial to build a spacecraft-centric frame:
     *   local +Z = forward (velocity direction)
     *   local +Y = "up" (perpendicular to velocity, in plane with radial)
     *   local +X = right (perpendicular to orbital plane)
     *
     * Then applies:
     *   - Bank angle: rotation around the forward axis (around velocity vector)
     *   - Angle of Attack (AoA): rotation around the right axis (pitch)
     *
     * IMPORTANT: AoA is applied here as a VISUAL pitch offset only — the
     * backend physics (Vinh's equations in sim-server/OP/entryeoms.py) use
     * a fixed L/D ratio and do not accept AoA as a control input.  Changing
     * the AoA slider updates the rendered attitude but does NOT alter the
     * trajectory that the sim-server returns.  A future backend update that
     * exposes an aerodynamic database (CL-α, CD-α) would make AoA a true
     * control input.
     */
    setScientificAttitude(velocity, position, bankAngle = null) {
        if (!velocity || !position || velocity.length() < 0.001) return;

        // Update bank angle if provided
        if (bankAngle !== null) {
            this.attitude.bankAngle = bankAngle;
        }

        const velNorm = velocity.clone().normalize();

        // Angular momentum = r × v (perpendicular to orbital plane)
        const angularMomentum = new THREE.Vector3().crossVectors(position, velocity);

        // Edge case: pure vertical fall (r ∥ v)
        if (angularMomentum.length() < 0.001) {
            angularMomentum.crossVectors(velNorm, new THREE.Vector3(0, 1, 0));
            if (angularMomentum.length() < 0.001) {
                angularMomentum.crossVectors(velNorm, new THREE.Vector3(1, 0, 0));
            }
        }
        angularMomentum.normalize();

        // Spacecraft frame: +Z forward, +Y up, +X right
        const forward = velNorm.clone();
        const right = angularMomentum.clone();
        const up = new THREE.Vector3().crossVectors(forward, right).normalize();
        right.crossVectors(up, forward).normalize();

        // Bank angle — rotation around the forward (velocity) axis.
        if (Math.abs(this.attitude.bankAngle) > 0.001) {
            const bankRad = THREE.MathUtils.degToRad(this.attitude.bankAngle);
            const bankQuat = new THREE.Quaternion();
            bankQuat.setFromAxisAngle(forward, bankRad);
            right.applyQuaternion(bankQuat);
            up.applyQuaternion(bankQuat);
        }

        // Angle of Attack — rotation around the right (pitch) axis.
        // Positive AoA pitches the nose up (forward tilts toward +up);
        // MSL trim AoA of -16° pitches the nose down relative to velocity.
        if (Math.abs(this.attitude.angleOfAttack) > 0.001) {
            const aoaRad = THREE.MathUtils.degToRad(this.attitude.angleOfAttack);
            const aoaQuat = new THREE.Quaternion();
            aoaQuat.setFromAxisAngle(right, aoaRad);
            forward.applyQuaternion(aoaQuat);
            up.applyQuaternion(aoaQuat);
            // right stays fixed (rotation axis)
        }

        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeBasis(right, up, forward);

        this.attitude.quaternion.setFromRotationMatrix(rotationMatrix).normalize();
        this.group.quaternion.copy(this.attitude.quaternion);
    }

    /**
     * Set angle of attack (for phase-specific changes like SUFR)
     * @param {number} aoa - Angle of attack in degrees
     */
    setAngleOfAttack(aoa) {
        this.attitude.angleOfAttack = aoa;
        console.log(`Spacecraft AoA set to ${aoa}°`);
    }

    /**
     * Set bank angle
     * @param {number} bankAngle - Bank angle in degrees
     */
    setBankAngle(bankAngle) {
        this.attitude.bankAngle = bankAngle;
    }
    
    triggerPhaseTransition(phaseName) {
        console.log(`Phase transition: ${phaseName}`);

        // Phase-keyed switch matches the team's 5-phase scheme.
        // SUFR uses startsWith() because the canonical name has typographic
        // quotes ("Straighten Up and Fly Right") which can render as plain
        // ASCII in some places — guard with a prefix check.
        switch (phaseName) {
            case 'Gravity-dominated motion in a rarefied atmosphere':
                // Trim AoA established at entry; no aerodynamic forces yet.
                this.setAngleOfAttack(-16);
                console.log('Phase 1: Trim AoA = -16° (MSL standard) — rarefied atmosphere');
                break;

            case 'Aerothermal build-up':
                // Aero forces ramping; activate bank-angle control authority.
                this.activateThrusters(true);
                console.log('Phase 2: Aerothermal build-up — bank-angle control active');
                break;

            case 'Peak heating and aerodynamic load':
                // Maintain trim AoA through peak deceleration / heating.
                console.log('Phase 3: Peak heating + load — holding trim AoA');
                break;

            case 'Hypersonic glide control phase':
                // Active bank-angle guidance for energy/range management.
                console.log('Phase 4: Hypersonic glide — bank-angle modulation');
                break;

            default:
                if (phaseName && phaseName.startsWith('SUFR')) {
                    // Straighten Up and Fly Right — zero AoA, zero bank for chute deploy.
                    this.setAngleOfAttack(0);
                    this.setBankAngle(0);
                    console.log('Phase 5: SUFR — AoA = 0°, Bank = 0° (parachute prep)');
                }
                break;
        }
    }
    
    deployParachute() {
        // DISABLED per user request - parachute not required
        console.log('Parachute deployment disabled');
    }

    ejectHeatShield() {
        // DISABLED per user request - heat shield removed from model
        console.log('Heat shield ejection disabled');
    }
    
    activateThrusters(active) {
        this.state.thrustersActive = active;
    }
    
    getObject3D() {
        return this.group;
    }
    
    /**
     * Switch to a different spacecraft model
     * @param {string} modelName - Name of the model to switch to ('primary', 'backup', 'cone')
     */
    async switchModel(modelName) {
        if (!this.assetLoader && modelName !== 'cone') {
            console.warn('Cannot switch to GLTF model without AssetLoader');
            return;
        }

        // Clear current model
        if (this.vehicleLOD) {
            this.group.remove(this.vehicleLOD);
            this.vehicleLOD.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => m.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }

        // Load new model based on selection
        switch (modelName) {
            case 'primary':
                {
                    const primaryModel = ModelSelector.getPrimaryModel();
                    this.useGLTF = true;
                    this.modelMetadata = primaryModel;
                    await this.loadGLTFModel(primaryModel.filename);
                    this.applyMaterialFixes();
                }
                break;
            case 'starship':
                {
                    this.useGLTF = true;
                    const starshipModel = ModelSelector.getStarshipModel
                        ? ModelSelector.getStarshipModel()
                        : { name: 'Starship', filename: 'Starship_updated_binary.glb' };
                    this.modelMetadata = starshipModel;
                    await this.loadGLTFModel(starshipModel.filename);
                    this._cleanupGLTFModel();
                    // ORDER MATTERS: generic fixes first so Starship-specific
                    // overrides have final say on side/opacity/depth (the
                    // generic pass forces FrontSide which would clip Starship's
                    // thin-wall fins from one viewing angle).
                    this.applyMaterialFixes();
                    this._applyStarshipMaterials();

                    // Auto-orient + center the loaded model so its geometric
                    // centroid sits at this.group's origin and its longest axis
                    // (= nose-to-tail) aligns with local +Z.  This makes the
                    // position dot fall AT the spacecraft's visual center
                    // instead of ~28 m in front of the body, and removes the
                    // "nose pointing the wrong way" symptom that comes from
                    // the geometry being offset along an axis.
                    this._autoOrientAndCenter();
                }
                break;
            case 'backup':
            default:
                {
                    const backupModel = ModelSelector.getBackupModel();
                    this.useGLTF = true;
                    this.modelMetadata = backupModel;
                    await this.loadGLTFModel(backupModel.filename);
                    this.applyMaterialFixes();
                }
                break;
        }

        console.log(`Switched spacecraft model to: ${modelName}`);
    }

    /**
     * Get available models
     */
    static getAvailableModels() {
        return [
            { id: 'primary', name: 'Dragon Spacecraft (GLTF)', requiresAssetLoader: true },
            { id: 'starship', name: 'Starship (GLTF)', requiresAssetLoader: true },
            { id: 'backup', name: 'High-L/D System (GLTF)', requiresAssetLoader: true }
        ];
    }

    dispose() {
        this.group.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => {
                        if (m.map) m.map.dispose();
                        if (m.normalMap) m.normalMap.dispose();
                        if (m.roughnessMap) m.roughnessMap.dispose();
                        m.dispose();
                    });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    if (child.material.normalMap) child.material.normalMap.dispose();
                    if (child.material.roughnessMap) child.material.roughnessMap.dispose();
                    child.material.dispose();
                }
            }
        });
    }
}
