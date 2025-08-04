const Fastify   = require('fastify');
const { Server } = require("socket.io");
const cors      = require('@fastify/cors');
const sqlite3   = require('sqlite3').verbose();
const bcrypt 	= require('bcrypt');
const fastifyStatic = require('@fastify/static');
const path = require('path');
const {promisify} = require('util')



const fastify = Fastify();
fastify.register(cors, { 
	origin: '*',
	methods: ['GET', 'POST', 'PUT', 'OPTIONS']
});

// Base de données SQLite
const db = new sqlite3.Database('./data.db', err => {
	if (err) console.error('Erreur DB:', err.message);
	else        console.log('Connecté à SQLite');
});

// Crée des fonctions promises
const dbGet = promisify(db.get).bind(db)
const dbRun = promisify(db.run).bind(db)
const dbAll = promisify(db.all).bind(db)

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL,
	avatar TEXT DEFAULT '/avatars/default.png'
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
`)

// GESTION DU CHAT (toujours utile pour l'historique)

fastify.post('/chat/message', async (req, reply) => {
  const { sender, receiver, content } = req.body

  // vérifie si le receiver a bloqué le sender
  const blocked = await dbGet(
    'SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?',
    [receiver, sender]
  )

  if (blocked) {
    return reply.status(403).send({ error: 'Blocked by user' })
  }

  await dbRun(
    'INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)',
    [sender, receiver, content]
  )

  reply.send({ success: true })
})


fastify.get('/chat/message/:userA/:userB', async (req, reply) => {
  const { userA, userB } = req.params

  const messages = await dbAll(
    `SELECT * FROM messages
     WHERE (sender = ? AND receiver = ?) OR (sender = ? AND receiver = ?)
     ORDER BY timestamp ASC`,
    [userA, userB, userB, userA]
  )

  reply.send(messages)
})

fastify.post('/chat/block', async (req, reply) => {
  const { blocker, blocked } = req.body

  await dbRun(
    `INSERT OR IGNORE INTO blocked_users (blocker, blocked) VALUES (?, ?)`,
    [blocker, blocked]
  )

  reply.send({ success: true })
})


// GESTION DES AJOUTS d'AMIS
//envoyer une demande d'ami
fastify.post('/friends/request', async (req, reply) => {
  const { from, to } = req.body;

  if (from === to) {
    return reply.status(400).send({ error: "Tu ne peux pas t'ajouter toi-même." });
  }

  // Vérifier s'il n'y a pas déjà une relation (pendante ou acceptée)
  const exists = await dbGet(
    `SELECT 1 FROM friends WHERE 
    (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)`,
    [from, to, to, from]
  );
  if (exists) {
    return reply.status(400).send({ error: "Une relation existe déjà." });
  }

  await dbRun(
    'INSERT INTO friends (user1, user2, status) VALUES (?, ?, ?)',
    [from, to, 'pending']
  );

  reply.send({ success: true, message: 'Demande envoyée.' });
});

//voir les demandes en attente
fastify.get('/friends/requests/:username', async (req, reply) => {
  const { username } = req.params;

  const requests = await dbAll(
    'SELECT user1 AS fromUser FROM friends WHERE user2 = ? AND status = ?',
    [username, 'pending']
  );

  reply.send(requests);
});

//accepter ou refuser les demandes
fastify.post('/friends/respond', async (req, reply) => {
  const { from, to, accept } = req.body; // accept = true/false

  if (accept) {
    await dbRun(
      `UPDATE friends SET status = 'accepted' WHERE user1 = ? AND user2 = ?`,
      [from, to]
    );
  } else {
    await dbRun(
      `UPDATE friends SET status = 'rejected' WHERE user1 = ? AND user2 = ?`,
      [from, to]
    );
  }

  reply.send({ success: true });
});

//liste d'amis 
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




// Post et Get User pour send la liste des user, et inserer des users
fastify.get('/users', (req, reply) => {
  db.all('SELECT * FROM users', [], (err, rows) => {
    if (err) return reply.code(500).send({ error: err.message });
    reply.send(rows);
  });
});
fastify.post('/users', async (req, reply) => {
  const { username } = req.body;
  db.run('INSERT INTO users (username) VALUES (?)', [username], function(err) {
    if (err) return reply.code(500).send({ error: err.message });
    reply.send({ id: this.lastID, username });
  });
});

//GESTION POUR UPDATE MAIL && MOT DE PASSE
fastify.put('/user/update', async (req, reply) => {
	const {username, email, password } = req.body

	if(!username || !email)
		return reply.code(400).send({ error: 'Champs manquants '})

	const updates = ['email = ?']
	const values = [email]

	if(password){
		const hash = await bcrypt.hash(password, 10)
		updates.push('password_hash = ?')
		values.push(hash)
	}

	values.push(username)

	await dbRun(
		`UPDATE users SET ${updates.join(', ')} WHERE username = ?`, values
	)

	reply.send({ success: true})
})


//REGISTER && GESTION DES AVATARS

fastify.register(fastifyStatic, {
	root: path.join(__dirname, 'avatars'),
	prefix: '/avatars/',
});

fastify.put('/user/avatar', async (req, reply) => {
  const { username, avatar } = req.body;
  if (!username || !avatar) return reply.code(400).send({ error: 'Données manquantes' });

  db.run('UPDATE users SET avatar = ? WHERE username = ?', [avatar, username], function(err) {
    if (err) return reply.code(500).send({ error: err.message });
    reply.send({ message: 'Avatar mis à jour' });
  });
});


fastify.post('/register', async (req, reply) => {
  const { username, email, password } = req.body
  console.log('Tentative de création:', username, email)
  const hash = await bcrypt.hash(password, 10)

  db.run(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
    [username, email, hash],
    function (err) {
      if (err) {
		  console.error('❌ Erreur INSERT :', err.message)
		return reply.code(400).send({ error: err.message })}
	console.log('✅ Utilisateur créé avec ID :', this.lastID)
      reply.send({ message: 'Utilisateur créé', id: this.lastID })
    });
});

//Post pour le login 
fastify.post('/login', async (req, reply) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email et mot de passe requis' });
  }

  // Wrap dans une Promise pour attendre le résultat
  const user = await new Promise((resolve, reject) => {
    db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, email], //deux fois la meme variable car c'est sur le meme champ qu'on utilise
		 (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

  if (!user) {
    return reply.code(401).send({ message: 'Email ou username inconnu' });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) {
    return reply.code(401).send({ message: 'Mot de passe incorrect' });
  }

  return reply.send({ message: 'Connexion réussie', username: user.username, email: user.email, avatar: user.avatar || '/avatars/default.png'});
});




// Lancement HTTP + WebSocket
fastify.listen({ port: 3000, host: '0.0.0.0'}, (err, address) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log(`🚀 Backend (HTTP) prêt sur ${address}`);

  const io = new Server(fastify.server, {
    cors: {
      origin: "http://localhost:5173",
      methods: ["GET", "POST"]
    }
  });
  console.log('⚡️ Serveur WebSocket prêt.');

  // ===============================================================
  // GESTION DES UTILISATEURS CONNECTÉS POUR LE CHAT
  // ===============================================================
  const connectedUsers = new Map(); // socketId -> username

  // ===============================================================
  // LOGIQUE DU JEU CÔTÉ SERVEUR: Qui servira pour le mode online
  // ===============================================================
  const W = 600, H = 400;
  let gameInterval = null;

  // État initial complet
  let gameState = {
    ball: {
      x: W/2, y: H/2, vx: 4, vy: 4, radius: 8
    },
    paddles: {
      p1: { x: 10,       y: H/2 - 50, width: 10, height: 100, vy: 0 },
      p2: { x: W - 20,   y: H/2 - 50, width: 10, height: 100, vy: 0 }
    },
    players: { p1: null, p2: null },
    score:   { player1: 0, player2: 0 },
    status: 'waiting'
  };

  // Doublon situé dans engine.ts mais hs pour change la x)
  // Réinitialise la balle au centre
  const resetBall = () => {
    gameState.ball.x  = W/2;
    gameState.ball.y  = H/2;
    gameState.ball.vx = Math.random() > 0.5 ? 4 : -4;
    gameState.ball.vy = Math.random() > 0.5 ? 4 : -4;
  };

  // Tout pareil
  const collides = (ball, paddle) => (
    ball.x - ball.radius < paddle.x + paddle.width &&
    ball.x + ball.radius > paddle.x &&
    ball.y - ball.radius < paddle.y + paddle.height &&
    ball.y + ball.radius > paddle.y
  );

  // Servira pour l'online
  // Démarre la boucle si pas déjà lancée
  const startGame = () => {
    if (gameState.status === 'playing') return;
    console.log("▶️ Les deux joueurs sont connectés, démarrage !");
    gameState.status = 'playing';
    resetBall();
    gameInterval = setInterval(gameLoop, 1000 / 60);
  };

  // Stoppe la boucle et repasse en attente
  const stopGame = () => {
    if (gameInterval) clearInterval(gameInterval);
    gameInterval = null;
    gameState.status = 'waiting';
    console.log("⏸️ Partie stoppée (déconnexion).");
  };

  // Boucle principale
  function gameLoop() {
    const { ball, paddles, score } = gameState;

    // Paddle
    [paddles.p1, paddles.p2].forEach(p => {
      p.y += p.vy;
      if (p.y < 0) p.y = 0;
      if (p.y > H - p.height) p.y = H - p.height;
    });

    // Balle
    ball.x += ball.vx;
    ball.y += ball.vy;

    // Murs
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > H) {
      ball.vy *= -1;
    }

    // Collision Paddles
    if (collides(ball, paddles.p1) || collides(ball, paddles.p2)) {
      ball.vx *= -1;
    }

    // Scores
    if (ball.x - ball.radius < 0) {
      score.player2++;
      resetBall();
    }
    if (ball.x + ball.radius > W) {
      score.player1++;
      resetBall();
    }

    // Diffusion de l'état
    io.emit('gameState', gameState);
  }

  io.on('connection', socket => {
    console.log(`🔗 Client connecté: ${socket.id}`);

    // ===============================================================
    // ÉVÉNEMENTS CHAT
    // ===============================================================
    
    // Identification de l'utilisateur
    socket.on('identify', (username) => {
      connectedUsers.set(socket.id, username);
      console.log(`👤 ${username} s'est identifié (${socket.id})`);
      
      // Notifier tous les utilisateurs de la connexion
      socket.broadcast.emit('userConnected', username);
    });

    // Envoi de message en temps réel
    socket.on('sendMessage', async (data) => {
      const { sender, receiver, content } = data;
      
      // Vérifier si le receiver a bloqué le sender
      const blocked = await dbGet(
        'SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?',
        [receiver, sender]
      );

      if (blocked) {
        socket.emit('messageError', { error: 'Vous avez été bloqué par cet utilisateur' });
        return;
      }

      // Sauvegarder en base
      await dbRun(
        'INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)',
        [sender, receiver, content]
      );

      // Envoyer le message au destinataire s'il est connecté
      const receiverSocketId = [...connectedUsers.entries()]
        .find(([_, username]) => username === receiver)?.[0];
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('newMessage', {
          sender,
          receiver,
          content,
          timestamp: new Date().toISOString()
        });
      }

      // Confirmer l'envoi à l'expéditeur
      socket.emit('messageSent', {
        sender,
        receiver,
        content,
        timestamp: new Date().toISOString()
      });
    });

    // Notification de frappe
    socket.on('typing', (data) => {
      const { sender, receiver } = data;
      const receiverSocketId = [...connectedUsers.entries()]
        .find(([_, username]) => username === receiver)?.[0];
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userTyping', { sender });
      }
    });

    // Arrêt de frappe
    socket.on('stopTyping', (data) => {
      const { sender, receiver } = data;
      const receiverSocketId = [...connectedUsers.entries()]
        .find(([_, username]) => username === receiver)?.[0];
      
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('userStoppedTyping', { sender });
      }
    });

    // ===============================================================
    // ÉVÉNEMENTS JEU (code existant)
    // ===============================================================

    // Attribution des joueurs
    if (!gameState.players.p1) {
      gameState.players.p1 = socket.id;
      console.log(`→ ${socket.id} = Joueur 1`);
    } else if (!gameState.players.p2) {
      gameState.players.p2 = socket.id;
      console.log(`→ ${socket.id} = Joueur 2`);
    }

    // Envoi immédiat de l'état
    socket.emit('gameState', gameState);

    // Démarrage si on a deux joueurs
    if (gameState.players.p1 && gameState.players.p2) {
      startGame();
    }

    // Réception des commandes de raquette
    socket.on('movePaddle', direction => {
      if (gameState.status !== 'playing') return;
      const p = socket.id === gameState.players.p1
              ? gameState.paddles.p1
              : gameState.paddles.p2;
      p.vy = direction === 'up'   ? -8
           : direction === 'down' ?  8
           : 0;
    });

    socket.on('disconnect', () => {
      console.log(`❌ Déconnexion: ${socket.id}`);
      
      // Retirer de la liste des utilisateurs connectés
      const username = connectedUsers.get(socket.id);
      if (username) {
        connectedUsers.delete(socket.id);
        socket.broadcast.emit('userDisconnected', username);
      }
      
      // Gestion du jeu
      stopGame();
      if (socket.id === gameState.players.p1) gameState.players.p1 = null;
      if (socket.id === gameState.players.p2) gameState.players.p2 = null;
    });
  });

});