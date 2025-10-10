# Complete Project Documentation
## Hypersonic Vehicle Simulation Platform

**Last Updated:** 2025-01-07
**Version:** 2.0.0
**Status:** Production Ready with Backend Integration

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Technology Stack](#2-architecture--technology-stack)
3. [Backend Integration](#3-backend-integration)
4. [Project Structure](#4-project-structure)
5. [Core Components](#5-core-components)
6. [API Documentation](#6-api-documentation)
7. [Data Flow & Processing](#7-data-flow--processing)
8. [Features & Capabilities](#8-features--capabilities)
9. [Setup & Installation](#9-setup--installation)
10. [Configuration](#10-configuration)
11. [Usage Guide](#11-usage-guide)
12. [Testing](#12-testing)
13. [Troubleshooting](#13-troubleshooting)
14. [Performance Optimization](#14-performance-optimization)
15. [Deployment](#15-deployment)
16. [Contributing](#16-contributing)

---

## 1. Project Overview

### 1.1 What is This Project?

A high-fidelity 3D simulation platform for atmospheric entry, descent, and landing (EDL) of hypersonic vehicles across multiple celestial bodies. Built with Three.js and featuring actual NASA trajectory data, it provides real-time visualization and physics-based trajectory modifications.

### 1.2 Key Features

- **Real-time 3D Visualization** - Immersive WebGL-based rendering
- **Multiple Planets** - Mars, Earth, Jupiter support with accurate atmospheres
- **Physics Engine** - Realistic forces, drag, lift, and gravity calculations
- **Backend Integration** - Server-side calculations with client-side fallback
- **Bank Angle Control** - Real-time trajectory modification with lift vector control
- **Mission Phases** - Detailed EDL phase tracking with telemetry
- **Multiple Camera Modes** - Follow, Free, Cinematic views
- **Timeline Control** - Precise time scrubbing and playback control

### 1.3 Target Users

- Aerospace engineers and researchers
- Mission planners and analysts
- Students and educators
- Space enthusiasts

### 1.4 Use Cases

1. **Mission Planning** - Visualize and validate EDL trajectories
2. **Education** - Teach atmospheric entry dynamics
3. **Research** - Analyze trajectory variations with bank angle control
4. **Public Outreach** - Demonstrate space missions to general audiences

---

## 2. Architecture & Technology Stack

### 2.1 Technology Stack

#### Frontend
- **Three.js** (r150+) - 3D rendering and WebGL
- **JavaScript ES6+** - Modern modular JavaScript
- **HTML5/CSS3** - User interface
- **Web APIs** - Fetch, WebGL, Canvas

#### Backend
- **Node.js** (v18+) - JavaScript runtime
- **Express.js** (v4.18+) - Web framework
- **CORS** - Cross-origin resource sharing
- **Helmet** - Security middleware
- **Winston** - Logging

#### Data
- **CSV** - Trajectory data storage
- **JSON** - Mission configurations and telemetry
- **In-memory Cache** - Fast data access

### 2.2 System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   UI Layer   │  │ 3D Renderer  │  │  Controls    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│  ┌──────▼──────────────────▼──────────────────▼───────┐     │
│  │           Simulation Manager                        │     │
│  └──────┬──────────────┬──────────────┬────────────┬──┘     │
│         │              │              │            │         │
│  ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌───▼────┐   │
│  │  Physics    │ │Trajectory│ │   Data     │ │ Phase  │   │
│  │  Engine     │ │ Manager  │ │  Manager   │ │Control │   │
│  └──────┬──────┘ └────┬─────┘ └─────┬──────┘ └───┬────┘   │
│         │              │              │            │         │
│  ┌──────▼──────────────▼──────────────▼────────────▼───┐   │
│  │            Backend API Client                         │   │
│  │         (tries backend first, falls back to local)    │   │
│  └──────┬────────────────────────────────────────────────┘   │
│         │                                                     │
└─────────┼─────────────────────────────────────────────────────┘
          │
          │ HTTP/REST
          ▼
┌─────────────────────────────────────────────────────────────┐
│                      Backend Server                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ Express.js   │  │   Routing    │  │  Middleware  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │               │
│  ┌──────▼──────────────────▼──────────────────▼───────┐     │
│  │                API Endpoints                        │     │
│  └──────┬──────────────┬──────────────┬────────────┬──┘     │
│         │              │              │            │         │
│  ┌──────▼──────┐ ┌────▼─────┐ ┌─────▼──────┐ ┌───▼────┐   │
│  │Trajectories │ │Missions  │ │ Telemetry  │ │ Health │   │
│  │     API     │ │   API    │ │    API     │ │  API   │   │
│  └──────┬──────┘ └────┬─────┘ └─────┬──────┘ └───┬────┘   │
│         │              │              │            │         │
│  ┌──────▼──────────────▼──────────────▼────────────▼───┐   │
│  │                 Data Layer                          │   │
│  │    (CSV Files, JSON Configs, In-Memory Store)      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### 2.3 Data Flow

```
User Input
    ↓
Backend API Call (via BackendAPIClient)
    ├─→ Success: Use backend data
    └─→ Fail: Use local calculation (fallback)
        ↓
3D Rendering & Visualization
```

---

## 3. Backend Integration

### 3.1 Overview

The client application **prioritizes backend API calls** while maintaining **local calculations as a fallback mechanism**. This ensures the simulation works even when the backend is unavailable.

### 3.2 Backend-First Architecture

#### Key Principle
> **Backend First, Local Fallback**
> All data fetching and physics calculations attempt to use backend APIs first. If the backend is unavailable or returns an error, the system automatically falls back to client-side calculations.

#### Components with Backend Integration

1. **BackendAPIClient** (`client/src/services/BackendAPIClient.js`)
   - Centralized API client for all backend communications
   - Automatic retry with exponential backoff
   - Request caching with configurable TTL (60s default)
   - Health checking and availability tracking
   - Timeout management (5-10s depending on operation)

2. **DataManager** (`client/src/data/DataManager.js`)
   - Backend-first trajectory data loading
   - Mission configuration from backend
   - Telemetry submission to backend
   - Local file fallback

3. **PhysicsEngine** (`client/src/core/PhysicsEngine.js`)
   - Backend physics force calculations
   - Atmospheric properties from backend
   - Local physics fallback

4. **TrajectoryManager** (`client/src/simulation/TrajectoryManager.js`)
   - Backend trajectory modification
   - Real-time bank angle updates via backend
   - Local trajectory calculation fallback

5. **SimulationDataProvider** (`client/src/core/SimulationDataProvider.js`)
   - Flexible data source management
   - Hybrid mode (backend base + frontend modifications)
   - Automatic source switching

### 3.3 Backend API Endpoints

#### ✅ Currently Implemented (Server-Side)

| Endpoint | Method | Description | Client Integration |
|----------|--------|-------------|-------------------|
| `/api/trajectories` | GET | List available trajectories | ✅ DataManager |
| `/api/trajectories/:filename` | GET | Get trajectory data | ✅ DataManager |
| `/api/trajectories/:filename/interpolate` | GET | Interpolate position | ✅ SimulationDataProvider |
| `/api/trajectories/analyze` | POST | Analyze trajectory | ✅ BackendAPIClient |
| `/api/data/msl-trajectory/range` | GET | Get time range | ✅ BackendAPIClient |
| `/api/data/msl-trajectory/at-time` | GET | Get specific time | ✅ BackendAPIClient |
| `/api/missions` | GET | List missions | ✅ DataManager |
| `/api/missions/:id` | GET | Get mission config | ✅ DataManager |
| `/api/missions/:id/phases` | GET | Get mission phases | ✅ DataManager |
| `/api/telemetry` | POST | Submit telemetry | ✅ DataManager |
| `/api/telemetry/mission/:id/latest` | GET | Get latest telemetry | ✅ DataManager |
| `/api/health` | GET | Backend health check | ✅ All components |

#### 🔄 Ready for Implementation (Client Ready, Server Pending)

| Endpoint | Method | Description | Priority | Client Ready |
|----------|--------|-------------|----------|--------------|
| `/api/physics/forces` | POST | Calculate all forces | 🔴 High | ✅ PhysicsEngine |
| `/api/physics/atmosphere` | GET | Atmospheric properties | 🔴 High | ✅ PhysicsEngine |
| `/api/trajectory/modify` | POST | Modify with bank angle | 🔴 High | ✅ TrajectoryManager |
| `/api/trajectory/calculate` | POST | Full trajectory calc | 🟡 Medium | ✅ SimulationDataProvider |

### 3.4 Automatic Fallback Mechanism

#### How It Works

```javascript
// Example: DataManager loading trajectory
async loadTrajectoryCSV(filename) {
    // 1. Check cache
    if (cached) return cached;

    // 2. Try backend
    if (preferBackend && backendAvailable) {
        const result = await backendAPI.getTrajectory(filename);
        if (result.success) {
            return result.data; // Backend data
        }
        backendAvailable = false; // Mark backend unavailable
    }

    // 3. Fallback to local
    return loadFromLocalFile(filename); // Local data
}
```

#### Fallback Triggers

Backend fallback occurs when:
- Network error (timeout, connection refused)
- HTTP error (404, 500, etc.)
- Backend returns `useFallback: true`
- Backend not available (health check fails)
- Request timeout exceeds limit

#### Fallback Behavior

| Component | Backend Operation | Fallback Operation |
|-----------|------------------|-------------------|
| DataManager | Load from `/api/trajectories` | Load from local CSV files |
| PhysicsEngine | Calculate via `/api/physics/forces` | Calculate with local engine |
| TrajectoryManager | Modify via `/api/trajectory/modify` | Modify with local physics |
| SimulationDataProvider | Fetch via backend APIs | Use frontend calculations |

### 3.5 Backend Control API

All components provide backend control methods:

```javascript
// Check backend availability
const isAvailable = await component.checkBackendAvailability();

// Get backend status
const status = component.getBackendStatus();
// Returns: { available: bool, preferBackend: bool, apiStatus: {...} }

// Enable/disable backend preference
component.setBackendPreference(true/false);
```

### 3.6 Logging & Monitoring

All backend operations are logged with prefixes:

```javascript
[BackendAPI] - API client operations
[DataManager] - Data loading operations
[PhysicsEngine] - Physics calculations
[TrajectoryManager] - Trajectory modifications
[SimulationDataProvider] - Data provider operations
```

Example console output:
```
[DataManager] Attempting to load trajectory from backend: MSL_position_J2000.csv
[BackendAPI] Request: GET /api/trajectories/MSL_position_J2000.csv
[BackendAPI] Cache hit: GET_/api/trajectories/MSL_position_J2000.csv
[DataManager] Successfully loaded trajectory from backend
[PhysicsEngine] Backend physics endpoint not available, using local calculation
```

---

## 4. Project Structure

### 4.1 Directory Layout

```
hypersonic-vehicle-simulation/
├── client/                          # Frontend application
│   ├── src/
│   │   ├── services/               # NEW: Backend API integration
│   │   │   └── BackendAPIClient.js # Centralized API client
│   │   ├── core/                   # Core simulation systems
│   │   │   ├── SceneManager.js     # Three.js scene management
│   │   │   ├── CameraController.js # Camera system
│   │   │   ├── PhysicsEngine.js    # Physics calculations (backend-first)
│   │   │   ├── SimulationDataProvider.js # Data provider (backend-first)
│   │   │   └── AssetLoader.js      # Asset loading
│   │   ├── components/             # 3D components
│   │   │   ├── spacecraft/         # Vehicle models
│   │   │   │   ├── EntryVehicle.js # Main spacecraft
│   │   │   │   └── Parachute.js    # Parachute system
│   │   │   ├── environment/        # Celestial bodies
│   │   │   │   ├── Mars.js         # Mars planet
│   │   │   │   ├── Earth.js        # Earth planet
│   │   │   │   ├── Jupiter.js      # Jupiter planet
│   │   │   │   ├── Stars.js        # Starfield
│   │   │   │   └── Atmosphere.js   # Atmospheric effects
│   │   │   ├── effects/            # Visual effects
│   │   │   │   ├── ThrusterFlames.js # Thruster particles
│   │   │   │   ├── HeatShield.js   # Heat effects
│   │   │   │   └── DustEffects.js  # Dust clouds
│   │   │   └── helpers/            # Debug helpers
│   │   │       └── CoordinateAxes.js # Axis indicators
│   │   ├── simulation/             # Simulation logic
│   │   │   ├── SimulationManager.js # Main simulation controller
│   │   │   ├── TrajectoryManager.js # Trajectory handling (backend-first)
│   │   │   └── PhaseController.js  # Mission phase control
│   │   ├── ui/                     # User interface
│   │   │   ├── Controls.js         # Control panel
│   │   │   ├── Timeline.js         # Timeline scrubber
│   │   │   └── PhaseInfo.js        # Phase information display
│   │   ├── data/                   # Data management
│   │   │   └── DataManager.js      # Data loading (backend-first)
│   │   ├── config/                 # Configuration
│   │   │   └── SimulationConfig.js # Simulation settings
│   │   └── main.js                 # Application entry point
│   ├── assets/
│   │   ├── data/                   # Trajectory CSV files
│   │   │   └── MSL_position_J2000.csv
│   │   ├── models/                 # 3D models (future)
│   │   └── textures/               # Planet textures
│   ├── styles/
│   │   └── main.css                # Application styles
│   └── index.html                  # Main HTML file
│
├── server/                         # Backend server
│   ├── api/                        # API endpoints
│   │   ├── trajectories.js         # Trajectory API
│   │   ├── missions.js             # Mission configuration API
│   │   ├── telemetry.js            # Telemetry API
│   │   └── data.js                 # Data serving API
│   ├── data/                       # Server data
│   │   └── missions/
│   │       └── msl.json            # MSL mission config
│   ├── logs/                       # Log files
│   ├── server.js                   # Express server setup
│   └── index.js                    # Server entry point
│
├── docs/                           # Documentation (optional)
├── package.json                    # Dependencies
├── package-lock.json
├── README.md                       # Basic readme
└── COMPLETE_PROJECT_DOCUMENTATION.md  # This file
```

### 4.2 Key Files Description

#### Frontend Core Files

| File | Purpose | Backend Integration |
|------|---------|-------------------|
| `BackendAPIClient.js` | Centralized API communication | ✅ Core integration layer |
| `SimulationManager.js` | Main simulation controller | Uses all integrated components |
| `PhysicsEngine.js` | Physics calculations | Backend-first force calculations |
| `TrajectoryManager.js` | Trajectory visualization & modification | Backend-first modifications |
| `DataManager.js` | Data loading and caching | Backend-first data loading |
| `SimulationDataProvider.js` | Flexible data provider | Backend/frontend/hybrid modes |

#### Backend Core Files

| File | Purpose | Endpoints Provided |
|------|---------|-------------------|
| `server.js` | Express server configuration | Static file serving, middleware |
| `trajectories.js` | Trajectory endpoints | 6 trajectory-related endpoints |
| `missions.js` | Mission configuration | 4 mission-related endpoints |
| `telemetry.js` | Telemetry handling | 2 telemetry endpoints |
| `data.js` | Data serving | 4 data query endpoints |

---

## 5. Core Components

### 5.1 BackendAPIClient

**Location:** `client/src/services/BackendAPIClient.js`

#### Purpose
Centralized API client that handles all backend communications with automatic retry, caching, and fallback support.

#### Key Features
- Automatic retry with exponential backoff
- Request caching with configurable TTL
- Timeout management
- Health checking
- Circuit breaker pattern

#### Configuration
```javascript
const apiClient = new BackendAPIClient({
    baseURL: 'http://localhost:3001',
    timeout: 10000,           // 10 seconds
    retryAttempts: 2,
    cacheEnabled: true,
    cacheTTL: 60000          // 1 minute
});
```

#### Main Methods
```javascript
// Trajectory APIs
await apiClient.getTrajectory(filename, options)
await apiClient.getTrajectoryRange(startTime, endTime, limit)
await apiClient.getTrajectoryAtTime(time)
await apiClient.getInterpolatedPosition(filename, time)
await apiClient.analyzeTrajectory(filename, startTime, endTime)

// Mission APIs
await apiClient.getMissionConfig(missionId)
await apiClient.getMissionPhases(missionId)

// Telemetry APIs
await apiClient.sendTelemetry(telemetryData)
await apiClient.getLatestTelemetry(missionId)

// Physics APIs (future backend implementation)
await apiClient.calculatePhysicsForces(vehicleState, planet, controls)
await apiClient.getAtmosphericProperties(planet, altitude, velocity)
await apiClient.modifyTrajectoryWithBankAngle(time, angle, direction, data)

// Health APIs
await apiClient.healthCheck()
await apiClient.isBackendAvailable()

// Utility
apiClient.clearCache()
apiClient.getStatus()
```

### 5.2 DataManager

**Location:** `client/src/data/DataManager.js`

#### Purpose
Manages all data loading, caching, and API communications. Now backend-first with local fallback.

#### Backend Integration
```javascript
// Before: Local only
loadTrajectoryCSV(filename) → Load from local file

// After: Backend-first
loadTrajectoryCSV(filename) → Try backend API → Fallback to local
```

#### Key Methods
```javascript
// Load trajectory (backend-first)
const data = await dataManager.loadTrajectoryCSV('MSL_position_J2000.csv');
console.log(data.source); // 'backend' or 'local'

// Load mission config (backend-first)
const config = await dataManager.loadMissionConfig('msl');
console.log(config.source); // 'backend' or 'default'

// Save telemetry (backend-first)
await dataManager.saveTelemetry(telemetryData);

// Backend control
await dataManager.checkBackendHealth();
dataManager.setBackendPreference(true/false);
const status = dataManager.getBackendStatus();
```

### 5.3 PhysicsEngine

**Location:** `client/src/core/PhysicsEngine.js`

#### Purpose
Calculates all physics forces acting on the vehicle. Now tries backend calculations first.

#### Physics Calculations

1. **Gravitational Force**
   ```javascript
   F_gravity = G * m_planet * m_vehicle / r²
   ```

2. **Atmospheric Drag**
   ```javascript
   F_drag = 0.5 * ρ * v² * Cd * A
   ```

3. **Lift Force**
   ```javascript
   F_lift = 0.5 * ρ * v² * Cl * A
   ```

4. **Thrust Forces**
   - Main engine thrust
   - RCS (Reaction Control System) thrust

#### Backend Integration
```javascript
// Now async - tries backend first
const forces = await physicsEngine.calculateForces(vehicleState, planet, controls);

// If backend unavailable, uses local calculation automatically
```

#### Key Methods
```javascript
// Force calculations (backend-first)
await physicsEngine.calculateForces(vehicleState, planet, controls)

// Local calculations (fallback)
physicsEngine.calculateForcesLocal(vehicleState, planet, controls)

// Specific force components
physicsEngine.calculateGravityForce(vehicleState, planet)
physicsEngine.calculateDragForce(vehicleState, planet)
physicsEngine.calculateLiftForce(vehicleState, planet)
physicsEngine.calculateThrustForce(vehicleState, controls)

// Trajectory prediction
physicsEngine.predictTrajectory(vehicleState, planet, timeHorizon)

// Orbital mechanics
physicsEngine.calculateOrbitalParameters(vehicleState, planet)
physicsEngine.calculateEntryParameters(vehicleState, planet)

// Backend control
physicsEngine.setBackendPreference(true/false)
const status = physicsEngine.getBackendStatus()
await physicsEngine.checkBackendAvailability()
```

### 5.4 TrajectoryManager

**Location:** `client/src/simulation/TrajectoryManager.js`

#### Purpose
Manages trajectory visualization and real-time modifications. Now supports backend trajectory calculations.

#### Trajectory Visualization

1. **Trajectory Line**
   - Past trajectory (solid gray)
   - Future trajectory (dashed red)
   - Full trajectory (white transparent)

2. **Path Points**
   - Instanced meshes for performance
   - Color-coded by altitude
   - Fading based on time distance

3. **Position Marker**
   - Current vehicle position indicator

#### Bank Angle Control

The simulation supports real-time trajectory modification using bank angle control:

```javascript
// User adjusts bank angle with slider
handleBankAngle(lastAngle, newAngle) {
    const liftForceDirection = calculateLiftDirection();

    // Tries backend modification first
    await trajectoryManager.offsetTrajectoryWithPhysicsRealTime(
        currentTime,
        liftForceDirection,
        bankAngle
    );
}
```

#### Backend Integration
```javascript
// Now async - tries backend modification first
await trajectoryManager.offsetTrajectoryWithPhysicsRealTime(
    currentTime,
    liftForceDirection,
    bankAngle
);

// If backend unavailable, uses local physics automatically
```

#### Key Methods
```javascript
// Trajectory setup
trajectoryManager.setTrajectoryFromCSV(csvRows)
trajectoryManager.setTrajectoryData(trajectoryData)
trajectoryManager.generateSampleTrajectory()

// Trajectory updates
trajectoryManager.updateTrajectoryDisplay(currentTime)
trajectoryManager.updateTrajectoryVisibility(currentTime)

// Data queries
trajectoryManager.getDataAtTime(time)
trajectoryManager.getVelocityVector(time)
trajectoryManager.getTimeFromPosition(position)

// Trajectory modifications (backend-first)
await trajectoryManager.offsetTrajectoryWithPhysicsRealTime(time, dir, angle)
trajectoryManager.offsetTrajectoryWithPhysicsRealTimeLocal(time, dir, angle) // Fallback
trajectoryManager.offsetTrajectoryLinearlyFromCurrentTime(time, x, y, percent)

// Reset
trajectoryManager.resetTrajectory()

// Backend control
trajectoryManager.setBackendPreference(true/false)
const status = trajectoryManager.getBackendStatus()
await trajectoryManager.checkBackendAvailability()
```

### 5.5 SimulationManager

**Location:** `client/src/simulation/SimulationManager.js`

#### Purpose
Main controller that coordinates all simulation components.

#### Components Managed

1. **Core Systems**
   - SceneManager (Three.js)
   - CameraController
   - PhysicsEngine (backend-integrated)
   - DataManager (backend-integrated)
   - SimulationDataProvider (backend-integrated)

2. **Scene Objects**
   - EntryVehicle
   - Planets (Mars, Earth, Jupiter)
   - Stars
   - TrajectoryManager (backend-integrated)

3. **UI Components**
   - Timeline
   - PhaseInfo
   - Controls

#### Simulation Loop

```javascript
animate() {
    requestAnimationFrame(() => this.animate());

    const deltaTime = this.clock.getDelta();

    if (this.state.isPlaying) {
        // Update simulation time
        this.state.currentTime += deltaTime * this.state.playbackSpeed;

        // Get current vehicle state (from backend or local)
        const vehicleData = this.trajectoryManager.getDataAtTime(
            this.state.currentTime
        );

        // Update vehicle position and orientation
        this.entryVehicle.updatePosition(vehicleData);

        // Update trajectory visualization
        this.trajectoryManager.updateTrajectoryDisplay(this.state.currentTime);

        // Update UI
        this.timeline.updateTime(this.state.currentTime);
        this.phaseController.update(this.state.currentTime);
    }

    // Update camera
    this.cameraController.update(deltaTime);

    // Render scene
    this.sceneManager.render();
}
```

### 5.6 CameraController

**Location:** `client/src/core/CameraController.js`

#### Purpose
Manages camera positioning and behavior across different camera modes.

#### Camera Modes

1. **Follow Mode**
   - Camera follows vehicle
   - Smooth tracking with damping
   - Maintains relative orientation

2. **Free Mode**
   - Mouse-controlled camera
   - Orbit around target
   - Zoom with scroll

3. **Cinematic Mode**
   - Pre-defined camera paths
   - Smooth transitions
   - Dramatic angles

#### Key Methods
```javascript
cameraController.setMode('follow' | 'free' | 'cinematic')
cameraController.setTarget(object3D)
cameraController.setDefaultDistance(distance)
cameraController.zoom(direction)
cameraController.update(deltaTime)
```

---

## 6. API Documentation

### 6.1 Trajectory APIs

#### GET /api/trajectories
List available trajectory files.

**Response:**
```json
{
  "count": 1,
  "trajectories": [
    {
      "filename": "MSL_position_J2000.csv",
      "size": 1024000,
      "modified": "2024-01-01T00:00:00.000Z",
      "mission": "MSL"
    }
  ]
}
```

#### GET /api/trajectories/:filename
Get trajectory data in JSON format.

**Parameters:**
- `format` (query): 'json' or 'csv' (default: 'json')
- `limit` (query): Maximum points to return
- `offset` (query): Starting point offset

**Response:**
```json
{
  "filename": "MSL_position_J2000.csv",
  "mission": "MSL",
  "totalPoints": 5213,
  "points": [
    {
      "Time": "0.0",
      "x": "-606436.28",
      "y": "3075821.96",
      "z": "1604925.87"
    }
  ],
  "metadata": {
    "pointCount": 5213,
    "timeRange": { "min": 0, "max": 260.65 },
    "altitudeRange": { "min": 0, "max": 132000 },
    "duration": 260.65
  }
}
```

#### GET /api/trajectories/:filename/interpolate
Get interpolated position at specific time.

**Parameters:**
- `time` (query, required): Target time in seconds

**Response:**
```json
{
  "time": 100.5,
  "interpolated": {
    "x": -500000.0,
    "y": 3000000.0,
    "z": 1500000.0,
    "altitude": 50000.0
  },
  "before": { "Time": 100.0, "x": ..., "y": ..., "z": ... },
  "after": { "Time": 101.0, "x": ..., "y": ..., "z": ... }
}
```

#### POST /api/trajectories/analyze
Analyze trajectory data.

**Request:**
```json
{
  "filename": "MSL_position_J2000.csv",
  "startTime": 0,
  "endTime": 260.65
}
```

**Response:**
```json
{
  "filename": "MSL_position_J2000.csv",
  "timeRange": { "start": 0, "end": 260.65 },
  "analysis": {
    "pointCount": 5213,
    "timeRange": { "min": 0, "max": 260.65 },
    "altitudeRange": { "min": 0, "max": 132000 },
    "velocity": {
      "min": 0,
      "max": 5900,
      "average": 2950
    },
    "acceleration": {
      "min": -15,
      "max": 0,
      "average": -7.5
    }
  }
}
```

#### GET /api/data/msl-trajectory/range
Get trajectory data within time range.

**Parameters:**
- `start` (query): Start time (default: 0)
- `end` (query): End time (default: 260.65)
- `limit` (query): Max points (default: 1000)

**Response:**
```json
{
  "header": ["Time", "x", "y", "z"],
  "data": [
    { "time": 0.0, "x": ..., "y": ..., "z": ... }
  ],
  "count": 1000,
  "timeRange": { "start": 0, "end": 100 }
}
```

#### GET /api/data/msl-trajectory/at-time
Get closest data point to target time.

**Parameters:**
- `time` (query, required): Target time

**Response:**
```json
{
  "targetTime": 100.5,
  "closestPoint": {
    "time": 100.0,
    "x": ...,
    "y": ...,
    "z": ...
  },
  "timeDifference": 0.5
}
```

### 6.2 Mission APIs

#### GET /api/missions
List all available missions.

**Response:**
```json
{
  "count": 2,
  "missions": [
    {
      "id": "msl",
      "name": "Mars Science Laboratory",
      "vehicle": "Curiosity Rover",
      "landingDate": "2012-08-06",
      "landingSite": "Gale Crater"
    }
  ]
}
```

#### GET /api/missions/:id
Get detailed mission configuration.

**Response:**
```json
{
  "id": "msl",
  "name": "Mars Science Laboratory",
  "vehicle": "Curiosity Rover",
  "launchDate": "2011-11-26",
  "landingDate": "2012-08-06",
  "landingSite": {
    "name": "Gale Crater",
    "latitude": -4.5895,
    "longitude": 137.4417
  },
  "entryInterface": {
    "altitude": 132,
    "velocity": 19300,
    "angle": -15.5
  },
  "phases": [...],
  "vehicleConfig": {
    "mass": 899,
    "heatShieldDiameter": 4.5,
    "parachuteDiameter": 21.5,
    "entryAngle": -15.5
  }
}
```

#### GET /api/missions/:id/phases
Get mission phases.

**Response:**
```json
{
  "missionId": "msl",
  "phases": [
    {
      "name": "Entry Interface Point",
      "time": 0,
      "altitude": 132,
      "velocity": 19300,
      "description": "The spacecraft enters the Martian atmosphere...",
      "nextPhase": "Guidance Start",
      "nextPhaseTime": 26
    }
  ],
  "totalDuration": 340
}
```

#### POST /api/missions
Create custom mission configuration.

**Request:**
```json
{
  "id": "custom_mission",
  "name": "Custom Mission",
  "phases": [...],
  "vehicleConfig": {...}
}
```

**Response:**
```json
{
  "message": "Mission created successfully",
  "mission": {...}
}
```

### 6.3 Telemetry APIs

#### POST /api/telemetry
Submit telemetry data.

**Request:**
```json
{
  "mission": "msl",
  "time": 100.5,
  "altitude": 50000,
  "velocity": 3000,
  "temperature": 1500,
  "gForce": 8.5
}
```

**Response:**
```json
{
  "id": "1704657600000",
  "timestamp": "2024-01-07T12:00:00.000Z",
  "mission": "msl",
  "time": 100.5,
  "altitude": 50000,
  "velocity": 3000
}
```

#### GET /api/telemetry/mission/:id/latest
Get latest telemetry for mission.

**Response:**
```json
{
  "id": "1704657600000",
  "timestamp": "2024-01-07T12:00:00.000Z",
  "mission": "msl",
  "time": 100.5,
  "altitude": 50000,
  "velocity": 3000
}
```

### 6.4 Health APIs

#### GET /api/health
Backend health check.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-07T12:00:00.000Z",
  "uptime": 86400,
  "memory": {
    "rss": 50000000,
    "heapTotal": 30000000,
    "heapUsed": 20000000,
    "external": 1000000
  }
}
```

### 6.5 Future Physics APIs (Client Ready)

#### POST /api/physics/forces
Calculate all forces acting on vehicle.

**Request:**
```json
{
  "vehicleState": {
    "position": { "x": -500000, "y": 3000000, "z": 1500000 },
    "velocity": { "x": 100, "y": -200, "z": 50 },
    "mass": 899,
    "altitude": 50000
  },
  "planetData": {
    "name": "mars",
    "mass": 6.4171e23,
    "radius": 3389500,
    "atmosphereHeight": 132000
  },
  "controls": {
    "mainThrust": 0,
    "pitch": 0,
    "yaw": 0,
    "roll": 0
  }
}
```

**Expected Response:**
```json
{
  "force": {
    "x": 100.5,
    "y": -500.2,
    "z": 50.3
  },
  "debug": {
    "acceleration": { "x": 0.1, "y": -0.5, "z": 0.05 },
    "atmosphericDensity": 0.02,
    "dragCoefficient": 1.5,
    "liftCoefficient": 0.1
  }
}
```

#### GET /api/physics/atmosphere
Get atmospheric properties.

**Parameters:**
- `planet` (query, required): Planet name
- `altitude` (query, required): Altitude in meters
- `velocity` (query, required): Velocity in m/s

**Expected Response:**
```json
{
  "planet": "mars",
  "altitude": 50000,
  "velocity": 3000,
  "density": 0.02,
  "pressure": 100,
  "temperature": 200,
  "speedOfSound": 240,
  "machNumber": 12.5,
  "dynamicPressure": 90000
}
```

#### POST /api/trajectory/modify
Modify trajectory with bank angle.

**Request:**
```json
{
  "currentTime": 100.5,
  "bankAngle": 45,
  "liftDirection": { "x": 1, "y": 0, "z": 0 },
  "trajectoryData": [...]
}
```

**Expected Response:**
```json
{
  "trajectory": [
    {
      "time": 100.5,
      "position": { "x": ..., "y": ..., "z": ... },
      "velocity": { "x": ..., "y": ..., "z": ... },
      "altitude": 50000,
      "velocityMagnitude": 3000,
      "distanceToLanding": 500
    }
  ],
  "metadata": {
    "modificationTime": 100.5,
    "bankAngle": 45,
    "pointsModified": 4000
  }
}
```

---

## 7. Data Flow & Processing

### 7.1 Application Startup

```
1. Server Start
   └─> Express initialization
       └─> API routes registration
           └─> Static file serving setup

2. Client Load
   └─> index.html loads
       └─> main.js initializes
           └─> SimulationManager created
               ├─> Backend health check
               ├─> SceneManager init (Three.js)
               ├─> DataManager init (backend-ready)
               ├─> PhysicsEngine init (backend-ready)
               ├─> TrajectoryManager init (backend-ready)
               ├─> CameraController init
               ├─> UI components init
               └─> Load trajectory data (backend-first)
                   ├─> Try: GET /api/trajectories/:filename
                   └─> Fallback: Load from local CSV
```

### 7.2 Data Loading Flow

```
loadTrajectoryCSV(filename)
    ├─> Check cache
    │   └─> If cached: return immediately
    │
    ├─> Try backend API
    │   ├─> BackendAPIClient.getTrajectory(filename)
    │   ├─> Retry logic (up to 2 attempts)
    │   ├─> If success: cache and return (source: 'backend')
    │   └─> If fail: mark backend unavailable
    │
    └─> Fallback to local
        ├─> Try multiple local paths
        ├─> Parse CSV data
        └─> Return (source: 'local')
```

### 7.3 Physics Calculation Flow

```
calculateForces(vehicleState, planet, controls)
    ├─> If backend available
    │   ├─> POST /api/physics/forces
    │   ├─> If success: return backend forces
    │   └─> If fail: mark backend unavailable
    │
    └─> Local calculation (fallback)
        ├─> Calculate gravity force
        ├─> Calculate drag force (if in atmosphere)
        ├─> Calculate lift force (if in atmosphere)
        ├─> Calculate thrust force
        └─> Return total force vector
```

### 7.4 Trajectory Modification Flow

```
User adjusts bank angle slider
    ↓
handleBankAngle(lastAngle, newAngle)
    ↓
Calculate lift force direction
    ├─> Based on velocity vector
    ├─> Based on spacecraft orientation
    └─> Based on bank angle
    ↓
offsetTrajectoryWithPhysicsRealTime(time, liftDir, bankAngle)
    ├─> If backend available
    │   ├─> POST /api/trajectory/modify
    │   ├─> Convert response to local format
    │   ├─> Update trajectory data
    │   └─> Update visualization
    │
    └─> Local physics calculation (fallback)
        ├─> Find current trajectory point
        ├─> Calculate physics-based modification
        ├─> Apply to future trajectory points
        ├─> Recompute velocities and altitudes
        ├─> Update trajectory data
        └─> Update visualization
    ↓
3D visualization updates in real-time
```

### 7.5 Simulation Loop Flow

```
requestAnimationFrame loop (60 FPS)
    ↓
Update simulation time (if playing)
    ↓
Get current vehicle state
    ├─> trajectoryManager.getDataAtTime(currentTime)
    ├─> Interpolate between trajectory points
    └─> Return position, velocity, altitude, etc.
    ↓
Update vehicle 3D model
    ├─> entryVehicle.updatePosition(vehicleData)
    ├─> Position vehicle in 3D space
    ├─> Orient vehicle based on velocity
    └─> Update orientation indicators
    ↓
Update trajectory visualization
    ├─> trajectoryManager.updateTrajectoryDisplay(currentTime)
    ├─> Update past/future line segments
    ├─> Update trajectory point visibility
    └─> Update position marker
    ↓
Update camera
    ├─> cameraController.update(deltaTime)
    └─> Follow mode: track vehicle
    ↓
Update UI
    ├─> timeline.updateTime(currentTime)
    ├─> phaseInfo.update(currentPhase)
    └─> Display telemetry data
    ↓
Render scene
    └─> sceneManager.render()
```

### 7.6 Backend-Frontend Communication

```
Client Component
    ↓
BackendAPIClient
    ├─> Check cache
    ├─> Prepare request
    ├─> Set timeout
    └─> Send HTTP request
        ↓
    Network Layer
        ↓
    Express Server
        ├─> Middleware (CORS, Helmet, etc.)
        ├─> Route matching
        └─> API Handler
            ├─> Validate request
            ├─> Process data
            └─> Send response
                ↓
    Network Layer
        ↓
BackendAPIClient
    ├─> Receive response
    ├─> Parse JSON
    ├─> Cache result
    └─> Return to component
        ↓
Client Component
    └─> Use data for rendering
```

---

## 8. Features & Capabilities

### 8.1 Core Features

#### 1. Real-time 3D Visualization
- **WebGL Rendering**: Hardware-accelerated 3D graphics
- **High-Fidelity Models**: Detailed spacecraft and planet models
- **Atmospheric Effects**: Realistic atmosphere rendering with scattering
- **Particle Systems**: Thruster flames, dust clouds, heat effects
- **Dynamic Lighting**: Real-time shadows and lighting

#### 2. Multiple Celestial Bodies
- **Mars**: Red planet with thin CO2 atmosphere
- **Earth**: Blue planet with thick N2/O2 atmosphere
- **Jupiter**: Gas giant with massive atmosphere
- Planet-specific properties:
  - Radius and mass
  - Atmospheric composition
  - Surface features
  - Gravity models

#### 3. Physics-Based Simulation
- **Gravitational Forces**: Accurate gravity calculations
- **Atmospheric Drag**: Altitude and velocity-dependent drag
- **Lift Forces**: Aerodynamic lift with bank angle control
- **Thrust Modeling**: Main engines and RCS thrusters
- **Trajectory Prediction**: Future trajectory calculation
- **Orbital Mechanics**: Orbit parameter calculations

#### 4. Backend Integration (NEW)
- **Backend-First Architecture**: Prioritizes server calculations
- **Automatic Fallback**: Seamless switch to local calculations
- **Request Caching**: Optimized data fetching
- **Health Monitoring**: Continuous backend availability tracking
- **Retry Logic**: Automatic retry with exponential backoff

#### 5. Bank Angle Control
- **Real-time Modification**: Adjust trajectory during simulation
- **Lift Vector Control**: Visual lift direction indicator
- **Physics-Based**: Accurate atmospheric physics
- **Instant Visual Feedback**: See trajectory changes immediately
- **Reset Capability**: Restore original trajectory

#### 6. Mission Phase Tracking
- Entry Interface Point
- Guidance Start
- Heading Alignment
- Begin SUFR (Straighten Up and Fly Right)
- Parachute Deployment
- Heat Shield Separation
- Phase-specific telemetry and events

#### 7. Camera System
- **Follow Mode**: Tracks vehicle automatically
- **Free Mode**: Manual camera control with mouse
- **Cinematic Mode**: Dramatic pre-defined views
- **Smooth Transitions**: Interpolated camera movements
- **Zoom Control**: Mouse wheel or buttons

#### 8. Timeline Control
- **Precise Scrubbing**: Click to jump to any time
- **Playback Speed**: 0.5x to 5x speed control
- **Play/Pause**: Space bar control
- **Skip Forward/Back**: Arrow keys for ±5 seconds
- **Phase Markers**: Visual indicators of mission phases

#### 9. Telemetry Display
- Real-time vehicle state
- Altitude, velocity, g-force
- Atmospheric properties
- Mission phase information
- Phase descriptions

### 8.2 Technical Capabilities

#### Performance
- **60 FPS Target**: Smooth animation on modern hardware
- **Instanced Rendering**: Efficient trajectory point rendering
- **LOD System**: Level-of-detail for performance
- **Frustum Culling**: Only render visible objects
- **Optimized Buffers**: Float32Array for positions

#### Data Handling
- **CSV Parsing**: Efficient trajectory data loading
- **JSON Configurations**: Flexible mission setup
- **Caching**: In-memory data caching
- **Batch Loading**: Load multiple files efficiently
- **Data Export**: Export simulation data

#### Extensibility
- **Modular Architecture**: Easy to add new features
- **Plugin System**: Custom components and effects
- **Configuration Files**: JSON-based setup
- **API-First Design**: Backend integration ready

### 8.3 User Interface Features

#### Control Panel
- Play/Pause button
- Playback speed slider
- Camera mode selector
- Zoom in/out buttons
- Bank angle slider (±90°)
- Reset trajectory button
- Fullscreen toggle

#### Timeline
- Progress bar with scrubbing
- Current time display
- Total duration display
- Phase markers
- Hover preview

#### Telemetry Panel
- Current phase name
- Phase description
- Altitude (km)
- Velocity (m/s)
- Time elapsed
- Distance to landing
- Atmospheric density
- G-force

#### Debug Info (Optional)
- FPS counter
- Render stats
- Physics debug info
- Backend connection status
- Cache statistics

### 8.4 Spacecraft Orientation Features

#### Coordinate System
- **J2000 Mars-Centered**: Standard reference frame
- **Body-Fixed Frame**: Spacecraft local coordinates
- **Velocity-Relative Frame**: Flight-path aligned

#### Orientation Visualization
- **Coordinate Axes**: RGB axes (X-Red, Y-Green, Z-Blue)
- **Velocity Vector**: Flight direction indicator
- **Lift Vector**: Aerodynamic lift direction
- **Bank Angle Indicator**: Roll orientation display

#### Bank Angle Control
- **Slider Control**: Adjust between -90° and +90°
- **Real-time Update**: Immediate trajectory response
- **Lift Direction**: Visualized with arrow
- **Physics-Based**: Accurate force calculations

---

## 9. Setup & Installation

### 9.1 Prerequisites

#### Required Software
- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher (comes with Node.js)
- **Modern Browser**: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Git**: For cloning repository

#### Hardware Requirements
- **CPU**: Multi-core processor (Intel i5 or equivalent)
- **RAM**: 4GB minimum, 8GB recommended
- **GPU**: WebGL 2.0 capable graphics card
- **Display**: 1920x1080 or higher resolution

#### Browser Requirements
- WebGL 2.0 support
- ES6 module support
- Fetch API support
- Canvas API support

### 9.2 Installation Steps

#### Step 1: Clone Repository
```bash
git clone https://github.com/yourusername/hypersonic-vehicle-simulation.git
cd hypersonic-vehicle-simulation
```

#### Step 2: Install Dependencies
```bash
npm install
```

This installs:
- express (^4.18.2)
- cors (^2.8.5)
- helmet (^7.0.0)
- compression (^1.7.4)
- multer (^1.4.5-lts.1)
- winston (^3.10.0)
- csvtojson (^2.0.10)

#### Step 3: Verify Data Files
```bash
# Check trajectory data exists
ls client/assets/data/MSL_position_J2000.csv

# If missing, add your trajectory CSV file to:
# client/assets/data/
```

#### Step 4: Start Server
```bash
# Development mode
npm start

# Or with specific port
PORT=3001 npm start

# Or production mode
npm run prod
```

#### Step 5: Open Browser
```
http://localhost:3001
```

### 9.3 Verification

#### Check Server Status
```bash
# Server should output:
HSLV Simulation server running on port 3001
Environment: development
Client files served from: /path/to/client
Open http://localhost:3001 in your browser
```

#### Check Browser Console
```javascript
// Should see these logs:
[DataManager] Attempting to load trajectory from backend
[BackendAPI] Request: GET /api/trajectories/MSL_position_J2000.csv
[DataManager] Successfully loaded trajectory from backend
Simulation Manager initialized
Ready to start simulation
```

#### Test Backend Connection
```bash
# In browser console:
const dm = new DataManager();
await dm.checkBackendHealth();
// Should return: { success: true, data: {...} }
```

### 9.4 Docker Deployment (Optional)

#### Docker Setup
```bash
# Install Docker
# See: https://docs.docker.com/engine/install/

# Build image
docker compose build --pull

# Start services
docker compose up -d

# Check logs
docker compose logs -f

# Stop services
docker compose down
```

#### Docker Configuration
```yaml
# docker-compose.yml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./logs:/app/logs
      - ./client/assets/data:/app/client/assets/data
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3001
```

### 9.5 Development Setup

#### Hot Reload (Optional)
```bash
# Install nodemon
npm install -g nodemon

# Run with auto-restart
nodemon server/index.js
```

#### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm start

# Or specific components
DEBUG=BackendAPI,DataManager npm start
```

#### Browser DevTools
```javascript
// Enable debug mode in console
localStorage.setItem('debug', 'true');

// View all logs
localStorage.setItem('verboseLogging', 'true');
```

---

## 10. Configuration

### 10.1 Server Configuration

#### Environment Variables
```bash
# .env file (create in root directory)
PORT=3001
NODE_ENV=development
LOG_LEVEL=info
ENABLE_CORS=true
```

#### Server Settings
```javascript
// server/server.js

const PORT = process.env.PORT || 3001;
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Middleware configuration
app.use(cors({
    origin: ['http://localhost:3001'],
    credentials: true
}));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            // ... other directives
        }
    }
}));

// Timeouts
server.timeout = 120000; // 2 minutes
server.keepAliveTimeout = 65000; // 65 seconds
```

### 10.2 Client Configuration

#### Simulation Config
```javascript
// client/src/config/SimulationConfig.js

export const config = {
    // Data source
    dataSource: {
        mode: 'backend',              // 'backend' | 'frontend' | 'hybrid'
        backendUrl: window.location.origin,
        fallbackToFrontend: true,
        cacheResults: true
    },

    // Physics settings
    physics: {
        preferBackend: true,
        timeStep: 1/60,
        maxTimeStep: 0.1,
        integrationMethod: 'rk4'
    },

    // Rendering settings
    rendering: {
        antialias: true,
        shadows: true,
        shadowMapSize: 2048,
        maxFPS: 60,
        pixelRatio: window.devicePixelRatio
    },

    // Camera settings
    camera: {
        fov: 45,
        near: 0.01,
        far: 10000,
        defaultDistance: 0.1
    },

    // Performance settings
    performance: {
        useInstancing: true,
        useLOD: true,
        maxTrajectoryPoints: 1000,
        frustumCulling: true
    }
};
```

#### Backend API Configuration
```javascript
// Configure BackendAPIClient
const apiClient = new BackendAPIClient({
    baseURL: 'http://localhost:3001',
    timeout: 10000,           // Request timeout
    retryAttempts: 2,         // Number of retries
    cacheEnabled: true,       // Enable caching
    cacheTTL: 60000          // Cache time-to-live (ms)
});
```

### 10.3 Mission Configuration

#### Mission JSON Format
```json
{
  "id": "msl",
  "name": "Mars Science Laboratory",
  "vehicle": "Curiosity Rover",
  "launchDate": "2011-11-26",
  "landingDate": "2012-08-06",
  "planet": "mars",
  "landingSite": {
    "name": "Gale Crater",
    "latitude": -4.5895,
    "longitude": 137.4417
  },
  "entryInterface": {
    "altitude": 132,
    "velocity": 19300,
    "angle": -15.5
  },
  "phases": [
    {
      "name": "Entry Interface Point",
      "time": 0,
      "altitude": 132,
      "velocity": 19300,
      "description": "Atmospheric entry begins"
    }
  ],
  "vehicleConfig": {
    "mass": 899,
    "heatShieldDiameter": 4.5,
    "parachuteDiameter": 21.5,
    "entryAngle": -15.5,
    "dragCoefficient": 1.5,
    "liftCoefficient": 0.1
  }
}
```

### 10.4 Trajectory Data Format

#### CSV Format
```csv
Time,x,y,z
0.0,-606436.28,3075821.96,1604925.87
0.05,-606562.17,3075739.39,1604947.46
0.1,-606688.04,3075656.82,1604969.04
```

**Requirements:**
- Header row with column names
- Time column (seconds)
- Position columns (x, y, z) in meters
- J2000 Mars-centered coordinate system
- Sorted by time (ascending)

### 10.5 Planet Configuration

#### Adding New Planet
```javascript
// client/src/components/environment/planets/NewPlanet.js

export class NewPlanet {
    constructor() {
        // Physical properties
        this.name = 'newplanet';
        this.radius = 6371000; // meters
        this.mass = 5.972e24; // kg
        this.atmosphereHeight = 100000; // meters
        this.speedOfSound = 340; // m/s

        // Visual properties
        this.color = 0x3366ff;
        this.rotation = 0.0001;

        // Atmospheric model
        this.atmosphericModel = {
            scaleHeight: 8500, // meters
            surfaceDensity: 1.225, // kg/m³
            surfacePressure: 101325, // Pa
            surfaceTemperature: 288 // K
        };
    }

    getAtmosphericDensity(altitude) {
        const { scaleHeight, surfaceDensity } = this.atmosphericModel;
        return surfaceDensity * Math.exp(-altitude / scaleHeight);
    }
}
```

---

## 11. Usage Guide

### 11.1 Basic Usage

#### Starting the Simulation
1. Open browser to `http://localhost:3001`
2. Wait for "Ready to start" message
3. Press **Space** to begin simulation
4. Use timeline to scrub through time
5. Press **Space** again to pause

#### Camera Controls
- **Mouse Drag**: Rotate camera (Free mode)
- **Mouse Wheel**: Zoom in/out
- **1 Key**: Follow mode (tracks vehicle)
- **2 Key**: Free mode (manual control)
- **3 Key**: Cinematic mode (pre-defined views)
- **F Key**: Toggle fullscreen

#### Timeline Controls
- **Space**: Play/Pause
- **Left Arrow**: Skip back 5 seconds
- **Right Arrow**: Skip forward 5 seconds
- **Click Timeline**: Jump to specific time
- **Speed Slider**: Adjust playback speed (0.5x - 5x)

### 11.2 Bank Angle Control

#### Adjusting Bank Angle
1. Locate bank angle slider in control panel
2. Drag slider between -90° and +90°
3. Watch trajectory update in real-time
4. Observe lift direction arrow
5. Click "Reset Trajectory" to restore original

#### Understanding Bank Angle
- **0°**: No roll, lift is perpendicular to velocity
- **+90°**: Roll right, lift points right
- **-90°**: Roll left, lift points left
- **Effect**: Changes horizontal trajectory path

#### Bank Angle Physics
```javascript
// Lift force direction calculation
const up = position.normalize(); // Radial up
const velocity = velocity.normalize(); // Flight direction
const horizontal = cross(velocity, up); // Horizontal perpendicular

// Apply bank angle rotation
const liftDirection = rotate(horizontal, bankAngle);

// Modify trajectory with lift force
applyLiftForce(liftDirection, bankAngle);
```

### 11.3 Viewing Telemetry

#### Telemetry Display
The right panel shows:
- **Current Phase**: Mission phase name
- **Description**: Phase details
- **Altitude**: Height above surface (km)
- **Velocity**: Speed (m/s)
- **Time**: Elapsed time (seconds)
- **Distance**: Distance to landing (km)
- **Density**: Atmospheric density (kg/m³)
- **G-Force**: Deceleration (g's)

#### Phase Transitions
Watch for automatic phase changes:
1. Entry Interface (0s, 132km)
2. Guidance Start (26s, 90km)
3. Heading Alignment (87s, 55km)
4. Begin SUFR (174s, 21km)
5. Parachute Deploy (240s, 13.5km)
6. Heat Shield Separation (260s, 10km)

### 11.4 Backend Status Monitoring

#### Check Backend Connection
```javascript
// Open browser console (F12)

// Check DataManager
const dm = new DataManager();
await dm.checkBackendHealth();
console.log(dm.getBackendStatus());

// Check all components
console.log('DataManager:', dataManager.getBackendStatus());
console.log('PhysicsEngine:', physicsEngine.getBackendStatus());
console.log('TrajectoryManager:', trajectoryManager.getBackendStatus());
```

#### Backend Status Indicators
- **available**: Is backend reachable?
- **preferBackend**: Is backend preferred?
- **lastHealthCheck**: When was last check?
- **cacheSize**: How many cached requests?

### 11.5 Advanced Features

#### Manual Backend Control
```javascript
// Disable backend (force local calculations)
dataManager.setBackendPreference(false);
physicsEngine.setBackendPreference(false);
trajectoryManager.setBackendPreference(false);

// Re-enable backend
dataManager.setBackendPreference(true);
physicsEngine.setBackendPreference(true);
trajectoryManager.setBackendPreference(true);

// Force backend availability check
await dataManager.updateBackendAvailability();
```

#### Cache Management
```javascript
// Clear backend cache
dataManager.backendAPI.clearCache();

// Check cache stats
const stats = dataManager.getCacheStats();
console.log('Cache size:', stats.mb, 'MB');
console.log('Cached items:', stats.size);
```

#### Export Simulation Data
```javascript
// Export trajectory data as JSON
const json = dataManager.exportSimulationData(simulationState, 'json');
dataManager.downloadData(json, 'simulation_data.json');

// Export as CSV
const csv = dataManager.exportSimulationData(simulationState, 'csv');
dataManager.downloadData(csv, 'simulation_data.csv', 'text/csv');
```

### 11.6 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Space** | Play/Pause |
| **1** | Follow camera mode |
| **2** | Free camera mode |
| **3** | Cinematic camera mode |
| **F** | Toggle fullscreen |
| **←** | Skip back 5 seconds |
| **→** | Skip forward 5 seconds |
| **+** | Increase playback speed |
| **-** | Decrease playback speed |
| **R** | Reset trajectory |
| **H** | Toggle UI visibility |
| **D** | Toggle debug info |

---

## 12. Testing

### 12.1 Backend Integration Testing

#### Test 1: Backend Available
```javascript
// Start server: npm start

// In browser console:
const dm = new DataManager();

// Test health check
const health = await dm.checkBackendHealth();
console.log('Backend healthy:', health.success);
// Expected: true

// Test trajectory loading
const data = await dm.loadTrajectoryCSV('MSL_position_J2000.csv');
console.log('Data source:', data.source);
// Expected: 'backend'

// Verify backend status
console.log(dm.getBackendStatus());
// Expected: { available: true, preferBackend: true, ... }
```

#### Test 2: Backend Unavailable
```javascript
// Stop server

// In browser console:
const dm = new DataManager();

// Test trajectory loading (should fallback)
const data = await dm.loadTrajectoryCSV('MSL_position_J2000.csv');
console.log('Data source:', data.source);
// Expected: 'local'

// Verify fallback occurred
console.log(dm.getBackendStatus());
// Expected: { available: false, preferBackend: true, ... }
```

#### Test 3: Force Local Mode
```javascript
// With server running

const dm = new DataManager();

// Disable backend
dm.setBackendPreference(false);

// Load data (should use local even though backend available)
const data = await dm.loadTrajectoryCSV('MSL_position_J2000.csv');
console.log('Data source:', data.source);
// Expected: 'local'
```

#### Test 4: Backend Retry Logic
```javascript
// Temporarily break backend connection
// Then restore it during retry

const dm = new DataManager();

// This should retry and eventually succeed or fallback
const data = await dm.loadTrajectoryCSV('MSL_position_J2000.csv');

// Check logs in console for retry messages:
// [BackendAPI] Attempt 1 failed
// [BackendAPI] Attempt 2 failed
// [DataManager] Backend failed, falling back to local file
```

### 12.2 Physics Testing

#### Test Physics Calculations
```javascript
const physicsEngine = new PhysicsEngine();

// Test vehicle state
const vehicleState = {
    position: new THREE.Vector3(-606436, 3075821, 1604925),
    velocity: new THREE.Vector3(100, -200, 50),
    mass: 899,
    altitude: 50000,
    orientation: new THREE.Quaternion()
};

// Test planet
const planet = {
    name: 'mars',
    mass: 6.4171e23,
    radius: 3389500,
    atmosphereHeight: 132000,
    speedOfSound: 240
};

// Calculate forces
const forces = await physicsEngine.calculateForces(
    vehicleState,
    planet,
    { mainThrust: 0, pitch: 0, yaw: 0, roll: 0 }
);

console.log('Total force:', forces);
console.log('Debug info:', physicsEngine.getDebugInfo());
```

### 12.3 Trajectory Modification Testing

#### Test Bank Angle Modification
```javascript
const trajectoryManager = new TrajectoryManager();

// Load some trajectory data first
// ...

const currentTime = 100;
const bankAngle = 45;
const liftDir = new THREE.Vector3(1, 0, 0);

// Test modification
await trajectoryManager.offsetTrajectoryWithPhysicsRealTime(
    currentTime,
    liftDir,
    bankAngle
);

// Verify trajectory changed
const modifiedData = trajectoryManager.getDataAtTime(currentTime + 10);
console.log('Modified position:', modifiedData.position);
```

### 12.4 Performance Testing

#### FPS Monitoring
```javascript
// In browser console:
let frameCount = 0;
let lastTime = performance.now();

setInterval(() => {
    const currentTime = performance.now();
    const deltaTime = currentTime - lastTime;
    const fps = Math.round((frameCount * 1000) / deltaTime);

    console.log('FPS:', fps);

    frameCount = 0;
    lastTime = currentTime;
}, 1000);

// Increment in animation loop
function animate() {
    frameCount++;
    // ... rest of animation
}
```

#### Memory Usage
```javascript
// Check memory usage
console.log('Memory:', performance.memory);

// Check cache size
const cacheStats = dataManager.getCacheStats();
console.log('Cache memory:', cacheStats.mb, 'MB');

// Check Three.js memory
console.log('Geometries:', renderer.info.memory.geometries);
console.log('Textures:', renderer.info.memory.textures);
```

### 12.5 API Endpoint Testing

#### Using curl
```bash
# Health check
curl http://localhost:3001/api/health

# Get trajectories
curl http://localhost:3001/api/trajectories

# Get specific trajectory
curl http://localhost:3001/api/trajectories/MSL_position_J2000.csv?format=json&limit=10

# Get mission config
curl http://localhost:3001/api/missions/msl

# Post telemetry
curl -X POST http://localhost:3001/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"mission":"msl","time":100,"altitude":50000}'
```

#### Using Browser Fetch
```javascript
// Test trajectory API
fetch('http://localhost:3001/api/trajectories/MSL_position_J2000.csv')
    .then(r => r.json())
    .then(data => console.log('Trajectory:', data));

// Test mission API
fetch('http://localhost:3001/api/missions/msl')
    .then(r => r.json())
    .then(data => console.log('Mission:', data));

// Test health API
fetch('http://localhost:3001/api/health')
    .then(r => r.json())
    .then(data => console.log('Health:', data));
```

### 12.6 Browser Compatibility Testing

#### Recommended Browsers
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

#### Feature Detection
```javascript
// Check WebGL 2.0 support
const canvas = document.createElement('canvas');
const gl = canvas.getContext('webgl2');
if (!gl) {
    console.error('WebGL 2.0 not supported');
}

// Check ES6 module support
if (!('noModule' in document.createElement('script'))) {
    console.error('ES6 modules not supported');
}

// Check Fetch API
if (!window.fetch) {
    console.error('Fetch API not supported');
}
```

---

## 13. Troubleshooting

### 13.1 Backend Connection Issues

#### Problem: "Backend not available" messages

**Symptoms:**
- Console shows `[DataManager] Backend failed, falling back to local file`
- Data source is always 'local'
- Backend status shows `available: false`

**Solutions:**

1. **Check server is running**
   ```bash
   # In terminal
   npm start

   # Should see:
   # HSLV Simulation server running on port 3001
   ```

2. **Check server logs**
   ```bash
   # Look for errors in server output
   # Check logs/error.log if using winston
   tail -f logs/error.log
   ```

3. **Test health endpoint**
   ```bash
   curl http://localhost:3001/api/health

   # Should return:
   # {"status":"healthy","timestamp":"..."}
   ```

4. **Check network tab in browser**
   - Open DevTools (F12)
   - Go to Network tab
   - Look for failed API requests (red)
   - Check request details and response

5. **Verify CORS settings**
   ```javascript
   // In server.js, ensure CORS is enabled:
   app.use(cors({
       origin: ['http://localhost:3001'],
       credentials: true
   }));
   ```

6. **Force backend re-check**
   ```javascript
   // In browser console:
   await dataManager.updateBackendAvailability();
   console.log(dataManager.getBackendStatus());
   ```

#### Problem: Slow API responses

**Solutions:**

1. **Clear cache**
   ```javascript
   dataManager.backendAPI.clearCache();
   ```

2. **Increase timeout**
   ```javascript
   const apiClient = new BackendAPIClient({
       timeout: 20000 // Increase to 20 seconds
   });
   ```

3. **Check network conditions**
   - Use browser DevTools Network tab
   - Look for slow requests
   - Check server response times

4. **Optimize data queries**
   ```javascript
   // Use limit parameter
   const data = await backendAPI.getTrajectory(filename, {
       limit: 100 // Load only 100 points
   });
   ```

### 13.2 Trajectory Issues

#### Problem: Trajectory not loading

**Symptoms:**
- No trajectory line visible
- Console error: "Failed to load trajectory data"
- "File not found" errors

**Solutions:**

1. **Verify file exists**
   ```bash
   ls client/assets/data/MSL_position_J2000.csv
   ```

2. **Check file format**
   ```csv
   Time,x,y,z
   0.0,-606436.28,3075821.96,1604925.87
   0.05,-606562.17,3075739.39,1604947.46
   ```
   - Must have header row
   - Must be comma-separated
   - Must have Time,x,y,z columns

3. **Check file path**
   ```javascript
   // In SimulationManager, verify path:
   dataPath: '/assets/data/MSL_position_J2000.csv'
   ```

4. **Test backend API**
   ```bash
   curl http://localhost:3001/api/trajectories/MSL_position_J2000.csv
   ```

5. **Check console for errors**
   ```javascript
   // Look for:
   [DataManager] Error loading trajectory CSV
   [BackendAPI] Request failed
   ```

#### Problem: Trajectory modification not working

**Symptoms:**
- Bank angle slider moves but trajectory doesn't change
- No visual feedback
- Console errors

**Solutions:**

1. **Check if trajectory is loaded**
   ```javascript
   console.log('Trajectory points:', trajectoryManager.trajectoryData.length);
   // Should be > 0
   ```

2. **Verify bank angle is changing**
   ```javascript
   // In handleBankAngle method, add:
   console.log('Bank angle changed:', lastAngle, '→', newAngle);
   ```

3. **Check lift direction calculation**
   ```javascript
   // Should see lift direction vector
   console.log('Lift direction:', liftForceDirection);
   ```

4. **Test local modification (bypass backend)**
   ```javascript
   trajectoryManager.setBackendPreference(false);
   // Try bank angle adjustment again
   ```

5. **Check for backend errors**
   ```javascript
   // Look for:
   [TrajectoryManager] Backend modification failed
   [BackendAPI] Trajectory modification endpoint not available
   ```

### 13.3 Rendering Issues

#### Problem: Black screen or no 3D view

**Solutions:**

1. **Check WebGL support**
   ```javascript
   const canvas = document.createElement('canvas');
   const gl = canvas.getContext('webgl2');
   console.log('WebGL 2.0:', gl ? 'Supported' : 'Not supported');
   ```

2. **Check console for errors**
   - Look for Three.js errors
   - Look for shader compilation errors
   - Look for texture loading errors

3. **Verify scene objects**
   ```javascript
   console.log('Scene children:', sceneManager.scene.children.length);
   // Should be > 0
   ```

4. **Check camera position**
   ```javascript
   console.log('Camera position:', camera.position);
   console.log('Camera looking at:', controls.target);
   ```

5. **Try different camera mode**
   - Press 1, 2, or 3 keys
   - Try zooming in/out

#### Problem: Low FPS / Performance issues

**Solutions:**

1. **Check FPS**
   ```javascript
   // See FPS in stats panel or console
   console.log('FPS:', stats.getFPS());
   ```

2. **Reduce visual quality**
   ```javascript
   // In config:
   rendering: {
       antialias: false,
       shadows: false,
       pixelRatio: 1
   }
   ```

3. **Reduce trajectory points**
   ```javascript
   // In TrajectoryManager:
   performance: {
       maxTrajectoryPoints: 500 // Reduce from 1000
   }
   ```

4. **Disable effects**
   - Turn off atmospheric effects
   - Disable particle systems
   - Reduce LOD quality

5. **Check GPU usage**
   - Open task manager / activity monitor
   - Check GPU utilization
   - Ensure GPU acceleration enabled in browser

### 13.4 UI Issues

#### Problem: Controls not responding

**Solutions:**

1. **Check event listeners**
   ```javascript
   // Verify controls are initialized
   console.log('Controls:', controls);
   ```

2. **Check for JavaScript errors**
   - Open browser console
   - Look for errors in UI components

3. **Test specific controls**
   ```javascript
   // Test play/pause
   controls.handlePlayPause();

   // Test bank angle
   controls.handleBankAngle(0, 45);
   ```

4. **Reload page**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

#### Problem: Timeline not updating

**Solutions:**

1. **Check timeline initialization**
   ```javascript
   console.log('Timeline:', timeline);
   console.log('Total time:', timeline.totalTime);
   ```

2. **Verify time updates**
   ```javascript
   // In simulation loop:
   console.log('Current time:', state.currentTime);
   ```

3. **Check timeline element**
   ```javascript
   const timelineEl = document.getElementById('timeline-container');
   console.log('Timeline element:', timelineEl);
   ```

### 13.5 Data Issues

#### Problem: CSV parsing errors

**Solutions:**

1. **Check CSV format**
   - Must be comma-separated
   - No extra commas
   - Consistent column count
   - Valid numbers (no text in numeric columns)

2. **Test CSV manually**
   ```javascript
   const text = `Time,x,y,z
   0.0,-606436.28,3075821.96,1604925.87
   0.05,-606562.17,3075739.39,1604947.46`;

   const data = dataManager.parseCSV(text);
   console.log('Parsed:', data);
   ```

3. **Check for special characters**
   - Ensure UTF-8 encoding
   - No BOM (Byte Order Mark)
   - Unix line endings (LF not CRLF)

#### Problem: Mission config not loading

**Solutions:**

1. **Check mission file**
   ```bash
   ls server/data/missions/msl.json
   cat server/data/missions/msl.json
   ```

2. **Validate JSON**
   ```bash
   # Use JSON validator
   cat server/data/missions/msl.json | jq
   ```

3. **Test mission API**
   ```bash
   curl http://localhost:3001/api/missions/msl
   ```

4. **Check default fallback**
   ```javascript
   // Should use default config if backend fails
   const config = await dataManager.loadMissionConfig('msl');
   console.log('Config source:', config.source);
   // Should be 'backend' or 'default'
   ```

### 13.6 Common Error Messages

#### "MIME type error"
```
Failed to load module script: Expected a JavaScript module script but the server responded with a MIME type of "text/html"
```

**Solution:**
```javascript
// In server.js, ensure:
app.use('/src', express.static(path.join(clientPath, 'src'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));
```

#### "CORS error"
```
Access to fetch at 'http://localhost:3001/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

**Solution:**
```javascript
// In server.js:
app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    credentials: true
}));
```

#### "Cannot read property 'length' of undefined"
```
TypeError: Cannot read property 'length' of undefined at TrajectoryManager
```

**Solution:**
- Trajectory data not loaded yet
- Check that data loading completed before accessing
- Add null checks:
```javascript
if (this.trajectoryData && this.trajectoryData.length > 0) {
    // Process trajectory
}
```

---

## 14. Performance Optimization

### 14.1 Frontend Optimization

#### Three.js Optimization

1. **Geometry Optimization**
   ```javascript
   // Use BufferGeometry instead of Geometry
   const geometry = new THREE.BufferGeometry();

   // Use Float32Array for positions
   const positions = new Float32Array(points.length * 3);
   geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

   // Dispose unused geometries
   geometry.dispose();
   ```

2. **Instanced Rendering**
   ```javascript
   // Use InstancedMesh for repeated objects
   const geometry = new THREE.SphereGeometry(0.02, 4, 2);
   const material = new THREE.MeshBasicMaterial({ color: 0x00ffff });
   const mesh = new THREE.InstancedMesh(geometry, material, 1000);

   // Update instances
   const matrix = new THREE.Matrix4();
   for (let i = 0; i < count; i++) {
       matrix.setPosition(positions[i]);
       mesh.setMatrixAt(i, matrix);
   }
   mesh.instanceMatrix.needsUpdate = true;
   ```

3. **Frustum Culling**
   ```javascript
   // Enable frustum culling
   mesh.frustumCulled = true;

   // Compute bounding spheres
   geometry.computeBoundingSphere();
   ```

4. **LOD (Level of Detail)**
   ```javascript
   const lod = new THREE.LOD();
   lod.addLevel(highDetailMesh, 0);
   lod.addLevel(mediumDetailMesh, 50);
   lod.addLevel(lowDetailMesh, 100);
   scene.add(lod);
   ```

5. **Texture Optimization**
   ```javascript
   // Use power-of-2 textures
   // Use mipmaps
   texture.generateMipmaps = true;
   texture.minFilter = THREE.LinearMipmapLinearFilter;

   // Compress textures
   texture.format = THREE.RGBFormat;
   ```

#### Rendering Optimization

1. **Reduce Draw Calls**
   - Merge geometries where possible
   - Use instanced rendering
   - Batch similar objects

2. **Optimize Shaders**
   - Minimize calculations in fragment shader
   - Use vertex shader for heavy calculations
   - Pre-calculate constants

3. **Frame Rate Control**
   ```javascript
   const targetFPS = 60;
   const frameTime = 1000 / targetFPS;
   let lastFrameTime = 0;

   function animate(currentTime) {
       requestAnimationFrame(animate);

       const deltaTime = currentTime - lastFrameTime;
       if (deltaTime < frameTime) return;

       lastFrameTime = currentTime;

       // Render frame
       render();
   }
   ```

### 14.2 Backend Optimization

#### API Response Optimization

1. **Caching**
   ```javascript
   // Server-side caching
   const cache = new Map();

   app.get('/api/trajectories/:filename', (req, res) => {
       const cacheKey = req.params.filename;

       if (cache.has(cacheKey)) {
           return res.json(cache.get(cacheKey));
       }

       // Load and cache
       const data = loadTrajectoryData(cacheKey);
       cache.set(cacheKey, data);
       res.json(data);
   });
   ```

2. **Compression**
   ```javascript
   // Enable gzip compression
   import compression from 'compression';
   app.use(compression());
   ```

3. **Pagination**
   ```javascript
   // Limit data per request
   router.get('/api/trajectories/:filename', (req, res) => {
       const limit = parseInt(req.query.limit) || 100;
       const offset = parseInt(req.query.offset) || 0;

       const data = trajectoryData.slice(offset, offset + limit);
       res.json({ data, total: trajectoryData.length });
   });
   ```

#### Database Optimization (if using DB)

1. **Indexing**
   ```sql
   CREATE INDEX idx_time ON trajectory_points(time);
   CREATE INDEX idx_mission ON missions(id);
   ```

2. **Query Optimization**
   ```sql
   -- Use prepared statements
   -- Limit results
   -- Use appropriate indexes
   SELECT * FROM trajectory_points
   WHERE time BETWEEN ? AND ?
   LIMIT 1000;
   ```

### 14.3 Network Optimization

#### Request Optimization

1. **Batch Requests**
   ```javascript
   // Load multiple resources in parallel
   const [trajectory, mission, telemetry] = await Promise.all([
       dataManager.loadTrajectoryCSV(filename),
       dataManager.loadMissionConfig(missionId),
       dataManager.getLatestTelemetry(missionId)
   ]);
   ```

2. **Request Caching**
   ```javascript
   // Client-side caching with TTL
   const cache = new Map();
   const TTL = 60000; // 1 minute

   function getCached(key) {
       const cached = cache.get(key);
       if (cached && Date.now() - cached.time < TTL) {
           return cached.data;
       }
       return null;
   }
   ```

3. **Lazy Loading**
   ```javascript
   // Load trajectory points on demand
   async function loadTrajectoryRange(start, end) {
       return await backendAPI.getTrajectoryRange(start, end, 100);
   }
   ```

### 14.4 Memory Optimization

#### Memory Management

1. **Dispose Resources**
   ```javascript
   // Dispose Three.js resources
   function disposeObject(obj) {
       if (obj.geometry) obj.geometry.dispose();
       if (obj.material) {
           if (Array.isArray(obj.material)) {
               obj.material.forEach(m => m.dispose());
           } else {
               obj.material.dispose();
           }
       }
       if (obj.texture) obj.texture.dispose();
   }
   ```

2. **Clear Caches**
   ```javascript
   // Periodic cache clearing
   setInterval(() => {
       dataManager.clearCache();
       backendAPI.clearCache();
   }, 300000); // Every 5 minutes
   ```

3. **Monitor Memory**
   ```javascript
   // Log memory usage
   console.log('Memory:', performance.memory);
   console.log('Geometries:', renderer.info.memory.geometries);
   console.log('Textures:', renderer.info.memory.textures);
   ```

### 14.5 Performance Monitoring

#### FPS Monitoring
```javascript
const stats = {
    fps: 0,
    ms: 0,
    frames: 0,
    lastTime: performance.now()
};

function updateStats() {
    stats.frames++;
    const currentTime = performance.now();
    const deltaTime = currentTime - stats.lastTime;

    if (deltaTime >= 1000) {
        stats.fps = Math.round((stats.frames * 1000) / deltaTime);
        stats.ms = Math.round(deltaTime / stats.frames);
        stats.frames = 0;
        stats.lastTime = currentTime;

        console.log(`FPS: ${stats.fps}, MS: ${stats.ms}`);
    }
}
```

#### Performance Profiling
```javascript
// Use browser DevTools Performance tab
// Or manual profiling:

console.time('trajectory-load');
await dataManager.loadTrajectoryCSV(filename);
console.timeEnd('trajectory-load');

console.time('physics-calc');
const forces = await physicsEngine.calculateForces(state, planet, controls);
console.timeEnd('physics-calc');
```

---

## 15. Deployment

### 15.1 Production Build

#### Preparation
```bash
# 1. Update version
npm version patch/minor/major

# 2. Test thoroughly
npm test

# 3. Build (if applicable)
npm run build

# 4. Check for security vulnerabilities
npm audit

# 5. Fix vulnerabilities
npm audit fix
```

#### Environment Configuration
```bash
# Create .env.production
NODE_ENV=production
PORT=3001
LOG_LEVEL=error
```

### 15.2 Server Deployment

#### Manual Deployment

```bash
# 1. Copy files to server
scp -r . user@server:/var/www/hypersonic-sim/

# 2. SSH to server
ssh user@server

# 3. Navigate to directory
cd /var/www/hypersonic-sim/

# 4. Install dependencies
npm install --production

# 5. Start server
npm start
```

#### PM2 Process Manager

```bash
# Install PM2
npm install -g pm2

# Start application
pm2 start server/index.js --name hypersonic-sim

# View logs
pm2 logs hypersonic-sim

# Monitor
pm2 monit

# Restart
pm2 restart hypersonic-sim

# Stop
pm2 stop hypersonic-sim

# Setup auto-start on boot
pm2 startup
pm2 save
```

#### PM2 Ecosystem File
```javascript
// ecosystem.config.js
module.exports = {
    apps: [{
        name: 'hypersonic-sim',
        script: 'server/index.js',
        instances: 2,
        exec_mode: 'cluster',
        env: {
            NODE_ENV: 'production',
            PORT: 3001
        },
        error_file: 'logs/error.log',
        out_file: 'logs/out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        max_memory_restart: '1G'
    }]
};
```

### 15.3 Docker Deployment

#### Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

RUN chmod -R 777 logs

EXPOSE 3001

CMD ["node", "server/index.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "3001:3001"
    volumes:
      - ./logs:/app/logs
      - ./client/assets/data:/app/client/assets/data
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3001
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
```

#### Docker Commands
```bash
# Build image
docker compose build --pull

# Start services
docker compose up -d

# View logs
docker compose logs -f

# Restart services
docker compose restart

# Stop services
docker compose down

# Remove volumes
docker compose down -v
```

### 15.4 Nginx Configuration

#### Nginx as Reverse Proxy
```nginx
server {
    listen 80;
    server_name hypersonics.yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name hypersonics.yourdomain.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static file caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        proxy_pass http://localhost:3001;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 15.5 GitHub Actions CI/CD

#### .github/workflows/deploy.yml
```yaml
name: Deploy

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: self-hosted

    steps:
    - uses: actions/checkout@v3

    - name: Install dependencies
      run: npm install --production

    - name: Build Docker image
      run: docker compose build --pull

    - name: Restart services
      run: docker compose up -d

    - name: Health check
      run: |
        sleep 10
        curl -f http://localhost:3001/api/health || exit 1
```

### 15.6 Monitoring & Logging

#### Logging Setup
```bash
# Create logs directory
mkdir -p logs
chmod -R 777 logs

# Logs will be written to:
# - logs/error.log (errors only)
# - logs/combined.log (all logs)
```

#### Log Rotation
```bash
# Install logrotate
sudo apt-get install logrotate

# Create config
sudo nano /etc/logrotate.d/hypersonic-sim

# Add:
/var/www/hypersonic-sim/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0777 root root
    sharedscripts
}
```

#### Monitoring Endpoints
```bash
# Health check
curl http://localhost:3001/api/health

# Stats
curl http://localhost:3001/api/stats

# PM2 monitoring
pm2 monit

# System resources
htop
```

---

## 16. Contributing

### 16.1 Development Workflow

#### Setting Up Development Environment
```bash
# 1. Fork repository
# 2. Clone your fork
git clone https://github.com/yourusername/hypersonic-vehicle-simulation.git
cd hypersonic-vehicle-simulation

# 3. Add upstream remote
git remote add upstream https://github.com/originaluser/hypersonic-vehicle-simulation.git

# 4. Install dependencies
npm install

# 5. Create feature branch
git checkout -b feature/your-feature-name

# 6. Make changes and commit
git add .
git commit -m "Add your feature"

# 7. Push to your fork
git push origin feature/your-feature-name

# 8. Create pull request
```

### 16.2 Code Style

#### JavaScript Style
```javascript
// Use ES6+ features
const variable = value;
const arrow = () => {};

// Use async/await instead of promises
async function loadData() {
    const data = await fetch(url);
    return data.json();
}

// Use template literals
const message = `Hello, ${name}!`;

// Destructuring
const { x, y, z } = position;

// Default parameters
function calculate(value = 0) {}
```

#### Naming Conventions
```javascript
// Classes: PascalCase
class PhysicsEngine {}

// Functions: camelCase
function calculateForces() {}

// Constants: UPPER_SNAKE_CASE
const MAX_VELOCITY = 5000;

// Private methods: _prefix
_internalMethod() {}

// Backend preference: descriptive names
preferBackend, backendAvailable, backendAPI
```

### 16.3 Adding New Features

#### Adding New Planet
```javascript
// 1. Create planet class
// client/src/components/environment/planets/Neptune.js

export class Neptune {
    constructor() {
        this.name = 'neptune';
        this.radius = 24622000; // meters
        this.mass = 1.024e26; // kg
        // ... other properties
    }

    getAtmosphericDensity(altitude) {
        // Implement atmospheric model
    }
}

// 2. Import in SimulationManager
import { Neptune } from './components/environment/planets/Neptune.js';

// 3. Add to planet switching
this.neptune = new Neptune();

// 4. Update UI controls
['mars', 'earth', 'jupiter', 'neptune'].forEach(planet => {
    // ...
});
```

#### Adding New Backend Endpoint
```javascript
// 1. Add to server API
// server/api/custom.js

export default router;

// 2. Register in server.js
import customAPI from './api/custom.js';
app.use('/api/custom', customAPI);

// 3. Add to BackendAPIClient
async getCustomData() {
    return await this.request('/api/custom', { method: 'GET' });
}

// 4. Use in client
const data = await backendAPI.getCustomData();
```

### 16.4 Testing Guidelines

#### Unit Tests
```javascript
// tests/physics.test.js
import { PhysicsEngine } from '../client/src/core/PhysicsEngine.js';

describe('PhysicsEngine', () => {
    test('calculates gravity correctly', () => {
        const engine = new PhysicsEngine();
        const force = engine.calculateGravityForce(vehicleState, planet);
        expect(force.length()).toBeCloseTo(expectedValue);
    });
});
```

#### Integration Tests
```javascript
// tests/integration.test.js
describe('Backend Integration', () => {
    test('loads trajectory from backend', async () => {
        const dm = new DataManager();
        const data = await dm.loadTrajectoryCSV('test.csv');
        expect(data.source).toBe('backend');
    });
});
```

### 16.5 Documentation

#### Code Documentation
```javascript
/**
 * Calculate all forces acting on the vehicle
 * @param {Object} vehicleState - Current vehicle state (position, velocity, mass)
 * @param {Object} planet - Planet properties (mass, radius, atmosphere)
 * @param {Object} controls - Control inputs (thrust, pitch, yaw, roll)
 * @returns {THREE.Vector3} Total force vector
 */
async calculateForces(vehicleState, planet, controls) {
    // Implementation
}
```

#### README Updates
- Update feature list
- Add usage examples
- Document breaking changes
- Update API documentation

### 16.6 Pull Request Guidelines

#### PR Checklist
- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console.log statements in production code
- [ ] Backend integration tested
- [ ] Performance tested
- [ ] Browser compatibility tested

#### PR Description Template
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Screenshots
If applicable

## Checklist
- [ ] Tests pass
- [ ] Documentation updated
- [ ] Backend integration works
```

---

## Appendix A: File Reference

### Core Files

| File | Lines | Purpose |
|------|-------|---------|
| `BackendAPIClient.js` | 530 | Backend API communication |
| `DataManager.js` | 468 | Data loading and caching |
| `PhysicsEngine.js` | 556 | Physics calculations |
| `TrajectoryManager.js` | 856 | Trajectory visualization |
| `SimulationManager.js` | 650 | Main simulation controller |
| `CameraController.js` | 380 | Camera management |
| `server.js` | 229 | Express server setup |
| `trajectories.js` | 309 | Trajectory API |
| `missions.js` | 337 | Mission configuration API |

### Configuration Files

| File | Purpose |
|------|---------|
| `package.json` | Dependencies and scripts |
| `.env` | Environment variables |
| `ecosystem.config.js` | PM2 configuration |
| `docker-compose.yml` | Docker configuration |
| `nginx.conf` | Nginx configuration |

### Data Files

| File | Format | Content |
|------|--------|---------|
| `MSL_position_J2000.csv` | CSV | MSL trajectory data |
| `msl.json` | JSON | MSL mission configuration |

---

## Appendix B: API Reference

### Complete Endpoint List

#### Trajectory Endpoints
1. `GET /api/trajectories` - List trajectories
2. `GET /api/trajectories/:filename` - Get trajectory data
3. `GET /api/trajectories/:filename/interpolate` - Interpolate position
4. `POST /api/trajectories/analyze` - Analyze trajectory
5. `GET /api/data/msl-trajectory/range` - Get time range
6. `GET /api/data/msl-trajectory/at-time` - Get at time
7. `GET /api/data/msl-trajectory/metadata` - Get metadata

#### Mission Endpoints
8. `GET /api/missions` - List missions
9. `GET /api/missions/:id` - Get mission
10. `GET /api/missions/:id/phases` - Get phases
11. `GET /api/missions/:id/phase/:name` - Get phase
12. `POST /api/missions` - Create mission
13. `PUT /api/missions/:id` - Update mission

#### Telemetry Endpoints
14. `GET /api/telemetry` - Get telemetry
15. `POST /api/telemetry` - Submit telemetry
16. `GET /api/telemetry/mission/:id/latest` - Latest telemetry

#### Health Endpoints
17. `GET /api/health` - Health check
18. `GET /api/stats` - Statistics

#### Future Endpoints (Client Ready)
19. `POST /api/physics/forces` - Calculate forces
20. `GET /api/physics/atmosphere` - Atmospheric properties
21. `POST /api/trajectory/modify` - Modify trajectory
22. `POST /api/trajectory/calculate` - Calculate trajectory

---

## Appendix C: Glossary

### Technical Terms

**Backend-First Architecture**: Design pattern where client attempts server operations before local calculations

**Fallback Mechanism**: Automatic switch to alternative method when primary fails

**Trajectory**: Path taken by vehicle through 3D space over time

**Bank Angle**: Roll angle used to direct lift force horizontally

**EDL**: Entry, Descent, and Landing - phases of atmospheric entry

**J2000**: Standard astronomical coordinate system

**WebGL**: Web Graphics Library for 3D rendering in browsers

**Three.js**: JavaScript 3D library built on WebGL

**Instanced Rendering**: Technique to render many identical objects efficiently

**LOD**: Level of Detail - varying detail based on distance

**FPS**: Frames Per Second - measure of rendering performance

**Telemetry**: Data transmitted from vehicle about its state

**RCS**: Reaction Control System - small thrusters for attitude control

**SUFR**: Straighten Up and Fly Right - maneuver to align vehicle

**Hypersonic**: Speeds greater than Mach 5 (5x speed of sound)

**Atmospheric Drag**: Force opposing motion through atmosphere

**Lift Force**: Perpendicular force generated by vehicle in atmosphere

**Gravitational Force**: Attraction between masses (vehicle and planet)

**Orbital Mechanics**: Physics of objects in orbit

**Phase Controller**: System managing mission phase transitions

**Interpolation**: Calculating intermediate values between known points

**Buffer Geometry**: Efficient Three.js geometry using typed arrays

**Material**: Visual properties of 3D objects (color, texture, etc.)

**Mesh**: 3D object combining geometry and material

**Scene**: Container for all 3D objects in Three.js

**Camera**: Virtual viewpoint for rendering 3D scene

**Renderer**: System that converts 3D scene to 2D image

---

## Appendix D: Version History

### Version 2.0.0 (2025-01-07)
**Major Release: Backend Integration**

**Added:**
- Backend API integration with automatic fallback
- BackendAPIClient service
- Backend-first data loading
- Backend physics calculations (ready)
- Backend trajectory modifications (ready)
- Request caching with TTL
- Automatic retry with exponential backoff
- Health checking and availability tracking
- Backend control methods on all components

**Changed:**
- DataManager now tries backend first
- PhysicsEngine calculates via backend first
- TrajectoryManager modifies via backend first
- SimulationDataProvider defaults to 'backend' mode
- All data loading respects backend preference

**Documentation:**
- Complete project documentation created
- Backend integration guide
- API documentation
- Testing guide
- Troubleshooting guide

### Version 1.0.0 (Previous)
**Initial Release**

**Features:**
- 3D visualization with Three.js
- Multiple planets (Mars, Earth, Jupiter)
- Physics-based simulation
- Trajectory visualization
- Bank angle control
- Mission phase tracking
- Camera modes
- Timeline control
- Telemetry display
- Local calculations only

---

## Appendix E: License & Credits

### License
This project is licensed under the MIT License.

### Credits

**Development:**
- Core simulation engine
- Backend integration architecture
- 3D visualization system
- Physics calculations

**Data Sources:**
- NASA JPL for trajectory data
- NASA for mission configurations
- Mars atmospheric models

**Technologies:**
- Three.js - MIT License
- Express.js - MIT License
- Node.js - MIT License

**Acknowledgments:**
- WPI Hypersonics Lab
- NASA EDL team
- Open source community

---

## Appendix F: Contact & Support

### Support Channels

**Documentation:**
- This comprehensive documentation
- README.md for quick start
- Code comments for implementation details

**Issues:**
- GitHub Issues for bug reports
- Feature requests via GitHub

**Community:**
- Discussions on GitHub

**Development:**
- Fork and contribute via pull requests
- Follow contribution guidelines

---

## Appendix G: Quick Reference

### Quick Commands

```bash
# Installation
npm install

# Start server
npm start

# Production mode
npm run prod

# Docker
docker compose up -d

# PM2
pm2 start ecosystem.config.js

# Health check
curl http://localhost:3001/api/health

# Clear logs
rm -rf logs/*
```

### Quick API Tests

```bash
# Trajectory
curl http://localhost:3001/api/trajectories/MSL_position_J2000.csv?limit=10

# Mission
curl http://localhost:3001/api/missions/msl

# Telemetry
curl -X POST http://localhost:3001/api/telemetry \
  -H "Content-Type: application/json" \
  -d '{"mission":"msl","time":100,"altitude":50000}'
```

### Quick Troubleshooting

```javascript
// Check backend
await dataManager.checkBackendHealth();

// Check status
console.log(dataManager.getBackendStatus());

// Force local
dataManager.setBackendPreference(false);

// Clear cache
dataManager.backendAPI.clearCache();
```

---

**END OF DOCUMENTATION**

*For the latest updates, visit the GitHub repository.*
*Last updated: 2025-01-07*
*Version: 2.0.0*
