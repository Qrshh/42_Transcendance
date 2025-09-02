// Charge les variables d'environnement depuis .env
try { require('dotenv').config(); } catch {}
const Fastify = require('fastify');
const fs = require('fs').promises;
const { PORT, HOST, SERVER_ORIGIN, FRONT_ORIGINS, DIRS } = require('./config');
const { runMigrations } = require('./db/migrations');
const { db } = require('./db');
const twofa = require('./routes/twofa')


async function ensureDirs() {
  await fs.mkdir(DIRS.AVATAR_DIR, { recursive: true }).catch(()=>{});
  await fs.mkdir(DIRS.BANNER_DIR, { recursive: true }).catch(()=>{});
}

(async () => {
  await ensureDirs();
  // resetDevDb(() => runMigrations()); 
  runMigrations();

  const fastify = Fastify({ logger: false });

  // Expose config & db
  fastify.decorate('config', { PORT, HOST, SERVER_ORIGIN, FRONT_ORIGINS });
  fastify.decorate('db', db);

  // Plugins
  await fastify.register(require('./plugins/cors'));
  await fastify.register(require('./plugins/static'));
  await fastify.register(require('./plugins/uploads'));
  await fastify.register(require('./plugins/metrics'));

  // Routes
  await fastify.register(require('./routes/users'));
  await fastify.register(require('./routes/auth-login'))
  await fastify.register(require('./routes/uploads'));
  await fastify.register(require('./routes/chat'));
  await fastify.register(require('./routes/friends'));
  await fastify.register(require('./routes/stats'));
  await fastify.register(require('./routes/games'));

  // 2FA
  const { authenticateHybrid, generate2FASecret, verify2FAToken, generateBackupCodes } = require('./utils/auth')
  const { verifyPassword } = require('./utils/hash')

  await fastify.register(require('./routes/twofa'), {
    db,
    utils: {
      authenticateHybrid,
      generate2FASecret,
      verify2FAToken,
      generateBackupCodes,
      verifyPassword,
    }
  })
  // Sockets (après registres; le plugin se branche en onReady)
  await fastify.register(require('./sockets'));

  // Start
  fastify.listen({ port: PORT, host: HOST }, (err, address) => {
    if (err) { console.error(err); process.exit(1); }
    console.log(`🚀 Backend HTTP prêt sur ${address}`);
  });

  // petite simulation (optionnelle)
  setInterval(() => {
    const m = fastify.metrics;
    if (!m) return;
    if (Math.random() > 0.7) {
      m.loginAttempts.inc({ status: Math.random() > 0.8 ? 'failure' : 'success', method: 'simulation' });
    }
    m.dbConnections.set(Math.floor(Math.random() * 10) + 5);
  }, 5000);
})();
