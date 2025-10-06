/**
 * server.js
 * Express server for HSLV Simulation
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import multer from 'multer';
import winston from 'winston';
import proxy from 'express-http-proxy';

// Import API routes
import trajectoriesAPI from './api/trajectories.js';
import missionsAPI from './api/missions.js';
import telemetryAPI from './api/telemetry.js';

// Get __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3001;

// Configure logger
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        }),
        new winston.transports.File({ 
            filename: './logs/error.log', 
            level: 'error' 
        }),
        new winston.transports.File({ 
            filename: './logs/combined.log' 
        })
    ]
});

// Middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://www.googletagmanager.com"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:", "https:"],
            connectSrc: ["'self'", "https://unpkg.com", "https://www.google-analytics.com"],
            fontSrc: ["'self'", "data:"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            frameSrc: ["'none'"],
        }
    }
}));

app.use(cors());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Configure file upload
const upload = multer({
    dest: 'uploads/',
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /csv|json|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only CSV, JSON, and TXT files are allowed'));
        }
    }
});

// Static files - Serve client directory
const clientPath = path.join(__dirname, '..', 'client');

// Serve JavaScript modules with correct MIME type
app.use('/src', express.static(path.join(clientPath, 'src'), {
    index: false,
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

// Serve root static files
app.use(express.static(clientPath, {
    index: 'index.html',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

// Serve assets
app.use('/assets', express.static(path.join(clientPath, 'assets')));

// Serve data files
app.use('/data', express.static(path.join(clientPath, 'assets', 'data')));

// Serve Three.js and other node modules
app.use('/node_modules', express.static(path.join(__dirname, '..', 'node_modules'), {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js') || filePath.endsWith('.mjs')) {
            res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
        }
    }
}));

// Proxy to Python sim-server
// In Docker: use service name, in local dev: use 127.0.0.1
const isDocker = process.env.NODE_ENV === 'production' || process.env.DOCKER_ENV;
const SIM_SERVER_HOST = process.env.SIM_SERVER_HOST || (isDocker ? 'sim-server' : '127.0.0.1');
const SIM_SERVER_PORT = process.env.SIM_SERVER_PORT || '8000';
const SIM_SERVER_URL = `http://${SIM_SERVER_HOST}:${SIM_SERVER_PORT}`;

app.use('/sim', proxy(SIM_SERVER_URL, {
    proxyReqPathResolver: (req) => {
        // Remove /sim prefix and forward the rest of the path
        const newPath = req.url;
        logger.info(`Proxying /sim${newPath} to ${SIM_SERVER_URL}${newPath}`);
        return newPath;
    },
    proxyErrorHandler: (err, res, next) => {
        logger.error('Proxy error:', err);
        res.status(502).json({
            error: {
                message: 'Simulation server unavailable',
                status: 502
            }
        });
    }
}));

// API Routes
app.use('/api/trajectories', trajectoriesAPI);
app.use('/api/missions', missionsAPI);
app.use('/api/telemetry', telemetryAPI);

// File upload endpoint
app.post('/api/upload/trajectory', upload.single('trajectory'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    logger.info(`File uploaded: ${req.file.originalname}`);
    
    // Process the file (in production, validate and move to proper location)
    res.json({
        message: 'File uploaded successfully',
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage()
    });
});

// Mission statistics endpoint
app.get('/api/stats', (req, res) => {
    res.json({
        totalSimulations: 1247,
        averageCompletionTime: 258.3,
        successRate: 0.98,
        activeUsers: 42
    });
});

// Serve index.html for all other routes (SPA support)
// But exclude file extensions to avoid serving HTML for JS/CSS files
app.get('*', (req, res) => {
    // Don't serve index.html for file requests
    if (req.path.includes('.')) {
        return res.status(404).send('File not found');
    }
    res.sendFile(path.join(clientPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error(err.stack);
    
    res.status(err.status || 500).json({
        error: {
            message: err.message || 'Internal Server Error',
            status: err.status || 500
        }
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: {
            message: 'Not Found',
            status: 404
        }
    });
});

// Start server
app.listen(PORT, () => {
    logger.info(`HSLV Simulation server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Client files served from: ${clientPath}`);
    logger.info(`Sim-server proxy configured: /sim -> ${SIM_SERVER_URL}`);
    
    // In development, open browser
    if (process.env.NODE_ENV !== 'production') {
        logger.info(`Open http://localhost:${PORT} in your browser`);
        logger.info(`Simulation API available at: http://localhost:${PORT}/sim/simulate/high-fidelity/`);
    }
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM signal received: closing HTTP server');
    app.close(() => {
        logger.info('HTTP server closed');
        process.exit(0);
    });
});

export default app;