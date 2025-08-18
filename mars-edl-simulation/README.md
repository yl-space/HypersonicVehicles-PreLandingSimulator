# Mars EDL Simulation - Hypersonic Vehicle Landing Visualization

A high-fidelity 3D visualization of Mars Entry, Descent, and Landing (EDL) using real MSL trajectory data in the J2000 reference frame.

## 🚀 Features

### Core Simulation
- **Real Trajectory Data**: Uses actual MSL_position_J2000.csv data from NASA
- **J2000 Reference Frame**: Accurate celestial coordinate system
- **Multi-Planet Support**: Switch between Mars, Earth, and Jupiter
- **NASA-Accurate Dimensions**: 
  - Mars: 3,390 km radius
  - Earth: 6,378 km radius  
  - Jupiter: 69,911 km radius (scaled for visibility)

### Visual Components
- **3D Spacecraft Model**: Detailed entry vehicle with heat shield effects
- **Trajectory Visualization**: 
  - Green path for traveled trajectory
  - Red dashed path for future trajectory
  - Yellow marker for current position
- **Coordinate Axes**: X (Red), Y (Green), Z (Blue) with arrow indicators
- **Starfield Background**: Tiled texture-based star rendering
- **Planet Textures**: High-resolution NASA texture maps

### Camera System
- **Multiple Camera Modes**:
  - **Follow Mode**: Tracks spacecraft from behind
  - **Free Mode**: User-controlled free camera
  - **Orbit Mode**: Orbit around the spacecraft
  - **Fixed Mode**: Stationary observation point

### User Interface
- **Timeline Controls**: Play/pause, speed control, seek functionality
- **Phase Information**: Real-time telemetry display
- **Planet Switcher**: Quick switch between planets
- **Settings Panel**: Display options and quality settings

## 🎮 Controls

### Keyboard Shortcuts
| Key | Action |
|-----|--------|
| `Space` | Play/Pause simulation |
| `1` | Follow camera mode |
| `2` | Free camera mode |
| `3` | Orbit camera mode |
| `4` | Fixed camera mode |
| `←/→` | Skip 5 seconds backward/forward |
| `↑/↓` | Zoom in/out |
| `R` | Restart simulation |

### Mouse Controls
- **Scroll Wheel**: Zoom in/out
- **Click + Drag**: Rotate camera (in Orbit/Free modes)

## 🛠️ Installation

### Prerequisites
- Node.js v18+ 
- npm v9+
- Modern web browser with WebGL support

### Quick Start

1. Clone the repository:
```bash
git clone https://github.com/your-repo/mars-edl-simulation.git
cd mars-edl-simulation
```

2. Run the setup script:
```bash
# Windows
setup.bat

# Or manually
npm install
```

3. Start the application:
```bash
# Windows
start.bat

# Or manually
npm start
```

4. Open your browser to:
```
http://localhost:3001
```

## 📁 Project Structure

```
mars-edl-simulation/
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/    # 3D components (spacecraft, planets, etc.)
│   │   ├── core/         # Core systems (scene, camera, physics)
│   │   ├── simulation/   # Simulation logic
│   │   ├── ui/          # User interface components
│   │   └── main.js      # Entry point
│   ├── assets/
│   │   ├── data/        # Trajectory CSV data
│   │   ├── textures/    # Planet and star textures
│   │   └── models/      # 3D models
│   └── index.html       # Main HTML file
├── server/              # Backend server
│   ├── api/            # REST API endpoints
│   ├── data/           # Mission and trajectory data
│   └── server.js       # Express server
└── package.json        # Dependencies
```

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=development
```

### Display Settings
- Quality levels: Low, Medium, High, Ultra
- Units: Imperial (mi, mph) or Metric (km, km/h)
- Visual effects can be toggled on/off

## 📊 Data Sources

- **Trajectory Data**: MSL_position_J2000.csv - Mars Science Laboratory actual trajectory
- **Planet Textures**: NASA's Solar System Exploration image archives
- **Dimensions**: NASA Planetary Fact Sheets

## 🚦 Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
```bash
npm run build
```

### Running Tests
```bash
npm test
```

## 🐳 Docker Support

Build and run with Docker:
```bash
docker-compose up --build
```

## 📝 Technical Details

### Technologies Used
- **Three.js**: 3D graphics rendering
- **WebGL**: Hardware-accelerated graphics
- **Express.js**: Backend server
- **ES6 Modules**: Modern JavaScript architecture

### Performance Optimizations
- LOD (Level of Detail) for spacecraft model
- Frustum culling for trajectory points
- Instanced rendering for particle effects
- Texture atlasing for UI elements
- Post-processing with bloom and SMAA

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- NASA JPL for trajectory data
- NASA for planet textures and dimensions
- Three.js community for excellent documentation
- Mars Science Laboratory mission team

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Contact: [your-email@example.com]

## 🔮 Future Enhancements

- [ ] VR/AR support
- [ ] Multiple mission trajectories
- [ ] Real-time telemetry streaming
- [ ] Enhanced atmospheric effects
- [ ] Landing site selection tool
- [ ] Mission planning interface

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Status**: Active Development