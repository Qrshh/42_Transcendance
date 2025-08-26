const fp = require('fastify-plugin');
const { dbGet, dbRun, dbAll } = require('../db');

module.exports = fp(async function chatRoutes(fastify) {
  fastify.post('/chat/message', async (req, reply) => {
    const { sender, receiver, content } = req.body || {};
    const blocked = await dbGet('SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?', [receiver, sender]);
    if (blocked) return reply.status(403).send({ error: 'Blocked by user' });
    await dbRun('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)', [sender, receiver, content]);
    reply.send({ success: true });
  });

  fastify.get('/chat/message/:userA/:userB', async (req, reply) => {
    const { userA, userB } = req.params;
    const messages = await dbAll(
      `SELECT * FROM messages
       WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
       ORDER BY timestamp ASC`,
      [userA, userB, userB, userA]
    );
    reply.send(messages);
  });

  fastify.post('/chat/block', async (req, reply) => {
    const { blocker, blocked } = req.body || {};
    await dbRun('INSERT OR IGNORE INTO blocked_users (blocker, blocked) VALUES (?, ?)', [blocker, blocked]);
    reply.send({ success: true });
  });
});
