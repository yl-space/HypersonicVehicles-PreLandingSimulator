// Test script to simulate browser loading sequence
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';

const BASE_URL = 'http://localhost:3001';

async function testLoadSequence() {
    console.log('Testing application load sequence...\n');

    // Step 1: Load index.html
    console.log('1. Loading index.html...');
    try {
        const indexResponse = await fetch(`${BASE_URL}/`);
        const indexHtml = await indexResponse.text();
        console.log('   ✓ index.html loaded successfully');

        // Check for main.js script tag
        if (indexHtml.includes('src="/src/main.js"')) {
            console.log('   ✓ main.js script tag found');
        } else {
            console.log('   ✗ main.js script tag not found');
        }
    } catch (error) {
        console.log('   ✗ Failed to load index.html:', error.message);
    }

    // Step 2: Load main.js
    console.log('\n2. Loading main.js...');
    try {
        const mainResponse = await fetch(`${BASE_URL}/src/main.js`);
        const mainJs = await mainResponse.text();
        console.log('   ✓ main.js loaded successfully');

        // Check for SimulationManager import
        if (mainJs.includes('SimulationManager')) {
            console.log('   ✓ SimulationManager import found');
        }
    } catch (error) {
        console.log('   ✗ Failed to load main.js:', error.message);
    }

    // Step 3: Load SimulationManager
    console.log('\n3. Loading SimulationManager.js...');
    try {
        const simManagerResponse = await fetch(`${BASE_URL}/src/simulation/SimulationManager.js`);
        const simManagerJs = await simManagerResponse.text();
        console.log('   ✓ SimulationManager.js loaded successfully');

        // Check for Three.js import
        if (simManagerJs.includes('/node_modules/three/build/three.module.js')) {
            console.log('   ✓ Three.js import path found');
        }

        // Check for TrajectoryService import
        if (simManagerJs.includes('TrajectoryService')) {
            console.log('   ✓ TrajectoryService import found');
        }
    } catch (error) {
        console.log('   ✗ Failed to load SimulationManager.js:', error.message);
    }

    // Step 4: Load Three.js
    console.log('\n4. Loading Three.js...');
    try {
        const threeResponse = await fetch(`${BASE_URL}/node_modules/three/build/three.module.js`);
        if (threeResponse.ok) {
            console.log('   ✓ Three.js module loaded successfully');
            console.log('   Status:', threeResponse.status);
            console.log('   Content-Type:', threeResponse.headers.get('content-type'));
        } else {
            console.log('   ✗ Three.js module failed:', threeResponse.status, threeResponse.statusText);
        }
    } catch (error) {
        console.log('   ✗ Failed to load Three.js:', error.message);
    }

    // Step 5: Load TrajectoryService
    console.log('\n5. Loading TrajectoryService.js...');
    try {
        const trajServiceResponse = await fetch(`${BASE_URL}/src/services/TrajectoryService.js`);
        const trajServiceJs = await trajServiceResponse.text();
        console.log('   ✓ TrajectoryService.js loaded successfully');

        // Check for backend URL
        if (trajServiceJs.includes('localhost:3010')) {
            console.log('   ✓ Correct backend URL (3010) found');
        }
    } catch (error) {
        console.log('   ✗ Failed to load TrajectoryService.js:', error.message);
    }

    // Step 6: Test backend connectivity
    console.log('\n6. Testing backend connectivity...');
    try {
        const healthResponse = await fetch('http://localhost:3010/health');
        const healthData = await healthResponse.json();
        console.log('   ✓ Backend health check passed:', healthData.status);
        console.log('   Backend service:', healthData.service);
        console.log('   Backend port:', healthData.port);
    } catch (error) {
        console.log('   ✗ Backend health check failed:', error.message);
    }

    // Step 7: Test backend trajectory endpoint
    console.log('\n7. Testing backend trajectory calculation...');
    try {
        const trajResponse = await fetch('http://localhost:3010/high-fidelity/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                control: { bank_angle: 0.0 },
                serialize_arrow: false
            })
        });
        const trajData = await trajResponse.json();
        if (trajData.time_s && trajData.x_m) {
            console.log('   ✓ Trajectory calculation successful');
            console.log('   Number of points:', trajData.time_s.length);
            console.log('   First position:', `(${trajData.x_m[0]?.toFixed(2)}, ${trajData.y_m[0]?.toFixed(2)}, ${trajData.z_m[0]?.toFixed(2)})`);
        } else {
            console.log('   ✗ Invalid trajectory response');
        }
    } catch (error) {
        console.log('   ✗ Trajectory calculation failed:', error.message);
    }

    console.log('\n✅ Load sequence test complete!');
    console.log('\nSummary: The application should be working if all tests passed.');
    console.log('To view the application, open: http://localhost:3001');
}

// Run the test
testLoadSequence().catch(console.error);