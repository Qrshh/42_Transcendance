const fp = require('fastify-plugin');
const { AVATAR_DIR, BANNER_DIR } = require('../utils/media');

module.exports = fp(async function staticPlugin(fastify) {
  fastify.addHook('onSend', (req, reply, payload, done) => {
    const url = req.raw.url || '';
    if (url.startsWith('/avatars/') || url.startsWith('/banners/')) {
      // Autorise l’embed cross-origin de ces fichiers
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin');
    }
    done(null, payload);
  });

  await fastify.register(require('@fastify/static'), {
    root: BANNER_DIR,
    prefix: '/banners/',
    decorateReply: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'),
  });
  await fastify.register(require('@fastify/static'), {
    root: AVATAR_DIR,
    prefix: '/avatars/',
    decorateReply: false,
    setHeaders: (res) => res.setHeader('Cache-Control', 'public, max-age=31536000, immutable'),
  });
});
