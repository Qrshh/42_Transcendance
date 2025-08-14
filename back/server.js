// server.js
console.log('--- DEBUG: SERVER SCRIPT STARTED ---');

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
   CORS
======================= */
fastify.register(cors, {
  origin: (origin, cb) => cb(null, true), // Open en dev ; restreins en prod
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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
};
setTimeout(addMissingColumns, 1000);

/* =======================
   UTILS
======================= */
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
fastify.post('/friends/request', async (req, reply) => {
  const { from, to } = req.body || {};
  if (from === to) return reply.status(400).send({ error: "Tu ne peux pas t'ajouter toi-même." });

  const exists = await dbGet(
    `SELECT 1 FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)`,
    [from, to, to, from]
  );
  if (exists) return reply.status(400).send({ error: 'Une relation existe déjà.' });

  await dbRun('INSERT INTO friends (user1, user2, status) VALUES (?, ?, ?)', [from, to, 'pending']);
  reply.send({ success: true, message: 'Demande envoyée.' });
});

fastify.get('/friends/requests/:username', async (req, reply) => {
  const { username } = req.params;
  const requests = await dbAll('SELECT user1 AS fromUser FROM friends WHERE user2 = ? AND status = ?', [username, 'pending']);
  reply.send(requests);
});

fastify.post('/friends/respond', async (req, reply) => {
  const { from, to, accept } = req.body || {};
  if (accept) {
    await dbRun(`UPDATE friends SET status = 'accepted' WHERE user1 = ? AND user2 = ?`, [from, to]);
  } else {
    await dbRun(`UPDATE friends SET status = 'rejected' WHERE user1 = ? AND user2 = ?`, [from, to]);
  }
  reply.send({ success: true });
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

fastify.delete('/friends/remove', async (req, reply) => {
  const { from, to } = req.body || {};
  try {
    await dbRun('DELETE FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)', [from, to, to, from]);
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

/* =======================
   PROFIL (email / pwd)
======================= */
fastify.put('/user/update', async (req, reply) => {
  const { username, email, password } = req.body || {};
  if (!username || !email) return reply.code(400).send({ error: 'Champs manquants' });

  const updates = ['email = ?'];
  const values = [email];

  if (password) {
    const { hash, salt } = hashPassword(password);
    updates.push('password_hash = ?', 'salt = ?');
    values.push(hash, salt);
  }
  values.push(username);

  await dbRun(`UPDATE users SET ${updates.join(', ')} WHERE username = ?`, values);
  reply.send({ success: true });
});

fastify.put('/user/:username', async (req, reply) => {
  const { username } = req.params;
  const updates = req.body || {};
  try {
    const allowedFields = ['username', 'email'];
    const setFields = [];
    const values = [];

    for (const field of allowedFields) {
      if (updates[field] !== undefined && updates[field] !== null) {
        setFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    if (!setFields.length) return reply.code(400).send({ error: 'Aucune donnée valide à mettre à jour' });
    values.push(username);

    await new Promise((resolve, reject) => {
      db.run(`UPDATE users SET ${setFields.join(', ')} WHERE username = ?`, values, function (err) {
        if (err) return reject(err);
        if (this.changes === 0) return reject(new Error('Utilisateur non trouvé ou aucune modification'));
        resolve();
      });
    });

    reply.send({ message: 'Profil mis à jour avec succès', ...updates });
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    reply.code(500).send({ error: error.message });
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
   REGISTER / LOGIN
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

  const user = await dbGet('SELECT * FROM users WHERE email = ? OR username = ?', [email, email]);
  if (!user) return reply.code(401).send({ message: 'Email ou username inconnu' });

  const match = verifyPassword(password, user.salt, user.password_hash);
  if (!match) return reply.code(401).send({ message: 'Mot de passe incorrect' });

  // avatar absolu renvoyé au front
  return reply.send({
    message: 'Connexion réussie',
    username: user.username,
    email: user.email,
    avatar: absoluteAvatarUrl(user.avatar || '/avatars/default.png', req)
  });
});

/* =======================
   GET USER
======================= */
fastify.get('/user/:username', async (req, reply) => {
  const { username } = req.params;
  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: absoluteAvatarUrl(user.avatar || '/avatars/default.png', req),
      created_at: user.created_at || new Date().toISOString()
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
let io; // déclaré ici pour être utilisé plus bas (API jeux)

fastify.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Backend (HTTP) prêt sur ${address}`);

  io = new Server(fastify.server, {
    cors: {
      origin: FRONT_ORIGINS,
      methods: ['GET', 'POST']
    }
  });
  console.log('⚡️ Serveur WebSocket prêt.');

  const connectedUsers = new Map();
  const W = 600, H = 400;
  const gameLobbies = new Map();
  const activeGameRooms = new Map();

  const initialGameStateTemplate = {
    gameId: null,
    ball: { x: W/2, y: H/2, vx: 4, vy: 4, radius: 8 },
    paddles: {
      p1: { x: 10,     y: H/2 - 50, width: 10, height: 100, vy: 0 },
      p2: { x: W - 20, y: H/2 - 50, width: 10, height: 100, vy: 0 }
    },
    players: { p1: null, p2: null },
    score:   { player1: 0, player2: 0 },
    status: 'waiting'
  };

  const resetBall = (ball) => {
    ball.x  = W/2;
    ball.y  = H/2;
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
    room.intervalId = setInterval(() => gameLoopForRoom(roomId), 1000 / 60);
  };
  const stopGameForRoom = (roomId) => {
    const room = activeGameRooms.get(roomId);
    if (room && room.intervalId) {
      clearInterval(room.intervalId);
      room.intervalId = null;
      room.gameState.status = 'finished';
      activeGameRooms.delete(roomId);
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

    if (ball.x - ball.radius < 0) {
      score.player2++;
      if (score.player2 >= 10) {
        room.gameState.status = 'finished';
        room.gameState.winner = 'Player 2';
        room.gameState.gameOver = true;
        io.to(roomId).emit('gameEnded', { winner: 'Player 2', finalScore: { ...score } });
        stopGameForRoom(roomId);
        return;
      } else {
        resetBall(ball);
      }
    }

    if (ball.x + ball.radius > W) {
      score.player1++;
      if (score.player1 >= 10) {
        room.gameState.status = 'finished';
        room.gameState.winner = 'Player 1';
        room.gameState.gameOver = true;
        io.to(roomId).emit('gameEnded', { winner: 'Player 1', finalScore: { ...score } });
        stopGameForRoom(roomId);
        return;
      } else {
        resetBall(ball);
      }
    }

    io.to(roomId).emit('gameState', room.gameState);
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

  io.on('connection', socket => {
    websocketConnections.inc();
    socket.onAny((eventName, ...args) => {
      console.log(`📨 SERVER: ${eventName}`, args?.[0] ?? '');
    });

    socket.on('identify', (username) => {
      connectedUsers.set(socket.id, username);
      socket.broadcast.emit('userConnected', username);
      const allUsers = Array.from(connectedUsers.values());
      socket.emit('connectedUsersList', allUsers);
    });

    socket.on('requestConnectedUsers', () => {
      const users = Array.from(connectedUsers.values());
      socket.emit('connectedUsersList', users);
    });

    socket.on('sendMessage', async (data) => {
      const { sender, receiver, content } = data || {};
      const blocked = await dbGet('SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?', [receiver, sender]);
      if (blocked) {
        socket.emit('messageError', { error: 'Vous avez été bloqué par cet utilisateur' });
        return;
      }
      await dbRun('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)', [sender, receiver, content]);
      const receiverSocketId = [...connectedUsers.entries()].find(([_, u]) => u === receiver)?.[0];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', { sender, receiver, content, timestamp: new Date().toISOString() });
      }
      socket.emit('messageSent', { sender, receiver, content, timestamp: new Date().toISOString() });
    });

    socket.on('typing', ({ sender, receiver }) => {
      const receiverSocketId = [...connectedUsers.entries()].find(([_, u]) => u === receiver)?.[0];
      if (receiverSocketId) io.to(receiverSocketId).emit('userTyping', { sender });
    });
    socket.on('stopTyping', ({ sender, receiver }) => {
      const receiverSocketId = [...connectedUsers.entries()].find(([_, u]) => u === receiver)?.[0];
      if (receiverSocketId) io.to(receiverSocketId).emit('userStoppedTyping', { sender });
    });

    // Jeux: create / join / leave etc. (inchangé, juste condensé)
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

        activeGameRooms.set(gameId, {
          gameState: newGameState,
          intervalId: null,
          playerSockets: { p1: newGameState.players.p1, p2: newGameState.players.p2 }
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
      if (!room || room.gameState.status !== 'playing') return;
      const { gameState } = room;
      const isP1 = socket.id === gameState.players.p1;
      const isP2 = socket.id === gameState.players.p2;
      if (!isP1 && !isP2) return;
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
      websocketConnections.dec();
      const username = connectedUsers.get(socket.id);
      if (username) {
        connectedUsers.delete(socket.id);
        socket.broadcast.emit('userDisconnected', username);
      }
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
    loginAttempts.inc({ status: Math.random() > 0.8 ? 'failure' : 'success', method: 'simulation' });
  }
  dbConnections.set(Math.floor(Math.random() * 10) + 5);
}, 5000);