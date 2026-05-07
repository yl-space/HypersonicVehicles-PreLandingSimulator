# Hypersonic Flight Simulator

> **Live site:** [hypersonics.wpi.edu](https://hypersonics.wpi.edu)

A high-fidelity, browser-based 3D simulator for atmospheric **Entry, Descent, and Landing (EDL)** of hypersonic vehicles on Mars. Real trajectories. Real physics. Built with Three.js, Express, and a Python (FastAPI + scipy) physics backend.

Developed at the WPI Hypersonic Vehicle Lab (HSVL) with support from the Emil Buehler Perpetual Trust Foundation.

---

## ⚡ One-command setup (the only thing you need)

You only have to run **one** command. The script handles everything: dependency installation, Python environment build, both servers, and opening the browser.

| Your OS | Command |
|---|---|
| **Windows** | Double-click `setup.bat` &nbsp;*(or run it from `cmd` / PowerShell)* |
| **macOS / Linux** | `./setup.sh` &nbsp;*(make it executable once: `chmod +x setup.sh`)* |

That's it. After ~1–3 minutes (first run only), your browser will open at <http://localhost:3001/> with the simulator ready to launch.

To stop everything, press **Ctrl+C** in the terminal window the script opened (or close the window on Windows).

### What `setup.bat` / `setup.sh` actually does

Each wrapper performs the same five steps under the hood:

1. **Verifies Node.js (≥ 18)** is installed — opens an install link and exits if not.
2. **Verifies Python (≥ 3.12)** is installed — opens an install link and exits if not.
3. **Auto-installs `uv`** (Astral's fast Python package manager) if missing.
4. **Runs `node setup.js`** — installs npm packages and builds the sim-server `.venv`.
5. **Runs `node start.js`** — launches both servers, waits for them to be healthy, opens your browser.

Re-running is safe: every step is idempotent.

---

## 🔧 Prerequisites (the only manual step)

The wrapper scripts cannot install OS-level toolchains for you, so you need these two installed **once** before running `setup.bat` / `setup.sh`:

| Tool | Minimum version | Where to get it |
|---|---|---|
| **Node.js** | 18 LTS | <https://nodejs.org/> &nbsp;*(pick the LTS installer)* |
| **Python** | 3.12 | <https://www.python.org/downloads/> &nbsp;*(on Windows: tick **"Add Python to PATH"** during install)* |

If either is missing, the script will tell you exactly what to install and where to get it. Everything else (npm packages, `uv`, scipy/numpy/FastAPI, etc.) is installed automatically.

---

## 🖥️ Manual / advanced workflows

If you'd rather drive the pipeline by hand, the same scripts are exposed as npm tasks:

```bash
npm run setup        # = node setup.js  (install everything)
npm run start:all    # = node start.js  (run both servers, open browser)
npm start            # Express only (port 3001) — sim-server must already be running
```

Run the sim-server alone (port 8000):

```bash
cd sim-server
uv run python -m uvicorn src.sim_server.main:app --host 127.0.0.1 --port 8000
```

### Docker (production-style)

A complete `docker-compose.yml` is included for deployments that want full isolation (Express + sim-server + nginx):

```bash
docker compose build --pull
docker compose up -d
```

This is what powers the live `hypersonics.wpi.edu` deployment.

---

## 🌐 Architecture at a glance

```
┌─────────────────────────────┐
│  Browser  (Three.js client) │
│   http://localhost:3001     │
└──────────────┬──────────────┘
               │  static assets, /api/*, /sim/*
┌──────────────▼──────────────┐
│  Express server  (Node 18)  │
│   server/index.js  :3001    │
│   - serves client/          │
│   - /api/missions, ...      │
│   - /sim/* → proxy to       │
└──────────────┬──────────────┘
               │  /sim/simulate/high-fidelity, /sim/tiles/...
┌──────────────▼──────────────┐
│  sim-server  (FastAPI)      │
│   uvicorn  :8000            │
│   - scipy RK45 integrator   │
│   - Vinh's entry EOMs       │
│   - NASA Trek WMTS tile     │
│     proxy + cache           │
└─────────────────────────────┘
```

| Layer | Tech |
|---|---|
| **Frontend** | Three.js, native ES modules (no Vite/webpack), `importmap` in `index.html` |
| **Web server** | Node.js 18, Express 4, helmet, compression, http-proxy |
| **Physics** | Python 3.12, FastAPI, scipy (RK45), numpy, pandas, pyarrow |
| **3D content** | NASA Trek MDIM21 Mars tile pyramid, USGS gazetteer, GLTF/GLB spacecraft models |

Coordinates: 1 scene unit = 100 km · Mars radius 33.96 units (3,396 km, IAU 2018) · Y-up J2000 in Three.js · Z-up IAU_MARS body-fixed in physics.

---

## 📁 Project layout

```
hypersonic-vehicle-simulation/
├── setup.bat   setup.sh   setup.js   start.js     ← one-command pipeline
├── client/
│   ├── index.html
│   └── src/
│       ├── core/             Three.js scene, camera, renderer, asset loader
│       ├── components/       3D models (spacecraft, planet, atmosphere, markers)
│       ├── simulation/       trajectory, phases, flight computer
│       ├── ui/               telemetry panel, controls, timeline
│       ├── data/             CSV / mission loaders
│       └── services/         backend API client
├── server/
│   ├── api/                  REST endpoints (missions, trajectories, telemetry)
│   ├── server.js             Express config + /sim proxy
│   └── index.js              entry point
├── sim-server/
│   ├── pyproject.toml        Python deps (managed by uv)
│   ├── uv.lock               pinned lockfile
│   └── src/sim_server/
│       ├── main.py           FastAPI app
│       ├── OP/main.py        high-fidelity integrator
│       └── OP/entryeoms.py   Vinh's entry EOMs
├── docker-compose.yml        production stack (app + sim-server + nginx)
└── package.json              npm scripts: setup, start:all, start, dev, prod
```

---

## 🎮 Using the simulator

After your browser opens at <http://localhost:3001/>:

1. The **welcome dialog** shows the trajectory, vehicle, and planet specifications you're about to fly. Review and click **Launch Simulation**.
2. The Dragon (or Starship) model spawns at the entry interface (~125 km altitude, ~5,845 m/s) above Gale Crater.
3. The left panel narrates each EDL phase as the spacecraft descends; the bottom timeline lets you scrub freely.

| Key / mouse | Action |
|---|---|
| **Space** | Play / Pause |
| **1 / 2 / 3** | Camera mode: Follow · Orbit · Trajectory |
| **← / →** | Skip ±5 seconds |
| **A / D** | Bank angle ∓5° |
| **W / S** | Angle of attack ±1° |
| **Mouse wheel** | Zoom |
| **Click timeline** | Scrub to time |

The five EDL phases (physics-driven scheme) are:

1. **Gravity-dominated motion in a rarefied atmosphere**
2. **Aerothermal build-up**
3. **Peak heating and aerodynamic load**
4. **Hypersonic glide control phase**
5. **SUFR — "Straighten Up and Fly Right"**

Phase transition times come live from the backend's `phases_entry` (t12, t23, t34, t45) — they update per-trajectory when you change bank angle.

---

## 🧪 Verifying it actually works

After the browser opens, you should see (on the welcome dialog):

- **Trajectory:** Entry altitude 125.96 km · velocity 5,845 m/s · FPA −16.13° · lat/lon −3.92° N / 126.74° E
- **Vehicle:** Dragon (MSL-class) · 2,920 kg · A_ref 15.9 m² · β 115 kg/m² · L/D 0.24
- **Planet:** Mars · Rp 3,396 km · μ 4.2828e13 · g_Earth 9.80665

While running, the cockpit HUD g-load should climb from ~0 g (rarefied entry) through ~5 g (peak load) to ~8–9 g (hypersonic glide), matching the PDF equations.

---

## 🩹 Troubleshooting

| Symptom | Fix |
|---|---|
| `setup.bat` says "Node.js is not installed" | Install from <https://nodejs.org/>, then close & re-run. |
| `setup.bat` says "Python 3.12 or newer is required" | Install from <https://www.python.org/downloads/> and tick "Add Python to PATH". |
| `uv was installed but is still not on PATH` | Open a **new** terminal so PATH is reloaded, then run `setup.bat` again. |
| Port 3001 or 8000 already in use | Stop whatever is using them, or set `PORT=3002 npm run start:all` (Express) / `SIM_SERVER_PORT=8001` (sim-server). |
| Browser opens but the page is blank | Hard-refresh (Ctrl/Cmd + Shift + R) — old cached scripts can collide with new module paths. |
| `npm install` fails on Windows with `node-gyp` | None of our deps need native compilation; check your network and re-run `node setup.js`. |
| `uv sync` fails with "Python interpreter not found" | The `uv` runtime needs Python on PATH; confirm `python -V` works in a fresh terminal. |
| Spacecraft falls through Mars / huge altitude offset | You probably have stale cached JS. Clear browser cache and reload. |
| Simulator hangs at "Loading Three.js…" | sim-server crashed — check the `sim-server` log lines in the terminal for a stacktrace. |

To see verbose logs, just watch the terminal where you ran `setup.bat` / `setup.sh` — both servers stream their output prefixed with `[express]` and `[sim-server]`.

---

## 👥 Credits

- **Developers:** Shreya Boyane · Weaver Goldman · Oleksii Padun
- **Lab:** WPI Hypersonic Vehicle Lab (HSVL)
- **Funding:** Emil Buehler Perpetual Trust Foundation
- **Imagery:** NASA Trek MDIM21 (Mars), USGS Gazetteer of Planetary Nomenclature
- **License:** MIT (see `package.json`)
