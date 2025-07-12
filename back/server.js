const Fastify   = require('fastify');
const { Server } = require("socket.io");
const cors      = require('@fastify/cors');
const sqlite3   = require('sqlite3').verbose();
const bcrypt 	= require('bcrypt');

const fastify = Fastify();
fastify.register(cors, { origin: '*' });

// Base de données SQLite
const db = new sqlite3.Database('./data.db', err => {
  if (err) console.error('Erreur DB:', err.message);
  else        console.log('Connecté à SQLite');
});
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
	email TEXT NOT NULL UNIQUE,
	password_hash TEXT NOT NULL
  )
`);

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


//POST pour le register
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
    }
  )
})

//Post pour le login 
fastify.post('/login', async (req, reply) => {
	const {username} = req.body;

	db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
		if(err) return reply.code(500).send({error: err.message});

		if(!row) return reply.code(401).send({message: 'Utilisateur inconnu'});

		reply.send({message: 'Connexion reussie', username: row.username});
	});
});

// Lancement HTTP + WebSocket
fastify.listen({ port: 3000 }, (err, address) => {
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
      stopGame();
      if (socket.id === gameState.players.p1) gameState.players.p1 = null;
      if (socket.id === gameState.players.p2) gameState.players.p2 = null;
    });
  });

});
