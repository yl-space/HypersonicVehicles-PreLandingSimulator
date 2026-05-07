#!/usr/bin/env bash
# ============================================================
#  Hypersonic Flight Simulator - one-click installer + launcher
#  macOS / Linux version (bash)
#
#  This script is the single entry point for non-technical users.
#  Open a terminal in this folder and run:
#       ./setup.sh
#  (You may need: chmod +x setup.sh   the first time.)
#
#  It will:
#    1. Verify Node.js is installed (gives download link if not).
#    2. Verify Python 3.12+ is installed (gives download link if not).
#    3. Run setup.js  -> installs npm + Python deps.
#    4. Run start.js  -> launches both servers and opens the browser.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")"

BOLD="$(printf '\033[1m')"
RED="$(printf '\033[31m')"
GREEN="$(printf '\033[32m')"
CYAN="$(printf '\033[36m')"
RESET="$(printf '\033[0m')"

echo
echo "${BOLD}${CYAN}============================================================${RESET}"
echo "${BOLD}${CYAN} Hypersonic Flight Simulator${RESET}"
echo "${BOLD}${CYAN}============================================================${RESET}"
echo

# --- Check Node.js ---
if ! command -v node >/dev/null 2>&1; then
    echo "${BOLD}${RED}ERROR:${RESET} Node.js is not installed or not on PATH."
    echo
    echo "   macOS:  brew install node"
    echo "           (or download from https://nodejs.org/)"
    echo "   Linux:  use your package manager, e.g."
    echo "           sudo apt install nodejs npm"
    echo "           (Ubuntu/Debian; for older distros consider nvm or"
    echo "            https://github.com/nodesource/distributions)"
    echo
    echo "   Re-run this script once Node.js is installed."
    exit 1
fi

# --- Check Python 3.12+ ---
PY_OK=0
for cand in python3 python; do
    if command -v "$cand" >/dev/null 2>&1; then
        if "$cand" -c "import sys; sys.exit(0 if sys.version_info >= (3, 12) else 1)" >/dev/null 2>&1; then
            PY_OK=1
            break
        fi
    fi
done
if [ "$PY_OK" -eq 0 ]; then
    echo "${BOLD}${RED}ERROR:${RESET} Python 3.12 or newer is required but was not found."
    echo
    echo "   macOS:  brew install python@3.12"
    echo "   Linux:  sudo apt install python3.12 python3.12-venv"
    echo "           (or build from https://www.python.org/downloads/)"
    echo
    echo "   Re-run this script once Python is installed."
    exit 1
fi

# --- Run the cross-platform Node setup script ---
echo "Running setup ..."
node setup.js

# --- Launch the simulator ---
echo
echo "${BOLD}${GREEN}Starting servers and opening the simulator in your browser ...${RESET}"
echo "(Press Ctrl+C in this terminal to stop the simulator.)"
echo
exec node start.js
