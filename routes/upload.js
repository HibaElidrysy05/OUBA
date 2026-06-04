const express = require('express');
const router = express.Router();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const auth = require('../middleware/auth');

router.use(auth);

router.post('/file', (req, res) => {
  try {
    if (!req.files || !req.files.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.file;
    const ext = path.extname(file.name);
    const fileName = `${uuidv4()}${ext}`;
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', fileName);

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

    file.mv(uploadPath, (err) => {
      if (err) {
        console.error('File upload error:', err);
        return res.status(500).json({ error: 'Failed to upload file' });
      }

      res.json({
        success: true,
        fileUrl: `/uploads/${fileName}`,
        fileName: file.name,
        fileType: file.mimetype,
        fileSize: file.size
      });
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

router.post('/profile-pic', async (req, res) => {
  try {
    if (!req.files || !req.files.profilePic) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const file = req.files.profilePic;
    const ext = path.extname(file.name);
    const fileName = `profile_${req.session.userId}${ext}`;
    const uploadPath = path.join(__dirname, '..', 'public', 'uploads', fileName);

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Only images are allowed' });
    }

    file.mv(uploadPath, (err) => {
      if (err) {
        console.error('Profile pic upload error:', err);
        return res.status(500).json({ error: 'Failed to upload' });
      }

      res.json({
        success: true,
        fileUrl: `/uploads/${fileName}`
      });
    });
  } catch (error) {
    console.error('Profile pic error:', error);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

module.exports = router;
