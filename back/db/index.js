// Setter DB
const sqlite3 = require('sqlite3').verbose();
const { promisify } = require('util');

const DB_PATH = process.env.DB_PATH || './data.db'
const db = new sqlite3.Database(DB_PATH, err => {
  if (err) console.error('DB error:', err.message);
  else console.log('✅ SQLite connecté');
});

const dbGet = promisify(db.get).bind(db);
const dbAll = promisify(db.all).bind(db);
const dbRun = (...args) => new Promise((resolve, reject) => {
  db.run(...args, function (err) {
    if (err) return reject(err);
    resolve(this);
  });
});

module.exports = { db, dbGet, dbAll, dbRun };
