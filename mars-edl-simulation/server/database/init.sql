-- Mars EDL Simulation Database Schema
-- PostgreSQL initialization script

-- Create extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Missions table
CREATE TABLE missions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    vehicle_type VARCHAR(100),
    planet VARCHAR(50) DEFAULT 'mars',
    launch_date DATE,
    landing_date DATE,
    config JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trajectories table
CREATE TABLE trajectories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mission_id UUID REFERENCES missions(id) ON DELETE CASCADE,
    trajectory_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    point_count INTEGER,
    duration_seconds FLOAT,
    entry_altitude FLOAT,
    deploy_altitude FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trajectory data points table (partitioned by mission for performance)
CREATE TABLE trajectory_points (
    id BIGSERIAL,
    trajectory_id UUID REFERENCES trajectories(id) ON DELETE CASCADE,
    time_seconds FLOAT NOT NULL,
    x_position DOUBLE PRECISION NOT NULL,
    y_position DOUBLE PRECISION NOT NULL,
    z_position DOUBLE PRECISION NOT NULL,
    velocity FLOAT,
    altitude FLOAT,
    PRIMARY KEY (id, trajectory_id)
) PARTITION BY HASH (trajectory_id);

-- Create partitions for trajectory points
CREATE TABLE trajectory_points_0 PARTITION OF trajectory_points
    FOR VALUES WITH (modulus 4, remainder 0);
CREATE TABLE trajectory_points_1 PARTITION OF trajectory_points
    FOR VALUES WITH (modulus 4, remainder 1);
CREATE TABLE trajectory_points_2 PARTITION OF trajectory_points
    FOR VALUES WITH (modulus 4, remainder 2);
CREATE TABLE trajectory_points_3 PARTITION OF trajectory_points
    FOR VALUES WITH (modulus 4, remainder 3);

-- Telemetry data table
CREATE TABLE telemetry (
    id BIGSERIAL PRIMARY KEY,
    trajectory_id UUID REFERENCES trajectories(id) ON DELETE CASCADE,
    time_seconds FLOAT NOT NULL,
    altitude FLOAT,
    velocity FLOAT,
    mach_number FLOAT,
    dynamic_pressure FLOAT,
    heat_flux FLOAT,
    g_force FLOAT,
    angle_of_attack FLOAT,
    atmospheric_density FLOAT,
    temperature FLOAT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User uploads table
CREATE TABLE user_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255),
    file_size INTEGER,
    mime_type VARCHAR(100),
    upload_path VARCHAR(500),
    trajectory_id UUID REFERENCES trajectories(id) ON DELETE SET NULL,
    user_ip VARCHAR(45),
    upload_status VARCHAR(50) DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

-- Simulation sessions table (for analytics)
CREATE TABLE simulation_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) UNIQUE NOT NULL,
    mission_id UUID REFERENCES missions(id),
    trajectory_id UUID REFERENCES trajectories(id),
    start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    max_time_reached FLOAT,
    user_agent TEXT,
    ip_address VARCHAR(45),
    browser_info JSONB,
    performance_metrics JSONB
);

-- Create indexes for performance
CREATE INDEX idx_trajectory_points_trajectory_time ON trajectory_points(trajectory_id, time_seconds);
CREATE INDEX idx_trajectory_points_time ON trajectory_points(time_seconds);
CREATE INDEX idx_telemetry_trajectory_time ON telemetry(trajectory_id, time_seconds);
CREATE INDEX idx_missions_mission_id ON missions(mission_id);
CREATE INDEX idx_trajectories_mission ON trajectories(mission_id);
CREATE INDEX idx_sessions_mission ON simulation_sessions(mission_id);
CREATE INDEX idx_sessions_trajectory ON simulation_sessions(trajectory_id);
CREATE INDEX idx_sessions_start_time ON simulation_sessions(start_time);

-- Create update trigger for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_missions_updated_at BEFORE UPDATE ON missions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_trajectories_updated_at BEFORE UPDATE ON trajectories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default MSL mission data
INSERT INTO missions (mission_id, name, description, vehicle_type, planet, launch_date, landing_date, config)
VALUES (
    'msl',
    'Mars Science Laboratory',
    'NASA''s Curiosity rover mission to explore Gale Crater on Mars',
    'msl_aeroshell',
    'mars',
    '2011-11-26',
    '2012-08-06',
    '{
        "entryInterface": {
            "altitude": 132000,
            "velocity": 5800,
            "angle": -15.5,
            "latitude": -4.6,
            "longitude": 137.4
        },
        "phases": [
            {
                "name": "Entry Interface",
                "startTime": 0,
                "altitude": 132000
            },
            {
                "name": "Peak Heating",
                "startTime": 80,
                "altitude": 60000
            },
            {
                "name": "Peak Deceleration",
                "startTime": 150,
                "altitude": 25000
            },
            {
                "name": "Parachute Deploy",
                "startTime": 260.65,
                "altitude": 13462.9
            }
        ],
        "landingSite": {
            "name": "Gale Crater",
            "latitude": -5.4,
            "longitude": 137.8,
            "elevation": -4500
        }
    }'::jsonb
);

-- Create read-only user for analytics
CREATE USER edl_readonly WITH PASSWORD 'readonly_password';
GRANT CONNECT ON DATABASE mars_edl TO edl_readonly;
GRANT USAGE ON SCHEMA public TO edl_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO edl_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO edl_readonly;

-- Create application user with appropriate permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO edl_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO edl_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO edl_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO edl_user;