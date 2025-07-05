/**
 * index.js
 * Main application entry point
 * Coordinates startup of both frontend and backend services
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const config = {
    frontend: {
        port: process.env.FRONTEND_PORT || 3000,
        host: process.env.FRONTEND_HOST || 'localhost'
    },
    backend: {
        port: process.env.PORT || 5000,
        host: process.env.BACKEND_HOST || 'localhost'
    },
    production: process.env.NODE_ENV === 'production'
};

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m'
};

// Utility functions
function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function logError(message) {
    console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function logSuccess(message) {
    console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logInfo(message) {
    console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

// Check if a service is running
async function checkService(host, port, timeout = 5000) {
    return new Promise((resolve) => {
        const startTime = Date.now();
        
        const check = () => {
            const options = {
                host,
                port,
                timeout: 1000,
                path: '/health'
            };
            
            const req = http.request(options, (res) => {
                resolve(true);
            });
            
            req.on('error', () => {
                if (Date.now() - startTime < timeout) {
                    setTimeout(check, 500);
                } else {
                    resolve(false);
                }
            });
            
            req.end();
        };
        
        check();
    });
}

// Ensure required directories exist
async function ensureDirectories() {
    const dirs = [
        'server/data/trajectories',
        'server/data/missions',
        'uploads',
        'logs'
    ];
    
    for (const dir of dirs) {
        await fs.mkdir(path.join(__dirname, dir), { recursive: true });
    }
}

// Check dependencies
async function checkDependencies() {
    try {
        await fs.access(path.join(__dirname, 'node_modules'));
        return true;
    } catch {
        return false;
    }
}

// Generate demo data if needed
async function ensureDemoData() {
    const trajectoryPath = path.join(__dirname, 'server/data/trajectories/msl_position_J2000.csv');
    
    try {
        await fs.access(trajectoryPath);
        logInfo('MSL trajectory data found');
    } catch {
        logInfo('Generating demo trajectory data...');
        
        const generateScript = path.join(__dirname, 'scripts/generateDemoData.js');
        try {
            await fs.access(generateScript);
            const { generateTrajectoryData } = await import(generateScript);
            await generateTrajectoryData();
            logSuccess('Demo data generated');
        } catch (error) {
            logError('Could not generate demo data: ' + error.message);
        }
    }
}

// Start backend server
function startBackend() {
    return new Promise((resolve, reject) => {
        logInfo('Starting backend server...');
        
        const backend = spawn('node', ['server/server.js'], {
            cwd: __dirname,
            env: { ...process.env, NODE_ENV: config.production ? 'production' : 'development' },
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        backend.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message.includes('Server running')) {
                logSuccess(`Backend server running on http://${config.backend.host}:${config.backend.port}`);
                resolve(backend);
            } else {
                console.log(`[Backend] ${message}`);
            }
        });
        
        backend.stderr.on('data', (data) => {
            console.error(`[Backend Error] ${data.toString()}`);
        });
        
        backend.on('error', (error) => {
            logError(`Failed to start backend: ${error.message}`);
            reject(error);
        });
        
        backend.on('exit', (code) => {
            if (code !== 0) {
                logError(`Backend exited with code ${code}`);
            }
        });
    });
}

// Start frontend dev server
function startFrontend() {
    return new Promise((resolve, reject) => {
        logInfo('Starting frontend development server...');
        
        const frontend = spawn('npm', ['run', 'dev'], {
            cwd: __dirname,
            shell: true,
            env: { ...process.env },
            stdio: ['inherit', 'pipe', 'pipe']
        });
        
        frontend.stdout.on('data', (data) => {
            const message = data.toString().trim();
            if (message.includes('ready in') || message.includes('Local:')) {
                logSuccess(`Frontend server running on http://${config.frontend.host}:${config.frontend.port}`);
                resolve(frontend);
            } else {
                console.log(`[Frontend] ${message}`);
            }
        });
        
        frontend.stderr.on('data', (data) => {
            const message = data.toString();
            // Vite often outputs non-error messages to stderr
            if (!message.includes('warning')) {
                console.error(`[Frontend Error] ${message}`);
            }
        });
        
        frontend.on('error', (error) => {
            logError(`Failed to start frontend: ${error.message}`);
            reject(error);
        });
        
        frontend.on('exit', (code) => {
            if (code !== 0) {
                logError(`Frontend exited with code ${code}`);
            }
        });
    });
}

// Start production server
async function startProduction() {
    logInfo('Starting in production mode...');
    
    // Check if build exists
    try {
        await fs.access(path.join(__dirname, 'dist'));
    } catch {
        logError('Production build not found. Run "npm run build" first.');
        process.exit(1);
    }
    
    // Only start backend in production (it serves the static files)
    const backend = await startBackend();
    
    logSuccess('Production server started');
    log(`\n🚀 Mars EDL Simulation is running at http://${config.backend.host}:${config.backend.port}\n`, 'green');
    
    return { backend };
}

// Start development servers
async function startDevelopment() {
    logInfo('Starting in development mode...');
    
    // Start both frontend and backend
    const [backend, frontend] = await Promise.all([
        startBackend(),
        startFrontend()
    ]);
    
    // Wait for services to be ready
    const backendReady = await checkService(config.backend.host, config.backend.port);
    const frontendReady = await checkService(config.frontend.host, config.frontend.port);
    
    if (backendReady && frontendReady) {
        logSuccess('All services started successfully');
        log('\n🚀 Mars EDL Simulation is ready!', 'green');
        log(`   Frontend: http://${config.frontend.host}:${config.frontend.port}`, 'blue');
        log(`   Backend:  http://${config.backend.host}:${config.backend.port}`, 'blue');
        log(`   API Docs: http://${config.backend.host}:${config.backend.port}/api\n`, 'blue');
        log('Press Ctrl+C to stop all services\n', 'yellow');
    }
    
    return { backend, frontend };
}

// Main startup sequence
async function start() {
    console.clear();
    
    // ASCII Banner
    log(`
    __  __                   _____ ____  _     
   |  \\/  | __ _ _ __ ___   | ____|  _ \\| |    
   | |\\/| |/ _\` | '__/ __|  |  _| | | | | |   
   | |  | | (_| | |  \\__ \\  | |___| |_| | |___ 
   |_|  |_|\\__,_|_|  |___/  |_____|____/|_____|
   
   🚀 Entry, Descent & Landing Simulation
    `, 'magenta');
    
    try {
        // Check dependencies
        logInfo('Checking dependencies...');
        const hasDeps = await checkDependencies();
        if (!hasDeps) {
            logError('Dependencies not installed. Run "npm install" first.');
            process.exit(1);
        }
        logSuccess('Dependencies OK');
        
        // Ensure directories
        logInfo('Setting up directories...');
        await ensureDirectories();
        logSuccess('Directories OK');
        
        // Ensure demo data
        await ensureDemoData();
        
        // Start appropriate mode
        let services;
        if (config.production) {
            services = await startProduction();
        } else {
            services = await startDevelopment();
        }
        
        // Handle graceful shutdown
        process.on('SIGINT', () => {
            log('\n\nShutting down services...', 'yellow');
            
            if (services.backend) {
                services.backend.kill('SIGTERM');
            }
            if (services.frontend) {
                services.frontend.kill('SIGTERM');
            }
            
            setTimeout(() => {
                logSuccess('All services stopped');
                process.exit(0);
            }, 1000);
        });
        
    } catch (error) {
        logError(`Startup failed: ${error.message}`);
        console.error(error);
        process.exit(1);
    }
}

// Command line interface
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Mars EDL Simulation

Usage: node index.js [options]

Options:
  --production, -p     Start in production mode
  --development, -d    Start in development mode (default)
  --port <port>        Set backend port (default: 5000)
  --frontend-port <p>  Set frontend port (default: 3000)
  --help, -h           Show this help message

Examples:
  node index.js                    Start in development mode
  node index.js --production       Start in production mode
  node index.js --port 8080        Start with custom backend port
  
Environment Variables:
  NODE_ENV             Set to 'production' for production mode
  PORT                 Backend server port
  FRONTEND_PORT        Frontend dev server port
    `);
    process.exit(0);
}

// Parse command line arguments
if (args.includes('--production') || args.includes('-p')) {
    process.env.NODE_ENV = 'production';
}

if (args.includes('--development') || args.includes('-d')) {
    process.env.NODE_ENV = 'development';
}

const portIndex = args.findIndex(arg => arg === '--port');
if (portIndex !== -1 && args[portIndex + 1]) {
    process.env.PORT = args[portIndex + 1];
}

const frontendPortIndex = args.findIndex(arg => arg === '--frontend-port');
if (frontendPortIndex !== -1 && args[frontendPortIndex + 1]) {
    process.env.FRONTEND_PORT = args[frontendPortIndex + 1];
}

// Start the application
start().catch(error => {
    logError('Fatal error during startup:');
    console.error(error);
    process.exit(1);
});