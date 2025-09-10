const { db } = require('./index');

function initSchema() {
  db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT,
        salt TEXT,
		    google_id TEXT UNIQUE,
        salt TEXT NOT NULL,
        avatar TEXT NOT NULL DEFAULT '/avatars/default.png',
        banner TEXT NOT NULL DEFAULT '/banners/default.jpg',
        is_private INTEGER NOT NULL DEFAULT 0,
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
    db.run(`CREATE INDEX IF NOT EXISTS idx_messages_pair_time ON messages(sender, receiver, timestamp)`);

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
        status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user1, user2)
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_friends_user1 ON friends(user1)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user2)`);

    db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player_id INTEGER NOT NULL,
        opponent_id INTEGER,
        result TEXT NOT NULL,
        score INTEGER,
        opponent_score INTEGER,
        played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (player_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
    db.run(`CREATE INDEX IF NOT EXISTS idx_games_player ON games(player_id, played_at)`);
  });
}

const addMissingColumns = () => {
 db.run(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT DEFAULT NULL`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne two_factor_secret:', err.message);
    else console.log('✅ Colonne two_factor_secret OK');
  });
  db.run(`ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne two_factor_enabled:', err.message);
    else console.log('✅ Colonne two_factor_enabled OK');
  });
  db.run(`ALTER TABLE users ADD COLUMN backup_codes TEXT DEFAULT NULL`, (err) => {
    if (err && !/duplicate column/i.test(err.message)) console.log('ℹ️ Colonne backup_codes:', err.message);
    else console.log('✅ Colonne backup_codes OK');
  });
  db.run(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `, (err) => {
    if (err) console.log('ℹ️ Table refresh_tokens:', err.message);
    else console.log('✅ Table refresh_tokens créée');
  });
};

setTimeout(addMissingColumns, 1000);
module.exports = {
  runMigrations: initSchema,

  // reset rapide de la db et autre fonction va logout les comptes fantomes
  resetDevDb(cb) {
    db.serialize(() => {
      db.run('DROP TABLE IF EXISTS games');
      db.run('DROP TABLE IF EXISTS friends');
      db.run('DROP TABLE IF EXISTS blocked_users');
      db.run('DROP TABLE IF EXISTS messages');
      db.run('DROP TABLE IF EXISTS users', cb);
    });
  }
};
