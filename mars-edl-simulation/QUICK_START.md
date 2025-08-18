# Quick Start Guide - Mars EDL Simulation

## 🚀 Getting Started in 3 Steps

### 1. Setup (First Time Only)
```bash
setup.bat
```
This will:
- Check for Node.js and npm
- Install all dependencies
- Create necessary folders
- Verify installation

### 2. Start the Application
```bash
start.bat
```
This will:
- Start the server on port 3001
- Open your browser automatically
- Display the simulation

### 3. Use the Simulation

#### Essential Controls:
- **Space Bar**: Play/Pause the simulation
- **Mouse Wheel**: Zoom in/out
- **Number Keys 1-4**: Switch camera modes
  - `1` = Follow spacecraft
  - `2` = Free camera
  - `3` = Orbit view
  - `4` = Fixed position

#### Navigation:
- **Arrow Keys**:
  - `←/→`: Skip backward/forward 5 seconds
  - `↑/↓`: Zoom in/out
- **R Key**: Restart simulation

#### Mouse Controls:
- **Click + Drag**: Rotate camera (in Free/Orbit modes)
- **Scroll**: Zoom in/out

## 🌍 Planet Switching

Click the planet buttons on the right side:
- **Mars**: Default planet with actual MSL trajectory
- **Earth**: Earth-scale comparison
- **Jupiter**: Jupiter-scale comparison

## 📊 Display Information

### Top Panel:
- Mission phase indicator
- Altitude display
- Velocity readout
- Time to landing

### Bottom Panel:
- Timeline scrubber
- Play/pause controls
- Playback speed selector
- Current timestamp

## 🎯 Tips for Best Experience

1. **Start with Follow Mode** (Press `1`) to track the spacecraft
2. **Use Orbit Mode** (Press `3`) for cinematic views
3. **Adjust zoom** with mouse wheel for optimal viewing
4. **Watch the trajectory** - Green = traveled, Red = future path
5. **Yellow sphere** marks current spacecraft position

## ⚙️ Settings

Click the gear icon (⚙️) in top-right to access:
- Display quality settings
- Unit preferences (Imperial/Metric)
- Visual effects toggles
- Trajectory visibility

## 🔧 Troubleshooting

### Server won't start:
1. Check if port 3001 is free
2. Run `setup.bat` to reinstall dependencies
3. Check `logs\error.log` for details

### Black screen or no planets:
1. Refresh the browser (F5)
2. Check browser console for errors (F12)
3. Ensure WebGL is enabled in your browser

### Performance issues:
1. Lower quality in settings
2. Disable visual effects
3. Use Chrome or Firefox for best performance

## 📁 File Locations

- **Trajectory Data**: `client\assets\data\MSL_position_J2000.csv`
- **Planet Textures**: `client\assets\textures\`
- **Logs**: `logs\error.log`
- **Server**: Runs on `http://localhost:3001`

## 🆘 Need Help?

- Check the full README.md for detailed documentation
- Review browser console for errors (F12)
- Server logs are in `logs\error.log`

---

**Quick Commands Summary:**

| Action | Command/Key |
|--------|-------------|
| Install | `setup.bat` |
| Start | `start.bat` |
| Play/Pause | `Space` |
| Camera modes | `1-4` |
| Skip time | `←/→` |
| Zoom | `↑/↓` or Mouse Wheel |
| Restart | `R` |

Enjoy exploring Mars EDL! 🚀🔴