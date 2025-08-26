const Fastify        = require('fastify');
const { Server }     = require('socket.io');
const cors           = require('@fastify/cors');
const sqlite3        = require('sqlite3').verbose();
const fastifyStatic  = require('@fastify/static');
const multipart      = require('@fastify/multipart');
const path           = require('path');
const { promisify }  = require('util');
const { hashPassword, verifyPassword } = require('./utils/hash');
const fs             = require('fs').promises;
const client         = require('prom-client');

const fastify = Fastify({ logger: false });

/* =======================
   CONFIG
======================= */
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
// URL publique du serveur HTTP qui sert les images (utilisée pour fabriquer des URLs absolues)
const SERVER_ORIGIN = process.env.SERVER_ORIGIN || null; // ex: "http://localhost:3000"
// Origins front autorisés (dev)
const FRONT_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

/* =======================
   CORS (HTTP)
======================= */
fastify.register(cors, {
  origin: (origin, cb) => cb(null, true),      // très permissif en dev
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
});


/* =======================
   SQLITE
======================= */
const db = new sqlite3.Database('./data.db', err => {
  if (err) console.error('Erreur DB:', err.message);
  else console.log('Connecté à SQLite');
});
const dbGet = promisify(db.get).bind(db);
const dbRun = promisify(db.run).bind(db);
const dbAll = promisify(db.all).bind(db);

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    avatar TEXT DEFAULT '/avatars/default.png',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP

  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT NOT NULL,
    receiver TEXT NOT NULL,
    content TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS blocked_users (
    blocker TEXT NOT NULL,
    blocked TEXT NOT NULL,
    UNIQUE(blocker, blocked)
  )
`);
db.run(`
  CREATE TABLE IF NOT EXISTS friends (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user1 TEXT NOT NULL,
    user2 TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user1, user2)
  )
`);

//table pour les parties
db.run(`
  CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    opponent_id INTEGER,
    result TEXT NOT NULL,
    score INTEGER,
    opponent_score INTEGER,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES users(id)
  )
`);

// Après la création des tables (même endroit que addMissingColumns)
db.run(`
  CREATE TABLE IF NOT EXISTS users_tmp__add_banner (id)
`); // no-op: juste pour garantir qu'on passe
db.run(`ALTER TABLE users ADD COLUMN banner TEXT DEFAULT '/banners/default.jpg'`, (err) => {
  if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne banner:', err.message);
  else console.log('✅ Colonne banner OK');
});

// Ajouter colonnes manquantes si besoin
const addMissingColumns = () => {
  db.run(`ALTER TABLE users ADD COLUMN salt TEXT`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne salt:', err.message);
    else console.log('✅ Colonne salt OK');
  });
  db.run(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '/avatars/default.png'`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne avatar:', err.message);
    else console.log('✅ Colonne avatar OK');
  });
  db.run(`ALTER TABLE users ADD COLUMN created_at TEXT`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne created_at:', err.message);
    else {
      console.log('✅ Colonne created_at OK');
      db.run(`UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL`, (updateErr) => {
        if (updateErr) console.log('ℹ️ Maj created_at:', updateErr.message);
        else console.log('✅ Dates created_at mises à jour');
      });
    }
  });
  db.run(`ALTER TABLE users ADD COLUMN is_private INTEGER DEFAULT 0`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) {
      console.log('ℹ️ Colonne is_private:', err.message);
    } else {
      console.log('✅ Colonne is_private OK');
    }
  });

};
setTimeout(addMissingColumns, 1000);

// ===== helpers à mettre près des autres utils DB =====
async function findUserByUsername(username) {
  return await dbGet('SELECT id, username, email FROM users WHERE username = ?', [username]);
}

async function propagateUsernameChange(oldU, newU) {
  // messages
  await dbRun('UPDATE messages SET sender = ?   WHERE sender   = ?',   [newU, oldU]);
  await dbRun('UPDATE messages SET receiver = ? WHERE receiver = ?',   [newU, oldU]);
  // friends
  await dbRun('UPDATE friends  SET user1 = ?    WHERE user1    = ?',   [newU, oldU]);
  await dbRun('UPDATE friends  SET user2 = ?    WHERE user2    = ?',   [newU, oldU]);
  // blocks
  await dbRun('UPDATE blocked_users SET blocker = ? WHERE blocker = ?', [newU, oldU]);
  await dbRun('UPDATE blocked_users SET blocked = ? WHERE blocked = ?', [newU, oldU]);
}

/* =======================
   UTILS
======================= */
const BANNER_DIR = path.join(__dirname, 'banners');
async function ensureBannerDir() {
  try { await fs.mkdir(BANNER_DIR, { recursive: true }); }
  catch (e) { console.error('❌ Impossible de créer banners/:', e); }
}
ensureBannerDir();

const AVATAR_DIR = path.join(__dirname, 'avatars');
async function ensureAvatarDir() {
  try {
    await fs.mkdir(AVATAR_DIR, { recursive: true });
  } catch (e) {
    console.error('❌ Impossible de créer avatars/:', e);
  }
}
ensureAvatarDir();

// Construit une URL absolue pour l’avatar
function absoluteAvatarUrl(relativePath, request) {
  if (!relativePath) return null;
  if (/^https?:\/\//i.test(relativePath)) return relativePath; // déjà absolue
  const origin =
    SERVER_ORIGIN ||
    (request && request.headers && request.headers.host
      ? `http://${request.headers.host}`
      : `http://localhost:${PORT}`);
  return `${origin}${relativePath.startsWith('/') ? '' : '/'}${relativePath}`;
}

// Nettoie et force l’extension selon le mimetype
function extFromMime(mime) {
  switch (mime) {
    case 'image/png':  return '.png';
    case 'image/jpeg': return '.jpg';
    case 'image/webp': return '.webp';
    case 'image/gif':  return '.gif';
    default: return '';
  }
}

/* =======================
   STATIC & MULTIPART
======================= */
fastify.register(fastifyStatic, {
  root: BANNER_DIR,
  prefix: '/banners/',
  decorateReply: false,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
});

fastify.register(fastifyStatic, {
  root: AVATAR_DIR,
  prefix: '/avatars/',
  decorateReply: false, // réduit l’overhead
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
});

fastify.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Mo
    files: 1
  }
});




/* =======================
   SOCKET SHARED STATE
======================= */
let io; // défini après listen()

// On garde connectedUsers pour compat (tu l'utilises encore à 2-3 endroits)
const connectedUsers = new Map(); // Map<socketId, username>

// Lobbies et rooms
const gameLobbies = new Map();
const activeGameRooms = new Map();

const W = 600, H = 400;

// ===== Presence robuste: multi-socket par user =====
const socketsByUserMulti = new Map(); // Map<username, Set<socketId>>
const usersBySocket = new Map();      // Map<socketId, username>

function addPresence(username, socketId) {
  usersBySocket.set(socketId, username);
  let set = socketsByUserMulti.get(username);
  if (!set) { set = new Set(); socketsByUserMulti.set(username, set); }
  set.add(socketId);
}

function removePresence(socketId) {
  const username = usersBySocket.get(socketId);
  if (!username) return { username: null, stillOnline: false };
  usersBySocket.delete(socketId);
  const set = socketsByUserMulti.get(username);
  if (set) {
    set.delete(socketId);
    if (set.size === 0) {
      socketsByUserMulti.delete(username);
      return { username, stillOnline: false };
    }
  }
  return { username, stillOnline: true };
}

function emitToUser(username, event, payload) {
  if (!io) return;
  const set = socketsByUserMulti.get(username);
  if (!set || set.size === 0) return;
  for (const sid of set) io.to(sid).emit(event, payload);
}

function getUserStatus(username) {
  for (const [, room] of activeGameRooms.entries()) {
    if (room.playerUsernames?.p1 === username || room.playerUsernames?.p2 === username) return 'playing';
  }
  return socketsByUserMulti.has(username) ? 'online' : 'offline';
}

/* =======================
   CHAT
======================= */
fastify.post('/chat/message', async (req, reply) => {
  const { sender, receiver, content } = req.body || {};
  const blocked = await dbGet(
    'SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?',
    [receiver, sender]
  );
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
  await dbRun(`INSERT OR IGNORE INTO blocked_users (blocker, blocked) VALUES (?, ?)`, [blocker, blocked]);
  reply.send({ success: true });
});

/* =======================
   AMIS
======================= */

fastify.get('/friends/:username/full', async (req, reply) => {
  const { username } = req.params;
  try {
    const rows = await dbAll(
      `SELECT 
         CASE WHEN f.user1 = ? THEN f.user2 ELSE f.user1 END AS username,
         u.avatar
       FROM friends f
       JOIN users u
         ON u.username = CASE WHEN f.user1 = ? THEN f.user2 ELSE f.user1 END
       WHERE (f.user1 = ? OR f.user2 = ?) AND f.status = 'accepted'`,
      [username, username, username, username]
    );
    reply.send(rows.map(r => ({
      username: r.username,
      avatar: absoluteAvatarUrl(r.avatar || '/avatars/default.png', req),
      status: socketsByUserMulti.has(r.username) ? getUserStatus(r.username) : 'offline'
    })));
  } catch (e) {
    reply.code(500).send({ error: e.message });
  }
});

// Envoi d'une demande d'ami + notification temps réel
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

  // Notification pour le destinataire
  emitToUser(to, 'newNotification', {
    id: `fr-${from}-${Date.now()}`,
    type: 'friendRequest',
    icon: '👥',
    title: 'Demande d’ami',
    message: `${from} souhaite devenir votre ami`,
    timestamp: new Date().toISOString(),
    actionable: true,
    actionText: 'Accepter',
    actionData: { type: 'friendRequest', fromUser: from }
  });

  // Optionnel: rafraîchir ses demandes pendantes côté front
  emitToUser(to, 'friendsUpdated', { users: [to] });


  reply.send({ success: true, message: 'Demande envoyée.' });
});


// Récupération des demandes en attente
fastify.get('/friends/requests/:username', async (req, reply) => {
  const { username } = req.params;
  const requests = await dbAll(
    'SELECT user1 AS fromUser FROM friends WHERE user2 = ? AND status = ?',
    [username, 'pending']
  );
  reply.send(requests);
});

fastify.delete('/user/:username', async (req, reply) => {
  const { username } = req.params;
  try {
    // Supprime relations (messages, amis, blocks)
    await dbRun('DELETE FROM messages WHERE sender = ? OR receiver = ?', [username, username]);
    await dbRun('DELETE FROM friends WHERE user1 = ? OR user2 = ?', [username, username]);
    await dbRun('DELETE FROM blocked_users WHERE blocker = ? OR blocked = ?', [username, username]);

    // Supprime l’utilisateur
    const res = await new Promise((resolve, reject) => {
      db.run('DELETE FROM users WHERE username = ?', [username], function (err) {
        if (err) return reject(err);
        resolve({ changes: this.changes });
      });
    });

    if (!res.changes) return reply.code(404).send({ error: 'Utilisateur introuvable' });

    // Optionnel: notify sockets & cleanup
    if (io) {
      for (const [sid, uname] of connectedUsers.entries()) {
        if (uname === username) io.to(sid).emit('accountDeleted');
      }
    }

    reply.send({ success: true });
  } catch (e) {
    console.error('❌ delete user:', e);
    reply.code(500).send({ error: e.message });
  }
});

// Réponse à une demande (accept/reject) + notifications + refresh listes
fastify.post('/friends/respond', async (req, reply) => {
  const { from, to, accept } = req.body || {};
  if (!from || !to || typeof accept !== 'boolean') {
    return reply.status(400).send({ error: 'Champs manquants' });
  }

  await dbRun(
    `UPDATE friends SET status = ? WHERE user1 = ? AND user2 = ?`,
    [accept ? 'accepted' : 'rejected', from, to]
  );

  // Notifier les 2 côtés
  const payloadForSender = {
    id: `fr-respond-${from}-${to}-${Date.now()}`,
    type: 'friendRespond',
    icon: accept ? '✅' : '❌',
    title: accept ? 'Demande acceptée' : 'Demande refusée',
    message: accept ? `${to} a accepté votre demande.` : `${to} a refusé votre demande.`,
    timestamp: new Date().toISOString(),
    actionable: false
  };
  emitToUser(from, 'newNotification', payloadForSender);

  const payloadForReceiver = {
    ...payloadForSender,
    message: accept
      ? `Vous êtes maintenant ami(e) avec ${from}.`
      : `Vous avez refusé la demande de ${from}.`
  };
  emitToUser(to, 'newNotification', payloadForReceiver);

  // Demander aux 2 clients de recharger leur liste d'amis
  emitToUser(from, 'friendsUpdated', { users: [from, to] });
  emitToUser(to,   'friendsUpdated', { users: [from, to] });

  reply.send({ success: true });
});


// Liste des amis acceptés
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

// Suppression d'un ami + refresh listes
fastify.delete('/friends/remove', async (req, reply) => {
  const { from, to } = req.body || {};
  try {
    await dbRun(
      'DELETE FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)',
      [from, to, to, from]
    );
    emitToUser(from, 'friendsUpdated', { users: [from, to] });
    emitToUser(to,   'friendsUpdated', { users: [from, to] });
    reply.send({ success: true, message: 'Ami supprimé avec succès' });
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

/* =======================
   USERS
======================= */
fastify.get('/users', async (req, reply) => {
  try {
    const rows = await dbAll('SELECT * FROM users', []);
    // transforme avatar -> absolu
    const out = rows.map(u => ({
      ...u,
      avatar: absoluteAvatarUrl(u.avatar || '/avatars/default.png', req),
    }));
    reply.send(out);
  } catch (err) {
    reply.code(500).send({ error: err.message });
  }
});

fastify.post('/users', async (req, reply) => {
  const { username } = req.body || {};
  db.run('INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)',
    [username, `${username}@example.com`, '', ''], function (err) {
      if (err) return reply.code(500).send({ error: err.message });
      reply.send({ id: this.lastID, username });
    });
});

fastify.put('/user/update', async (req, reply) => {
  const { username, email, password } = req.body || {};
  if (!username || !email) return reply.code(400).send({ error: 'Champs manquants' });

  const user = await findUserByUsername(username);
  if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

  const updates = [];
  const values = [];

  if (email && email !== user.email) {
    updates.push('email = ?');
    values.push(email);
  }
  if (password) {
    const { hash, salt } = hashPassword(password);
    updates.push('password_hash = ?', 'salt = ?');
    values.push(hash, salt);
  }
  if (updates.length === 0) {
    return reply.send({ success: true, message: 'Aucune modification' });
  }

  try {
    await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...values, user.id]);
  } catch (e) {
    if (/UNIQUE constraint failed: users\.email/i.test(e.message)) {
      return reply.code(409).send({ error: 'Cet email est déjà utilisé' });
    }
    throw e;
  }

  reply.send({ success: true, message: 'Mise à jour OK' });
});

// ====== remplace TOTALEMENT ton endpoint PUT /user/:username ======
fastify.put('/user/:username', async (req, reply) => {
  const { username: pathUsername } = req.params;
  const updates = req.body || {};

  try {
    // 1) vérifier l’existence
    const existing = await findUserByUsername(pathUsername);
    if (!existing) {
      return reply.code(404).send({ error: 'Utilisateur non trouvé' });
    }

    // 2) ne garder que les champs autorisés ET réellement modifiés
    const allowed = ['username', 'email', 'is_private'];
    const setFields = [];
    const values = [];
    const incoming = { ...updates };
    if (typeof incoming.privateProfile === 'boolean') {
      incoming.is_private = incoming.privateProfile ? 1 : 0;
    }
    for (const f of allowed) {
      const newVal = incoming[f];
      if (newVal !== undefined && String(newVal) !== String(existing[f === 'is_private' ? 'is_private' : f])) {
        setFields.push(`${f} = ?`);
        values.push(newVal);
      }
    }

    // 3) si rien à changer -> succès doux
    if (setFields.length === 0) {
      return reply.send({
        success: true,
        message: 'Aucune modification',
        username: existing.username,
        email: existing.email
      });
    }

    // 4) appliquer la mise à jour (avec gestion des uniques)
    try {
      await dbRun(`UPDATE users SET ${setFields.join(', ')} WHERE id = ?`, [...values, existing.id]);
    } catch (e) {
      if (/UNIQUE constraint failed: users\.username/i.test(e.message)) {
        return reply.code(409).send({ error: 'Ce pseudo est déjà pris' });
      }
      if (/UNIQUE constraint failed: users\.email/i.test(e.message)) {
        return reply.code(409).send({ error: 'Cet email est déjà utilisé' });
      }
      throw e;
    }

    // 5) propager le renommage dans les autres tables si besoin
    const newUsername = updates.username || existing.username;
    if (newUsername !== existing.username) {
      await propagateUsernameChange(existing.username, newUsername);
    }

    return reply.send({
      success: true,
      message: 'Profil mis à jour avec succès',
      username: newUsername,
      email: updates.email ?? existing.email
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    reply.code(500).send({ error: error.message || 'Erreur interne' });
  }
});

fastify.put('/user/:username/password', async (req, reply) => {
  const { username } = req.params;
  const { currentPassword, newPassword } = req.body || {};
  try {
    if (!currentPassword || !newPassword) return reply.code(400).send({ error: 'Mots de passe manquants' });

    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    const isValid = verifyPassword(currentPassword, user.salt, user.password_hash);
    if (!isValid) return reply.code(400).send({ error: 'Mot de passe actuel incorrect' });

    const { hash, salt } = hashPassword(newPassword);
    await dbRun('UPDATE users SET password_hash = ?, salt = ? WHERE username = ?', [hash, salt, username]);

    reply.send({ message: 'Mot de passe mis à jour avec succès' });
  } catch (error) {
    console.error('❌ Erreur changement mot de passe:', error);
    reply.code(500).send({ error: error.message });
  }
});

/* =======================
   AVATAR
======================= */
// Setter direct (URL connue)
fastify.put('/user/avatar', async (req, reply) => {
  const { username, avatar } = req.body || {};
  if (!username || !avatar) return reply.code(400).send({ error: 'Données manquantes' });
  await dbRun('UPDATE users SET avatar = ? WHERE username = ?', [avatar, username]);
  reply.send({ message: 'Avatar mis à jour', avatar: absoluteAvatarUrl(avatar, req) });
});

// Upload générique (avec champ username dans form-data) — conservée
fastify.post('/upload-avatar', async (req, reply) => {
  try {
    const data = await req.file();
    const username = data?.fields?.username?.value;
    if (!data || !username) return reply.code(400).send({ error: 'Fichier ou username manquant' });

    // Vérifs
    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Format non supporté' });
    const buf = await data.toBuffer();
    if (buf.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'Fichier trop lourd (max 5 Mo)' });

    const filename = `${username}-${Date.now()}${extFromMime(data.mimetype)}`;
    const filepath  = path.join(AVATAR_DIR, filename);
    await fs.writeFile(filepath, buf);

    const relative = `/avatars/${filename}`;
    await dbRun('UPDATE users SET avatar = ? WHERE username = ?', [relative, username]);

    reply.send({ success: true, avatarUrl: absoluteAvatarUrl(relative, req) });
  } catch (error) {
    console.error('❌ Erreur upload avatar:', error);
    reply.code(500).send({ error: error.message });
  }
});

fastify.post('/user/:username/banner', async (req, reply) => {
  try {
    const { username } = req.params;
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Aucun fichier fourni' });

    const userExists = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
    if (!userExists) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Format non supporté' });

    const buf = await data.toBuffer();
    if (buf.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'Fichier trop lourd (max 5 Mo)' });

    const filename = `${username}-${Date.now()}${extFromMime(data.mimetype)}`;
    const filepath  = path.join(BANNER_DIR, filename);
    await fs.writeFile(filepath, buf);

    const relative = `/banners/${filename}`;
    await dbRun('UPDATE users SET banner = ? WHERE username = ?', [relative, username]);

    reply.send({ success: true, bannerUrl: absoluteAvatarUrl(relative, req) });
  } catch (error) {
    console.error('❌ Erreur upload banner:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Upload propre: /user/:username/avatar (utilisée par ton front)
fastify.post('/user/:username/avatar', async (req, reply) => {
  try {
    const { username } = req.params;
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'Aucun fichier fourni' });
    const userExists = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
    if (!userExists) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowed.has(data.mimetype)) return reply.code(400).send({ error: 'Format non supporté' });

    const buf = await data.toBuffer();
    if (buf.length > 5 * 1024 * 1024) return reply.code(400).send({ error: 'Fichier trop lourd (max 5 Mo)' });

    const filename = `${username}-${Date.now()}${extFromMime(data.mimetype)}`;
    const filepath  = path.join(AVATAR_DIR, filename);
    await fs.writeFile(filepath, buf);

    const relative = `/avatars/${filename}`;
    await dbRun('UPDATE users SET avatar = ? WHERE username = ?', [relative, username]);

    reply.send({ success: true, avatarUrl: absoluteAvatarUrl(relative, req) });
  } catch (error) {
    console.error('❌ Erreur upload avatar:', error);
    reply.code(500).send({ error: error.message });
  }
});




/* =======================
   REGISTER / LOGIN / LOGOUT
======================= */
fastify.post('/register', async (req, reply) => {
  const { username, email, password } = req.body || {};
  if (!username || !email || !password) return reply.code(400).send({ error: 'Champs manquants' });

  const { hash, salt } = hashPassword(password);
  db.run(
    'INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)',
    [username, email, hash, salt],
    function (err) {
      if (err) {

        console.error('❌ Erreur INSERT :', err.message);
        return reply.code(400).send({ error: err.message });
      }
      console.log('✅ Utilisateur créé ID :', this.lastID);
      reply.send({ message: 'Utilisateur créé', id: this.lastID });
    }
  );
});


fastify.post('/login', async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) return reply.code(400).send({ error: 'Email et mot de passe requis' });

  const user = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email], (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

  if (!user) {
    return reply.code(401).send({ message: 'Email ou username inconnu' });
  }

  const match = verifyPassword(password, user.salt, user.password_hash)
  if (!match) {
    return reply.code(401).send({ message: 'Mot de passe incorrect' });
  }

  return reply.send({
    message: 'Connexion réussie',
    username: user.username,
    email: user.email,
    avatar: user.avatar || '/avatars/default.png'
  });
});

fastify.post('/logout', async (req, reply) => {
  // Si tu ajoutes plus tard des cookies/sessions:
  // reply.clearCookie('sid', { path: '/', sameSite: 'lax' });
  return reply.send({ message: 'Déconnexion réussie' });
});

/* =======================
   GET USER (fix: createdAt + status)
======================= */
fastify.get('/user/:username', async (req, reply) => {
  const { username } = req.params;
  console.log('GET USER:', username);

  try {
    const user = await dbGet(
      'SELECT id, username, email, avatar, banner, created_at, is_private FROM users WHERE username = ?',
      [username]
    );

    console.log('USER FOUND:', user);
    if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    // Status: si helpers de présence dispos, on les utilise; sinon on met 'offline'
    let status = 'offline';
    try {
      if (typeof getUserStatus === 'function') {
        status = getUserStatus(username);
      } else if (socketsByUserMulti && typeof socketsByUserMulti.has === 'function') {
        status = socketsByUserMulti.has(username) ? 'online' : 'offline';
      }
    } catch (_) { /* fallback offline */ }

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: absoluteAvatarUrl(user.avatar || '/avatars/default.png', req),
      banner: absoluteAvatarUrl(user.banner || '/banners/default.jpg', req),
      createdAt: user.created_at || new Date().toISOString(), // <- camelCase attendu par le front
      status,
      isPrivate: !!user.is_private
    };

    reply.send(userResponse);
  } catch (error) {
    console.error('❌ ERREUR GET USER:', error);
    reply.code(500).send({ error: 'Erreur interne du serveur', details: error.message });
  }
});


/* =======================
   GAMES API (existant)
======================= */
fastify.get('/api/games/available', (req, reply) => {
  const available = Array.from(gameLobbies.values()).filter(game => game.status === 'lobby');
  const mappedGames = available.map(game => ({
    id: game.id,
    name: game.name,
    currentPlayers: game.currentPlayers.length,
    maxPlayers: game.maxPlayers,
    estimatedWaitTime: null,
    hasPassword: !!game.password,
    status: game.status
  }));
  reply.send(mappedGames);
});

/* =======================
   GET STATISTICS
======================= */

fastify.get('/user/:username/stats', async (req, reply) => {
  const { username } = req.params;
  console.log('GET USER STATS:', username);
  try {
    const user = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
	  console.log('USER STATS FOUND:', user);
    if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });
    // Nombre de parties jouées
    const totalGamesRow = await dbGet('SELECT COUNT(*) as count FROM games WHERE player_id = ?', [user.id]);
    const totalGames = totalGamesRow?.count || 0;
    // Nombre de victoires
    const gamesWonRow = await dbGet('SELECT COUNT(*) as count FROM games WHERE player_id = ? AND result = "win"', [user.id]);
    const gamesWon = gamesWonRow?.count || 0;
    // Taux de victoire
    const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;
    // Classement (par nombre de victoires, 1 = meilleur)
    const rankingRow = await dbGet(`
      SELECT rank FROM (
        SELECT player_id, RANK() OVER (ORDER BY COUNT(CASE WHEN result = "win" THEN 1 END) DESC) as rank
        FROM games
        GROUP BY player_id
      ) WHERE player_id = ?
    `, [user.id]);
    const ranking = rankingRow?.rank || null;
    reply.send({
      totalGames,
      gamesWon,
      winRate,
      ranking
    });
  } catch (error) {
    console.error('❌ ERREUR GET USER STATS:', error);
    reply.code(500).send({ error: 'Erreur interne du serveur', details: error.message });
  }
});

/* =======================
   USER GAME HISTORY (dernieres parties)
======================= */
fastify.get('/user/:username/history', async (req, reply) => {
  const { username } = req.params;
  try {
    const u = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (!u) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    const rows = await dbAll(`
      SELECT g.id,
             g.result,
             g.score,
             g.opponent_score,
             g.played_at,
             u2.username AS opponent
      FROM games g
      LEFT JOIN users u2 ON u2.id = g.opponent_id
      WHERE g.player_id = ?
      ORDER BY g.played_at DESC
      LIMIT 50
    `, [u.id]);

    // Le front attend result: 'win' | 'loss'
    const out = rows.map(r => ({
      id: r.id,
      opponent: r.opponent || 'Inconnu',
      result: r.result === 'win' ? 'win' : 'loss',
      playerScore: r.score,
      opponentScore: r.opponent_score,
      date: r.played_at,
      duration: '' // si tu veux, stocke et renvoie une vraie durée plus tard
    }));
    reply.send(out);
  } catch (e) {
    console.error('❌ ERREUR /user/:username/history:', e);
    reply.code(500).send({ error: e.message });
  }
});


/* =======================
   PROMETHEUS METRICS
======================= */
client.register.setDefaultLabels({ app: 'ft_transcendance' });
client.collectDefaultMetrics();

const loginAttempts = new client.Counter({
  name: 'login_attempts_total',
  help: 'Total login attempts',
  labelNames: ['status', 'method'],
});
const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});
const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5],
});
const gameSessionsActive = new client.Gauge({
  name: 'game_sessions_active',
  help: 'Number of active game sessions'
});
const websocketConnections = new client.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});
const dbConnections = new client.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

fastify.addHook('onRequest', async (request, reply) => { request.startTime = Date.now(); });
fastify.addHook('onResponse', async (request, reply) => {
  const duration = (Date.now() - request.startTime) / 1000;
  const route = request.routerPath || 'unknown';
  httpRequests.inc({ method: request.method, route, status_code: reply.statusCode });
  httpDuration.observe({ method: request.method, route, status_code: reply.statusCode }, duration);
});

fastify.get('/metrics', async (request, reply) => {
  reply.header('Content-Type', client.register.contentType);
  return await client.register.metrics();
});

// Démos
fastify.get('/test/login-success', async () => { loginAttempts.inc({ status: 'success', method: 'test' }); return { ok: true }; });
fastify.get('/test/login-failure', async () => { loginAttempts.inc({ status: 'failure', method: 'test' }); return { ok: true }; });
fastify.get('/test/game-session', async (request) => {
  const action = request.query.action || 'start';
  if (action === 'start') { gameSessionsActive.inc(); return { message: 'Started' }; }
  if (action === 'end')   { gameSessionsActive.dec(); return { message: 'Ended' }; }
  return { message: 'Invalid action' };
});
fastify.get('/test/websocket', async (request) => {
  const action = request.query.action || 'connect';
  if (action === 'connect') { websocketConnections.inc(); return { message: 'WS connected' }; }
  if (action === 'disconnect') { websocketConnections.dec(); return { message: 'WS disconnected' }; }
  return { message: 'Invalid action' };
});

/* =======================
   HTTP + SOCKET.IO
======================= */
fastify.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Backend (HTTP) prêt sur ${address}`);

  io = new Server(fastify.server, {
    cors: {
      origin: FRONT_ORIGINS,
      methods: ['GET', 'POST'],
      credentials: true
    }
    // transports par défaut: polling + websocket
  });

  console.log('⚡️ Serveur WebSocket prêt.');

  const initialGameStateTemplate = {
    gameId: null,
    ball: { x: W / 2, y: H / 2, vx: 4, vy: 4, radius: 8 },
    paddles: {
      p1: { x: 10, y: H / 2 - 50, width: 10, height: 100, vy: 0 },
      p2: { x: W - 20, y: H / 2 - 50, width: 10, height: 100, vy: 0 }
    },
    players: { p1: null, p2: null },
    score: { player1: 0, player2: 0 },
    status: 'waiting'
  };

  // === helpers jeu ===
  const resetBall = (ball) => {
    ball.x = W / 2;
    ball.y = H / 2;
    ball.vx = Math.random() > 0.5 ? 4 : -4;
    ball.vy = Math.random() > 0.5 ? 4 : -4;
  };
  const collides = (ball, paddle) => (
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.x + ball.radius > paddle.x &&
    ball.y - ball.radius < paddle.y + paddle.height &&
    ball.y + ball.radius > paddle.y
  );

  const startGameForRoom = (roomId) => {
    const room = activeGameRooms.get(roomId);
    if (!room || room.gameState.status === 'playing') return;
    room.gameState.status = 'playing';
    resetBall(room.gameState.ball);
    // ... juste après status = 'playing' + resetBall
    io.to(roomId).emit('gameState', room.gameState);        // ✅ l’UI voit "playing" sans délai
    room.intervalId = setInterval(() => gameLoopForRoom(roomId), 1000/60);


    // fin au temps si configurée
    if (room.durationMinutes && !room.durationTimer) {
      room.durationTimer = setTimeout(() => {
        if (!activeGameRooms.has(roomId)) return;
        io.to(roomId).emit('gameEnded', { message: 'Fin du temps.' });
        stopGameForRoom(roomId);
      }, room.durationMinutes * 60 * 1000);
    }
  };

const stopGameForRoom = (roomId, silent = false) => {
  const room = activeGameRooms.get(roomId);
  if (!room) return;
  if (room.intervalId) clearInterval(room.intervalId);
  if (room.durationTimer) clearTimeout(room.durationTimer);
  room.intervalId = null;
  room.durationTimer = null;
  room.gameState.status = 'finished';
  activeGameRooms.delete(roomId);
  if (!silent) {
    io.to(roomId).emit('gameEnded', { message: 'La partie a été arrêtée.' });
  }
};


  function gameLoopForRoom(roomId) {
    const room = activeGameRooms.get(roomId);
    if (!room || room.gameState.status !== 'playing') return;
    const { ball, paddles, score } = room.gameState;

    [paddles.p1, paddles.p2].forEach(p => {
      p.y += p.vy;
      if (p.y < 0) p.y = 0;
      if (p.y > H - p.height) p.y = H - p.height;
    });

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.y - ball.radius < 0 || ball.y + ball.radius > H) ball.vy *= -1;
    if (collides(ball, paddles.p1) || collides(ball, paddles.p2)) ball.vx *= -1;

    // Point Player 2
    if (ball.x - ball.radius < 0) {
      score.player2++;
      if (score.player2 >= (room.maxPoints || 10)) {
        room.gameState.status = 'finished';
        room.gameState.winner = 'Player 2';
        room.gameState.gameOver = true;
        io.to(roomId).emit('gameEnded', { winner: 'Player 2', finalScore: { ...score } });
        persistAndNotifyRoomResult(roomId, 'p2');
        return;
        (async () => {
          const p1Username = room.playerUsernames.p1;
          const p2Username = room.playerUsernames.p2;

          const p1User = await dbGet('SELECT id FROM users WHERE username = ?', [p1Username]);
          const p2User = await dbGet('SELECT id FROM users WHERE username = ?', [p2Username]);

          if (p1User && p2User) {
            await dbRun(
              'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
              [p2User.id, p1User.id, 'win',  score.player2, score.player1]
            );
            await dbRun(
              'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
              [p1User.id, p2User.id, 'lose', score.player1, score.player2]
            );
          
            // 🔔 Notifie les 2 joueurs pour qu’ils rafraîchissent leurs stats
            emitToUser(p1Username, 'playerStatsUpdated', { username: p1Username });
            emitToUser(p2Username, 'playerStatsUpdated', { username: p2Username });
          }
        
          stopGameForRoom(roomId);
        })();
        return;
      } else {
        resetBall(ball);
      }
    }

    // Point Player 1
    if (ball.x + ball.radius > W) {
      score.player1++;
      if (score.player1 >= (room.maxPoints || 10)) {
        room.gameState.status = 'finished';
        room.gameState.winner = 'Player 1';
        room.gameState.gameOver = true;
        io.to(roomId).emit('gameEnded', { winner: 'Player 1', finalScore: { ...score } });
        persistAndNotifyRoomResult(roomId, 'p1');
        return;
        (async () => {
          const p1Username = room.playerUsernames.p1;
          const p2Username = room.playerUsernames.p2;

          const p1User = await dbGet('SELECT id FROM users WHERE username = ?', [p1Username]);
          const p2User = await dbGet('SELECT id FROM users WHERE username = ?', [p2Username]);

          if (p1User && p2User) {
            await dbRun(
              'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
              [p1User.id, p2User.id, 'win',  score.player1, score.player2]
            );
            await dbRun(
              'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
              [p2User.id, p1User.id, 'lose', score.player2, score.player1]
            );
          
            // 🔔 Notifie les 2 joueurs pour qu’ils rafraîchissent leurs stats
            emitToUser(p1Username, 'playerStatsUpdated', { username: p1Username });
            emitToUser(p2Username, 'playerStatsUpdated', { username: p2Username });
          }
        
          stopGameForRoom(roomId);
        })();
        return;
      } else {
        resetBall(ball);
      }
    }

    io.to(roomId).emit('gameState', room.gameState);
  }

  /* ---------- GAMES: persistance & notifications ---------- */
async function persistAndNotifyRoomResult(roomId, winnerSide /* 'p1' | 'p2' */) {
  try {
    const room = activeGameRooms.get(roomId);
    if (!room) return;

    const { score } = room.gameState;
    const p1Username = room.playerUsernames.p1;
    const p2Username = room.playerUsernames.p2;

    const p1User = await dbGet('SELECT id FROM users WHERE username = ?', [p1Username]);
    const p2User = await dbGet('SELECT id FROM users WHERE username = ?', [p2Username]);
    if (!p1User || !p2User) return;

    const winnerIsP1  = winnerSide === 'p1';
    const winnerId    = winnerIsP1 ? p1User.id : p2User.id;
    const loserId     = winnerIsP1 ? p2User.id : p1User.id;
    const winnerScore = winnerIsP1 ? score.player1 : score.player2;
    const loserScore  = winnerIsP1 ? score.player2 : score.player1;

    await dbRun(
      'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
      [winnerId, loserId, 'win',  winnerScore, loserScore]
    );
    await dbRun(
      'INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)',
      [loserId,  winnerId, 'loss', loserScore,  winnerScore]
    );

    // 📢 event unique avec pseudo
    io.to(roomId).emit('gameEnded', {
      winner: winnerIsP1 ? 'Player 1' : 'Player 2',
      winnerUsername: winnerIsP1 ? p1Username : p2Username,
      loserUsername:  winnerIsP1 ? p2Username : p1Username,
      finalScore: { ...score },
      roomId
    });

    // 🔔 demande aux profils de recharger
    emitToUser(p1Username, 'playerStatsUpdated', { username: p1Username });
    emitToUser(p2Username, 'playerStatsUpdated', { username: p2Username });
  } catch (e) {
    console.error('❌ persistAndNotifyRoomResult failed:', e);
  } finally {
    // stop silencieux (pas de 2ᵉ "gameEnded")
    stopGameForRoom(roomId, true);
  }
}


  const broadcastGameListUpdate = () => {
    const available = Array.from(gameLobbies.values()).filter(game => game.status === 'lobby');
    const mappedGames = available.map(game => ({
      id: game.id,
      name: game.name,
      currentPlayers: game.currentPlayers.length,
      maxPlayers: game.maxPlayers,
      estimatedWaitTime: null,
      hasPassword: !!game.password,
      status: game.status
    }));
    io.emit('gameListUpdate', mappedGames);
  };
  // --- Défis (challenges) ---
  const pendingChallenges = new Map(); // Map<challengeId, {id, from, to, options, createdAt, status}>
  function pickOneSocketId(username) {
    const set = socketsByUserMulti.get(username);
    if (!set || set.size === 0) return null;
    // on prend le premier socket connu
    return Array.from(set)[0];
  }

  function replayPendingChallengesFor(username) {
    const set = socketsByUserMulti.get(username);
    if (!set || set.size === 0) return;
    for (const ch of pendingChallenges.values()) {
      if (ch.to === username && ch.status === 'pending') {
        // notif cliquable
        const notif = {
          id: ch.id,
          type: 'challenge',
          icon: '🎯',
          title: 'Défi reçu',
          message: `${ch.from} te défie à un match !`,
          timestamp: ch.createdAt,
          actionable: true,
          actionText: 'Accepter',
          actionData: { type: 'challenge', id: ch.id }
        };
        for (const sid of set) {
          io.to(sid).emit('newNotification', notif);
          io.to(sid).emit('challengeIncoming', ch);
        }
      }
    }
  }

  io.on('connection', socket => {
    client.register.getSingleMetric('websocket_connections_active')?.inc();

    socket.onAny((eventName, ...args) => {
      console.log(`📨 SERVER: ${eventName}`, args?.[0] ?? '');
    });
      
    // Quand un joueur ouvre GameView sur un autre onglet/socket,
// on rattache CE socket à la room comme contrôleur officiel.
socket.on('joinChallengeRoom', ({ roomId, username }) => {
  try {
    const room = activeGameRooms.get(roomId);
    if (!room) return socket.emit('challengeError', { error: 'Room introuvable' });

    const isP1 = room.playerUsernames?.p1 === username;
    const isP2 = room.playerUsernames?.p2 === username;
    if (!isP1 && !isP2) return socket.emit('challengeError', { error: 'Tu ne fais pas partie de cette room' });

    // Retire l’ancien socket de la room (s’il existe)
    const prevSid = isP1 ? room.playerSockets.p1 : room.playerSockets.p2;
    if (prevSid && prevSid !== socket.id) {
      io.sockets.sockets.get(prevSid)?.leave(roomId);
    }

    // Ajoute ce socket à la room et met à jour les mappings
    socket.join(roomId);
    if (isP1) {
      room.playerSockets.p1 = socket.id;
      room.gameState.players.p1 = socket.id;
    } else {
      room.playerSockets.p2 = socket.id;
      room.gameState.players.p2 = socket.id;
    }

    // Push l'état courant au nouveau socket pour qu'il ne reste pas "En attente"
    socket.emit('gameState', room.gameState);
  } catch (e) {
    socket.emit('challengeError', { error: e?.message || 'Erreur joinChallengeRoom' });
  }
});

        // 1) Le challenger envoie un défi
    socket.on('challengePlayer', async ({ from, to, options }) => {
      try {
        from = String(from || '').trim();
        to   = String(to   || '').trim();
        if (!from || !to || from === to) {
          return socket.emit('challengeError', { error: 'Paramètres invalides' });
        }
      
        // (optionnel) vérifie que les 2 users existent en DB
        const fromU = await dbGet('SELECT id FROM users WHERE username = ?', [from]);
        const toU   = await dbGet('SELECT id FROM users WHERE username = ?', [to]);
        if (!fromU || !toU) {
          return socket.emit('challengeError', { error: 'Utilisateur introuvable' });
        }
      
        const challengeId = `ch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
        const payload = {
          id: challengeId,
          from,
          to,
          options: {
            maxPoints: Number(options?.maxPoints) || 10,
            durationMinutes: Number(options?.durationMinutes) || null
          },
          createdAt: new Date().toISOString(),
          status: 'pending'
        };
        pendingChallenges.set(challengeId, payload);
      
        // Notif visuelle côté SocialView du destinataire
        emitToUser(to, 'newNotification', {
          id: challengeId,
          type: 'challenge',
          icon: '🎯',
          title: 'Défi reçu',
          message: `${from} te défie à un match !`,
          timestamp: payload.createdAt,
          actionable: true,
          actionText: 'Accepter',               // SocialView peut afficher « Accepter »
          actionData: { type: 'challenge', id: challengeId }
        });
      
        // Event dédié avec les détails (pour afficher Accepter/Refuser)
        emitToUser(to, 'challengeIncoming', payload);
      
        // Feedback au challenger
        emitToUser(from, 'challengeSent', { id: challengeId, to, options: payload.options });
      } catch (e) {
        socket.emit('challengeError', { error: e.message || 'Erreur envoi défi' });
      }
    });
    
    // 2) Le destinataire accepte/refuse
    socket.on('challengeRespond', async ({ challengeId, accept }) => {
      const ch = pendingChallenges.get(challengeId);
      if (!ch || ch.status !== 'pending') {
        return socket.emit('challengeError', { error: 'Défi introuvable ou expiré' });
      }
    
      if (!accept) {
        ch.status = 'declined';
        pendingChallenges.delete(challengeId);
        emitToUser(ch.from, 'challengeDeclined', { id: ch.id, to: ch.to });
        emitToUser(ch.to,   'challengeDeclinedAck', { id: ch.id });
        return;
      }
    
      // Accepté → on crée une room active et on y met directement les 2 sockets
      ch.status = 'accepted';
      pendingChallenges.delete(challengeId);
    
      const roomId = `game-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
    
      // Prépare l’état de jeu
      const newGameState = {
        gameId: roomId,
        ball: { x: W/2, y: H/2, vx: 4, vy: 4, radius: 8 },
        s: {
          p1: { x: 10,    y: H/2 - 50, width: 10, height: 100, vy: 0 },
          p2: { x: W-20,  y: H/2 - 50, width: 10, height: 100, vy: 0 },
        },
        players: { p1: null, p2: null },
        score: { player1: 0, player2: 0 },
        status: 'starting'
      };
    
      // Socket IDs (on prend un onglet si plusieurs)
      const p1Sid = pickOneSocketId(ch.from);
      const p2Sid = pickOneSocketId(ch.to);
    
      if (!p1Sid || !p2Sid) {
        emitToUser(ch.from, 'challengeError', { error: 'Un joueur est hors-ligne' });
        emitToUser(ch.to,   'challengeError', { error: 'Un joueur est hors-ligne' });
        return;
      }
    
      // Place les sockets dans la room côté serveur
      io.sockets.sockets.get(p1Sid)?.join(roomId);
      io.sockets.sockets.get(p2Sid)?.join(roomId);
      newGameState.players = { p1: p1Sid, p2: p2Sid };        // ✅ contrôleurs tout de suite
      newGameState.usernames = { p1: ch.from, p2: ch.to };
      // Enregistre la room active (même forme que tes rooms actuelles)
      activeGameRooms.set(roomId, {
        gameState: newGameState,
        intervalId: null,
        playerSockets:  { p1: p1Sid, p2: p2Sid },
        playerUsernames:{ p1: ch.from, p2: ch.to },
        maxPoints: ch.options.maxPoints,
        durationMinutes: ch.options.durationMinutes,
        durationTimer: null
      });
      io.to(roomId).emit('gameState', newGameState);   
      // Informer les 2 clients d’ouvrir RemoteGame sur roomId
      emitToUser(ch.from, 'challengeStart', { roomId, mode: 'remote' });
      emitToUser(ch.to,   'challengeStart', { roomId, mode: 'remote' });
    
      // Démarre la partie (ta fonction existante)
      setTimeout(() => startGameForRoom(roomId), 1500);
    });
    
    // 3) (optionnel) le challenger annule
    socket.on('challengeCancel', ({ challengeId }) => {
      const ch = pendingChallenges.get(challengeId);
      if (ch) {
        pendingChallenges.delete(challengeId);
        emitToUser(ch.to, 'challengeCanceled', { id: challengeId, from: ch.from });
        emitToUser(ch.from, 'challengeCanceledAck', { id: challengeId });
      }
    });


    // identify: présence multi-onglet + liste dédupliquée
    socket.on('identify', (usernameRaw) => {
      const username = String(usernameRaw || '').trim();
      if (!username) return;

      // compat ancien code
      connectedUsers.set(socket.id, username);

      addPresence(username, socket.id);

      // annonce si 1er onglet
      const set = socketsByUserMulti.get(username);
      if (set && set.size === 1) socket.broadcast.emit('userConnected', username);

      const unique = Array.from(new Set(Array.from(socketsByUserMulti.keys())));
      socket.emit('connectedUsersList', unique);
      replayPendingChallengesFor(username);
    });

    socket.on('requestConnectedUsers', () => {
      const unique = Array.from(socketsByUserMulti.keys());
      socket.emit('connectedUsersList', unique);
    });

    // Chat
    socket.on('sendMessage', async (data) => {
      const { sender, receiver, content } = data || {};
      const blocked = await dbGet('SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?', [receiver, sender]);
      if (blocked) {
        socket.emit('messageError', { error: 'Vous avez été bloqué par cet utilisateur' });
        return;
      }
      await dbRun('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)', [sender, receiver, content]);

      const payload = { sender, receiver, content, timestamp: new Date().toISOString() };
      const recvSet = socketsByUserMulti.get(receiver);
      if (recvSet) for (const sid of recvSet) io.to(sid).emit('newMessage', payload);
      socket.emit('messageSent', payload);
    });

    socket.on('typing', ({ sender, receiver }) => {
      const recvSet = socketsByUserMulti.get(receiver);
      if (recvSet) for (const sid of recvSet) io.to(sid).emit('userTyping', { sender });
    });
    socket.on('stopTyping', ({ sender, receiver }) => {
      const recvSet = socketsByUserMulti.get(receiver);
      if (recvSet) for (const sid of recvSet) io.to(sid).emit('userStoppedTyping', { sender });
    });

    // Jeux: create / join / leave etc.
    socket.on('createGame', (gameData) => {
      const newGameId = `game-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
      const userId = connectedUsers.get(socket.id) || socket.id;

      const newGameLobby = {
        id: newGameId,
        name: gameData.name,
        password: gameData.password,
        creatorId: userId,
        maxPlayers: gameData.maxPlayers,
        currentPlayers: [{ id: userId, socketId: socket.id }],
        status: 'lobby',
        durationMinutes: gameData.durationMinutes,
        maxPoints: gameData.maxPoints,
        createdAt: Date.now()
      };

      gameLobbies.set(newGameId, newGameLobby);
      socket.join(newGameId);
      socket.emit('gameCreatedConfirmation', { id: newGameLobby.id, name: newGameLobby.name });
      broadcastGameListUpdate();
    });

    socket.on('requestLobbyState', ({ gameId }) => {
      const gameLobby = gameLobbies.get(gameId);
      const userId = connectedUsers.get(socket.id) || socket.id;
      if (!gameLobby) return socket.emit('gameQueueUpdate', { gameId, status: 'not_found', message: 'Lobby introuvable.' });
      if (!gameLobby.currentPlayers.find(p => p.id === userId))
        return socket.emit('gameQueueUpdate', { gameId, status: 'not_found', message: 'Vous n\'êtes pas dans ce lobby.' });

      socket.emit('gameQueueUpdate', {
        gameId: gameLobby.id,
        currentPlayers: gameLobby.currentPlayers.length,
        maxPlayers: gameLobby.maxPlayers,
        status: gameLobby.status,
        estimatedWaitTime: null
      });
    });

    socket.on('requestGameQueueStatus', ({ gameId }) => {
      const gameLobby = gameLobbies.get(gameId);
      if (gameLobby) {
        const userId = connectedUsers.get(socket.id) || socket.id;
        if (!gameLobby.currentPlayers.find(p => p.id === userId))
          return socket.emit('gameQueueUpdate', { gameId, status: 'not_found', message: 'Vous n\'êtes pas dans ce lobby.' });
        return socket.emit('gameQueueUpdate', {
          gameId: gameLobby.id,
          currentPlayers: gameLobby.currentPlayers.length,
          maxPlayers: gameLobby.maxPlayers,
          status: gameLobby.status,
          estimatedWaitTime: null
        });
      }
      const activeRoom = activeGameRooms.get(gameId);
      if (activeRoom) {
        return socket.emit('gameQueueUpdate', {
          gameId: activeRoom.gameState.gameId,
          currentPlayers: 2,
          maxPlayers: 2,
          status: 'started',
          roomId: activeRoom.gameState.gameId
        });
      }
      socket.emit('gameQueueUpdate', { gameId, status: 'not_found', message: 'Partie introuvable ou terminée.' });
    });

    socket.on('joinGame', ({ gameId, password }) => {
      const gameLobby = gameLobbies.get(gameId);
      const userId = connectedUsers.get(socket.id) || socket.id;
      if (!gameLobby) return socket.emit('gameJoinError', { message: 'Partie introuvable.' });
      if (gameLobby.currentPlayers.some(p => p.id === userId))
        return socket.emit('gameJoinError', { message: 'Vous êtes déjà dans cette partie.' });
      if (gameLobby.currentPlayers.length >= gameLobby.maxPlayers)
        return socket.emit('gameJoinError', { message: 'La partie est pleine.' });
      if (gameLobby.password && password !== gameLobby.password)
        return socket.emit('gameJoinError', { message: 'Mot de passe incorrect.' });

      gameLobby.currentPlayers.push({ id: userId, socketId: socket.id });
      socket.join(gameId);
      broadcastGameListUpdate();
      gameLobby.currentPlayers.forEach(player => {
        io.to(player.socketId).emit('gameQueueUpdate', {
          gameId: gameLobby.id,
          currentPlayers: gameLobby.currentPlayers.length,
          maxPlayers: gameLobby.maxPlayers,
          status: gameLobby.status,
          estimatedWaitTime: null
        });
      });

      if (gameLobby.currentPlayers.length === gameLobby.maxPlayers && gameLobby.status === 'lobby') {
        gameLobby.status = 'starting';
        gameLobbies.delete(gameId);
        broadcastGameListUpdate();

        const newGameState = JSON.parse(JSON.stringify(initialGameStateTemplate));
        newGameState.gameId = gameId;
        newGameState.players.p1 = gameLobby.currentPlayers[0].socketId;
        newGameState.players.p2 = gameLobby.currentPlayers[1].socketId;
        const p1Username = connectedUsers.get(newGameState.players.p1);
        const p2Username = connectedUsers.get(newGameState.players.p2);
        newGameState.usernames = { p1: p1Username, p2: p2Username }; // 👈

        activeGameRooms.set(gameId, {
          gameState: newGameState,
          intervalId: null,
          playerSockets: { p1: newGameState.players.p1, p2: newGameState.players.p2 },
          playerUsernames: { p1: p1Username, p2: p2Username },
          maxPoints: Number(gameLobby.maxPoints) || 10,
          durationMinutes: Number(gameLobby.durationMinutes) || null,
          durationTimer: null
        });

        setTimeout(() => {
          if (activeGameRooms.has(gameId)) {
            startGameForRoom(gameId);
            gameLobby.currentPlayers.forEach(player => {
              io.to(player.socketId).emit('gameQueueUpdate', {
                gameId: gameLobby.id,
                currentPlayers: gameLobby.currentPlayers.length,
                maxPlayers: gameLobby.maxPlayers,
                status: 'started',
                roomId: gameLobby.id
              });
            });
          }
        }, 3000);
      }
    });

    socket.on('leaveGame', ({ gameId }) => {
      const userId = connectedUsers.get(socket.id) || socket.id;
      const gameLobby = gameLobbies.get(gameId);
      if (gameLobby) {
        const before = gameLobby.currentPlayers.length;
        gameLobby.currentPlayers = gameLobby.currentPlayers.filter(p => p.id !== userId);
        if (gameLobby.currentPlayers.length < before) {
          socket.leave(gameId);
          if (gameLobby.currentPlayers.length === 0) gameLobbies.delete(gameId);
          else gameLobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
            gameId: gameLobby.id,
            currentPlayers: gameLobby.currentPlayers.length,
            maxPlayers: gameLobby.maxPlayers,
            status: gameLobby.status,
            estimatedWaitTime: null
          }));
          socket.emit('leftGameConfirmation', { gameId });
          broadcastGameListUpdate();
          return;
        }
      }
      
      const activeRoom = activeGameRooms.get(gameId);
      if (activeRoom) {
        stopGameForRoom(gameId);
        socket.emit('leftGameConfirmation', { gameId });
        return;
      }
      socket.emit('leaveGameError', { message: 'Partie introuvable ou vous n\'êtes pas dedans.' });
    });

    socket.on('movePaddle', ({ roomId, direction }) => {
      const room = activeGameRooms.get(roomId);
      if (!room) return;
      const { gameState } = room;

      if (gameState.status !== 'playing') {
        // (facultatif) log utile en dev :
        // console.log('⏸ move ignoré: status', gameState.status);
        return;
      }
    
      const isP1 = socket.id === (room.playerSockets?.p1) || socket.id === (gameState.players?.p1);
      const isP2 = socket.id === (room.playerSockets?.p2) || socket.id === (gameState.players?.p2);
      if (!isP1 && !isP2) {
        // console.log('🚫 move rejeté: socket non autorisé', socket.id);
        return;
      }
    
      const p = isP1 ? gameState.paddles.p1 : gameState.paddles.p2;
      p.vy = direction === 'up' ? -8 : direction === 'down' ? 8 : 0;
    });


    socket.on('requestGameList', () => {
      const available = Array.from(gameLobbies.values()).filter(game => game.status === 'lobby');
      const mappedGames = available.map(game => ({
        id: game.id,
        name: game.name,
        currentPlayers: game.currentPlayers.length,
        maxPlayers: game.maxPlayers,
        estimatedWaitTime: null,
        hasPassword: !!game.password,
        status: game.status
      }));
      socket.emit('gameListUpdate', mappedGames);
    });

    socket.on('disconnect', () => {
      client.register.getSingleMetric('websocket_connections_active')?.dec();

      const username = connectedUsers.get(socket.id);
      const result = removePresence(socket.id);

      // compat ancien mapping
      if (username) connectedUsers.delete(socket.id);

      if (result.username && !result.stillOnline) {
        socket.broadcast.emit('userDisconnected', result.username);
      }

      // nettoyage lobbies
      for (const [gameId, lobby] of gameLobbies.entries()) {
        const before = lobby.currentPlayers.length;
        lobby.currentPlayers = lobby.currentPlayers.filter(p => p.socketId !== socket.id);
        if (lobby.currentPlayers.length < before) {
          socket.leave(gameId);
          if (lobby.currentPlayers.length === 0) gameLobbies.delete(gameId);
          else lobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
            gameId: lobby.id,
            currentPlayers: lobby.currentPlayers.length,
            maxPlayers: lobby.maxPlayers,
            status: lobby.status,
            estimatedWaitTime: null
          }));
          broadcastGameListUpdate();
          break;
        }
      }
      // si joueur en partie → stop
      for (const [gameId, room] of activeGameRooms.entries()) {
        if (room.playerSockets.p1 === socket.id || room.playerSockets.p2 === socket.id) {
          stopGameForRoom(gameId);
          break;
        }
      }
    });
  });
});

/* =======================
   SIMULATION (DEV)
======================= */
setInterval(() => {
  if (Math.random() > 0.7) {
    client.register.getSingleMetric('login_attempts_total')?.inc({ status: Math.random() > 0.8 ? 'failure' : 'success', method: 'simulation' });
  }
  client.register.getSingleMetric('database_connections_active')?.set(Math.floor(Math.random() * 10) + 5);
}, 5000);
