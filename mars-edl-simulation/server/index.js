// server/index.js
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');

// Import API routes
const missionsRouter = require('./api/missions');
const telemetryRouter = require('./api/telemetry');
const trajectoriesRouter = require('./api/trajectories');
const dataRouter = require('./api/data');

// Import database
const { initDatabase } = require('./database/models');

class SimulationServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 3001;
        this.clients = new Map();
        
        this.init();
    }
    
    async init() {
        try {
            // Initialize database
            await initDatabase();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup WebSocket
            this.setupWebSocket();
            
            // Setup static files
            this.setupStaticFiles();
            
            // Start server
            this.start();
            
        } catch (error) {
            console.error('Failed to initialize server:', error);
            process.exit(1);
        }
    }
    
    setupMiddleware() {
        // Security middleware
        this.app.use(helmet({
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
                    fontSrc: ["'self'", "https://fonts.gstatic.com"],
                    scriptSrc: ["'self'", "'unsafe-eval'"],
                    imgSrc: ["'self'", "data:", "blob:"],
                    connectSrc: ["'self'", "ws:", "wss:"]
                }
            }
        }));
        
        // CORS
        this.app.use(cors({
            origin: process.env.NODE_ENV === 'production' 
                ? ['https://yourdomain.com'] 
                : ['http://localhost:3000', 'http://localhost:3001'],
            credentials: true
        }));
        
        // Compression
        this.app.use(compression());
        
        // Body parsing
        this.app.use(express.json({ limit: '10mb' }));
        this.app.use(express.urlencoded({ extended: true }));
        
        // Request logging
        this.app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
            next();
        });
    }
    
    setupRoutes() {
        // API routes
        this.app.use('/api/missions', missionsRouter);
        this.app.use('/api/telemetry', telemetryRouter);
        this.app.use('/api/trajectories', trajectoriesRouter);
        this.app.use('/api/data', dataRouter);
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                clients: this.clients.size
            });
        });
        
        // API documentation
        this.app.get('/api', (req, res) => {
            res.json({
                name: 'Hypersonic Vehicle Simulation API',
                version: '1.0.0',
                endpoints: {
                    missions: '/api/missions',
                    telemetry: '/api/telemetry',
                    trajectories: '/api/trajectories',
                    health: '/health'
                }
            });
        });
    }
    
    setupWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);
            
            // Store client information
            this.clients.set(socket.id, {
                socket: socket,
                connectedAt: new Date(),
                lastActivity: new Date(),
                missionId: null
            });
            
            // Handle client joining a mission
            socket.on('join-mission', (missionId) => {
                const client = this.clients.get(socket.id);
                if (client) {
                    client.missionId = missionId;
                    socket.join(`mission-${missionId}`);
                    console.log(`Client ${socket.id} joined mission ${missionId}`);
                }
            });
            
            // Handle telemetry updates
            socket.on('telemetry-update', (data) => {
                const client = this.clients.get(socket.id);
                if (client) {
                    client.lastActivity = new Date();
                    
                    // Broadcast to other clients in the same mission
                    if (client.missionId) {
                        socket.to(`mission-${client.missionId}`).emit('telemetry-update', data);
                    }
                    
                    // Store telemetry data
                    this.storeTelemetryData(client.missionId, data);
                }
            });
            
            // Handle control inputs
            socket.on('control-input', (data) => {
                const client = this.clients.get(socket.id);
                if (client) {
                    client.lastActivity = new Date();
                    
                    // Broadcast control inputs to other clients
                    if (client.missionId) {
                        socket.to(`mission-${client.missionId}`).emit('control-input', data);
                    }
                }
            });
            
            // Handle mission events
            socket.on('mission-event', (data) => {
                const client = this.clients.get(socket.id);
                if (client) {
                    client.lastActivity = new Date();
                    
                    // Broadcast mission events
                    if (client.missionId) {
                        this.io.to(`mission-${client.missionId}`).emit('mission-event', data);
                    }
                    
                    // Log mission events
                    this.logMissionEvent(client.missionId, data);
                }
            });
            
            // Handle disconnection
            socket.on('disconnect', () => {
                console.log(`Client disconnected: ${socket.id}`);
                this.clients.delete(socket.id);
            });
            
            // Handle errors
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
            });
        });
        
        // Periodic cleanup of inactive clients
        setInterval(() => {
            const now = new Date();
            for (const [id, client] of this.clients.entries()) {
                const inactiveTime = now - client.lastActivity;
                if (inactiveTime > 300000) { // 5 minutes
                    console.log(`Removing inactive client: ${id}`);
                    client.socket.disconnect();
                    this.clients.delete(id);
                }
            }
        }, 60000); // Check every minute
    }
    
    setupStaticFiles() {
        // Serve static files from client directory
        this.app.use(express.static(path.join(__dirname, '../client')));
        
        // Serve assets
        this.app.use('/assets', express.static(path.join(__dirname, '../client/assets')));
        
        // Handle SPA routing
        this.app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, '../index.html'));
        });
    }
    
    async storeTelemetryData(missionId, data) {
        try {
            // Store telemetry data in database
            const { Telemetry } = require('./database/models');
            
            await Telemetry.create({
                missionId: missionId,
                timestamp: new Date(),
                position: JSON.stringify(data.position),
                velocity: JSON.stringify(data.velocity),
                altitude: data.altitude,
                temperature: data.temperature,
                fuel: data.fuel,
                battery: data.battery,
                gForce: data.gForce
            });
            
        } catch (error) {
            console.error('Failed to store telemetry data:', error);
        }
    }
    
    async logMissionEvent(missionId, data) {
        try {
            // Log mission events in database
            const { MissionEvent } = require('./database/models');
            
            await MissionEvent.create({
                missionId: missionId,
                timestamp: new Date(),
                eventType: data.type,
                description: data.description,
                phase: data.phase
            });
            
        } catch (error) {
            console.error('Failed to log mission event:', error);
        }
    }
    
    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 Hypersonic Vehicle Simulation Server running on port ${this.port}`);
            console.log(`📊 Health check: http://localhost:${this.port}/health`);
            console.log(`📚 API docs: http://localhost:${this.port}/api`);
            console.log(`🌐 Web interface: http://localhost:${this.port}`);
        });
    }
    
    // Broadcast methods
    broadcastToMission(missionId, event, data) {
        this.io.to(`mission-${missionId}`).emit(event, data);
    }
    
    broadcastToAll(event, data) {
        this.io.emit(event, data);
    }
    
    // Get server statistics
    getStats() {
        return {
            uptime: process.uptime(),
            clients: this.clients.size,
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }
    
    // Graceful shutdown
    shutdown() {
        console.log('Shutting down server...');
        
        // Disconnect all clients
        for (const [id, client] of this.clients.entries()) {
            client.socket.disconnect();
        }
        this.clients.clear();
        
        // Close server
        this.server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
        
        // Force exit after 10 seconds
        setTimeout(() => {
            console.error('Forced shutdown');
            process.exit(1);
        }, 10000);
    }
}

// Create and start server
const server = new SimulationServer();

// Handle graceful shutdown
process.on('SIGTERM', () => {
    server.shutdown();
});

process.on('SIGINT', () => {
    server.shutdown();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    server.shutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    server.shutdown();
});

module.exports = server; 