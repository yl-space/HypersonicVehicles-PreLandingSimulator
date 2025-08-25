/**
 * Simple test module to debug import issues
 */

console.log('Test module loading...');

// Test Three.js import
import * as THREE from '/node_modules/three/build/three.module.js';
console.log('Three.js imported successfully:', THREE.REVISION);

// Test if this module exports properly
export function testFunction() {
    console.log('Test function called');
    return 'Test successful';
}

console.log('Test module loaded successfully');
