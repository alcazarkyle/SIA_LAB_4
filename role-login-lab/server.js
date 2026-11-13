require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const redis = require('redis');
const { createServer } = require('http');
const { Server } = require('socket.io');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MySQL Connection Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Redis Clients
const redisPublisher = redis.createClient({ url: process.env.REDIS_URL });
const redisSubscriber = redis.createClient({ url: process.env.REDIS_URL });

(async () => {
    await redisPublisher.connect();
    await redisSubscriber.connect();
    
    await redisSubscriber.subscribe('admin_broadcast', (message) => {
        io.emit('new_announcement', JSON.parse(message));
    });
    await redisSubscriber.subscribe('user_login_events', (message) => {
        io.emit('user_logged_in', JSON.parse(message));
    });
})();

// Auth Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') return res.sendStatus(403);
    next();
};

// ===== API ROUTES =====

// Register
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await pool.execute(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [name, email, hashedPassword, 'user']
        );
        res.status(201).json({ message: 'Registered' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Email already exists' });
        res.status(500).json({ error: 'Server error' });
    }
});

// Login
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.execute(
            'SELECT * FROM users WHERE email = ?', [email]);
        const user = rows[0];
        
        const match = user && await bcrypt.compare(password, user.password);
        if (!match)
            return res.status(401).json({ error: 'Invalid email or password' });
        
        const token = jwt.sign(
            { id: user.id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );
        
        await pool.execute(
            'INSERT INTO login_logs (user_id) VALUES (?)', [user.id]);
        
        await redisPublisher.publish('user_login_events', JSON.stringify({
            name: user.name, role: user.role, time: new Date().toISOString()
        }));
        
        res.json({ token, user: { id: user.id, name: user.name, role: user.role } });
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all users (Admin only)
app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const [rows] = await pool.execute(
        'SELECT id, name, email, role, created_at FROM users');
    res.json(rows);
});

// Update user (Admin only)
app.put('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    const { name, email, role } = req.body;
    try {
        await pool.execute(
            'UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?',
            [name, email, role, req.params.id]);
        res.sendStatus(204);
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY')
            return res.status(409).json({ error: 'Email already in use' });
        res.status(500).json({ error: 'Server error' });
    }
});

// Delete user (Admin only)
app.delete('/api/users/:id', authenticateToken, isAdmin, async (req, res) => {
    if (Number(req.params.id) === req.user.id)
        return res.status(400).json({ error: 'You cannot delete yourself' });
    
    await pool.execute('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.sendStatus(204);
});

// Broadcast announcement (Admin only)
app.post('/api/broadcast', authenticateToken, isAdmin, async (req, res) => {
    const { message } = req.body;
    await pool.execute(
        'INSERT INTO announcements (message, created_by) VALUES (?, ?)',
        [message, req.user.id]);
    
    await redisPublisher.publish('admin_broadcast',
        JSON.stringify({ message, time: new Date().toISOString() }));
    
    res.sendStatus(201);
});

// Get announcements
app.get('/api/announcements', authenticateToken, async (req, res) => {
    const [rows] = await pool.execute(
        'SELECT * FROM announcements ORDER BY created_at DESC LIMIT 50');
    res.json(rows);
});

// Change password
app.put('/api/profile/password', authenticateToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const [rows] = await pool.execute(
        'SELECT password FROM users WHERE id = ?', [req.user.id]);
    const match = await bcrypt.compare(currentPassword, rows[0].password);
    if (!match) return res.status(401).json({ error: 'Current password wrong' });
    
    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.execute('UPDATE users SET password = ? WHERE id = ?',
        [newHash, req.user.id]);
    res.sendStatus(204);
});

// Socket.IO connection
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    socket.on('disconnect', () => console.log('Client left:', socket.id));
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
