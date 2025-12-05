# Hypersonic Vehicle Simulation

A high-fidelity 3D simulation platform for atmospheric entry, descent, and landing (EDL) of hypersonic vehicles across multiple celestial bodies in the solar system.

## 🚀 Overview

This simulation provides real-time visualization and analysis of hypersonic vehicle trajectories during atmospheric entry on various planets and moons. Built with Three.js and featuring actual trajectory data, it offers an immersive experience for understanding the complex dynamics of EDL missions.


## 🛠️ Tech Stack

- **Frontend**: Three.js, ES6 Modules, WebGL
- **Backend**: Node.js, Express.js
- **Data**: CSV trajectory files, JSON mission configurations
- **Visualization**: Custom shaders, particle systems, atmospheric effects

## 📋 Prerequisites

- Node.js v18+ 
- Modern browser with WebGL support
- Trajectory data files (CSV format)

## 🚀 Quick Start

```bash
# Clone repository
git clone https://github.com/yourusername/hypersonic-vehicle-simulation.git
cd hypersonic-vehicle-simulation

# Install dependencies
npm install

# Place trajectory data in client/assets/data/
# Example: MSL_position_J2000.csv

# Start development server
npm start

# Open http://localhost:3001
```

## 🖥️ Running the Application

## Server Deployment

**Install Docker:**
1. https://docs.docker.com/engine/install/ubuntu/ (apt instructions)
2. https://docs.docker.com/engine/install/ubuntu/ (post install instructions)
3. `sudo chmod 666 /var/run/docker.sock`

**Start Server Manually:**
1. `docker compose build --pull`
2. `docker compose up -d`

Note: Since both the server and nginx are set to always restart, this will continue to work in the case of either the server crashing or the host restarting.

**Deploy on push to main:**

Adding a self-hosted github actions runner:
https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/add-runners#adding-a-self-hosted-runner-to-a-repository

Configuring the runner to automatically run on the server in the background:
https://docs.github.com/en/actions/how-tos/manage-runners/self-hosted-runners/configure-the-application

We already have a GitHub action that will perform this action, so besides registering the server as a runner, there are no other tasks required.

The actions runner on the hypersonics.wpi.edu server is stored under wlgoldman/actions-runner.

See the runner configuration link above to control it via systemd.

**Logging:**

To ensure that the app can log to the `logs` folder within this codebase, we open write permissions to that folder:

`sudo chmod -R 777 logs`

### Development Mode
```bash
# Start the server
npm start
# or
npm run dev

# Server runs on http://localhost:3001
# Open this URL in your browser
```

### Production Mode
```bash
# Start with production settings
npm run prod

# Or use PM2 for process management
pm2 start server/index.js --name "hypersonic-sim"
```

### First Time Setup
1. Ensure all files are in correct directories (see Project Structure)
2. Check that `MSL_position_J2000.csv` is in `client/assets/data/`
3. Start server: `npm start`
4. Open browser to `http://localhost:3001`
5. Wait for "Ready!" status
6. Press Space to begin simulation

### Troubleshooting
- **404 Errors**: Check file paths match directory structure
- **MIME Type Errors**: Restart server, clear browser cache
- **No Trajectory Data**: Verify CSV file is in `client/assets/data/`
- **Port Already in Use**: Change port in `server.js` or use `PORT=3002 npm start`

## 📁 Project Structure

```
hypersonic-vehicle-simulation/
├── client/
│   ├── src/
│   │   ├── core/              # Three.js scene, camera, rendering
│   │   ├── components/        # 3D models, environments, effects
│   │   ├── simulation/        # Physics, trajectory, phases
│   │   ├── ui/               # Controls, timeline, telemetry
│   │   └── data/             # Data loading and management
│   ├── assets/
│   │   ├── data/             # Trajectory CSV files
│   │   ├── models/           # 3D vehicle models
│   │   └── textures/         # Planet textures
│   └── index.html
├── server/
│   ├── api/                  # REST endpoints
│   └── server.js             # Express server
└── package.json
```

## 🎮 Controls

| Key/Action | Function |
|------------|----------|
| **Space** | Play/Pause |
| **1/2/3** | Camera modes (Follow/Free/Cinematic) |
| **←/→** | Skip ±5 seconds |
| **Mouse Wheel** | Zoom |
| **F** | Fullscreen |
| **Timeline Click** | Scrub to position |


## 📊 Data Format

### Trajectory CSV
```csv
Time,x,y,z
0.0,-606436.28,3075821.96,1604925.87
0.05,-606562.17,3075739.39,1604947.46
...
```

### Mission Configuration
```json
{
  "id": "mission_name",
  "vehicle": "vehicle_type",
  "planet": "jupiter",
  "phases": [...],
  "vehicleConfig": {...}
}
```

## 🔧 Configuration

### Add New Planet
1. Create planet data in `components/environment/planets/`
2. Add atmosphere model
3. Configure surface features
4. Update gravity and atmospheric parameters

### Add New Vehicle
1. Add 3D model to `assets/models/`
2. Create vehicle component in `components/spacecraft/`
3. Define aerodynamic properties
4. Configure phase transitions

## 📈 Performance

- Optimized for 60 FPS on modern hardware
- Level-of-detail (LOD) for planet surfaces
- Efficient particle systems for atmospheric effects
- WebGL 2.0 features when available

