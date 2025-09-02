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
  const host = req.headers.host; // Ex: "10.12.8.3:3000" ou "localhost:3000"
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  const base = origin || `${protocol}://${host}`;
  return rel.startsWith('http') ? rel : `${base}${rel}`;
}

module.exports = { AVATAR_DIR, BANNER_DIR, extFromMime, absoluteUrl };
