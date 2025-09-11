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
  // Si SERVER_ORIGIN est local, privilégie l’hôte réel du navigateur, en
  // tenant compte des proxies (x-forwarded-*) et en dernier recours Referer.
  const h = req.headers || {}
  const forwardedProto = h['x-forwarded-proto']
  const protocol = forwardedProto || (req.protocol && req.protocol.includes('https') ? 'https' : 'http') || 'http'
  const xfHost = h['x-forwarded-host']
  let requestHost = xfHost || h.host
  if (!requestHost) {
    // Essaye d’extraire depuis l’en-tête Origin ou Referer
    const from = h.origin || h.referer
    try { if (from) requestHost = new URL(from).host } catch {}
  }
  requestHost = requestHost || `localhost:${port || 3000}`

  const originIsLocal = typeof origin === 'string' && /(^|:)\/\/(localhost|127\.|\[::1\]|backend(?::\d+)?)/i.test(origin)
  const base = (!origin || originIsLocal) ? `${protocol}://${requestHost}` : origin
  return rel.startsWith('http') ? rel : `${base}${rel}`
}

module.exports = { AVATAR_DIR, BANNER_DIR, extFromMime, absoluteUrl };
