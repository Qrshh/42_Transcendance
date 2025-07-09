const Fastify = require('fastify');
const sqlite3 = require('sqlite3').verbose();
const cors = require('@fastify/cors');

const fastify = Fastify();
fastify.register(cors, { origin: '*' });

const db = new sqlite3.Database('./data.db', (err) => {
  if (err) console.error('Erreur DB:', err.message);
  else console.log('Connecté à SQLite');
});

db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE
  )
`);

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

fastify.listen({ port: 3000 }, (err) => {
  if (err) throw err;
  console.log('🚀 Backend ready: http://localhost:3000');
});
