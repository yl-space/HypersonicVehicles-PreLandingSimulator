#!/usr/bin/env node
/**
 * start.js — Launches the full Hypersonic Flight Simulator stack.
 *
 * This script:
 *   1. Spawns the Python sim-server (FastAPI / uvicorn) on port 8000.
 *   2. Waits for the sim-server to report healthy.
 *   3. Spawns the Node.js Express server on port 3001.
 *   4. Opens the default browser to http://localhost:3001/.
 *   5. Streams both servers' logs (prefixed) and shuts both down on Ctrl+C.
 *
 * Pre-requisite: run `node setup.js` once to install dependencies.
 *
 * Usage:
 *   node start.js              # auto-open browser
 *   node start.js --no-open    # don't open browser (useful in CI / Docker)
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = __dirname;
const SIM_SERVER = join(ROOT, 'sim-server');
const IS_WIN = process.platform === 'win32';
const NO_OPEN = process.argv.includes('--no-open');

const SIM_PORT = Number(process.env.SIM_SERVER_PORT || 8000);
const EXPRESS_PORT = Number(process.env.PORT || 3001);

/* ─────────────────────────────────────────────────────────── helpers ── */

const C = {
    reset: '\x1b[0m',
    bold:  '\x1b[1m',
    red:   '\x1b[31m',
    green: '\x1b[32m',
    yellow:'\x1b[33m',
    cyan:  '\x1b[36m',
    magenta:'\x1b[35m',
    gray:  '\x1b[90m',
};

function prefixedLogger(label, color) {
    const tag = `${color}[${label}]${C.reset}`;
    return (chunk) => {
        const text = chunk.toString();
        // Preserve interior newlines but tag every non-empty line
        for (const line of text.split('\n')) {
            if (line.trim() === '') continue;
            process.stdout.write(`${tag} ${line}\n`);
        }
    };
}

function banner(msg) {
    console.log(`\n${C.bold}${C.cyan}━━━ ${msg} ━━━${C.reset}\n`);
}

function info(msg)  { console.log(`${C.gray}      ${msg}${C.reset}`); }
function ok(msg)    { console.log(`${C.green}  ✓${C.reset}   ${msg}`); }
function warn(msg)  { console.log(`${C.yellow}  !${C.reset}   ${msg}`); }
function fail(msg)  { console.log(`${C.red}  ✗${C.reset}   ${msg}`); }

/** GET a URL and resolve true on 2xx within `timeoutMs`, else false. */
function ping(url, timeoutMs = 1500) {
    return new Promise((resolve) => {
        const req = http.get(url, { timeout: timeoutMs }, (res) => {
            res.resume();
            resolve(res.statusCode >= 200 && res.statusCode < 500);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

/** Poll `url` until 2xx or `maxAttempts * intervalMs` elapses. */
async function waitFor(url, label, maxAttempts = 60, intervalMs = 500) {
    process.stdout.write(`      Waiting for ${label} `);
    for (let i = 0; i < maxAttempts; i++) {
        if (await ping(url)) {
            process.stdout.write(' ✓\n');
            return true;
        }
        process.stdout.write('.');
        await new Promise((r) => setTimeout(r, intervalMs));
    }
    process.stdout.write(' ✗\n');
    return false;
}

/** Open a URL in the user's default browser without blocking. */
function openBrowser(url) {
    const platform = process.platform;
    let cmd, args;
    if (platform === 'win32') {
        // `start` needs an empty string title to handle quoted URLs correctly.
        cmd = 'cmd';
        args = ['/c', 'start', '""', url];
    } else if (platform === 'darwin') {
        cmd = 'open';
        args = [url];
    } else {
        cmd = 'xdg-open';
        args = [url];
    }
    try {
        const child = spawn(cmd, args, { detached: true, stdio: 'ignore' });
        child.unref();
        return true;
    } catch {
        return false;
    }
}

/* ────────────────────────────────────────────────────── pre-flight ── */

function preflight() {
    if (!existsSync(join(ROOT, 'node_modules'))) {
        fail('node_modules missing.');
        info('Run `node setup.js` first to install dependencies.');
        process.exit(1);
    }
    const venv = join(SIM_SERVER, '.venv');
    if (!existsSync(venv)) {
        fail('sim-server/.venv missing.');
        info('Run `node setup.js` first to build the Python environment.');
        process.exit(1);
    }
}

/* ─────────────────────────────────────────────────────── launchers ── */

let simProc = null;
let expressProc = null;
let shuttingDown = false;

function killChild(child, name) {
    if (!child || child.killed) return;
    try {
        if (IS_WIN) {
            // tree-kill on Windows: taskkill ensures uvicorn's worker is also stopped
            spawn('taskkill', ['/PID', String(child.pid), '/F', '/T'], { stdio: 'ignore' });
        } else {
            child.kill('SIGTERM');
            // Escalate after 3 s if still alive
            setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 3000).unref();
        }
    } catch (e) {
        warn(`Could not stop ${name}: ${e.message}`);
    }
}

function shutdown(code = 0) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n${C.gray}Shutting down …${C.reset}`);
    killChild(expressProc, 'Express');
    killChild(simProc, 'sim-server');
    setTimeout(() => process.exit(code), 500).unref();
}

function startSimServer() {
    info(`Starting sim-server on http://127.0.0.1:${SIM_PORT}/ …`);
    const args = [
        'run', 'python', '-m', 'uvicorn',
        'src.sim_server.main:app',
        '--host', '127.0.0.1',
        '--port', String(SIM_PORT),
        '--log-level', 'warning',
    ];
    simProc = spawn(IS_WIN ? 'uv.exe' : 'uv', args, {
        cwd: SIM_SERVER,
        env: process.env,
        shell: IS_WIN,
    });
    const out = prefixedLogger('sim-server', C.magenta);
    simProc.stdout.on('data', out);
    simProc.stderr.on('data', out);
    simProc.on('exit', (code) => {
        if (!shuttingDown) {
            fail(`sim-server exited unexpectedly (code ${code}). Stopping Express too.`);
            shutdown(code ?? 1);
        }
    });
}

function startExpress() {
    info(`Starting Express on http://localhost:${EXPRESS_PORT}/ …`);
    expressProc = spawn(IS_WIN ? 'node.exe' : 'node', ['server/index.js'], {
        cwd: ROOT,
        env: { ...process.env, PORT: String(EXPRESS_PORT), SIM_SERVER_PORT: String(SIM_PORT) },
        shell: false,
    });
    const out = prefixedLogger('express', C.cyan);
    expressProc.stdout.on('data', out);
    expressProc.stderr.on('data', out);
    expressProc.on('exit', (code) => {
        if (!shuttingDown) {
            fail(`Express exited unexpectedly (code ${code}). Stopping sim-server too.`);
            shutdown(code ?? 1);
        }
    });
}

/* ──────────────────────────────────────────────────────────── main ── */

(async function main() {
    banner('Hypersonic Flight Simulator — launching');
    preflight();

    // Fail fast if either port is already in use — saves a confusing error later.
    if (await ping(`http://127.0.0.1:${SIM_PORT}/health`)) {
        warn(`Port ${SIM_PORT} already responds. Will reuse the running sim-server.`);
    } else {
        startSimServer();
        const ready = await waitFor(`http://127.0.0.1:${SIM_PORT}/health`, 'sim-server', 60, 500);
        if (!ready) {
            fail('sim-server did not become healthy within 30 s.');
            shutdown(1);
            return;
        }
        ok(`sim-server healthy on :${SIM_PORT}`);
    }

    if (await ping(`http://127.0.0.1:${EXPRESS_PORT}/`)) {
        warn(`Port ${EXPRESS_PORT} is already in use. Stop that process or set PORT=<other> and retry.`);
        shutdown(1);
        return;
    }

    startExpress();
    const expressReady = await waitFor(`http://127.0.0.1:${EXPRESS_PORT}/`, 'Express', 40, 500);
    if (!expressReady) {
        fail('Express did not start within 20 s.');
        shutdown(1);
        return;
    }
    ok(`Express healthy on :${EXPRESS_PORT}`);

    const url = `http://localhost:${EXPRESS_PORT}/`;
    console.log(`\n${C.bold}${C.green}✓ Simulator is live at ${url}${C.reset}`);
    console.log(`${C.gray}  Press Ctrl+C to stop both servers.${C.reset}\n`);

    if (!NO_OPEN) {
        if (openBrowser(url)) info(`Opened ${url} in your default browser.`);
        else info(`Could not auto-open the browser. Visit ${url} manually.`);
    }

    // Keep the process alive
    process.on('SIGINT',  () => shutdown(0));
    process.on('SIGTERM', () => shutdown(0));
})();
