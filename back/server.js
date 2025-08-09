console.log("--- DEBUG: SERVER SCRIPT STARTED ---");
const Fastify   = require('fastify');
const { Server } = require("socket.io");
const cors      = require('@fastify/cors');
const sqlite3   = require('sqlite3').verbose();
const fastifyStatic = require('@fastify/static');
const path = require('path');
const {promisify} = require('util')
const { hashPassword, verifyPassword } = require('./utils/hash')
const fs = require('fs').promises;
const fastify = Fastify();
fastify.register(cors, {
	origin: '*', // Assurez-vous que c'est sécurisé pour la production
	methods: ['GET', 'POST', 'PUT', 'OPTIONS']
});

// Base de données SQLite
const db = new sqlite3.Database('./data.db', err => {
	if (err) console.error('Erreur DB:', err.message);
	else console.log('Connecté à SQLite');
});

// Crée des fonctions promises pour SQLite
const dbGet = promisify(db.get).bind(db)
const dbRun = promisify(db.run).bind(db)
const dbAll = promisify(db.all).bind(db)

// Création des tables si elles n'existent pas
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
`)

// ===============================================================
// ADDING MISSING COLOMNS(temporaire)
// ===============================================================
// Ajouter les colonnes manquantes à la table users
const addMissingColumns = () => {
  // Ajouter la colonne salt
  db.run(`ALTER TABLE users ADD COLUMN salt TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('ℹ️ Colonne salt:', err.message);
    } else {
      console.log('✅ Colonne salt ajoutée ou existe déjà');
    }
  });

  // Ajouter la colonne avatar
  db.run(`ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT '/avatars/default.png'`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('ℹ️ Colonne avatar:', err.message);
    } else {
      console.log('✅ Colonne avatar ajoutée ou existe déjà');
    }
  });

  // Ajouter la colonne created_at (sans default pour éviter l'erreur)
  db.run(`ALTER TABLE users ADD COLUMN created_at TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column')) {
      console.log('ℹ️ Colonne created_at:', err.message);
    } else {
      console.log('✅ Colonne created_at ajoutée ou existe déjà');
      
      // Mettre à jour les entrées existantes sans created_at
      db.run(`UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL`, (updateErr) => {
        if (updateErr) {
          console.log('ℹ️ Erreur mise à jour created_at:', updateErr.message);
        } else {
          console.log('✅ Dates created_at mises à jour pour les utilisateurs existants');
        }
      });
    }
  });
};

// Appeler la fonction après un petit délai pour que la DB soit prête
setTimeout(addMissingColumns, 1000);


// ===============================================================
// GESTION DU CHAT
// ===============================================================
// Sender et verif si il est pas bloqué
fastify.post('/chat/message', async (req, reply) => {
  const { sender, receiver, content } = req.body

  // Vérifie si le receiver a bloqué le sender
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

// Getter User 1 et 2
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

// Ignore chat si user bloqué
fastify.post('/chat/block', async (req, reply) => {
  const { blocker, blocked } = req.body

  await dbRun(
    `INSERT OR IGNORE INTO blocked_users (blocker, blocked) VALUES (?, ?)`,
    [blocker, blocked]
  )

  reply.send({ success: true })
})


// ===============================================================
// GESTION DES AJOUTS/RETRAIT/BLOCK d'AMIS
// ===============================================================
// Envoyer une demande d'ami
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

// Voir les demandes en attente
fastify.get('/friends/requests/:username', async (req, reply) => {
  const { username } = req.params;

  const requests = await dbAll(
    'SELECT user1 AS fromUser FROM friends WHERE user2 = ? AND status = ?', // Correction: caractère invisible retiré ici
    [username, 'pending']
  );

  reply.send(requests);
});

// Accepter ou refuser les demandes
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

// Liste d'amis
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

// Route pour supprimer un ami
fastify.delete('/friends/remove', async (req, reply) => {
  const { from, to } = req.body;
  
  try {
    await dbRun(
      'DELETE FROM friends WHERE (user1 = ? AND user2 = ?) OR (user1 = ? AND user2 = ?)',
      [from, to, to, from]
    );
    
    reply.send({ success: true, message: 'Ami supprimé avec succès' });
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Post et Get User pour send la liste des user, et inserer des users a bientot tej
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


// ===============================================================
// GESTION DU PROFIL
// ===============================================================
// GESTION POUR UPDATE MAIL && MOT DE PASSE
fastify.put('/user/update', async (req, reply) => {
	const {username, email, password } = req.body

	if(!username || !email)
		return reply.code(400).send({ error: 'Champs manquants '})
	const updates = ['email = ?']
	const values = [email]

  if (password) {
	const { hash, salt } = hashPassword(password)
	updates.push('password_hash = ?', 'salt = ?')
	values.push(hash, salt)
  }
  values.push(username)
  await dbRun(
	`UPDATE users SET ${updates.join(', ')} WHERE username = ?`,
	values
  )
  reply.send({ success: true })
})

// Route pour mettre à jour le profil (username, email)
fastify.put('/user/:username', async (req, reply) => {
  const { username } = req.params;
  const updates = req.body;
  
  try {
    console.log('📝 Mise à jour profil pour:', username, updates);
    
    // Construire la requête UPDATE dynamiquement
    const allowedFields = ['username', 'email'];
    const setFields = [];
    const values = [];
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined && updates[field] !== null) {
        setFields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }
    
    if (setFields.length === 0) {
      return reply.code(400).send({ error: 'Aucune donnée valide à mettre à jour' });
    }
    
    values.push(username); // Pour le WHERE
    
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE users SET ${setFields.join(', ')} WHERE username = ?`,
        values,
        function(err) {
          if (err) return reject(err);
          if (this.changes === 0) {
            return reject(new Error('Utilisateur non trouvé ou aucune modification'));
          }
          resolve();
        }
      );
    });
    
    reply.send({ 
      message: 'Profil mis à jour avec succès',
      ...updates 
    });
    
  } catch (error) {
    console.error('❌ Erreur mise à jour profil:', error);
    reply.code(500).send({ error: error.message });
  }
});

// Route pour changer le mot de passe
fastify.put('/user/:username/password', async (req, reply) => {
  const { username } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  try {
    if (!currentPassword || !newPassword) {
      return reply.code(400).send({ error: 'Mots de passe manquants' });
    }
    
    // Récupérer l'utilisateur actuel avec son mot de passe
    const user = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
    
    if (!user) {
      return reply.code(404).send({ error: 'Utilisateur non trouvé' });
    }
    
    // Vérifier le mot de passe actuel avec ta fonction existante
    const isCurrentPasswordValid = verifyPassword(currentPassword, user.salt, user.password_hash);
    
    if (!isCurrentPasswordValid) {
      return reply.code(400).send({ error: 'Mot de passe actuel incorrect' });
    }
    
    // Hasher le nouveau mot de passe avec ta fonction existante
    const { hash, salt } = hashPassword(newPassword);
    
    // Mettre à jour
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE users SET password_hash = ?, salt = ? WHERE username = ?',
        [hash, salt, username],
        function(err) {
          if (err) return reject(err);
          resolve();
        }
      );
    });
    
    reply.send({ message: 'Mot de passe mis à jour avec succès' });
    
  } catch (error) {
    console.error('❌ Erreur changement mot de passe:', error);
    reply.code(500).send({ error: error.message });
  }
});


// ===============================================================
// AVATAR
// ===============================================================
// Setter d'avatars
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

// Configuration multipart pour l'upload
fastify.register(require('@fastify/multipart'));

// Route pour l'upload d'avatar
fastify.post('/upload-avatar', async (req, reply) => {
  try {
    const data = await req.file();
    const username = data.fields.username?.value;
    
    if (!data || !username) {
      return reply.code(400).send({ error: 'Fichier ou username manquant' });
    }
    
    // Sauvegarder le fichier
    const filename = `${username}-${Date.now()}${path.extname(data.filename)}`;
    const filepath = path.join(__dirname, 'avatars', filename);
    
    await fs.writeFile(filepath, await data.toBuffer());
    
    const avatarUrl = `/avatars/${filename}`;
    
    // Mettre à jour la base de données
    await dbRun('UPDATE users SET avatar = ? WHERE username = ?', [avatarUrl, username]);
    
    reply.send({ success: true, avatarUrl });
  } catch (error) {
    reply.code(500).send({ error: error.message });
  }
});

// Route pour upload d'avatar (améliorer l'existante)
fastify.post('/user/:username/avatar', async (req, reply) => {
  try {
	const { username } = req.params;
	const data = await req.file();
	
	if (!data) {
	  return reply.code(400).send({ error: 'Aucun fichier fourni' });
	}
	
	// Vérifier que l'utilisateur existe
	const userExists = await new Promise((resolve, reject) => {
	  db.get('SELECT 1 FROM users WHERE username = ?', [username], (err, row) => {
		if (err) return reject(err);
		resolve(!!row);
	  });
	});
	
	if (!userExists) {
	  return reply.code(404).send({ error: 'Utilisateur non trouvé' });
	}
	
	// Sauvegarder le fichier
	const filename = `${username}-${Date.now()}${path.extname(data.filename)}`;
	const filepath = path.join(__dirname, 'avatars', filename);
	
	await fs.writeFile(filepath, await data.toBuffer());
	
	const avatarUrl = `/avatars/${filename}`;
	
	// Mettre à jour la base de données
	await new Promise((resolve, reject) => {
	  db.run('UPDATE users SET avatar = ? WHERE username = ?', [avatarUrl, username], function(err) {
		if (err) return reject(err);
		resolve();
	  });
	});
	
	reply.send({ success: true, avatarUrl });
	
  } catch (error) {
	console.error('❌ Erreur upload avatar:', error);
	reply.code(500).send({ error: error.message });
  }
});


// ===============================================================
// REGISTER
// ===============================================================

fastify.post('/register', async (req, reply) => {
  const { username, email, password } = req.body
  console.log('Tentative de création:', username, email)
  const { hash, salt } = hashPassword(password)

  db.run(
	'INSERT INTO users (username, email, password_hash, salt) VALUES (?, ?, ?, ?)',
	[username, email, hash, salt],
	function (err) {
	  if (err) {
		  console.error('❌ Erreur INSERT :', err.message)
		return reply.code(400).send({ error: err.message })}
	console.log('✅ Utilisateur créé avec ID :', this.lastID)
	  reply.send({ message: 'Utilisateur créé', id: this.lastID })
	});
});

// ===============================================================
// LOGIN
// ===============================================================

fastify.post('/login', async (req, reply) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return reply.code(400).send({ error: 'Email et mot de passe requis' });
  }

  // Wrap dans une Promise pour attendre le résultat
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


// ===============================================================
// FUNC IDK
// ===============================================================

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
fastify.get('/user/:username', async (req, reply) => {
  const { username } = req.params;
  
  try {
    console.log('🔍 Username demandé:', username);
    
    const user = await new Promise((resolve, reject) => {
      // ✅ Sélectionner toutes les colonnes disponibles
      db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
        if (err) {
          console.error('❌ Erreur SQL:', err);
          return reject(err);
        }
        resolve(row);
      });
    });
    
    if (!user) {
      console.log('❌ Utilisateur non trouvé:', username);
      return reply.code(404).send({ error: 'Utilisateur non trouvé' });
    }
    
    console.log('✅ Utilisateur trouvé:', user);
    
    // ✅ Construire la réponse avec des fallbacks
    const userResponse = {
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar || '/avatars/default.png',
      created_at: user.created_at || new Date().toISOString()
    };
    
    reply.send(userResponse);
    
  } catch (error) {
    console.error('❌ ERREUR COMPLETE:', error);
    reply.code(500).send({ 
      error: 'Erreur interne du serveur',
      details: error.message 
    });
  }
});


// ===============================================================
// LANCEMENT HTTP + WEBSOCKET
// ===============================================================

fastify.listen({ port: 3000, host: '0.0.0.0'}, (err, address) => {
	if (err) {
		console.error(err);
		process.exit(1);
	}
	console.log(`🚀 Backend (HTTP) prêt sur ${address}`);

	const io = new Server(fastify.server, {
		cors: {
		origin: "http://localhost:5173", // URL de votre frontend Vue.js
            "https://c76242dc599e.ngrok-free.app"
		methods: ["GET", "POST"]
   		}
	});
	console.log('⚡️ Serveur WebSocket prêt.');


  	// ===============================================================
  	// GESTION DES UTILISATEURS CONNECTÉS POUR LE CHAT
  	// ===============================================================
  	const connectedUsers = new Map(); // socketId -> username (pour identifier les joueurs)

	// ===============================================================
	// LOGIQUE DU JEU CÔTÉ SERVEUR: Pour le mode online multi-parties
  	// ===============================================================
  	const W = 600, H = 400; // Dimensions du terrain de jeu

  	// Map pour stocker les lobbies en attente de joueurs
  	// gameId -> { id, name, password, maxPlayers, currentPlayers: [{id: userId, socketId: socket.id}], status, ... }
  	const gameLobbies = new Map();

  	// Map pour stocker les instances de jeu actives (une fois qu'elles ont démarré)
  	// gameId -> { gameState, intervalId, playerSockets: { p1: socketId, p2: socketId } }
  	const activeGameRooms = new Map();

	// État initial du jeu (template pour chaque nouvelle partie)
	const initialGameStateTemplate = {
	  	gameId: null, // Ajouté pour identifier la partie spécifique
	  	ball: { x: W/2, y: H/2, vx: 4, vy: 4, radius: 8 },
	  	paddles: {
	  		p1: { x: 10,       y: H/2 - 50, width: 10, height: 100, vy: 0 },
	    	p2: { x: W - 20,   y: H/2 - 50, width: 10, height: 100, vy: 0 }
	  	},
	  	players: { p1: null, p2: null }, // socket.id des joueurs
	  	score:   { player1: 0, player2: 0 },
	  	status: 'waiting' // 'waiting', 'starting', 'playing', 'finished'
	};

  	// Réinitialise la balle au centre pour un état de jeu donné
	const resetBall = (ball) => {
		ball.x  = W/2;
    	ball.y  = H/2;
    	ball.vx = Math.random() > 0.5 ? 4 : -4; // Direction horizontale aléatoire
    	ball.vy = Math.random() > 0.5 ? 4 : -4; // Direction verticale aléatoire
	};

  	// Détecte la collision entre la balle et une raquette
	const collides = (ball, paddle) => (
    	ball.x - ball.radius < paddle.x + paddle.width &&
    	ball.x + ball.radius > paddle.x &&
    	ball.y - ball.radius < paddle.y + paddle.height &&
    	ball.y + ball.radius > paddle.y
	);

	// Démarre la boucle de jeu pour une room spécifique
	const startGameForRoom = (roomId) => {
    	const room = activeGameRooms.get(roomId);
    	if (!room || room.gameState.status === 'playing') return; // Déjà en jeu ou n'existe pas

    	console.log(`▶️ La partie dans la room ${roomId} démarre !`);
    	room.gameState.status = 'playing';
    	resetBall(room.gameState.ball);
    	room.intervalId = setInterval(() => gameLoopForRoom(roomId), 1000 / 60); // 60​ FPS
	};

	// Stoppe la boucle de jeu pour une room spécifique
	const stopGameForRoom = (roomId) => {
		const room = activeGameRooms.get(roomId);
    	if (room && room.intervalId) {
    	    clearInterval(room.intervalId);
    	    room.intervalId = null;
    	    room.gameState.status = 'finished';
    	    console.log(`⏸️ La partie dans la room ${roomId} est stoppée.`); // Correction: caractère invisible retiré ici
    	    activeGameRooms.delete(roomId); // Nettoyage
    	    // Informer les joueurs restants que la partie est terminée
    	    io.to(roomId).emit('gameEnded', { message: 'La partie a été arrêtée.' });
    	}
	};

	// Boucle principale du jeu pour une room spécifique
	function gameLoopForRoom(roomId) {
		const room = activeGameRooms.get(roomId);
		if (!room || room.gameState.status !== 'playing') return;
		const { ball, paddles, score } = room.gameState;

    	// Mise à jour de la position des raquettes
    	[paddles.p1, paddles.p2].forEach(p => {
    		p.y += p.vy;
    		if (p.y < 0) p.y = 0;
    		if (p.y > H - p.height) p.y = H - p.height;
    	});

    	// Mise à jour de la position de la balle
    	ball.x += ball.vx;
    	ball.y += ball.vy;

    	// Collision avec les murs (haut/bas)
    	if (ball.y - ball.radius < 0 || ball.y + ball.radius > H) {
    		ball.vy *= -1;
    	}

    	// Collision avec les raquettes
    	if (collides(ball, paddles.p1) || collides(ball, paddles.p2)) {
    		ball.vx *= -1;
    	}

    	// Gestion des points et réinitialisation de la balle
    	if (ball.x - ball.radius < 0) { // Balle touche le mur gauche
      		score.player2++;
      		console.log(`🏆 Point pour P2! Score: ${score.player1}-${score.player2}`);

      		// ✅ Vérifier la fin de partie
      		if (score.player2 >= 10) { // Tu peux changer 10 par room.gameState.maxPoints si tu l'as défini
      			room.gameState.status = 'finished';
      			room.gameState.winner = 'Player 2';
      			room.gameState.gameOver = true;
        		console.log(`🏁 Partie terminée! Player 2 a gagné ${score.player2}-${score.player1}!`);

        		// Envoyer l'événement de fin de partie
        		io.to(roomId).emit('gameEnded', {
        		  winner: 'Player 2',
        		  finalScore: { ...score },
        		  message: `Player 2 a gagné ${score.player2}-${score.player1}!`
        		});
        	// Arrêter la boucle de jeu
        	stopGameForRoom(roomId);
        	return;
		} else {
    	    resetBall(ball);
		}

    	// À la fin de gameLoopForRoom, juste avant l'envoi du gameState, ajoute :
    	console.log(`📤 Envoi gameState pour room ${roomId}:`, {
        	ballX: room.gameState.ball.x.toFixed(1), 
        	ballY: room.gameState.ball.y.toFixed(1),
        	p1Y: room.gameState.paddles.p1.y,
        	p2Y: room.gameState.paddles.p2.y,
        	score: room.gameState.score
    	});
    	// Diffusion de l'état du jeu uniquement aux clients dans cette room
    	io.to(roomId).emit('gameState', room.gameState);
    }

    if (ball.x + ball.radius > W) { // Balle touche le mur droit
    	score.player1++;
    	console.log(`🏆 Point pour P1! Score: ${score.player1}-${score.player2}`);

      	// ✅ Vérifier la fin de partie
      	if (score.player1 >= 10) { // Tu peux changer 10 par room.gameState.maxPoints si tu l'as défini
        	room.gameState.status = 'finished';
        	room.gameState.winner = 'Player 1';
        	room.gameState.gameOver = true;
        	console.log(`🏁 Partie terminée! Player 1 a gagné ${score.player1}-${score.player2}!`);

        	// Envoyer l'événement de fin de partie
        	io.to(roomId).emit('gameEnded', {
        	  winner: 'Player 1',
        	  finalScore: { ...score },
        	  message: `Player 1 a gagné ${score.player1}-${score.player2}!`
        	});

        	// Arrêter la boucle de jeu
        	stopGameForRoom(roomId);
        	return;
      	} else {
        	resetBall(ball);
      	}
   	}
	// Diffusion de l'état du jeu uniquement aux clients dans cette room
	io.to(roomId).emit('gameState', room.gameState);
}

  	// Helper pour diffuser la liste des parties disponibles à tous les clients
	const broadcastGameListUpdate = () => {
    	const available = Array.from(gameLobbies.values()).filter(game => game.status === 'lobby');
    	const mappedGames = available.map(game => ({
    	    id: game.id,
    	    name: game.name,
    	    currentPlayers: game.currentPlayers.length,
    	    maxPlayers: game.maxPlayers,
    	    estimatedWaitTime: null, // À implémenter si besoin d'une estimation réelle
    	    hasPassword: !!game.password,
    	    status: game.status
    	}));
    	// *** AJOUT DEBUGGING ***
    	console.log("SERVER: Broadcasting la liste des parties:", mappedGames);
    	io.emit('gameListUpdate', mappedGames);
  	};

  	// --- Socket.IO Connection Handling ---
  	io.on('connection', socket => {
    	console.log(`🔗 Client connecté: ${socket.id}`);
    	socket.onAny((eventName, ...args) => {
        console.log(`📨 SERVER: Événement reçu: ${eventName}`, args);
    });
	// ===============================================================
    // ÉVÉNEMENTS CHAT (existants)
    // ===============================================================

    // Identification de l'utilisateur (utilisé pour l'username dans les lobbys)
    socket.on('identify', (username) => {
      	connectedUsers.set(socket.id, username);
      	console.log(`👤 ${username} s'est identifié (${socket.id})`);

      	// Notifier tous les utilisateurs de la connexion
      	socket.broadcast.emit('userConnected', username);
      	socket.broadcast.emit('userConnected', username);
    
      	// ✅ AJOUTER : Envoyer la liste complète au nouvel utilisateur
      	const allUsers = Array.from(connectedUsers.values());
      	socket.emit('connectedUsersList', allUsers);
    });

    socket.on('requestConnectedUsers', () => {
      	const users = Array.from(connectedUsers.values());
      	console.log('📋 Envoi liste utilisateurs connectés:', users);
      	socket.emit('connectedUsersList', users);
    });

    // Envoi de message en temps réel
    socket.on('sendMessage', async (data) => {
      	const { sender, receiver, content } = data;

      	//​ Vérifier si le receiver a bloqué le sender
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
        	[sender, receiver, content] // Correction: caractère invisible retiré ici
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
    // ÉVÉNEMENTS JEU (NOUVEAU - GESTION DU LOBBY ET MULTI-PARTIES)
    // ===============================================================
    // [1] Créer une partie
	// Ajoute ceci dans la section des événements de jeu, dans io.on('connection', socket => {
	socket.on('createGame', async (gameData) => {
	    console.log('SERVER: Reçu createGame:', gameData);
	
	    const newGameId = `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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

	    console.log("SERVER: Partie créée:", newGameLobby);

	    // CRUCIAL : Envoyer la confirmation
	    socket.emit('gameCreatedConfirmation', { 
	        id: newGameLobby.id, 
	        name: newGameLobby.name 
	    });

	    console.log(`SERVER: gameCreatedConfirmation envoyée pour ${newGameId}`);

	    // Diffuser la liste mise à jour
	    broadcastGameListUpdate();
	});

	// Nouvel événement dans ton serveur :
	socket.on('requestLobbyState', (data) => {
	    const { gameId } = data;
	    const gameLobby = gameLobbies.get(gameId);
	    const userId = connectedUsers.get(socket.id) || socket.id;

	    if (!gameLobby) {
	        socket.emit('gameQueueUpdate', { gameId: gameId, status: 'not_found', message: 'Lobby introuvable.' });
	        return;
	    }

	    // Vérifier si l'utilisateur est dans ce lobby
	    const playerInLobby = gameLobby.currentPlayers.find(p => p.id === userId);
	    if (!playerInLobby) {
	        socket.emit('gameQueueUpdate', { gameId: gameId, status: 'not_found', message: 'Vous n\'êtes pas dans ce lobby.' });
	        return;
	    }

	    // Envoyer l'état du lobby
	    socket.emit('gameQueueUpdate', {
	        gameId: gameLobby.id,
	        currentPlayers: gameLobby.currentPlayers.length,
	        maxPlayers: gameLobby.maxPlayers,
	        status: gameLobby.status,
	        estimatedWaitTime: null
	    });
	});

	socket.on('requestGameQueueStatus', (data) => {
	    const { gameId } = data;
	    console.log(`SERVER: Demande de statut pour gameId: ${gameId}`);
		
	    // Chercher d'abord dans les lobbies en attente
	    const gameLobby = gameLobbies.get(gameId);
		
	    if (gameLobby) {
	        console.log(`SERVER: Lobby trouvé:`, gameLobby);
	        const userId = connectedUsers.get(socket.id) || socket.id;
		
	        // Vérifier si l'utilisateur est dans ce lobby
	        const playerInLobby = gameLobby.currentPlayers.find(p => p.id === userId);
	        if (!playerInLobby) {
	            console.log(`SERVER: Joueur ${userId} pas dans le lobby ${gameId}`);
	            socket.emit('gameQueueUpdate', { 
	                gameId: gameId, 
	                status: 'not_found', 
	                message: 'Vous n\'êtes pas dans ce lobby.' 
	            });
	            return;
	        }
		
	        // Envoyer l'état du lobby
	        socket.emit('gameQueueUpdate', {
	            gameId: gameLobby.id,
	            currentPlayers: gameLobby.currentPlayers.length,
	            maxPlayers: gameLobby.maxPlayers,
	            status: gameLobby.status, // 'lobby', 'starting', etc.
	            estimatedWaitTime: null
	        });
	        return;
	    }
	
	    // Si pas dans les lobbies, vérifier les parties actives
	    const activeRoom = activeGameRooms.get(gameId);
	    if (activeRoom) {
	        console.log(`SERVER: Partie active trouvée: ${gameId}`);
	        socket.emit('gameQueueUpdate', {
	            gameId: activeRoom.gameState.gameId,
	            currentPlayers: 2, // Supposons 2 joueurs pour Pong
	            maxPlayers: 2,
	            status: 'started',
	            roomId: activeRoom.gameState.gameId
	        });
	        return;
	    }
	
	    // Partie introuvable
	    console.log(`SERVER: Partie ${gameId} introuvable`);
	    socket.emit('gameQueueUpdate', { 
	        gameId: gameId, 
	        status: 'not_found', 
	        message: 'Partie introuvable ou terminée.' 
	    });
	});

	// Modifier l'événement joinGame pour vérifier le mot de passe
	socket.on('joinGame', async (data) => {
	    const { gameId, password } = data;
	    const gameLobby = gameLobbies.get(gameId);
	    const userId = connectedUsers.get(socket.id) || socket.id;

	    if (!gameLobby) {
	        socket.emit('gameJoinError', { message: 'Partie introuvable.' });
	        return;
	    }
	
	    if (gameLobby.currentPlayers.some(p => p.id === userId)) {
	        socket.emit('gameJoinError', { message: 'Vous êtes déjà dans cette partie.' });
	        return;
	    }
	
	    if (gameLobby.currentPlayers.length >= gameLobby.maxPlayers) {
	        socket.emit('gameJoinError', { message: 'La partie est pleine.' });
	        return;
	    }
	
	    // Vérification du mot de passe
	    if (gameLobby.password && password !== gameLobby.password) {
	        socket.emit('gameJoinError', { message: 'Mot de passe incorrect.' });
	        return;
	    }
	        // TODO: Vérifier le mot de passe ici si gameLobby.password existe
	        // if (gameLobby.password && password !== gameLobby.password) {
	        //     socket.emit('gameJoinError', { message: 'Mot de passe incorrect.' });
	        //     return;
	        // }

	        gameLobby.currentPlayers.push({ id: userId, socketId: socket.id });
	        socket.join(gameId); // Le socket rejoint la room de ce lobby

	        console.log(`Joueur ${userId} a rejoint la partie ${gameLobby.name} (ID: ${gameId})`);

	        // Diffuser la liste des parties mise à jour
	        broadcastGameListUpdate();

	        // Notifier tous les joueurs de ce lobby de la mise à jour
	        gameLobby.currentPlayers.forEach(player => {
	            io.to(player.socketId).emit('gameQueueUpdate', {
	                gameId: gameLobby.id,
	                currentPlayers: gameLobby.currentPlayers.length,
	                maxPlayers: gameLobby.maxPlayers,
	                status: gameLobby.status,
	                estimatedWaitTime: null
	            });
	        });

	        // Si le lobby est plein, démarrer la partie
	        if (gameLobby.currentPlayers.length === gameLobby.maxPlayers && gameLobby.status === 'lobby') {
	            gameLobby.status = 'starting'; // Changer le statut du lobby
	            console.log(`Partie ${gameLobby.name} (ID: ${gameId}) est pleine, démarrage imminent !`);

	            // Informer tous les joueurs dans ce lobby que la partie va démarrer
	            gameLobby.currentPlayers.forEach(player => {
	                io.to(player.socketId).emit('gameQueueUpdate', {
	                    gameId: gameLobby.id,
	                    currentPlayers: gameLobby.currentPlayers.length,
	                    maxPlayers: gameLobby.maxPlayers,
	                    status: 'starting'
	                });
	            });

	            // Retirer le lobby de la liste des lobbies en attente (car elle devient une partie active)
	            gameLobbies.delete(gameId);
	            broadcastGameListUpdate(); // Mettre à jour la liste publique des parties

	            // Initialiser et démarrer la logique du jeu Pong
	            const newGameState = JSON.parse(JSON.stringify(initialGameStateTemplate)); // Copie profonde
	            newGameState.gameId = gameId; // Assigner l'ID de la partie à l'état du jeu
	            newGameState.players.p1 = gameLobby.currentPlayers[0].socketId; // Assigner les sockets aux joueurs
	            newGameState.players.p2 = gameLobby.currentPlayers[1].socketId; // Supposons 2 joueurs pour Pong

	            activeGameRooms.set(gameId, {
	                gameState: newGameState,
	                intervalId: null,
	                playerSockets: { p1: newGameState.players.p1, p2: newGameState.players.p2 }
	            });

	            // Délai avant le démarrage effectif du jeu
	            setTimeout(() => {
	                if (activeGameRooms.has(gameId)) { // Vérifier si la partie existe toujours
	                    startGameForRoom(gameId); // Démarrer la boucle de jeu pour cette room
	                    gameLobby.currentPlayers.forEach(player => {
	                        io.to(player.socketId).emit('gameQueueUpdate', {
	                            gameId: gameLobby.id,
	                            currentPlayers: gameLobby.currentPlayers.length,
	                            maxPlayers: gameLobby.maxPlayers,
	                            status: 'started',
	                            roomId: gameLobby.id // Envoyer le roomId au client pour qu'il le transmette à RemoteGame.vue
	                        });
	                    });
	                }
	            }, 3000); // 3 secondes
	        }
	    });

	// Quitter la game
	socket.on('leaveGame', (data) => {
    	const { gameId } = data;
    	const userId = connectedUsers.get(socket.id) || socket.id;
    	// Tenter de quitter un lobby
    	const gameLobby = gameLobbies.get(gameId);
    	if (gameLobby) {
    	    const initialPlayerCount = gameLobby.currentPlayers.length;
    	    gameLobby.currentPlayers = gameLobby.currentPlayers.filter(p => p.id !== userId);
    	    if (gameLobby.currentPlayers.length < initialPlayerCount) { // S'il a bien été retiré
    	        socket.leave(gameId); // Le socket quitte la room
    	        if (gameLobby.currentPlayers.length === 0) {
    	            gameLobbies.delete(gameId); // Supprimer le lobby s'il est vide
    	            console.log(`Lobby ${gameId} supprimé (vide).`); // Correction: caractère invisible retiré ici
    	        } else {
    	            // Notifier les joueurs restants dans le lobby
    	            gameLobby.currentPlayers.forEach(player => {
    	                io.to(player.socketId).emit('gameQueueUpdate', {
    	                    gameId: gameLobby.id,
    	                    currentPlayers: gameLobby.currentPlayers.length, // Correction: caractère invisible retiré ici
    	                    maxPlayers: gameLobby.maxPlayers,
    	                    status: gameLobby.status,
    	                    estimatedWaitTime: null
    	                });
    	            });
    	        }
    	        socket.emit('leftGameConfirmation', { gameId: gameId }); // Confirmer au joueur qu'il a quitté
    	        broadcastGameListUpdate(); // Mettre à jour la liste des parties pour tous
    	        return;
    	    }
    	}
    	// Tenter de quitter une partie active
    	const activeRoom = activeGameRooms.get(gameId);
    	if (activeRoom) {
    	    // Logique pour gérer la déconnexion en cours de partie (par exemple, arrêter la partie)
    	    console.log(`Joueur ${userId} a quitté la partie active ${gameId}. Arrêt de la partie.`);
    	    stopGameForRoom(gameId); // Pour l'instant, on arrête la partie
    	    socket.emit('leftGameConfirmation', { gameId: gameId });
    	    return;
    	}
    	socket.emit('leaveGameError', { message: 'Partie introuvable ou vous n\'êtes pas dedans.' });
    });

	// [5] Réception des commandes de raquette (maintenant par roomId)
	socket.on('movePaddle', ({ roomId, direction }) => {
		console.log(`🎮 SERVER: Mouvement reçu - Room: ${roomId}, Direction: ${direction}, Socket: ${socket.id}`);
	
		const room = activeGameRooms.get(roomId);
		if (!room || room.gameState.status !== 'playing') {
	    	console.log(`❌ Room ${roomId} non trouvée ou pas en jeu. Status:`, room?.gameState.status);
	    	return;
	  	}
	
		const { gameState } = room;
		console.log(`🎮 Players - P1: ${gameState.players.p1}, P2: ${gameState.players.p2}`);
		const isP1 = socket.id === gameState.players.p1;
		const isP2 = socket.id === gameState.players.p2;
	  	if (!isP1 && !isP2) {
	    	console.log(`❌ Socket ${socket.id} n'est ni P1 ni P2`);
	    	return;
	  	}
		const p = isP1 ? gameState.paddles.p1 : gameState.paddles.p2;
		const oldVy = p.vy;
		p.vy = direction === 'up'   ? -8
			: direction === 'down' ?  8
			: 0;
	  	console.log(`🎮 Paddle ${isP1 ? 'P1' : 'P2'} vy: ${oldVy} -> ${p.vy}`);
	});

	// [6] Demander la liste des parties disponibles (ajouté pour la synchronisation initiale du client)
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
	    // *** AJOUT DEBUGGING ***
	    console.log(`SERVER: Envoi de la liste des parties demandée à ${socket.id}:`, mappedGames);
	    socket.emit('gameListUpdate', mappedGames); // Émettre uniquement au socket qui a demandé
	});
	
	socket.on('requestConnectedUsers', () => {
	    const users = Array.from(connectedUsers.values());
	    socket.emit('connectedUsersList', users);
    });

	// ===============================================================
    // Gestion de la déconnexion
    // ===============================================================
    socket.on('disconnect', () => {
		console.log(`❌ Déconnexion: ${socket.id}`);
      	// Retirer de la liste des utilisateurs connectés
    	const username = connectedUsers.get(socket.id);
    	if (username) {
        	connectedUsers.delete(socket.id);
        	socket.broadcast.emit('userDisconnected', username);
      	}
      	// Gérer la déconnexion d'un joueur depuis un lobby
      	let lobbyUpdated = false; // Correction: caractère invisible retiré ici
      	for (const [gameId, lobby] of gameLobbies.entries()) {
        	const initialPlayerCount = lobby.currentPlayers.length;
        	lobby.currentPlayers = lobby.currentPlayers.filter(p => p.socketId !== socket.id);
        	if (lobby.currentPlayers.length < initialPlayerCount) { // Le joueur était dans ce lobby
            	socket.leave(gameId); // Assurez-vous que le socket quitte la room
            	if (lobby.currentPlayers.length === 0) {
                	gameLobbies.delete(gameId); // Supprimer le lobby s'il est vide
                	console.log(`Lobby ${gameId} supprimé car vide après déconnexion de ${socket.id}.`);
              	} else {
                	// Notifier les joueurs restants dans le lobby
                	lobby.currentPlayers.forEach(player => {
                    	io.to(player.socketId).emit('gameQueueUpdate', {
                        	gameId: lobby.id,
                        	currentPlayers: lobby.currentPlayers.length,
                        	maxPlayers: lobby.maxPlayers,
                        	status: lobby.status,
                        	estimatedWaitTime: null
                    	});
                });
            }
            lobbyUpdated = true;
            break; // Un joueur ne devrait être que dans un seul lobby à la fois
        }
    }
    if (lobbyUpdated) {
        broadcastGameListUpdate(); // Mettre à jour la liste des parties publiques
    }
    // Gérer la déconnexion d'un joueur depuis une partie active
    for (const [gameId, room] of activeGameRooms.entries()) {
        if (room.playerSockets.p1 === socket.id || room.playerSockets.p2 === socket.id) {
            console.log(`Joueur ${socket.id} déconnecté de la partie active ${gameId}. Arrêt de la partie.`);
            stopGameForRoom(gameId); // Arrêter la partie si un joueur se déconnecte
            // Optionnel: Gérer la reconnexion ou remplacer par un bot
            break; // Un joueur ne devrait être que dans une seule partie active
        }
    }});
  });
});
