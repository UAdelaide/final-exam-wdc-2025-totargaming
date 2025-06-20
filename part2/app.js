const express = require('express');
const path = require('path');
require('dotenv').config();
const session = require('express-session');
const db = require('./models/db');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, '/public')));
app.use(session({
  secret: process.env.SESSION_SECRET || 'defaultsecret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false }
}));
function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return next();
}
function requireRole(role) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== role) {
            return res.status(403).json({ error: 'Forbidden' });
        }
        return next();
    };
}
// Routes
const walkRoutes = require('./routes/walkRoutes');
const userRoutes = require('./routes/userRoutes');

app.use('/api/walks', walkRoutes);
app.use('/api/users', userRoutes);
app.get('/api/dogs', async (req,res) => {
    try {
        const [rows] = await db.query('SELECT dog_id, name, size, owner_id FROM Dogs');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch dogs' });
    }
});
app.get('/owner-dashboard.html', requireLogin, requireRole('owner'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'owner-dashboard.html'));
});
app.get('/walker-dashboard.html', requireLogin, requireRole('walker'), (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'walker-dashboard.html'));
});
// Export the app instead of listening here
module.exports = app;
