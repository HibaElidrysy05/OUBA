const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { Op } = require('sequelize');
const User = require('../models/User');
const { PasswordResetToken } = require('../models');
const transporter = require('../config/email');

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

router.get('/forgot-password', (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('forgot-password', { title: 'Forgot Password - Ouba', error: null, success: null });
});

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.render('forgot-password', { title: 'Forgot Password - Ouba', error: 'Email is required', success: null });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.render('forgot-password', { title: 'Forgot Password - Ouba', error: null, success: 'If that email is registered, you will receive a reset link shortly.' });
    }

    await PasswordResetToken.update({ used: true }, { where: { userId: user.id, used: false } });

    const token = crypto.randomBytes(32).toString('hex');
    await PasswordResetToken.create({
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });

    const baseUrl = process.env.BASE_URL || `${req.protocol}://${req.get('host')}`;
    const resetLink = `${baseUrl}/reset-password/${token}`;

    const smtpConfigured = process.env.SMTP_USER && process.env.SMTP_PASS;
    let emailSent = false;

    if (smtpConfigured) {
      try {
        await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ouba.app',
          to: user.email,
          subject: 'Ouba - Password Reset',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;border:1px solid #FFD6E0;border-radius:16px;background:#FFF5F7">
            <h1 style="color:#E88FAC;font-size:22px;margin-bottom:16px">🌸 Password Reset</h1>
            <p style="color:#4A3740;line-height:1.6">Hi <strong>${user.displayName || user.username}</strong>,</p>
            <p style="color:#4A3740;line-height:1.6">Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href="${resetLink}" style="display:inline-block;padding:12px 28px;background:#FFB6C1;color:#fff;text-decoration:none;border-radius:30px;font-weight:700;margin:16px 0">Reset Password</a>
            <p style="color:#A88A9A;font-size:13px">If you didn't request this, ignore this email.</p>
          </div>`
        });
        emailSent = true;
      } catch (emailErr) {
        console.error('Email send error:', emailErr);
      }
    }

    const successMsg = emailSent
      ? 'If that email is registered, you will receive a reset link shortly.'
      : 'Click here to reset your password: <a href="' + resetLink + '" style="color:var(--pink-dark);font-weight:700">Reset Password</a>';

    res.render('forgot-password', { title: 'Forgot Password - Ouba', error: null, success: successMsg });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.render('forgot-password', { title: 'Forgot Password - Ouba', error: 'Something went wrong', success: null });
  }
});

router.get('/reset-password/:token', async (req, res) => {
  if (req.session.userId) return res.redirect('/');
  try {
    const record = await PasswordResetToken.findOne({
      where: { token: req.params.token, used: false, expiresAt: { [Op.gt]: new Date() } }
    });
    if (!record) {
      return res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Invalid or expired reset link', success: null, token: req.params.token });
    }
    res.render('reset-password', { title: 'Reset Password - Ouba', error: null, success: null, token: req.params.token });
  } catch (error) {
    console.error('Reset page error:', error);
    res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Something went wrong', success: null, token: req.params.token });
  }
});

router.post('/reset-password/:token', async (req, res) => {
  try {
    const record = await PasswordResetToken.findOne({
      where: { token: req.params.token, used: false, expiresAt: { [Op.gt]: new Date() } },
      include: [{ model: User }]
    });
    if (!record) {
      return res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Invalid or expired reset link', success: null, token: req.params.token });
    }

    const { password, confirmPassword } = req.body;
    if (!password || !confirmPassword) {
      return res.render('reset-password', { title: 'Reset Password - Ouba', error: 'All fields are required', success: null, token: req.params.token });
    }
    if (password !== confirmPassword) {
      return res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Passwords do not match', success: null, token: req.params.token });
    }
    if (password.length < 6) {
      return res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Password must be at least 6 characters', success: null, token: req.params.token });
    }

    record.User.password = password;
    await record.User.save();

    record.used = true;
    await record.save();

    res.render('reset-password', { title: 'Reset Password - Ouba', error: null, success: 'Password reset successfully! You can now login with your new password.', token: req.params.token });
  } catch (error) {
    console.error('Reset password error:', error);
    res.render('reset-password', { title: 'Reset Password - Ouba', error: 'Something went wrong', success: null, token: req.params.token });
  }
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
