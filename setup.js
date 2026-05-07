#!/usr/bin/env node
/**
 * setup.js — One-shot installer for the Hypersonic Flight Simulator.
 *
 * What this does (in order):
 *   1. Verifies Node.js (>= 18) and Python (>= 3.12) are available.
 *   2. Installs the `uv` Python package manager if missing.
 *   3. Installs Node dependencies (`npm install`).
 *   4. Builds the sim-server Python virtual environment (`uv sync`).
 *   5. Verifies critical asset files exist.
 *
 * Re-running is safe: every step is idempotent (no-ops if already done).
 *
 * Usage:
 *   node setup.js
 */

import { spawnSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SIM_SERVER = join(ROOT, 'sim-server');
const IS_WIN = process.platform === 'win32';

/* ──────────────────────────────────────────────────────────────── helpers ── */

const C = {
    reset: '\x1b[0m',
    bold:  '\x1b[1m',
    red:   '\x1b[31m',
    green: '\x1b[32m',
    yellow:'\x1b[33m',
    cyan:  '\x1b[36m',
    gray:  '\x1b[90m',
};

const log = {
    step:   (n, total, msg) => console.log(`\n${C.bold}${C.cyan}[${n}/${total}]${C.reset} ${C.bold}${msg}${C.reset}`),
    info:   (msg) => console.log(`        ${msg}`),
    ok:     (msg) => console.log(`        ${C.green}✓${C.reset} ${msg}`),
    warn:   (msg) => console.log(`        ${C.yellow}!${C.reset} ${msg}`),
    fail:   (msg) => console.log(`        ${C.red}✗${C.reset} ${msg}`),
    hint:   (msg) => console.log(`        ${C.gray}${msg}${C.reset}`),
    banner: (msg) => console.log(`\n${C.bold}${C.cyan}━━━ ${msg} ━━━${C.reset}\n`),
};

function die(msg, hint) {
    console.error(`\n${C.bold}${C.red}ERROR:${C.reset} ${msg}`);
    if (hint) console.error(`${C.gray}${hint}${C.reset}`);
    process.exit(1);
}

/** Run a command, stream output, throw on failure. */
function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd: opts.cwd || ROOT,
        shell: IS_WIN,             // Windows needs shell to find .cmd / .bat
        env: { ...process.env, ...(opts.env || {}) },
    });
    if (r.error) throw r.error;
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(' ')} exited with status ${r.status}`);
    }
}

/** Capture stdout from a command. Returns null on failure (used for version probing). */
function tryCapture(cmd, args) {
    try {
        const r = spawnSync(cmd, args, { encoding: 'utf8', shell: IS_WIN });
        if (r.status !== 0) return null;
        return (r.stdout || '').trim();
    } catch {
        return null;
    }
}

/** First command from the list whose `--version` succeeds, else null. */
function findCommand(candidates) {
    for (const c of candidates) {
        if (tryCapture(c, ['--version']) !== null) return c;
    }
    return null;
}

function parseVersion(str) {
    const m = String(str || '').match(/(\d+)\.(\d+)(?:\.(\d+))?/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3] || 0)] : null;
}

function compareVersion(actual, required) {
    for (let i = 0; i < required.length; i++) {
        if ((actual[i] || 0) > required[i]) return 1;
        if ((actual[i] || 0) < required[i]) return -1;
    }
    return 0;
}

/* ────────────────────────────────────────────────────────────── steps ── */

const TOTAL_STEPS = 5;

// 1. Node.js check (we're already running under Node, so this is just the version)
function checkNode() {
    log.step(1, TOTAL_STEPS, 'Verifying Node.js …');
    const v = parseVersion(process.version);
    if (!v || compareVersion(v, [18, 0, 0]) < 0) {
        die(`Node.js ${process.version} is too old (need ≥ 18.0.0).`,
            'Install the latest LTS from https://nodejs.org/');
    }
    log.ok(`Node.js ${process.version}`);
    log.ok(`npm ${tryCapture(IS_WIN ? 'npm.cmd' : 'npm', ['--version']) || '?'}`);
}

// 2. Python ≥ 3.12 check
function checkPython() {
    log.step(2, TOTAL_STEPS, 'Verifying Python ≥ 3.12 …');
    const candidates = IS_WIN
        ? ['py', 'python', 'python3']
        : ['python3', 'python'];

    let found = null;
    for (const c of candidates) {
        // `py` on Windows is a launcher; query Python directly via `-V`
        const out = tryCapture(c, ['-V']) || tryCapture(c, ['--version']);
        if (!out) continue;
        const v = parseVersion(out);
        if (v && compareVersion(v, [3, 12, 0]) >= 0) {
            found = { cmd: c, version: out };
            break;
        }
    }

    if (!found) {
        die('Python 3.12 or newer is required but was not found on PATH.',
            'Install from https://www.python.org/downloads/ and re-run this script.\n        On Windows, make sure you tick "Add Python to PATH" during install.');
    }
    log.ok(`${found.version}  (${found.cmd})`);
}

// 3. uv (Astral's Python package manager) — auto-install if missing
function ensureUv() {
    log.step(3, TOTAL_STEPS, 'Verifying uv (Python package manager) …');
    let uv = findCommand([IS_WIN ? 'uv.exe' : 'uv', 'uv']);

    if (uv) {
        log.ok(`uv ${tryCapture(uv, ['--version']) || '?'}`);
        return;
    }

    log.warn('uv not found — installing it now …');
    try {
        if (IS_WIN) {
            // Official Windows installer (PowerShell one-liner from astral.sh)
            run('powershell', [
                '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
                'irm https://astral.sh/uv/install.ps1 | iex',
            ]);
        } else {
            run('sh', ['-c', 'curl -LsSf https://astral.sh/uv/install.sh | sh']);
        }
    } catch (e) {
        die(`Automatic uv install failed: ${e.message}`,
            'Install manually from https://docs.astral.sh/uv/getting-started/installation/ and re-run this script.');
    }

    // After install, uv lives in ~/.local/bin (Unix) or %USERPROFILE%\.local\bin (Windows).
    // Add it to this process's PATH so the next steps can find it.
    const home = os.homedir();
    const uvDir = IS_WIN ? join(home, '.local', 'bin') : join(home, '.local', 'bin');
    if (existsSync(uvDir)) {
        process.env.PATH = uvDir + (IS_WIN ? ';' : ':') + process.env.PATH;
    }

    uv = findCommand([IS_WIN ? 'uv.exe' : 'uv', 'uv']);
    if (!uv) {
        die('uv was installed but is still not on PATH.',
            'Open a new terminal (so PATH is reloaded) and re-run this script.');
    }
    log.ok(`uv ${tryCapture(uv, ['--version']) || '?'} (newly installed)`);
}

// 4. Install Node dependencies
function npmInstall() {
    log.step(4, TOTAL_STEPS, 'Installing Node dependencies (npm install) …');
    if (existsSync(join(ROOT, 'node_modules')) && existsSync(join(ROOT, 'package-lock.json'))) {
        log.info('node_modules already present — running npm install to sync any new deps …');
    }
    try {
        run(IS_WIN ? 'npm.cmd' : 'npm', ['install', '--no-fund', '--no-audit'], { cwd: ROOT });
        log.ok('Node dependencies installed.');
    } catch (e) {
        die(`npm install failed: ${e.message}`,
            'Check your internet connection and try again.');
    }
}

// 5. Build sim-server Python venv
function uvSync() {
    log.step(5, TOTAL_STEPS, 'Building sim-server virtual environment (uv sync) …');
    if (!existsSync(join(SIM_SERVER, 'pyproject.toml'))) {
        die(`Missing ${join('sim-server', 'pyproject.toml')} — wrong working directory?`);
    }
    try {
        run(IS_WIN ? 'uv.exe' : 'uv', ['sync'], { cwd: SIM_SERVER });
        log.ok('sim-server environment ready (.venv).');
    } catch (e) {
        die(`uv sync failed: ${e.message}`,
            'See sim-server/pyproject.toml for the dependency list.');
    }
}

// Bonus: friendly asset sanity check (warns but does not fail)
function assetSanityCheck() {
    log.banner('Asset sanity check');
    const expect = [
        'client/index.html',
        'client/assets/data/MSL_reference_position_velocity.csv',
        'client/assets/data/mars-gram-avg.csv',
        'client/assets/models/Starship_updated_binary.glb',
        'server/server.js',
        'sim-server/src/sim_server/main.py',
    ];
    let missing = 0;
    for (const rel of expect) {
        const ok = existsSync(join(ROOT, rel));
        (ok ? log.ok : log.warn)(rel);
        if (!ok) missing++;
    }
    if (missing) {
        log.warn(`${missing} expected file(s) missing — the simulator may not load fully.`);
    }
}

/* ──────────────────────────────────────────────────────────── main ── */

(function main() {
    log.banner('Hypersonic Flight Simulator — environment setup');
    try {
        checkNode();
        checkPython();
        ensureUv();
        npmInstall();
        uvSync();
        assetSanityCheck();

        console.log(`\n${C.bold}${C.green}✓ Setup complete.${C.reset}`);
        console.log(`${C.gray}Next:${C.reset} run ${C.bold}node start.js${C.reset} (or ${C.bold}npm run start:all${C.reset}) to launch the simulator.\n`);
    } catch (e) {
        die(e.message);
    }
})();
