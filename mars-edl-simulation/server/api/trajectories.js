
// server/api/trajectories.js
app.get('/api/trajectories/:missionId', async (req, res) => {
    const { missionId } = req.params;
    const { startTime, endTime, resolution } = req.query;
    
    // Stream data for large datasets
    res.setHeader('Content-Type', 'application/x-ndjson');
    
    const stream = db.query(`
        SELECT * FROM trajectory_points 
        WHERE mission_id = $1 
        AND timestamp BETWEEN $2 AND $3
        ORDER BY timestamp
    `, [missionId, startTime, endTime])
    .stream();
    
    stream.pipe(res);
});