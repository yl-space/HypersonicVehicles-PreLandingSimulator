/**
 * AssetLoader.js - Asset loading and management
 */

import * as THREE from 'three';

export class AssetLoader {
    constructor() {
        this.textureLoader = new THREE.TextureLoader();
        this.loadingManager = new THREE.LoadingManager();
        this.loadedAssets = new Map();
        
        this.setupLoadingManager();
    }
    
    setupLoadingManager() {
        this.loadingManager.onLoad = () => {
            console.log('All assets loaded');
        };
        
        this.loadingManager.onProgress = (url, loaded, total) => {
            const progress = (loaded / total) * 100;
            this.updateLoadingProgress(progress, `Loading ${url.split('/').pop()}`);
        };
        
        this.loadingManager.onError = (url) => {
            console.error(`Failed to load: ${url}`);
        };
    }
    
    updateLoadingProgress(progress, message) {
        const progressBar = document.getElementById('loading-progress');
        const loadingText = document.getElementById('loading-text');
        
        if (progressBar) {
            progressBar.style.width = `${progress}%`;
        }
        
        if (loadingText) {
            loadingText.textContent = message;
        }
    }
    
    async loadTexture(url, options = {}) {
        const cacheKey = `texture_${url}`;
        
        if (this.loadedAssets.has(cacheKey)) {
            return this.loadedAssets.get(cacheKey);
        }
        
        return new Promise((resolve, reject) => {
            this.textureLoader.load(
                url,
                (texture) => {
                    // Apply options
                    if (options.wrapS) texture.wrapS = options.wrapS;
                    if (options.wrapT) texture.wrapT = options.wrapT;
                    if (options.repeat) texture.repeat.set(options.repeat.x, options.repeat.y);
                    if (options.flipY !== undefined) texture.flipY = options.flipY;
                    
                    this.loadedAssets.set(cacheKey, texture);
                    resolve(texture);
                },
                undefined,
                reject
            );
        });
    }
    
    createMarsTexture() {
        // Create procedural Mars texture if image not available
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Base Mars color
        const gradient = ctx.createLinearGradient(0, 0, 0, 512);
        gradient.addColorStop(0, '#CD5C5C');
        gradient.addColorStop(0.5, '#A0522D');
        gradient.addColorStop(1, '#8B4513');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 1024, 512);
        
        // Add noise for surface details
        const imageData = ctx.getImageData(0, 0, 1024, 512);
        const data = imageData.data;
        
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 30;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }
    
    createStarField() {
        const canvas = document.createElement('canvas');
        canvas.width = 2048;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 2048, 1024);
        
        // Generate stars
        for (let i = 0; i < 3000; i++) {
            const x = Math.random() * 2048;
            const y = Math.random() * 1024;
            const brightness = Math.random();
            const size = Math.random() * 2 + 0.5;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${brightness})`;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createParticleTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
        gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(0.4, 'rgba(255, 255, 255, 0.4)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        
        return new THREE.CanvasTexture(canvas);
    }
    
    createHeatShieldTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        
        // Create heat shield pattern
        const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
        gradient.addColorStop(0, '#FF4500');
        gradient.addColorStop(0.5, '#FF6347');
        gradient.addColorStop(1, '#8B0000');
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 512, 512);
        
        // Add hexagonal pattern
        for (let x = 0; x < 512; x += 40) {
            for (let y = 0; y < 512; y += 40) {
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 2;
                this.drawHexagon(ctx, x + 20, y + 20, 15);
            }
        }
        
        return new THREE.CanvasTexture(canvas);
    }
    
    drawHexagon(ctx, x, y, radius) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const px = x + radius * Math.cos(angle);
            const py = y + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.stroke();
    }
    
    async loadDefaultAssets() {
        try {
            // Load default textures
            const marsTexture = this.createMarsTexture();
            const starTexture = this.createStarField();
            const particleTexture = this.createParticleTexture();
            const heatShieldTexture = this.createHeatShieldTexture();
            
            this.loadedAssets.set('mars_surface', marsTexture);
            this.loadedAssets.set('star_field', starTexture);
            this.loadedAssets.set('particle', particleTexture);
            this.loadedAssets.set('heat_shield', heatShieldTexture);
            
            return true;
        } catch (error) {
            console.error('Failed to load default assets:', error);
            return false;
        }
    }
    
    getAsset(key) {
        return this.loadedAssets.get(key);
    }
    
    dispose() {
        this.loadedAssets.forEach(asset => {
            if (asset.dispose) {
                asset.dispose();
            }
        });
        this.loadedAssets.clear();
    }
}