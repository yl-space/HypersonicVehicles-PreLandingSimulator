/**
 * AssetLoader.js
 * Handles loading of models, textures, and other assets
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

export class AssetLoader {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.gltfLoader = new GLTFLoader(this.loadingManager);
        
        // Setup Draco loader for compressed models
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://www.gstatic.com/draco/v1/decoders/');
        this.gltfLoader.setDRACOLoader(dracoLoader);
        
        // Cache for loaded assets
        this.cache = new Map();
        
        // Loading progress tracking
        this.totalItems = 0;
        this.loadedItems = 0;
        
        this.setupLoadingManager();
    }
    
    setupLoadingManager() {
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            this.totalItems = itemsTotal;
            this.loadedItems = itemsLoaded;
            console.log(`Started loading: ${url}`);
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            this.loadedItems = itemsLoaded;
            const progress = (itemsLoaded / itemsTotal) * 100;
            
            window.dispatchEvent(new CustomEvent('asset-loading-progress', {
                detail: { progress, loaded: itemsLoaded, total: itemsTotal }
            }));
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`Error loading: ${url}`);
            window.dispatchEvent(new CustomEvent('asset-loading-error', {
                detail: { url }
            }));
        };
        
        this.loadingManager.onLoad = () => {
            console.log('All assets loaded');
            window.dispatchEvent(new CustomEvent('assets-loaded'));
        };
    }
    
    async loadTexture(path, options = {}) {
        // Check cache
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }
        
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    // Apply options
                    if (options.repeat) {
                        texture.wrapS = THREE.RepeatWrapping;
                        texture.wrapT = THREE.RepeatWrapping;
                        texture.repeat.set(options.repeat[0], options.repeat[1]);
                    }
                    
                    if (options.encoding) {
                        texture.encoding = options.encoding;
                    }
                    
                    if (options.generateMipmaps !== undefined) {
                        texture.generateMipmaps = options.generateMipmaps;
                    }
                    
                    // Cache the texture
                    this.cache.set(path, texture);
                    resolve(texture);
                },
                (progress) => {
                    // Progress callback
                },
                (error) => {
                    console.error(`Failed to load texture: ${path}`, error);
                    reject(error);
                }
            );
        });
    }
    
    async loadModel(path, options = {}) {
        // Check cache
        if (this.cache.has(path)) {
            return this.cache.get(path).clone();
        }
        
        return new Promise((resolve, reject) => {
            this.gltfLoader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    
                    // Apply options
                    if (options.scale) {
                        model.scale.set(options.scale, options.scale, options.scale);
                    }
                    
                    if (options.castShadow) {
                        model.traverse((child) => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                    }
                    
                    // Store animations if present
                    if (gltf.animations && gltf.animations.length > 0) {
                        model.userData.animations = gltf.animations;
                        model.userData.mixer = new THREE.AnimationMixer(model);
                    }
                    
                    // Cache the model
                    this.cache.set(path, model);
                    resolve(model.clone());
                },
                (progress) => {
                    // Progress callback
                },
                (error) => {
                    console.error(`Failed to load model: ${path}`, error);
                    reject(error);
                }
            );
        });
    }
    
    async loadCubeTexture(paths) {
        const key = paths.join(',');
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        return new Promise((resolve, reject) => {
            const loader = new THREE.CubeTextureLoader(this.loadingManager);
            loader.load(
                paths,
                (texture) => {
                    this.cache.set(key, texture);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error('Failed to load cube texture', error);
                    reject(error);
                }
            );
        });
    }
    
    async loadHDRI(path) {
        // For HDR environment maps
        if (this.cache.has(path)) {
            return this.cache.get(path);
        }
        
        const { RGBELoader } = await import('three/addons/loaders/RGBELoader.js');
        const loader = new RGBELoader(this.loadingManager);
        
        return new Promise((resolve, reject) => {
            loader.load(
                path,
                (texture) => {
                    texture.mapping = THREE.EquirectangularReflectionMapping;
                    this.cache.set(path, texture);
                    resolve(texture);
                },
                undefined,
                (error) => {
                    console.error(`Failed to load HDRI: ${path}`, error);
                    reject(error);
                }
            );
        });
    }
    
    // Preload common assets
    async preloadAssets() {
        const assetsToLoad = [
            // Textures
            { type: 'texture', path: '/assets/textures/mars_surface.jpg' },
            { type: 'texture', path: '/assets/textures/stars_milkyway.jpg' },
            { type: 'texture', path: '/assets/textures/heat_gradient.png' },
            
            // Models (if you have them)
            // { type: 'model', path: '/assets/models/msl_aeroshell.glb' },
            // { type: 'model', path: '/assets/models/parachute.glb' }
        ];
        
        const promises = assetsToLoad.map(async (asset) => {
            try {
                switch (asset.type) {
                    case 'texture':
                        await this.loadTexture(asset.path, asset.options);
                        break;
                    case 'model':
                        await this.loadModel(asset.path, asset.options);
                        break;
                }
            } catch (error) {
                console.warn(`Failed to preload ${asset.path}, using fallback`);
            }
        });
        
        await Promise.all(promises);
    }
    
    // Create placeholder textures for missing assets
    createPlaceholderTexture(type = 'default') {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        switch (type) {
            case 'mars':
                // Mars surface placeholder
                const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
                gradient.addColorStop(0, '#CD853F');
                gradient.addColorStop(0.5, '#D2691E');
                gradient.addColorStop(1, '#8B4513');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, 512, 512);
                break;
                
            case 'stars':
                // Starfield placeholder
                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, 512, 512);
                ctx.fillStyle = '#FFFFFF';
                for (let i = 0; i < 100; i++) {
                    const x = Math.random() * 512;
                    const y = Math.random() * 512;
                    const size = Math.random() * 2;
                    ctx.beginPath();
                    ctx.arc(x, y, size, 0, Math.PI * 2);
                    ctx.fill();
                }
                break;
                
            default:
                // Checkerboard pattern
                const size = 64;
                for (let y = 0; y < 8; y++) {
                    for (let x = 0; x < 8; x++) {
                        ctx.fillStyle = (x + y) % 2 === 0 ? '#808080' : '#404040';
                        ctx.fillRect(x * size, y * size, size, size);
                    }
                }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        return texture;
    }
    
    // Get loading progress
    getLoadingProgress() {
        if (this.totalItems === 0) return 1;
        return this.loadedItems / this.totalItems;
    }
    
    // Clear cache
    clearCache() {
        this.cache.forEach((asset, key) => {
            if (asset.dispose) {
                asset.dispose();
            }
        });
        this.cache.clear();
    }
    
    // Dispose of all resources
    dispose() {
        this.clearCache();
        
        if (this.gltfLoader.dracoLoader) {
            this.gltfLoader.dracoLoader.dispose();
        }
    }
}

export default AssetLoader;