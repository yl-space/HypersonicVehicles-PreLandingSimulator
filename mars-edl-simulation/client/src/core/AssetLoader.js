// client/src/core/AssetLoader.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * AssetLoader - Centralized resource management
 * 
 * This class teaches several important concepts:
 * 1. Asynchronous resource loading with progress tracking
 * 2. Memory management and caching
 * 3. Error handling and fallbacks
 * 4. Different loader types for various assets
 */
export class AssetLoader {
    constructor() {
        // Cache loaded assets to avoid duplicate loading
        this.cache = new Map();
        
        // Track loading progress
        this.loadingManager = new THREE.LoadingManager();
        
        // Configure loading manager callbacks
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`Started loading: ${url}`);
            this.onLoadStart?.(url, itemsLoaded, itemsTotal);
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            console.log(`Loading progress: ${progress.toFixed(2)}%`);
            this.onLoadProgress?.(url, itemsLoaded, itemsTotal);
        };
        
        this.loadingManager.onLoad = () => {
            console.log('All assets loaded');
            this.onLoadComplete?.();
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`Error loading: ${url}`);
            this.onLoadError?.(url);
        };
        
        // Initialize different loaders
        this.initializeLoaders();
    }
    
    initializeLoaders() {
        // Texture loader for images
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        
        // GLTF loader for 3D models
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        
        // Initialize Draco loader for compressed geometry
        // Draco significantly reduces file size for complex models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/libs/draco/'); // Path to Draco decoder
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        // Cube texture loader for environment maps
        this.cubeTextureLoader = new THREE.CubeTextureLoader(this.loadingManager);
        
        // Audio loader for sound effects
        this.audioLoader = new THREE.AudioLoader(this.loadingManager);
    }
    
    /**
     * Load an asset with caching and error handling
     * @param {Object} assetConfig - Configuration object for the asset
     * @returns {Promise} Resolves with the loaded asset
     */
    async load(assetConfig) {
        const { type, name, url, options = {} } = assetConfig;
        
        // Check cache first
        const cacheKey = `${type}:${name}`;
        if (this.cache.has(cacheKey)) {
            console.log(`Returning cached asset: ${name}`);
            return this.cache.get(cacheKey);
        }
        
        try {
            let asset;
            
            switch (type) {
                case 'texture':
                    asset = await this.loadTexture(url, options);
                    break;
                    
                case 'model':
                    asset = await this.loadModel(url, options);
                    break;
                    
                case 'cubeTexture':
                    asset = await this.loadCubeTexture(url, options);
                    break;
                    
                case 'audio':
                    asset = await this.loadAudio(url, options);
                    break;
                    
                default:
                    throw new Error(`Unknown asset type: ${type}`);
            }
            
            // Cache the loaded asset
            this.cache.set(cacheKey, asset);
            
            return asset;
            
        } catch (error) {
            console.error(`Failed to load ${name}:`, error);
            
            // Return fallback asset if available
            if (options.fallback) {
                console.warn(`Using fallback for ${name}`);
                return this.createFallbackAsset(type, options.fallback);
            }
            
            throw error;
        }
    }
    
    /**
     * Load a texture with proper configuration
     * Teaching point: Texture optimization is crucial for performance
     */
    async loadTexture(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // Configure texture properties
                    texture.wrapS = options.wrapS || THREE.RepeatWrapping;
                    texture.wrapT = options.wrapT || THREE.RepeatWrapping;
                    
                    // Anisotropic filtering improves texture quality at angles
                    // Higher values = better quality but more GPU cost
                    texture.anisotropy = options.anisotropy || 16;
                    
                    // Set texture filtering
                    texture.minFilter = options.minFilter || THREE.LinearMipMapLinearFilter;
                    texture.magFilter = options.magFilter || THREE.LinearFilter;
                    
                    // Color space configuration
                    if (options.encoding) {
                        texture.encoding = options.encoding;
                    }
                    
                    // Generate mipmaps for better performance
                    texture.generateMipmaps = options.generateMipmaps !== false;
                    
                    resolve(texture);
                },
                undefined, // Progress callback handled by LoadingManager
                reject
            );
        });
    }
    
    /**
     * Load a 3D model (GLTF/GLB format)
     * Teaching point: GLTF is the "JPEG of 3D" - efficient and feature-rich
     */
    async loadModel(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                url,
                (gltf) => {
                    // Process the loaded model
                    const model = gltf.scene;
                    
                    // Apply shadows to all meshes if specified
                    if (options.castShadow || options.receiveShadow) {
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = options.castShadow || false;
                                child.receiveShadow = options.receiveShadow || false;
                            }
                        });
                    }
                    
                    // Store animations if present
                    if (gltf.animations && gltf.animations.length > 0) {
                        model.animations = gltf.animations;
                    }
                    
                    // Apply custom material if specified
                    if (options.materialOverride) {
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.material = options.materialOverride.clone();
                            }
                        });
                    }
                    
                    resolve(model);
                },
                // Progress callback
                (xhr) => {
                    const percentComplete = (xhr.loaded / xhr.total) * 100;
                    console.log(`Model ${url} ${percentComplete.toFixed(2)}% loaded`);
                },
                reject
            );
        });
    }
    
    /**
     * Load a cube texture for environment mapping
     * Teaching point: Cube maps create realistic reflections and skyboxes
     */
    async loadCubeTexture(urls, options = {}) {
        return new Promise((resolve, reject) => {
            this.cubeTextureLoader.load(
                urls, // Array of 6 URLs [+X, -X, +Y, -Y, +Z, -Z]
                (cubeTexture) => {
                    if (options.encoding) {
                        cubeTexture.encoding = options.encoding;
                    }
                    resolve(cubeTexture);
                },
                undefined,
                reject
            );
        });
    }
    
    /**
     * Load audio for sound effects
     */
    async loadAudio(url, options = {}) {
        return new Promise((resolve, reject) => {
            this.audioLoader.load(
                url,
                (audioBuffer) => {
                    resolve(audioBuffer);
                },
                undefined,
                reject
            );
        });
    }
    
    /**
     * Create fallback assets when loading fails
     * Teaching point: Always have graceful degradation
     */
    createFallbackAsset(type, fallbackOptions) {
        switch (type) {
            case 'texture':
                // Create a simple colored texture as fallback
                const canvas = document.createElement('canvas');
                canvas.width = 256;
                canvas.height = 256;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = fallbackOptions.color || '#808080';
                ctx.fillRect(0, 0, 256, 256);
                return new THREE.CanvasTexture(canvas);
                
            case 'model':
                // Create a simple box as fallback geometry
                const geometry = new THREE.BoxGeometry(1, 1, 1);
                const material = new THREE.MeshStandardMaterial({
                    color: fallbackOptions.color || 0x808080
                });
                return new THREE.Mesh(geometry, material);
                
            default:
                return null;
        }
    }
    
    /**
     * Preload multiple assets with progress tracking
     */
    async preloadAssets(assetList) {
        const total = assetList.length;
        let loaded = 0;
        
        const results = {};
        
        for (const asset of assetList) {
            try {
                results[asset.name] = await this.load(asset);
                loaded++;
                
                // Emit progress event
                const progress = (loaded / total) * 100;
                this.onPreloadProgress?.(progress, loaded, total);
                
            } catch (error) {
                console.error(`Failed to preload ${asset.name}:`, error);
                results[asset.name] = null;
            }
        }
        
        return results;
    }
    
    /**
     * Dispose of cached assets to free memory
     * Teaching point: Memory management is crucial in 3D applications
     */
    dispose() {
        this.cache.forEach((asset, key) => {
            if (asset.dispose) {
                asset.dispose();
            } else if (asset.traverse) {
                // For models, traverse and dispose all geometries and materials
                asset.traverse((child) => {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(mat => mat.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                });
            }
        });
        
        this.cache.clear();
    }
    
    /**
     * Get memory usage statistics
     * Useful for monitoring performance
     */
    getMemoryStats() {
        const stats = {
            textureCount: 0,
            textureMemory: 0,
            geometryCount: 0,
            geometryMemory: 0
        };
        
        this.cache.forEach((asset) => {
            if (asset.isTexture) {
                stats.textureCount++;
                // Estimate texture memory (width * height * 4 bytes per pixel)
                if (asset.image) {
                    stats.textureMemory += asset.image.width * asset.image.height * 4;
                }
            } else if (asset.isBufferGeometry) {
                stats.geometryCount++;
                // Calculate geometry memory from attributes
                for (const attribute of Object.values(asset.attributes)) {
                    stats.geometryMemory += attribute.array.byteLength;
                }
            }
        });
        
        return stats;
    }
}

// Usage example:
/*
const assetLoader = new AssetLoader();

// Set up callbacks
assetLoader.onLoadProgress = (url, loaded, total) => {
    updateProgressBar(loaded / total);
};

// Load assets
const assets = await assetLoader.preloadAssets([
    {
        type: 'model',
        name: 'rover',
        url: '/assets/models/rover.glb',
        options: { castShadow: true, receiveShadow: true }
    },
    {
        type: 'texture',
        name: 'marsTexture',
        url: '/assets/textures/mars_surface.jpg',
        options: { anisotropy: 16 }
    }
]);
*/