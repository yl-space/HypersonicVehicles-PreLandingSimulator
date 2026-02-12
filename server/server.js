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
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';

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
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://unpkg.com", "https://www.googletagmanager.com", "https://esm.sh", "https://cdn.jsdelivr.net"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            imgSrc: ["'self'", "data:", "blob:", "https:", "http://localhost:8000"],
            connectSrc: ["'self'", "http://localhost:8000", "https://unpkg.com", "https://www.google-analytics.com", "https://esm.sh", "https://cdn.jsdelivr.net", "https://planetarynames.wr.usgs.gov"],
            fontSrc: ["'self'", "data:", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
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

// Mars features cache (refreshed daily from USGS official data)
let marsFeatureCache = {
    data: null,
    lastFetched: null,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Fetch and parse official USGS Mars nomenclature data
 * Source: https://planetarynames.wr.usgs.gov/GIS_Downloads
 * Data is updated nightly by USGS
 */
async function fetchUSGSMarsData() {
    const USGS_KMZ_URL = 'https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MARS_nomenclature_center_pts.kmz';

    logger.info('Fetching official USGS Mars nomenclature data...');

    const response = await fetch(USGS_KMZ_URL, {
        headers: {
            'User-Agent': 'HSVL-Simulation/1.0 (Educational Mars Visualization)'
        }
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch USGS data: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);

    // Find the KML file inside the KMZ
    const kmlFile = Object.keys(zip.files).find(name => name.endsWith('.kml'));
    if (!kmlFile) {
        throw new Error('No KML file found in KMZ archive');
    }

    const kmlContent = await zip.files[kmlFile].async('string');

    // Parse the KML XML
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: '@_'
    });
    const kmlData = parser.parse(kmlContent);

    // Extract features from KML structure
    const features = [];
    const placemarks = extractPlacemarks(kmlData);

    // Feature type mapping based on USGS nomenclature
    const typeMap = {
        'crater': 'AA', 'craters': 'AA',
        'mons': 'MO', 'montes': 'MO',
        'vallis': 'VA', 'valles': 'VA',
        'chasma': 'CH', 'chasmata': 'CH',
        'planitia': 'PL', 'planitiae': 'PL',
        'planum': 'PM', 'plana': 'PM',
        'tholus': 'TH', 'tholi': 'TH',
        'patera': 'PA', 'paterae': 'PA',
        'terra': 'TE', 'terrae': 'TE',
        'fossa': 'FO', 'fossae': 'FO',
        'dorsum': 'DO', 'dorsa': 'DO',
        'labyrinthus': 'LA',
        'mensa': 'ME', 'mensae': 'ME',
        'scopulus': 'SC', 'scopuli': 'SC',
        'catena': 'CA', 'catenae': 'CA',
        'collis': 'CO', 'colles': 'CO',
        'fluctus': 'FL', 'fluctūs': 'FL',
        'rupes': 'RU', 'rupēs': 'RU',
        'sulcus': 'SU', 'sulci': 'SU',
        'undae': 'UN',
        'vastitas': 'VS'
    };

    for (const placemark of placemarks) {
        try {
            const name = placemark.name || '';
            const description = placemark.description || '';
            const folder = placemark.folder || '';
            const coordinates = placemark.coordinates;

            if (!coordinates || !name) continue;

            // Parse coordinates (KML format: lon,lat,altitude)
            const [lonStr, latStr] = coordinates.split(',');
            const lon = parseFloat(lonStr);
            const lat = parseFloat(latStr);

            if (isNaN(lat) || isNaN(lon)) continue;

            // Determine feature type from folder name first, then name, then description
            let type = null;
            const folderLower = folder.toLowerCase();
            const nameLower = name.toLowerCase();
            const descLower = description.toLowerCase();

            // Check folder name first (most reliable - USGS organizes by type)
            for (const [keyword, code] of Object.entries(typeMap)) {
                if (folderLower.includes(keyword)) {
                    type = code;
                    break;
                }
            }

            // If not found in folder, check name and description
            if (!type) {
                for (const [keyword, code] of Object.entries(typeMap)) {
                    if (nameLower.includes(keyword) || descLower.includes(keyword)) {
                        type = code;
                        break;
                    }
                }
            }

            // Default to Crater (AA) for unclassified features
            // Craters are the most common feature type on Mars
            if (!type) {
                type = 'AA';
            }

            // Extract diameter from description if available
            let diameter = 0;
            const diamMatch = description.match(/diameter[:\s]*(\d+(?:\.\d+)?)/i);
            if (diamMatch) {
                diameter = parseFloat(diamMatch[1]);
            }

            features.push({
                name,
                lat,
                lon,
                diameter,
                type,
                description: description.replace(/<[^>]*>/g, '').trim(),
                source: 'USGS/IAU Planetary Nomenclature'
            });
        } catch (e) {
            // Skip malformed entries
        }
    }

    logger.info(`Parsed ${features.length} features from USGS official data`);
    return features;
}

/**
 * Recursively extract placemarks from KML structure, preserving folder hierarchy
 */
function extractPlacemarks(obj, placemarks = [], currentFolder = '') {
    if (!obj || typeof obj !== 'object') return placemarks;

    // Track current folder name for feature type classification
    let folderName = currentFolder;
    if (obj.name && typeof obj.name === 'string') {
        // Check if this is a folder (not a placemark)
        if (obj.Folder || obj.Placemark) {
            folderName = obj.name;
        }
    }

    if (obj.Placemark) {
        const pms = Array.isArray(obj.Placemark) ? obj.Placemark : [obj.Placemark];
        for (const pm of pms) {
            const placemark = {
                name: pm.name || '',
                description: pm.description || '',
                folder: folderName // Store the parent folder name
            };

            // Extract coordinates from Point geometry
            if (pm.Point && pm.Point.coordinates) {
                placemark.coordinates = pm.Point.coordinates.toString().trim();
            }

            if (placemark.coordinates) {
                placemarks.push(placemark);
            }
        }
    }

    // Recurse into nested Folders
    if (obj.Folder) {
        const folders = Array.isArray(obj.Folder) ? obj.Folder : [obj.Folder];
        for (const folder of folders) {
            extractPlacemarks(folder, placemarks, folder.name || folderName);
        }
    }

    // Recurse into Document
    if (obj.Document) {
        extractPlacemarks(obj.Document, placemarks, folderName);
    }

    // Recurse into kml root
    if (obj.kml) {
        extractPlacemarks(obj.kml, placemarks, folderName);
    }

    return placemarks;
}

// Proxy to USGS Planetary Nomenclature (fetches official GIS data)
app.get('/api/mars-features', async (req, res) => {
    try {
        const { minDiameter = 0 } = req.query;
        const minDiam = parseFloat(minDiameter);

        // Check cache validity
        const now = Date.now();
        if (!marsFeatureCache.data ||
            !marsFeatureCache.lastFetched ||
            (now - marsFeatureCache.lastFetched) > marsFeatureCache.maxAge) {

            try {
                marsFeatureCache.data = await fetchUSGSMarsData();
                marsFeatureCache.lastFetched = now;
            } catch (fetchError) {
                logger.error('Failed to fetch USGS data:', fetchError);

                // If we have stale cache data, use it
                if (marsFeatureCache.data) {
                    logger.info('Using stale cache data');
                } else {
                    throw fetchError;
                }
            }
        }

        // Filter by minimum diameter if specified
        let features = marsFeatureCache.data || [];
        if (minDiam > 0) {
            features = features.filter(f => (f.diameter || 0) >= minDiam);
        }

        logger.info(`Returning ${features.length} Mars features (minDiameter: ${minDiam})`);
        res.json({
            success: true,
            count: features.length,
            source: 'USGS/IAU Planetary Nomenclature (Official)',
            dataUrl: 'https://planetarynames.wr.usgs.gov/',
            timestamp: new Date().toISOString(),
            cacheAge: marsFeatureCache.lastFetched ? Math.round((now - marsFeatureCache.lastFetched) / 1000) : null,
            features
        });

    } catch (error) {
        logger.error('Error fetching Mars features:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            source: 'USGS/IAU Planetary Nomenclature'
        });
    }
});

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
