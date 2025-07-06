/**
 * Mars EDL Simulation Server - Fixed CSP
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import winston from 'winston';
import trajectoriesAPI from './api/trajectories.js';
import missionsAPI from './api/missions.js';
import telemetryAPI from './api/telemetry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
    ),
    defaultMeta: { service: 'mars-edl-server' },
    transports: [
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

class EDLServer {
    constructor() {
        this.app = express();
        this.port = process.env.PORT || 5000;
        this.isProduction = process.env.NODE_ENV === 'production';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupErrorHandling();
    }

    setupMiddleware() {
        // Relaxed CSP for Three.js development
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    scriptSrc: [
                        "'self'", 
                        "'unsafe-inline'", 
                        "'unsafe-eval'",
                        "https://cdnjs.cloudflare.com",
                        "https://cdn.jsdelivr.net",
                        "https://unpkg.com"
                    ],
                    styleSrc: ["'self'", "'unsafe-inline'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    connectSrc: ["'self'"],
                    fontSrc: ["'self'", "data:"],
                    objectSrc: ["'none'"],
                    mediaSrc: ["'self'"],
                    frameSrc: ["'none'"],
                    workerSrc: ["'self'", "blob:"],
                }
            }
        }));

        this.app.use(cors({
            origin: this.isProduction ? false : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5000'],
            credentials: true
        }));

        this.app.use(compression());
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

        // Static files
        const clientPath = path.join(__dirname, '../client');
        this.app.use(express.static(clientPath));

        this.app.use((req, res, next) => {
            logger.info(`${req.method} ${req.path} - ${req.ip}`);
            next();
        });
    }

    setupRoutes() {
        this.app.get('/api/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });

        this.app.use('/api/trajectories', trajectoriesAPI);
        this.app.use('/api/missions', missionsAPI);
        this.app.use('/api/telemetry', telemetryAPI);

        // Serve client app for all other routes
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../client/index.html'));
        });
    }

    setupErrorHandling() {
        this.app.use((req, res) => {
            res.status(404).json({ error: 'Not found' });
        });

        this.app.use((err, req, res, next) => {
            logger.error('Server error:', err);
            res.status(500).json({ 
                error: this.isProduction ? 'Internal server error' : err.message 
            });
        });
    }

    async ensureDirectories() {
        const dirs = [
            'data/trajectories',
            'data/missions'
        ];

        for (const dir of dirs) {
            await fs.mkdir(path.join(__dirname, dir), { recursive: true });
        }
    }

    async initializeData() {
        const mslConfig = {
            id: 'msl',
            name: 'Mars Science Laboratory',
            vehicle: 'msl_aeroshell',
            planet: 'mars',
            launchDate: '2011-11-26',
            landingDate: '2012-08-06',
            entryInterface: {
                altitude: 132000,
                velocity: 5800,
                angle: -15.5,
                latitude: -4.6,
                longitude: 137.4
            },
            phases: [
                { name: 'Entry Interface', startTime: 0, altitude: 132000, description: 'Atmospheric entry begins' },
                { name: 'Peak Heating', startTime: 80, altitude: 60000, description: 'Maximum thermal stress on heat shield' },
                { name: 'Peak Deceleration', startTime: 150, altitude: 25000, description: 'Maximum g-forces experienced' },
                { name: 'Parachute Deploy', startTime: 260.65, altitude: 13462.9, description: 'Supersonic parachute deployment' }
            ],
            landingSite: {
                name: 'Gale Crater',
                latitude: -5.4,
                longitude: 137.8,
                elevation: -4500
            },
            vehicleSpecs: {
                mass: 3893,
                diameter: 4.5,
                heatShieldMaterial: 'PICA',
                parachuteDiameter: 21.5
            }
        };

        const configPath = path.join(__dirname, 'data/missions/msl.json');
        await fs.writeFile(configPath, JSON.stringify(mslConfig, null, 2));
        
        logger.info('Mission configuration initialized');
    }

    async start() {
        try {
            await this.ensureDirectories();
            await this.initializeData();

            this.server = this.app.listen(this.port, () => {
                logger.info(`🚀 Mars EDL Server running on port ${this.port}`);
                logger.info(`🌍 Environment: ${this.isProduction ? 'production' : 'development'}`);
                logger.info(`📡 Access: http://localhost:${this.port}`);
            });

            process.on('SIGTERM', () => this.shutdown());
            process.on('SIGINT', () => this.shutdown());

        } catch (error) {
            logger.error('Failed to start server:', error);
            process.exit(1);
        }
    }

    shutdown() {
        logger.info('Shutting down server...');
        this.server.close(() => {
            logger.info('Server closed');
            process.exit(0);
        });
    }
}

const server = new EDLServer();
server.start();