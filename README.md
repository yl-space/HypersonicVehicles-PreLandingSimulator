# Hypersonic Vehicle Simulation

A real-time, interactive simulation of hypersonic vehicles landing on different planets. This project provides a comprehensive platform for simulating atmospheric entry, descent, and landing (EDL) missions with realistic physics, beautiful 3D graphics, and real-time control systems.

## 🚀 Features

### Real-Time Vehicle Control
- **Thrust Control**: Adjust main engine and RCS thrust in real-time
- **Attitude Control**: Control pitch, yaw, and roll using intuitive joysticks
- **System Management**: Deploy parachutes, eject heat shields, and extend landing legs
- **Real-time Response**: All controls immediately affect vehicle behavior and trajectory

### Multi-Planet Support
- **Mars**: Realistic atmospheric entry with dust storms and craters
- **Venus**: High-pressure atmosphere with sulfuric acid clouds
- **Titan**: Low-gravity environment with methane lakes
- **Earth**: Familiar terrestrial landing simulation

### Advanced Physics Engine
- **Gravitational Forces**: Realistic planetary gravity calculations
- **Atmospheric Drag**: Exponential atmosphere models for each planet
- **Heating Effects**: Plasma heating during high-speed entry
- **Orbital Mechanics**: Accurate trajectory calculations and predictions

### Real-Time Trajectory Analysis
- **Live Predictions**: Continuously updated landing predictions
- **Mission Phases**: Automatic phase transitions (Cruise → Entry → Descent → Landing)
- **Telemetry Tracking**: Comprehensive data logging and analysis
- **Performance Metrics**: Real-time monitoring of vehicle health and mission status

### Beautiful 3D Visualization
- **Three.js Graphics**: High-quality 3D rendering with realistic lighting
- **Particle Effects**: Engine exhaust, plasma trails, and atmospheric effects
- **Dynamic Environments**: Procedurally generated planetary surfaces
- **Multiple Camera Views**: Follow, orbit, top-down, and side views

### Mission Management
- **Mission Planning**: Create and configure missions for different planets
- **Real-time Monitoring**: Live telemetry and mission status updates
- **Data Persistence**: SQLite database for mission history and analysis
- **WebSocket Communication**: Real-time data streaming between client and server

## 🛠️ Technology Stack

### Frontend
- **Three.js**: 3D graphics and visualization
- **Vanilla JavaScript**: Modern ES6+ with modules
- **CSS3**: Responsive design with animations
- **WebSocket**: Real-time communication

### Backend
- **Node.js**: Server runtime
- **Express.js**: Web framework and API
- **Socket.IO**: Real-time bidirectional communication
- **SQLite**: Lightweight database
- **Sequelize**: ORM for database management

### Physics & Simulation
- **Custom Physics Engine**: Realistic orbital mechanics
- **Atmospheric Models**: Planet-specific density and pressure calculations
- **Trajectory Prediction**: Real-time landing calculations
- **Mission Phase Management**: Automated phase transitions

## 📦 Installation

### Prerequisites
- Node.js (v16 or higher)
- npm or yarn package manager

### Setup Instructions

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd mars-edl-simulation
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to `http://localhost:3001`

### Production Build

1. **Build the client**
   ```bash
   npm run build
   ```

2. **Start production server**
   ```bash
   npm start
   ```

## 🎮 Usage

### Getting Started

1. **Select a Planet**: Choose from Mars, Venus, Titan, or Earth
2. **Start Mission**: Click "Start Mission" to begin simulation
3. **Control Vehicle**: Use the control panels to maneuver the vehicle
4. **Monitor Telemetry**: Watch real-time data in the telemetry panel
5. **Follow Timeline**: Track mission progress in the timeline

### Vehicle Controls

#### Thrust Control
- **Main Engine**: Primary propulsion system (0-100%)
- **RCS Thrusters**: Reaction control system for attitude control

#### Attitude Control
- **Pitch**: Control nose up/down movement
- **Yaw**: Control left/right turning
- **Roll**: Control rolling motion

#### System Controls
- **Deploy Parachute**: Reduce velocity during descent
- **Eject Heat Shield**: Remove heat shield after entry
- **Deploy Landing Legs**: Prepare for touchdown

### Camera Controls
- **Follow**: Camera follows the vehicle
- **Orbit**: Camera orbits around the vehicle
- **Top**: Bird's eye view
- **Side**: Side view of the vehicle

### Mission Phases

1. **Cruise Phase**: Interplanetary travel
2. **Entry Phase**: High-speed atmospheric entry
3. **Descent Phase**: Controlled descent through atmosphere
4. **Landing Phase**: Final approach and touchdown

## 📊 API Documentation

### Missions API
- `GET /api/missions` - Get all missions
- `POST /api/missions` - Create new mission
- `GET /api/missions/:id` - Get specific mission
- `PUT /api/missions/:id` - Update mission
- `DELETE /api/missions/:id` - Delete mission

### Telemetry API
- `GET /api/telemetry` - Get telemetry data
- `POST /api/telemetry` - Create telemetry record
- `GET /api/telemetry/mission/:id` - Get mission telemetry
- `GET /api/telemetry/mission/:id/latest` - Get latest telemetry

### Trajectories API
- `GET /api/trajectories` - Get trajectory data
- `POST /api/trajectories` - Create trajectory record
- `POST /api/trajectories/mission/:id/predict` - Generate prediction

## 🔧 Configuration

### Environment Variables
```bash
PORT=3001                    # Server port
NODE_ENV=development         # Environment mode
DATABASE_URL=sqlite://...    # Database connection
```

### Planet Configuration
Each planet has specific parameters:
- **Mass and Radius**: Physical properties
- **Atmosphere**: Composition and density models
- **Gravity**: Surface gravity and escape velocity
- **Visual Properties**: Colors and textures

## 🎯 Mission Objectives

### Success Criteria
- **Safe Landing**: Vehicle reaches surface with minimal velocity
- **System Health**: Maintain fuel, battery, and temperature within limits
- **Trajectory Accuracy**: Land within acceptable distance of target
- **Phase Completion**: Successfully complete all mission phases

### Failure Conditions
- **Excessive G-Force**: Vehicle experiences too much acceleration
- **Overheating**: Temperature exceeds material limits
- **Fuel Depletion**: Insufficient fuel for landing
- **System Failures**: Critical system malfunctions

## 🚧 Development

### Project Structure
```
mars-edl-simulation/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/     # 3D components
│   │   ├── core/          # Core systems
│   │   ├── simulation/    # Simulation logic
│   │   └── ui/            # User interface
│   └── styles/            # CSS stylesheets
├── server/                # Backend application
│   ├── api/               # API routes
│   ├── database/          # Database models
│   └── index.js           # Server entry point
├── index.html             # Main HTML file
└── package.json           # Project configuration
```

### Adding New Features

1. **New Planet**: Add planet data to `Planet.js`
2. **New Vehicle**: Extend `VehicleController.js`
3. **New Effects**: Add to particle systems
4. **New Controls**: Extend UI components

### Testing
```bash
# Run tests (when implemented)
npm test

# Run linting
npm run lint

# Check code formatting
npm run format
```

