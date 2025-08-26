const fp = require('fastify-plugin');
const { dbAll, dbGet, dbRun } = require('../db');
const { absoluteUrl } = require('../utils/media');

module.exports = fp(async function friendsRoutes(fastify) {
  const emitToUser = (u, ev, p) => fastify.emitToUser?.(u, ev, p);

  fastify.get('/friends/:username/full', async (req, reply) => {
    const { username } = req.params;
    try {
      const rows = await dbAll(
        `SELECT CASE WHEN f.user1 = ? THEN f.user2 ELSE f.user1 END AS username, u.avatar
         FROM friends f
         JOIN users u ON u.username = CASE WHEN f.user1 = ? THEN f.user2 ELSE f.user1 END
         WHERE (f.user1 = ? OR f.user2 = ?) AND f.status = 'accepted'`,
        [username, username, username, username]
      );
      reply.send(rows.map(r => ({
        username: r.username,
        avatar: absoluteUrl(r.avatar || '/avatars/default.png', req, fastify.config.SERVER_ORIGIN, fastify.config.PORT),
        status: fastify.getUserStatus ? fastify.getUserStatus(r.username) : 'offline'
      })));
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  fastify.post('/friends/request', async (req, reply) => {
    const { from, to } = req.body || {};
    if (!from || !to) return reply.status(400).send({ error: 'Champs manquants' });
    if (from === to) return reply.status(400).send({ error: "Tu ne peux pas t'ajouter toi-même." });
    const exists = await dbGet(
      `SELECT 1 FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)`,
      [from, to, to, from]
    );
    if (exists) return reply.status(400).send({ error: 'Une relation existe déjà.' });
    await dbRun('INSERT INTO friends (user1, user2, status) VALUES (?, ?, ?)', [from, to, 'pending']);

    emitToUser(to, 'newNotification', {
      id: `fr-${from}-${Date.now()}`, type: 'friendRequest', icon: '👥',
      title: 'Demande d’ami', message: `${from} souhaite devenir votre ami`,
      timestamp: new Date().toISOString(), actionable: true,
      actionText: 'Accepter', actionData: { type: 'friendRequest', fromUser: from }
    });
    emitToUser(to, 'friendsUpdated', { users: [to] });

    reply.send({ success: true, message: 'Demande envoyée.' });
  });

  fastify.get('/friends/requests/:username', async (req, reply) => {
    const { username } = req.params;
    const requests = await dbAll(
      'SELECT user1 AS fromUser FROM friends WHERE user2 = ? AND status = ?',
      [username, 'pending']
    );
    reply.send(requests);
  });

  fastify.post('/friends/respond', async (req, reply) => {
    const { from, to, accept } = req.body || {};
    if (!from || !to || typeof accept !== 'boolean') {
      return reply.status(400).send({ error: 'Champs manquants' });
    }
    await dbRun('UPDATE friends SET status = ? WHERE user1 = ? AND user2 = ?', [accept ? 'accepted' : 'rejected', from, to]);

    const base = {
      id: `fr-respond-${from}-${to}-${Date.now()}`,
      type: 'friendRespond',
      icon: accept ? '✅' : '❌',
      title: accept ? 'Demande acceptée' : 'Demande refusée',
      timestamp: new Date().toISOString(),
      actionable: false
    };
    fastify.emitToUser?.(from, 'newNotification', { ...base, message: accept ? `${to} a accepté votre demande.` : `${to} a refusé votre demande.` });
    fastify.emitToUser?.(to, 'newNotification', { ...base, message: accept ? `Vous êtes maintenant ami(e) avec ${from}.` : `Vous avez refusé la demande de ${from}.` });

    fastify.emitToUser?.(from, 'friendsUpdated', { users: [from, to] });
    fastify.emitToUser?.(to,   'friendsUpdated', { users: [from, to] });

    reply.send({ success: true });
  });

  fastify.delete('/friends/remove', async (req, reply) => {
    const { from, to } = req.body || {};
    try {
      await dbRun('DELETE FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)', [from, to, to, from]);
      fastify.emitToUser?.(from, 'friendsUpdated', { users: [from, to] });
      fastify.emitToUser?.(to,   'friendsUpdated', { users: [from, to] });
      reply.send({ success: true, message: 'Ami supprimé avec succès' });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  fastify.get('/friends/:username', async (req, reply) => {
    const { username } = req.params;
    const friends = await dbAll(
      `SELECT CASE WHEN user1 = ? THEN user2 ELSE user1 END AS friend
       FROM friends
       WHERE (user1 = ? OR user2 = ?) AND status = 'accepted'`,
      [username, username, username]
    );
    reply.send(friends);
  });

  fastify.delete('/user/:username', async (req, reply) => {
    const { username } = req.params;
    try {
      await dbRun('DELETE FROM messages WHERE sender = ? OR receiver = ?', [username, username]);
      await dbRun('DELETE FROM friends WHERE user1 = ? OR user2 = ?', [username, username]);
      await dbRun('DELETE FROM blocked_users WHERE blocker = ? OR blocked = ?', [username, username]);

      const res = await new Promise((resolve, reject) => {
        fastify.db.run('DELETE FROM users WHERE username = ?', [username], function (err) {
          if (err) return reject(err);
          resolve({ changes: this.changes });
        });
      });
      if (!res.changes) return reply.code(404).send({ error: 'Utilisateur introuvable' });

      // notifier si connecté
      if (fastify.io) {
        const map = fastify.socketState?.usersBySocket || new Map();
        for (const [sid, uname] of map.entries()) {
          if (uname === username) fastify.io.to(sid).emit('accountDeleted');
        }
      }
      reply.send({ success: true });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });
});
