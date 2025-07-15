const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');

const dbPath = path.join(__dirname, 'back', 'data.db');

// Supprime le fichier data.db si présent
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
  console.log('🗑️ Base de données supprimée.');
} else {
  console.log('ℹ️ Pas de base à supprimer.');
}

// Recrée la base
const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) return console.error('Erreur création DB:', err.message);

  // Crée la table users
  db.run(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL
    )
  `, async (err) => {
    if (err) return console.error('Erreur création table:', err.message);

    // Hachage du mot de passe
    const password = '1234';
    const hash = await bcrypt.hash(password, 10);

    // Insertion d'un utilisateur test
    db.run(
      'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
      ['adrien', 'adrien@test.com', hash],
      function (err) {
        if (err) return console.error('Erreur insertion:', err.message);
        console.log('✅ Utilisateur de test créé avec ID :', this.lastID);
        console.log('➡️ Email: adrien@test.com');
        console.log('➡️ Password: 1234');
      }
    );
  });
});
