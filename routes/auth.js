const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const User = require('../models/User');

router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', { title: 'Login - Ouba', error: null });
});

router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', { title: 'Register - Ouba', error: null });
});

router.post('/register', async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;

    if (!username || !email || !password || !confirmPassword) {
      return res.render('register', { title: 'Register - Ouba', error: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.render('register', { title: 'Register - Ouba', error: 'Passwords do not match' });
    }

    if (password.length < 6) {
      return res.render('register', { title: 'Register - Ouba', error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({
      where: { [Op.or]: [
        { username: { [Op.iLike]: username } },
        { email: { [Op.iLike]: email } }
      ]}
    });
    if (existingUser) {
      return res.render('register', { title: 'Register - Ouba', error: 'Username or email already exists' });
    }

    const user = await User.create({ username, email, password, displayName: username });

    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) {
    console.error('Register error:', error);
    res.render('register', { title: 'Register - Ouba', error: 'Something went wrong' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.render('login', { title: 'Login - Ouba', error: 'All fields are required' });
    }

    const user = await User.findOne({
      where: { [Op.or]: [{ username }, { email: username }] }
    });
    if (!user) {
      return res.render('login', { title: 'Login - Ouba', error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('login', { title: 'Login - Ouba', error: 'Invalid credentials' });
    }

    req.session.userId = user.id;
    res.redirect('/');
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { title: 'Login - Ouba', error: 'Something went wrong' });
  }
});

router.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

router.get('/make-me-admin', async (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const adminKey = process.env.ADMIN_KEY;
  if (!adminKey || req.query.key !== adminKey) {
    return res.status(403).send('Forbidden: valid ?key= parameter required (set ADMIN_KEY env var)');
  }
  const user = await User.findByPk(req.session.userId);
  if (!user) return res.redirect('/login');
  user.role = 'admin';
  await user.save();
  res.redirect('/admin');
});

module.exports = router;
