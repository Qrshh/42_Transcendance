const fp = require('fastify-plugin');
const fs = require('fs').promises;
const path = require('path');
const { dbGet, dbRun } = require('../db');
const { extFromMime, absoluteUrl, AVATAR_DIR, BANNER_DIR } = require('../utils/media');

module.exports = fp(async function uploadsRoutes(fastify) {
  const { SERVER_ORIGIN, PORT } = fastify.config;

  // endpoint JSON direct retiré (préférez l'upload multipart ci‑dessous)

  fastify.post('/user/:username/avatar', async (req, reply) => {
    try {
      // garde-fou : si le parser multipart n'est pas actif, on le voit tout de suite
      if (!req.isMultipart()) {
        return reply.code(415).send({
          error: `Expected multipart/form-data, got: ${req.headers['content-type'] || 'unknown'}`
        });
      }
  
      const { username } = req.params;
      const data = await req.file();
  
      if (!data) return reply.code(400).send({ error: 'Aucun fichier fourni' });
  
      const exists = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
      if (!exists) return reply.code(404).send({ error: 'Utilisateur non trouvé' });
  
      const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
      if (!allowed.has(data.mimetype)) {
        return reply.code(400).send({ error: 'Format non supporté' });
      }
  
      const buf = await data.toBuffer();
      if (buf.length > 5 * 1024 * 1024) {
        return reply.code(400).send({ error: 'Fichier trop lourd (max 5 Mo)' });
      }
  
      const filename = `${username}-${Date.now()}${extFromMime(data.mimetype)}`;
      await fs.mkdir(AVATAR_DIR, { recursive: true });
      await fs.writeFile(path.join(AVATAR_DIR, filename), buf);
  
      const relative = `/avatars/${filename}`;
      await dbRun('UPDATE users SET avatar = ? WHERE username = ?', [relative, username]);
      reply.send({ success: true, avatarUrl: absoluteUrl(relative, req, SERVER_ORIGIN, PORT) });
    } catch (e) {
      reply.code(500).send({ error: e.message });
    }
  });
  

  // upload banner
  fastify.post('/user/:username/banner', async (req, reply) => {
    try {
      // garde-fou : si le parser multipart n'est pas actif, on le voit tout de suite
      if (!req.isMultipart()) {
        return reply.code(415).send({
          error: `Expected multipart/form-data, got: ${req.headers['content-type'] || 'unknown'}`
        });
      }
      const { username } = req.params;
      const data = await req.file();
      if (!data) return reply.code(400).send({ error: 'Aucun fichier fourni' });
      const exists = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
      if (!exists) return reply.code(404).send({ error: 'Utilisateur non trouvé' });
      const allowed = new Set(['image/png','image/jpeg','image/webp','image/gif']);
      if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Format non supporté' });
      const buf = await data.toBuffer();
      if (buf.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'Fichier trop lourd (max 5 Mo)' });
      const filename = `${username}-${Date.now()}${extFromMime(data.mimetype)}`;
      await fs.mkdir(BANNER_DIR, { recursive: true });
      await fs.writeFile(path.join(BANNER_DIR, filename), buf);
      const relative = `/banners/${filename}`;
      await dbRun('UPDATE users SET banner = ? WHERE username = ?', [relative, username]);
      reply.send({ success: true, bannerUrl: absoluteUrl(relative, req, SERVER_ORIGIN, PORT) });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });
});
