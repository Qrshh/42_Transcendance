const path = require('path');

const AVATAR_DIR = path.join(__dirname, '..', 'avatars');
const BANNER_DIR = path.join(__dirname, '..', 'banners');

function extFromMime(m) {
  switch (m) {
    case 'image/png': return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/webp': return '.webp';
    case 'image/gif': return '.gif';
    default: return '';
  }
}
function absoluteUrl(rel, req, origin, port) {
  const base = origin || `http://localhost:${port || 3000}`;
  return rel.startsWith('http') ? rel : `${base}${rel}`;
}

module.exports = { AVATAR_DIR, BANNER_DIR, extFromMime, absoluteUrl };
