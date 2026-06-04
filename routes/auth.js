const express = require('express');
const router = express.Router();
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

    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      return res.render('register', { title: 'Register - Ouba', error: 'Username or email already exists' });
    }

    const user = new User({ username, email, password, displayName: username });
    await user.save();

    req.session.userId = user._id;
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

    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user) {
      return res.render('login', { title: 'Login - Ouba', error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.render('login', { title: 'Login - Ouba', error: 'Invalid credentials' });
    }

    req.session.userId = user._id;
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

module.exports = router;
