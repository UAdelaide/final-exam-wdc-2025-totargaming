const express = require('express');
const router = express.Router();
const db = require('../models/db');

// GET all users (for admin/testing)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT user_id, username, email, role FROM Users');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// POST a new user (simple signup)
router.post('/register', async (req, res) => {
  const {
    username, email, password, role
  } = req.body;

  try {
    const [result] = await db.query(`
      INSERT INTO Users (username, email, password_hash, role)
      VALUES (?, ?, ?, ?)
    `, [username, email, password, role]);

    res.status(201).json({ message: 'User registered', user_id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.get('/me', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Not logged in' });
  }
  return res.json(req.session.user);
});

// POST login has been modified to handle login functionality using username and password
// and handle redirecting to the appropriate dashboard based on the user's role
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }
  try {
    const [rows] = await db.query(`
      SELECT user_id, username, role FROM Users
      WHERE username = ? AND password_hash = ?
    `, [username, password]);

    if (rows.length === 0) {
      // on failure, redirect to index.html with error
      return res.status(401).json({ error: 'Invalid username or password' });
    }
    req.session.user = {
      user_id: rows[0].user_id,
      username: rows[0].username,
      role: rows[0].role
    };
    if (req.session.user.role === 'owner') {
      return res.redirect('/owner-dashboard');
    }
    if (req.session.user.role === 'walker') {
      return res.redirect('/walker-dashboard');
    }
    return res.redirect('/');

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// GET logout has been added to handle logout functionality
// by destroying the session and redirecting to the home page
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('connect.sid'); // Clear the session cookie
    return res.redirect('/'); // Redirect to the home page
  });
});

// GET my-dogs has been added to handle fetching the dogs owned by the logged-in owner
// and returning them as a JSON response
router.get('/my-dogs', async (req,res) => {
  if (!req.session.user || req.session.user.role !== 'owner') {
    return res.status(403).json({ error: 'Access denied' });
  }
  try {
    const [rows] = await db.query(`
      SELECT dog_id, name, size FROM Dogs WHERE owner_id = ?
    `, [req.session.user.user_id]);
    return res.json(rows);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

module.exports = router;
