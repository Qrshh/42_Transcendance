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
  // Si SERVER_ORIGIN pointe vers localhost mais que la requête arrive d'une IP LAN,
  // privilégie l'hôte de la requête pour éviter des URLs injoignables côté navigateur.
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol = forwardedProto || (req.protocol && req.protocol.includes('https') ? 'https' : 'http') || 'http';
  const requestHost = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${port || 3000}`;
  const originIsLocal = typeof origin === 'string' && /(^|:)\/\/(localhost|127\.|\[::1\])/i.test(origin);
  const base = (!origin || originIsLocal) ? `${protocol}://${requestHost}` : origin;
  return rel.startsWith('http') ? rel : `${base}${rel}`;
}

module.exports = { AVATAR_DIR, BANNER_DIR, extFromMime, absoluteUrl };
