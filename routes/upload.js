const express = require('express');
const router = express.Router();
const streamifier = require('streamifier');
const cloudinary = require('../config/cloudinary');
const auth = require('../middleware/auth');

router.use(auth);

function uploadToCloudinary(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'ouba',
        resource_type: 'auto',
        ...options
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

router.post('/file', async (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;

    if (!file.data || file.data.length === 0) {
      return res.status(400).json({ error: 'Empty file' });
    }

    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
      'video/mp4', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed',
      'text/plain', 'text/csv'
    ];

    const maxSize = 50 * 1024 * 1024;

    if (!allowedTypes.includes(file.mimetype) && !file.mimetype.startsWith('image/') && !file.mimetype.startsWith('audio/')) {
      return res.status(400).json({ error: 'File type not supported' });
    }

    if (file.size > maxSize) {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }

    const result = await uploadToCloudinary(file.data, {
      public_id: `file_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    });

    res.json({
      success: true,
      fileUrl: result.secure_url,
      fileName: file.name,
      fileType: file.mimetype,
      fileSize: file.size
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

router.post('/profile-pic', async (req, res) => {
  try {
    if (!req.files || !req.files.profilePic) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.profilePic;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Only images are allowed' });
    }

    const result = await uploadToCloudinary(file.data, {
      public_id: `profile_${req.session.userId}`,
      overwrite: true,
      transformation: { width: 400, height: 400, crop: 'fill', gravity: 'face' }
    });

    try {
      const User = require('../models/User');
      await User.update(
        { profilePic: result.secure_url },
        { where: { id: req.session.userId } }
      );
    } catch (dbErr) {
      console.error('Profile pic DB update error:', dbErr);
    }

    res.json({
      success: true,
      fileUrl: result.secure_url
    });
  } catch (error) {
    console.error('Profile pic error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

module.exports = router;
