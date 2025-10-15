#!/bin/bash

echo "Testing application load sequence..."
echo ""

echo "1. Testing index.html..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/ | grep -q "200" && echo "   ✓ index.html loads" || echo "   ✗ index.html failed"

echo ""
echo "2. Testing main.js..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/src/main.js | grep -q "200" && echo "   ✓ main.js loads" || echo "   ✗ main.js failed"

echo ""
echo "3. Testing Three.js module..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/node_modules/three/build/three.module.js | grep -q "200" && echo "   ✓ Three.js loads" || echo "   ✗ Three.js failed"

echo ""
echo "4. Testing SimulationManager..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/src/simulation/SimulationManager.js | grep -q "200" && echo "   ✓ SimulationManager loads" || echo "   ✗ SimulationManager failed"

echo ""
echo "5. Testing TrajectoryService..."
curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/src/services/TrajectoryService.js | grep -q "200" && echo "   ✓ TrajectoryService loads" || echo "   ✗ TrajectoryService failed"

echo ""
echo "6. Testing backend health..."
curl -s http://localhost:3010/health | grep -q "healthy" && echo "   ✓ Backend is healthy" || echo "   ✗ Backend failed"

echo ""
echo "7. Testing trajectory calculation..."
curl -s -X POST http://localhost:3010/high-fidelity/ \
  -H "Content-Type: application/json" \
  -d '{"control": {"bank_angle": 0.0}, "serialize_arrow": false}' \
  | grep -q "time_s" && echo "   ✓ Trajectory calculation works" || echo "   ✗ Trajectory calculation failed"

echo ""
echo "✅ Test complete! Open http://localhost:3001 in your browser."