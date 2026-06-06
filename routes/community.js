const express = require('express');
const router = express.Router();
const { CommunityPost, User } = require('../models');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/community', async (req, res) => {
  try {
    const posts = await CommunityPost.findAll({
      include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }],
      order: [['createdAt', 'DESC']],
      limit: 50
    });

    const user = await User.findByPk(req.session.userId, {
      attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role']
    });

    res.render('community', {
      title: 'Community - Ouba',
      user,
      posts,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('Community error:', error);
    res.redirect('/');
  }
});

router.post('/community/create', async (req, res) => {
  try {
    const { location, comment } = req.body;

    if (!req.files || !req.files.image) {
      const posts = await CommunityPost.findAll({ include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }], order: [['createdAt', 'DESC']], limit: 50 });
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role'] });
      return res.render('community', { title: 'Community - Ouba', user, posts, error: 'Image is required', success: null });
    }

    if (comment && comment.length > 100) {
      const posts = await CommunityPost.findAll({ include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }], order: [['createdAt', 'DESC']], limit: 50 });
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role'] });
      return res.render('community', { title: 'Community - Ouba', user, posts, error: 'Comment must be 100 characters or less', success: null });
    }

    if (location && location.length > 100) {
      const posts = await CommunityPost.findAll({ include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }], order: [['createdAt', 'DESC']], limit: 50 });
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role'] });
      return res.render('community', { title: 'Community - Ouba', user, posts, error: 'Location must be 100 characters or less', success: null });
    }

    const file = req.files.image;
    if (!file.mimetype.startsWith('image/')) {
      const posts = await CommunityPost.findAll({ include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }], order: [['createdAt', 'DESC']], limit: 50 });
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role'] });
      return res.render('community', { title: 'Community - Ouba', user, posts, error: 'Only images are allowed', success: null });
    }

    if (file.size > 10 * 1024 * 1024) {
      const posts = await CommunityPost.findAll({ include: [{ association: 'user', attributes: ['id', 'username', 'displayName', 'profilePic'] }], order: [['createdAt', 'DESC']], limit: 50 });
      const user = await User.findByPk(req.session.userId, { attributes: ['id', 'username', 'displayName', 'profilePic', 'bio', 'role'] });
      return res.render('community', { title: 'Community - Ouba', user, posts, error: 'Max image size is 10MB', success: null });
    }

    const streamifier = require('streamifier');
    const cloudinary = require('../config/cloudinary');
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'ouba_community' },
        (err, r) => err ? reject(err) : resolve(r)
      );
      streamifier.createReadStream(file.data).pipe(stream);
    });

    await CommunityPost.create({
      userId: req.session.userId,
      imageUrl: result.secure_url,
      location: location || '',
      comment: comment || ''
    });

    res.redirect('/community');
  } catch (error) {
    console.error('Community create error:', error);
    res.redirect('/community');
  }
});

router.post('/community/delete/:id', async (req, res) => {
  try {
    const post = await CommunityPost.findByPk(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.userId !== req.session.userId) {
      const user = await User.findByPk(req.session.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Unauthorized' });
      }
    }
    await post.destroy();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
