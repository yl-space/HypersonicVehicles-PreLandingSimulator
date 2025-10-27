/**
 * ModelMetadata.js
 * Centralized configuration for 3D model axis information and transformations
 * As suggested by Weaver G - separate record for each file with axis information and center points
 */

import * as THREE from 'three';

/**
 * Model metadata configuration
 * Each entry contains:
 * - name: Display name
 * - filename: Model file name
 * - originalAxes: Original coordinate system of the model
 * - simulationAxes: Target coordinate system for simulation (J2000)
 * - transformations: Required transformations to align model with simulation
 * - centerOffset: Offset to apply after centering the model
 * - scale: Scale factor for visualization
 * - notes: Any special notes about the model
 */
export const ModelMetadata = {
    // Primary spacecraft model
    dragonConverted: {
        name: 'Dragon Spacecraft (Primary)',
        filename: 'dragon_converted/dragon/dragon.gltf',
        originalAxes: {
            forward: '+X',  // Direction the spacecraft points
            up: '+Z',       // Top of the spacecraft
            right: '-Y',    // Right side of the spacecraft
            notes: 'SOLIDWORKS export default orientation'
        },
        simulationAxes: {
            forward: '+X',  // Velocity direction in J2000
            up: '+Z',       // North pole in J2000
            right: '+Y',    // Right-hand coordinate system
            notes: 'J2000 inertial reference frame'
        },
        transformations: {
            // Rotation to align model axes with simulation axes
            rotation: {
                x: -90,  // Degrees - rotate around X axis
                y: 0,    // Degrees - rotate around Y axis
                z: 0,    // Degrees - rotate around Z axis
                order: 'XYZ'
            },
            // Scale factor (uniform or per-axis)
            scale: 0.001,  // 1:1000 scale for visualization
            // Position offset after centering
            position: { x: 0, y: 0, z: 0 }
        },
        centerOffset: { x: 0, y: 0, z: 0 },  // Offset from geometric center
        visualScale: {
            // Different scales for different view distances
            near: 0.001,   // Close-up view
            medium: 0.0005, // Medium distance
            far: 0.0002     // Far distance
        },
        materials: {
            heatShieldColor: '#cccccc',
            bodyColor: '#f0f0f0',
            metallic: 0.7,
            roughness: 0.3
        },
        notes: 'Primary model from SOLIDWORKS, includes detailed geometry',
        trademarks: 'Check for SpaceX logos - may need removal',
        source: 'SOLIDWORKS conversion by Oleksii'
    },

    // Backup/alternative spacecraft model
    genericDragonLike: {
        name: 'Generic RV Dragon-like (Backup)',
        filename: 'generic_RV_dragon_like/generic_RV_dragon_like/generic_RV_dragon_like.gltf',
        originalAxes: {
            forward: '+Z',  // Model's forward direction
            up: '+Y',       // Model's up direction
            right: '+X',    // Model's right direction
            notes: 'Generic model orientation'
        },
        simulationAxes: {
            forward: '+X',  // Velocity direction
            up: '+Z',       // North pole
            right: '+Y',    // Right-hand system
            notes: 'J2000 reference frame'
        },
        transformations: {
            rotation: {
                x: 0,    // May need adjustment after testing
                y: 90,   // Rotate to align forward axes
                z: 0,
                order: 'YXZ'
            },
            scale: 0.001,
            position: { x: 0, y: 0, z: 0 }
        },
        centerOffset: { x: 0, y: 0, z: 0 },
        visualScale: {
            near: 0.001,
            medium: 0.0005,
            far: 0.0002
        },
        materials: {
            heatShieldColor: '#bbbbbb',
            bodyColor: '#e8e8e8',
            metallic: 0.6,
            roughness: 0.4
        },
        notes: 'Backup model, simpler geometry, open source friendly',
        trademarks: 'Generic model, no trademark concerns',
        source: 'SOLIDWORKS conversion by Oleksii'
    },

    // Simple cone model (current/fallback)
    simpleCone: {
        name: 'Simple Cone Model (Fallback)',
        filename: null,  // Procedurally generated
        originalAxes: {
            forward: '+Y',  // Cone points along Y
            up: '+Z',
            right: '+X',
            notes: 'Three.js ConeGeometry default'
        },
        simulationAxes: {
            forward: '+X',
            up: '+Z',
            right: '+Y',
            notes: 'J2000 reference frame'
        },
        transformations: {
            rotation: {
                x: 0,
                y: 0,
                z: -90,  // Rotate cone to point forward
                order: 'XYZ'
            },
            scale: 0.01,  // 10m diameter at 100km scale
            position: { x: 0, y: 0, z: 0 }
        },
        centerOffset: { x: 0, y: 0, z: 0 },
        visualScale: {
            near: 0.01,
            medium: 0.01,
            far: 0.01
        },
        materials: {
            heatShieldColor: '#ff6600',
            bodyColor: '#cccccc',
            metallic: 0.5,
            roughness: 0.5
        },
        notes: 'Current implementation, procedural geometry',
        trademarks: 'None - procedural geometry',
        source: 'Three.js primitive'
    }
};

/**
 * Helper class for model transformations
 */
export class ModelTransformHelper {
    /**
     * Apply transformations from metadata to a Three.js object
     */
    static applyTransformations(object, metadata) {
        const { transformations } = metadata;

        if (!transformations) return;

        // Apply rotation
        if (transformations.rotation) {
            const { x, y, z, order } = transformations.rotation;
            object.rotation.set(
                THREE.MathUtils.degToRad(x || 0),
                THREE.MathUtils.degToRad(y || 0),
                THREE.MathUtils.degToRad(z || 0)
            );
            if (order) {
                object.rotation.order = order;
            }
        }

        // Apply scale
        if (transformations.scale) {
            if (typeof transformations.scale === 'number') {
                object.scale.setScalar(transformations.scale);
            } else {
                object.scale.set(
                    transformations.scale.x || 1,
                    transformations.scale.y || 1,
                    transformations.scale.z || 1
                );
            }
        }

        // Apply position
        if (transformations.position) {
            object.position.set(
                transformations.position.x || 0,
                transformations.position.y || 0,
                transformations.position.z || 0
            );
        }
    }

    /**
     * Calculate and apply center offset
     */
    static centerModel(object, metadata) {
        const bbox = new THREE.Box3().setFromObject(object);
        const center = bbox.getCenter(new THREE.Vector3());

        // Move object to center
        object.position.sub(center);

        // Apply custom center offset if specified
        if (metadata.centerOffset) {
            object.position.add(new THREE.Vector3(
                metadata.centerOffset.x || 0,
                metadata.centerOffset.y || 0,
                metadata.centerOffset.z || 0
            ));
        }

        return {
            originalCenter: center,
            boundingBox: bbox,
            size: bbox.getSize(new THREE.Vector3())
        };
    }

    /**
     * Create axis helper for debugging
     */
    static createAxisHelper(metadata, size = 1) {
        const group = new THREE.Group();

        // Original axes (red, green, blue)
        const originalAxes = new THREE.AxesHelper(size);
        originalAxes.name = 'OriginalAxes';
        group.add(originalAxes);

        // Add labels if needed
        if (metadata.originalAxes) {
            // Could add text sprites here for axis labels
        }

        return group;
    }

    /**
     * Convert between coordinate systems
     */
    static convertCoordinates(vector, fromAxes, toAxes) {
        // Implementation for coordinate system conversion
        // This would handle the conversion between different axis conventions
        const result = vector.clone();

        // Example: if forward axis is different
        if (fromAxes.forward !== toAxes.forward) {
            // Apply necessary transformation
            // This is simplified - actual implementation would be more complex
        }

        return result;
    }

    /**
     * Get transformation matrix from metadata
     */
    static getTransformationMatrix(metadata) {
        const matrix = new THREE.Matrix4();
        const { transformations } = metadata;

        if (!transformations) return matrix;

        // Create transformation components
        const position = new THREE.Vector3(
            transformations.position?.x || 0,
            transformations.position?.y || 0,
            transformations.position?.z || 0
        );

        const rotation = new THREE.Euler(
            THREE.MathUtils.degToRad(transformations.rotation?.x || 0),
            THREE.MathUtils.degToRad(transformations.rotation?.y || 0),
            THREE.MathUtils.degToRad(transformations.rotation?.z || 0),
            transformations.rotation?.order || 'XYZ'
        );

        const quaternion = new THREE.Quaternion().setFromEuler(rotation);

        const scale = new THREE.Vector3(
            transformations.scale?.x || transformations.scale || 1,
            transformations.scale?.y || transformations.scale || 1,
            transformations.scale?.z || transformations.scale || 1
        );

        // Compose transformation matrix
        matrix.compose(position, quaternion, scale);

        return matrix;
    }
}

/**
 * Model selection helper
 */
export class ModelSelector {
    static getModelByName(name) {
        return Object.values(ModelMetadata).find(model => model.name === name);
    }

    static getModelByFilename(filename) {
        return Object.values(ModelMetadata).find(model => model.filename === filename);
    }

    static getPrimaryModel() {
        return ModelMetadata.dragonConverted;
    }

    static getBackupModel() {
        return ModelMetadata.genericDragonLike;
    }

    static getFallbackModel() {
        return ModelMetadata.simpleCone;
    }

    static getAllModels() {
        return Object.values(ModelMetadata);
    }
}

export default ModelMetadata;