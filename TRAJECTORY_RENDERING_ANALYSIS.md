# Trajectory Rendering Analysis Report

## Overview
This document provides a comprehensive analysis of trajectory rendering in the HSV EDL Simulation.

## 1. Where Trajectories Are Created/Drawn

### Primary File: TrajectoryManager.js
Location: d:/WPI Assignments/Website-PartTimeJob/HSVL/Project/client/src/simulation/TrajectoryManager.js

#### Key Creation Method: createOptimizedTrajectory() (Lines 184-232)
- Creates the complete trajectory line visualization
- **CRITICAL ISSUE FIXED** (Lines 187-198): Removes old trajectory before creating new one
- Prevents memory leaks by disposing geometry and material
- Uses THREE.BufferGeometry with Float32Array for positions

#### Key Method: createTrajectoryVisualization() (Lines 31-80)
- Creates past and future trajectory lines separately
- Uses pre-allocated buffers (2000 points each)
- PastMaterial: Light gray line (traveled path)
- FutureMaterial: Red dashed line (future path)

---

## 2. How Banking Angle Changes Affect Trajectory Rendering

### Flow: User Input -> Backend Calculation -> Trajectory Update

**Step 1: User Interface (Controls.js lines 64-99)**
- Bank angle slider range: -90 to +90 degrees
- Fires onBankAngle callback on value change

**Step 2: SimulationManager Handler (lines 629-653)**
```javascript
handleBankAngle(lastAngle, angle) {
    this.state.bankAngle = angle;
    // Store in history for replay
    this.state.bankingHistory.push({ time, angle });
    // Apply physics immediately
    this.applyBankAnglePhysicsRealTime(angle);
}
```

**Step 3: Backend Integration (lines 671-757)**
- applyBankAnglePhysicsRealTime() throttles calls to 500ms intervals
- Prevents concurrent updates with _bankAngleUpdateInProgress flag
- Calls TrajectoryService.modifyTrajectoryFromCurrentState()

**Step 4: Backend API Call (TrajectoryService.js lines 101-160)**
- Converts bank angle to radians
- Sends current position and velocity as starting point
- Backend recalculates trajectory from current instant onwards

**Step 5: Trajectory Splice (TrajectoryManager.js lines 422-456)**
- spliceTrajectoryFromTime() preserves past trajectory
- Combines past points with new future points
- Calls createOptimizedTrajectory() to rebuild visualization

---

## 3. Code That Might Cause Multiple Trajectories to Be Drawn

### Critical Issues and Solutions:

**Issue 1: Race Condition in Banking Angle Updates**
File: SimulationManager.js lines 671-757

Prevention mechanisms:
- _bankAngleUpdateInProgress flag (lines 669, 687-690, 704, 755)
- 500ms throttle interval (line 673)
- Result caching (lines 692-700)

```javascript
// Prevent concurrent backend calls
if (this._bankAngleUpdateInProgress) {
    console.log('Bank angle update already in progress, skipping');
    return;  // KEY: Skip if already updating
}
```

**Issue 2: Memory Leaks from Unreleased Geometry**
File: TrajectoryManager.js lines 184-198

Solution: Proper cleanup before creating new geometry
```javascript
// CRITICAL: Remove old trajectory line before creating new one
if (this.trajectoryLine) {
    this.group.remove(this.trajectoryLine);
    if (this.trajectoryLine.geometry) {
        this.trajectoryLine.geometry.dispose();
    }
    if (this.trajectoryLine.material) {
        this.trajectoryLine.material.dispose();
    }
    this.trajectoryLine = null;
}
```

**Issue 3: Rapid Calls from Control Updates**
Controls.js has redundancy check (lines 89-92):
```javascript
slider.addEventListener('change', () => {
    const newValue = Number(slider.value);
    if (newValue === this.lastSliderValue) return;  // Prevents redundant calls
    this.options.onBankAngle(this.lastSliderValue, newValue);
    this.lastSliderValue = newValue;
});
```

---

## 4. Functions That Create Line Geometries or Trajectory Visualizations

### Function Summary Table:

| Function | File | Purpose | Creates New Geometry |
|----------|------|---------|----------------------|
| createTrajectoryVisualization() | TrajectoryManager.js:31 | Initial setup | Yes (BufferGeometry) |
| createOptimizedTrajectory() | TrajectoryManager.js:184 | Main trajectory line | Yes (with cleanup) |
| createInstancedPathPoints() | TrajectoryManager.js:82 | Point markers | Yes (InstancedMesh) |
| updateTrajectoryDisplay() | TrajectoryManager.js:270 | Update positions | No (buffer updates) |
| spliceTrajectoryFromTime() | TrajectoryManager.js:422 | Banking angle update | No (calls createOptimized) |

### updateTrajectoryDisplay() Details (Lines 270-341)
- Called every frame when simulation is playing
- Updates past and future trajectory visual positions
- Uses pre-allocated buffers (NO new geometry creation)
- Updates draw ranges efficiently

Key code section:
```javascript
updateTrajectoryDisplay(currentTime) {
    // Find current position in trajectory
    // Update pastLine using pastPositionBuffer
    // Update futureLine using futurePositionBuffer
    
    if (pastPointCount > 1) {
        const pastPositionAttr = this.pastLine.geometry.getAttribute('position');
        pastPositionAttr.needsUpdate = true;
        this.pastLine.geometry.setDrawRange(0, pastPointCount);
    }
}
```

---

## 5. Performance Optimizations

1. **BufferGeometry with Pre-allocated Arrays**
   - Past trajectory: 2000 x 3 Float32Array
   - Future trajectory: 2000 x 3 Float32Array
   - Avoids constant memory reallocations

2. **Throttling and Caching**
   - 500ms minimum between backend calls
   - Result caching prevents redundant calculations
   - Concurrent update prevention flag

3. **Frustum Culling**
   - Enabled on all trajectory lines
   - Reduces GPU load for off-screen geometry

4. **Draw Range Optimization**
   - Only renders necessary trajectory portion
   - Updates setDrawRange() each frame

---

## 6. Data Flow Summary

Banking Angle Change:
1. User adjusts slider (-90 to +90 degrees)
2. Controls.js fires onBankAngle(lastAngle, newAngle)
3. SimulationManager.handleBankAngle() stores in history
4. applyBankAnglePhysicsRealTime() checks flags and throttle
5. TrajectoryService.modifyTrajectoryFromCurrentState() calls backend
6. Backend calculates physics and returns new trajectory
7. TrajectoryManager.spliceTrajectoryFromTime() updates data
8. createOptimizedTrajectory() rebuilds visualization (with disposal)
9. Animation loop calls updateTrajectoryDisplay() every frame
10. Visual positions updated in pre-allocated buffers

---

## 7. Key Locations Referenced

**Main trajectory management:**
- D:/WPI Assignments/Website-PartTimeJob/HSVL/Project/client/src/simulation/TrajectoryManager.js

**Simulation control and banking angle:**
- D:/WPI Assignments/Website-PartTimeJob/HSVL/Project/client/src/simulation/SimulationManager.js

**Backend service:**
- D:/WPI Assignments/Website-PartTimeJob/HSVL/Project/client/src/services/TrajectoryService.js

**UI controls:**
- D:/WPI Assignments/Website-PartTimeJob/HSVL/Project/client/src/ui/Controls.js

