const path = require('path');
const fs = require('fs');

const getFileIcon = (mimetype) => {
  if (!mimetype) return 'fa-file';
  if (mimetype.startsWith('image/')) return 'fa-file-image';
  if (mimetype.startsWith('audio/')) return 'fa-file-audio';
  if (mimetype.startsWith('video/')) return 'fa-file-video';
  if (mimetype.includes('pdf')) return 'fa-file-pdf';
  if (mimetype.includes('zip') || mimetype.includes('rar')) return 'fa-file-archive';
  if (mimetype.includes('word') || mimetype.includes('document')) return 'fa-file-word';
  if (mimetype.includes('sheet') || mimetype.includes('excel')) return 'fa-file-excel';
  return 'fa-file';
};

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const deleteFile = (filePath) => {
  const fullPath = path.join(__dirname, '..', 'public', filePath);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
};

module.exports = { getFileIcon, formatFileSize, deleteFile };
