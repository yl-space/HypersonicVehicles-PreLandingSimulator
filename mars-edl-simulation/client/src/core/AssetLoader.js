/**
 * AssetLoader.js
 * Handles loading and caching of 3D models, textures, and other assets
 */

import * as THREE from 'three';

export class AssetLoader {
    constructor() {
        this.loadingManager = new THREE.LoadingManager();
        this.textureLoader = new THREE.TextureLoader(this.loadingManager);
        this.cache = new Map();
        this.loadingProgress = new Map();
        
        // Asset paths
        this.basePath = '/assets/';
        this.texturePath = this.basePath + 'textures/';
        this.modelPath = this.basePath + 'models/';
        
        // Setup loading manager callbacks
        this.setupLoadingManager();
    }
    
    setupLoadingManager() {
        this.loadingManager.onStart = (url, itemsLoaded, itemsTotal) => {
            console.log(`Started loading: ${url}`);
            this.onLoadStart?.(url, itemsLoaded, itemsTotal);
        };
        
        this.loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
            const progress = (itemsLoaded / itemsTotal) * 100;
            this.loadingProgress.set(url, progress);
            console.log(`Loading progress: ${url} - ${progress.toFixed(0)}%`);
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
    }
    
    /**
     * Load texture with caching
     */
    async loadTexture(filename, options = {}) {
        const cacheKey = `texture_${filename}`;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const path = this.texturePath + filename;
        
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                path,
                (texture) => {
                    // Apply texture settings
                    if (options.wrapS) texture.wrapS = options.wrapS;
                    if (options.wrapT) texture.wrapT = options.wrapT;
                    if (options.repeat) texture.repeat.set(options.repeat.x, options.repeat.y);
                    if (options.anisotropy) texture.anisotropy = options.anisotropy;
                    if (options.encoding) texture.encoding = options.encoding;
                    
                    // Cache texture
                    this.cache.set(cacheKey, texture);
                    resolve(texture);
                },
                (progress) => {
                    // Progress callback
                    const percent = (progress.loaded / progress.total) * 100;
                    console.log(`Loading ${filename}: ${percent.toFixed(0)}%`);
                },
                (error) => {
                    console.error(`Failed to load texture ${filename}:`, error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Load multiple textures
     */
    async loadTextures(textureList) {
        const promises = textureList.map(item => {
            if (typeof item === 'string') {
                return this.loadTexture(item);
            } else {
                return this.loadTexture(item.filename, item.options);
            }
        });
        
        return Promise.all(promises);
    }
    
    /**
     * Create procedural Mars texture
     */
    createMarsTexture(size = 2048) {
        const cacheKey = 'texture_mars_procedural';
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size / 2;
        const ctx = canvas.getContext('2d');
        
        // Base gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#D2691E');
        gradient.addColorStop(0.3, '#CD853F');
        gradient.addColorStop(0.5, '#B87333');
        gradient.addColorStop(0.7, '#A0522D');
        gradient.addColorStop(1, '#8B4513');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add surface features
        this.addMarsFeatures(ctx, canvas.width, canvas.height);
        
        // Create texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        this.cache.set(cacheKey, texture);
        return texture;
    }
    
    addMarsFeatures(ctx, width, height) {
        // Add craters
        for (let i = 0; i < 200; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;
            const radius = Math.random() * 30 + 5;
            
            const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
            gradient.addColorStop(0, 'rgba(139, 69, 19, 0.4)');
            gradient.addColorStop(0.7, 'rgba(160, 82, 45, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Add polar ice caps
        const iceGradient = ctx.createLinearGradient(0, 0, 0, 100);
        iceGradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        iceGradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = iceGradient;
        ctx.fillRect(0, 0, width, 100);
        
        const southIceGradient = ctx.createLinearGradient(0, height - 100, 0, height);
        southIceGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
        southIceGradient.addColorStop(1, 'rgba(255, 255, 255, 0.6)');
        
        ctx.fillStyle = southIceGradient;
        ctx.fillRect(0, height - 100, width, 100);
        
        // Add some noise for texture
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20;
            data[i] += noise;     // Red
            data[i + 1] += noise; // Green
            data[i + 2] += noise; // Blue
        }
        
        ctx.putImageData(imageData, 0, 0);
    }
    
    /**
     * Create heat shield texture
     */
    createHeatShieldTexture(size = 512) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        // Base color
        ctx.fillStyle = '#cccccc';
        ctx.fillRect(0, 0, size, size);
        
        // Tile pattern
        const tileSize = size / 16;
        ctx.strokeStyle = '#999999';
        ctx.lineWidth = 2;
        
        for (let x = 0; x < size; x += tileSize) {
            for (let y = 0; y < size; y += tileSize) {
                ctx.strokeRect(x, y, tileSize, tileSize);
                
                // Add some variation
                if (Math.random() > 0.7) {
                    ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.1})`;
                    ctx.fillRect(x, y, tileSize, tileSize);
                }
            }
        }
        
        // Add wear and tear
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = Math.random() * 10 + 2;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${Math.random() * 0.2})`;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    /**
     * Create environment map
     */
    createEnvironmentMap() {
        const cacheKey = 'envmap_mars';
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        // Create cube render target for environment mapping
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256, {
            format: THREE.RGBFormat,
            generateMipmaps: true,
            minFilter: THREE.LinearMipmapLinearFilter
        });
        
        // Create scene for rendering environment
        const envScene = new THREE.Scene();
        
        // Add gradient sky
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a0a) },
                bottomColor: { value: new THREE.Color(0x220000) },
                offset: { value: 50 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(h, exponent), 0.0)), 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        const sky = new THREE.Mesh(skyGeometry, skyMaterial);
        envScene.add(sky);
        
        this.cache.set(cacheKey, cubeRenderTarget.texture);
        return cubeRenderTarget.texture;
    }
    
    /**
     * Load CubeTexture for skybox
     */
    async loadCubeTexture(paths) {
        const cacheKey = `cubetexture_${paths.join('_')}`;
        
        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }
        
        return new Promise((resolve, reject) => {
            const loader = new THREE.CubeTextureLoader(this.loadingManager);
            loader.setPath(this.texturePath);
            
            loader.load(
                paths,
                (texture) => {
                    this.cache.set(cacheKey, texture);
                    resolve(texture);
                },
                (progress) => {
                    console.log('Loading cube texture...', progress);
                },
                (error) => {
                    console.error('Failed to load cube texture:', error);
                    reject(error);
                }
            );
        });
    }
    
    /**
     * Preload all essential assets
     */
    async preloadAssets() {
        const assets = {
            textures: [],
            models: [],
            sounds: []
        };
        
        // Preload textures
        const texturePromises = [
            this.createMarsTexture(),
            this.createHeatShieldTexture(),
            this.createEnvironmentMap()
        ];
        
        try {
            await Promise.all(texturePromises);
            console.log('All assets preloaded successfully');
            return true;
        } catch (error) {
            console.error('Error preloading assets:', error);
            return false;
        }
    }
    
    /**
     * Get loading progress
     */
    getLoadingProgress() {
        if (this.loadingProgress.size === 0) return 100;
        
        let totalProgress = 0;
        this.loadingProgress.forEach(progress => {
            totalProgress += progress;
        });
        
        return totalProgress / this.loadingProgress.size;
    }
    
    /**
     * Clear cache
     */
    clearCache() {
        // Dispose of all cached textures
        this.cache.forEach((asset, key) => {
            if (asset.dispose) {
                asset.dispose();
            }
        });
        
        this.cache.clear();
        this.loadingProgress.clear();
    }
    
    /**
     * Set loading callbacks
     */
    setCallbacks(callbacks) {
        if (callbacks.onStart) this.onLoadStart = callbacks.onStart;
        if (callbacks.onProgress) this.onLoadProgress = callbacks.onProgress;
        if (callbacks.onComplete) this.onLoadComplete = callbacks.onComplete;
        if (callbacks.onError) this.onLoadError = callbacks.onError;
    }
}