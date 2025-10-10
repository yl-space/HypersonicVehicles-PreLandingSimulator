// Centralized Three.js import
// Using CDN version to avoid multiple local imports

export * from 'https://unpkg.com/three@0.170.0/build/three.module.js';
export * as THREE from 'https://unpkg.com/three@0.170.0/build/three.module.js';

// Re-export for convenience
import * as THREE_MODULE from 'https://unpkg.com/three@0.170.0/build/three.module.js';
export default THREE_MODULE;