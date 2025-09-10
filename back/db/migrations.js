const { db } = require('./index');

async function initSchema() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run('PRAGMA foreign_keys = ON');

      const schemaSql = `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT NOT NULL UNIQUE,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT,
          salt TEXT,
          google_id TEXT UNIQUE,
          avatar TEXT NOT NULL DEFAULT '/avatars/default.png',
          banner TEXT NOT NULL DEFAULT '/banners/default.jpg',
          is_private INTEGER NOT NULL DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS messages (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sender TEXT NOT NULL,
          receiver TEXT NOT NULL,
          content TEXT NOT NULL,
          timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_messages_pair_time ON messages(sender, receiver, timestamp);

        CREATE TABLE IF NOT EXISTS blocked_users (
          blocker TEXT NOT NULL,
          blocked TEXT NOT NULL,
          UNIQUE(blocker, blocked)
        );

        CREATE TABLE IF NOT EXISTS friends (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user1 TEXT NOT NULL,
          user2 TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected')),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user1, user2)
        );
        CREATE INDEX IF NOT EXISTS idx_friends_user1 ON friends(user1);
        CREATE INDEX IF NOT EXISTS idx_friends_user2 ON friends(user2);

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
        );
        CREATE INDEX IF NOT EXISTS idx_games_player ON games(player_id, played_at);

        CREATE TABLE IF NOT EXISTS refresh_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          token TEXT NOT NULL UNIQUE,
          expires_at DATETIME NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
      `;

      db.exec(schemaSql, (err) => {
        if (err) return reject(err);
        return resolve();
      });
    });
  });
}

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
