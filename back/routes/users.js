const fp = require('fastify-plugin');
const { dbGet, dbRun, dbAll } = require('../db');
const { hashPassword, verifyPassword } = require('../utils/hash');
const { absoluteUrl } = require('../utils/media');

async function findUserByUsername(username) {
  return dbGet('SELECT id, username, email, is_private FROM users WHERE username = ?', [username]);
}
async function propagateUsernameChange(oldU, newU) {
  await dbRun('UPDATE messages SET sender = ?   WHERE sender   = ?', [newU, oldU]);
  await dbRun('UPDATE messages SET receiver = ? WHERE receiver = ?', [newU, oldU]);
  await dbRun('UPDATE friends  SET user1 = ?    WHERE user1    = ?', [newU, oldU]);
  await dbRun('UPDATE friends  SET user2 = ?    WHERE user2    = ?', [newU, oldU]);
  await dbRun('UPDATE blocked_users SET blocker = ? WHERE blocker = ?', [newU, oldU]);
  await dbRun('UPDATE blocked_users SET blocked = ? WHERE blocked = ?', [newU, oldU]);
}

module.exports = fp(async function usersRoutes(fastify) {
  const { SERVER_ORIGIN, PORT } = fastify.config;

  fastify.get('/users', async (req, reply) => {
    try {
      const rows = await dbAll('SELECT * FROM users', []);
      reply.send(rows.map(u => ({
        ...u,
        avatar: absoluteUrl(u.avatar || '/avatars/default.png', req, SERVER_ORIGIN, PORT),
      })));
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  fastify.post('/users', async (req, reply) => {
    const { username } = req.body || {};
    dbRun('INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)',
      [username, `${username}@example.com`, '', ''])
      .then(function () { reply.send({ id: this.lastID, username }); })
      .catch(err => reply.code(500).send({ error: err.message }));
  });

  fastify.get('/user/:username', async (req, reply) => {
    const { username } = req.params;
    try {
      const user = await dbGet(
        'SELECT id, username, email, avatar, banner, created_at, is_private FROM users WHERE username = ?',
        [username]
      );
      if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

      const status = (typeof fastify.getUserStatus === 'function')
        ? fastify.getUserStatus(username)
        : 'offline';

      reply.send({
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: absoluteUrl(user.avatar || '/avatars/default.png', req, SERVER_ORIGIN, PORT),
        banner: absoluteUrl(user.banner || '/banners/default.jpg', req, SERVER_ORIGIN, PORT),
        createdAt: user.created_at || new Date().toISOString(),
        status,
        isPrivate: !!user.is_private,
      });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  // update username/email/is_private
  fastify.put('/user/:username', async (req, reply) => {
    const { username: pathUsername } = req.params;
    const updates = req.body || {};
    try {
      const existing = await findUserByUsername(pathUsername);
      if (!existing) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

      const allowed = ['username', 'email', 'is_private'];
      const setFields = [], values = [];
      const incoming = { ...updates };
      if (typeof incoming.privateProfile === 'boolean') {
        incoming.is_private = incoming.privateProfile ? 1 : 0;
      }
      for (const f of allowed) {
        const newVal = incoming[f];
        const curr = (f === 'is_private') ? existing.is_private : existing[f];
        if (newVal !== undefined && String(newVal) !== String(curr)) {
          setFields.push(`${f} = ?`); values.push(newVal);
        }
      }
      if (setFields.length === 0) {
        return reply.send({ success: true, message: 'Aucune modification', username: existing.username, email: existing.email });
      }

      try {
        await dbRun(`UPDATE users SET ${setFields.join(', ')} WHERE id = ?`, [...values, existing.id]);
      } catch (e) {
        if (/users\.username/.test(e.message)) return reply.code(409).send({ error: 'Ce pseudo est déjà pris' });
        if (/users\.email/.test(e.message))    return reply.code(409).send({ error: 'Cet email est déjà utilisé' });
        throw e;
      }

      const newUsername = updates.username || existing.username;
      if (newUsername !== existing.username) await propagateUsernameChange(existing.username, newUsername);

      reply.send({ success: true, message: 'Profil mis à jour avec succès', username: newUsername, email: updates.email ?? existing.email });
    } catch (e) { reply.code(500).send({ error: e.message || 'Erreur interne' }); }
  });

  // password
  fastify.put('/user/:username/password', async (req, reply) => {
    const { username } = req.params;
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return reply.code(400).send({ error: 'Mots de passe manquants' });
    try {
      const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
      if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });
      const ok = verifyPassword(currentPassword, user.salt, user.password_hash);
      if (!ok) return reply.code(400).send({ error: 'Mot de passe actuel incorrect' });
      const { hash, salt } = hashPassword(newPassword);
      await dbRun('UPDATE users SET password_hash = ?, salt = ? WHERE username = ?', [hash, salt, username]);
      reply.send({ message: 'Mot de passe mis à jour avec succès' });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  // register/login/logout
  fastify.post('/register', async (req, reply) => {
    const { username, email, password } = req.body || {};
    if (!username || !email || !password) return reply.code(400).send({ error: 'Champs manquants' });
    const { hash, salt } = hashPassword(password);
    dbRun('INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)', [username, email, hash, salt])
      .then(function () { reply.send({ message: 'Utilisateur créé', id: this.lastID }); })
      .catch(err => reply.code(400).send({ error: err.message }));
  });

  fastify.post('/login', async (req, reply) => {
    const { email, password } = req.body || {};
    if (!email || !password) return reply.code(400).send({ error: 'Email et mot de passe requis' });
    const user = await dbGet('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
    if (!user) return reply.code(401).send({ message: 'Email ou username inconnu' });
    const match = verifyPassword(password, user.salt, user.password_hash);
    if (!match) return reply.code(401).send({ message: 'Mot de passe incorrect' });
    return reply.send({ message: 'Connexion réussie', username: user.username, email: user.email, avatar: user.avatar || '/avatars/default.png' });
  });

  fastify.post('/logout', async (_, reply) => reply.send({ message: 'Déconnexion réussie' }));
});
