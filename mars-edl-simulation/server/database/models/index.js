const { Sequelize, DataTypes } = require('sequelize');
const path = require('path');

// Create SQLite database
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, '../../database.sqlite'),
    logging: false
});

// Mission Model
const Mission = sequelize.define('Mission', {
    id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    planet: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
            isIn: [['mars', 'venus', 'titan', 'earth']]
        }
    },
    vehicleType: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'hypersonic_capsule'
    },
    targetLatitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    targetLongitude: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    entryVelocity: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 5000
    },
    entryAngle: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 15
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    status: {
        type: DataTypes.ENUM('planned', 'active', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'planned'
    },
    startTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    endTime: {
        type: DataTypes.DATE,
        allowNull: true
    },
    result: {
        type: DataTypes.TEXT,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        {
            fields: ['status']
        },
        {
            fields: ['planet']
        },
        {
            fields: ['createdAt']
        }
    ]
});

// Mission Event Model
const MissionEvent = sequelize.define('MissionEvent', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    missionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'id'
        }
    },
    eventType: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    phase: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'unknown'
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    metadata: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    timestamps: true,
    indexes: [
        {
            fields: ['missionId']
        },
        {
            fields: ['eventType']
        },
        {
            fields: ['timestamp']
        },
        {
            fields: ['phase']
        }
    ]
});

// Telemetry Model
const Telemetry = sequelize.define('Telemetry', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    missionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'id'
        }
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    position: {
        type: DataTypes.TEXT, // JSON string
        allowNull: false
    },
    velocity: {
        type: DataTypes.TEXT, // JSON string
        allowNull: false
    },
    altitude: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    temperature: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    fuel: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    battery: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    gForce: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    phase: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'unknown'
    }
}, {
    timestamps: true,
    indexes: [
        {
            fields: ['missionId']
        },
        {
            fields: ['timestamp']
        },
        {
            fields: ['phase']
        }
    ]
});

// Trajectory Model
const Trajectory = sequelize.define('Trajectory', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    missionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'id'
        }
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    trajectoryData: {
        type: DataTypes.TEXT, // JSON string
        allowNull: false
    },
    predictionData: {
        type: DataTypes.TEXT, // JSON string
        allowNull: true
    },
    phase: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'unknown'
    }
}, {
    timestamps: true,
    indexes: [
        {
            fields: ['missionId']
        },
        {
            fields: ['timestamp']
        },
        {
            fields: ['phase']
        }
    ]
});

// Control Input Model
const ControlInput = sequelize.define('ControlInput', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    missionId: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
            model: Mission,
            key: 'id'
        }
    },
    timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
    },
    mainThrust: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    rcsThrust: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    pitch: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    yaw: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    roll: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0
    },
    systems: {
        type: DataTypes.TEXT, // JSON string
        allowNull: false,
        defaultValue: '{}'
    }
}, {
    timestamps: true,
    indexes: [
        {
            fields: ['missionId']
        },
        {
            fields: ['timestamp']
        }
    ]
});

// Define associations
Mission.hasMany(MissionEvent, {
    foreignKey: 'missionId',
    as: 'events',
    onDelete: 'CASCADE'
});

Mission.hasMany(Telemetry, {
    foreignKey: 'missionId',
    as: 'telemetry',
    onDelete: 'CASCADE'
});

Mission.hasMany(Trajectory, {
    foreignKey: 'missionId',
    as: 'trajectories',
    onDelete: 'CASCADE'
});

Mission.hasMany(ControlInput, {
    foreignKey: 'missionId',
    as: 'controlInputs',
    onDelete: 'CASCADE'
});

MissionEvent.belongsTo(Mission, {
    foreignKey: 'missionId',
    as: 'mission'
});

Telemetry.belongsTo(Mission, {
    foreignKey: 'missionId',
    as: 'mission'
});

Trajectory.belongsTo(Mission, {
    foreignKey: 'missionId',
    as: 'mission'
});

ControlInput.belongsTo(Mission, {
    foreignKey: 'missionId',
    as: 'mission'
});

// Initialize database
async function initDatabase() {
    try {
        await sequelize.authenticate();
        console.log('Database connection established successfully.');
        
        // Sync all models
        await sequelize.sync({ alter: true });
        console.log('Database models synchronized.');
        
        // Create default data if needed
        await createDefaultData();
        
    } catch (error) {
        console.error('Unable to connect to the database:', error);
        throw error;
    }
}

// Create default data
async function createDefaultData() {
    try {
        // Check if we have any missions
        const missionCount = await Mission.count();
        
        if (missionCount === 0) {
            // Create sample missions
            const sampleMissions = [
                {
                    name: 'Mars Landing Demo',
                    planet: 'mars',
                    vehicleType: 'hypersonic_capsule',
                    targetLatitude: 0,
                    targetLongitude: 0,
                    entryVelocity: 5000,
                    entryAngle: 15,
                    description: 'Demonstration mission for Mars landing simulation',
                    status: 'planned'
                },
                {
                    name: 'Venus Atmospheric Entry',
                    planet: 'venus',
                    vehicleType: 'hypersonic_capsule',
                    targetLatitude: 0,
                    targetLongitude: 0,
                    entryVelocity: 7000,
                    entryAngle: 12,
                    description: 'High-speed entry into Venus atmosphere',
                    status: 'planned'
                },
                {
                    name: 'Titan Exploration',
                    planet: 'titan',
                    vehicleType: 'hypersonic_capsule',
                    targetLatitude: 0,
                    targetLongitude: 0,
                    entryVelocity: 3000,
                    entryAngle: 18,
                    description: 'Landing on Saturn\'s moon Titan',
                    status: 'planned'
                }
            ];
            
            for (const missionData of sampleMissions) {
                const mission = await Mission.create(missionData);
                
                // Create initial event
                await MissionEvent.create({
                    missionId: mission.id,
                    eventType: 'mission_created',
                    description: `Sample mission "${mission.name}" created`,
                    phase: 'planning',
                    timestamp: new Date()
                });
            }
            
            console.log('Sample missions created.');
        }
        
    } catch (error) {
        console.error('Error creating default data:', error);
    }
}

// Export models and functions
module.exports = {
    sequelize,
    Mission,
    MissionEvent,
    Telemetry,
    Trajectory,
    ControlInput,
    initDatabase
}; 