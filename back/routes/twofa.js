const qrcode = require('qrcode')

/** Helpers DB — accepte (dbGet/dbRun) *ou* un db sqlite brut */
function makeDbHelpers (opts) {
  const { db, dbGet, dbRun } = opts || {}
  if (dbGet && dbRun) return { dbGet, dbRun }
  if (!db || typeof db.get !== 'function' || typeof db.run !== 'function') {
    throw new Error('[twofa] Fournis soit {dbGet, dbRun}, soit {db} sqlite')
  }
  return {
    dbGet: (sql, params = []) =>
      new Promise((resolve, reject) =>
        db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
      ),
    dbRun: (sql, params = []) =>
      new Promise((resolve, reject) =>
        db.run(sql, params, function (err) {
          if (err) return reject(err)
          resolve(this) // this.changes, this.lastID, etc.
        })
      ),
  }
}

/** Migration minimale des colonnes 2FA */
async function ensureTwoFaColumns({ dbRun }) {
  const safeAlter = async (sql) => {
    try { await dbRun(sql) } catch (e) {
      // Ignore "duplicate column" / "already exists"
      if (!/duplicate column|already exists/i.test(String(e && e.message))) {
        console.log('ℹ️ [twofa] migration:', e.message)
      }
    }
  }
  await safeAlter(`ALTER TABLE users ADD COLUMN two_factor_secret TEXT DEFAULT NULL`)
  await safeAlter(`ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0`)
  await safeAlter(`ALTER TABLE users ADD COLUMN backup_codes TEXT DEFAULT NULL`)
  console.log('✅ [twofa] colonnes 2FA OK')
}

/** Réponse d'erreur uniformisée */
const sendBadRequest = (reply, msg) => reply.code(400).send({ error: msg })

module.exports = async function twofaPlugin (fastify, opts = {}) {
  const { dbGet, dbRun } = makeDbHelpers(opts)
  const {
    authenticateHybrid,
    generate2FASecret,
    verify2FAToken,
    generateBackupCodes,
    verifyPassword, // requis pour /disable
  } = (opts.utils || {})

  if (!authenticateHybrid || !generate2FASecret || !verify2FAToken || !generateBackupCodes) {
    throw new Error('[twofa] Il manque des utils: authenticateHybrid, generate2FASecret, verify2FAToken, generateBackupCodes')
  }
  if (!verifyPassword) {
    console.warn('[twofa] ⚠️ utils.verifyPassword manquant : /auth/2fa/disable échouera.')
  }

  // Migrations (non bloquantes): exécuter après l'init des plugins
  fastify.addHook('onReady', async () => {
    try {
      await ensureTwoFaColumns({ dbRun })
    } catch (e) {
      console.log('ℹ️ [twofa] migration (onReady):', e && e.message)
    }
  })

  /* =======================
     ROUTES 2FA
  ======================= */

  // 1) Générer un secret + QR (pré-activation)
  fastify.post('/auth/2fa/setup', { preHandler: authenticateHybrid }, async (req, reply) => {
    try {
      const username = req.user && req.user.username
      if (!username) return reply.code(401).send({ error: 'Non authentifié' })

      const user = await dbGet('SELECT * FROM users WHERE username = ?', [username])
      if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' })
      if (user.two_factor_enabled) return sendBadRequest(reply, '2FA déjà activée')

      // Nouveau secret (base32 + otpauth)
      const secret = generate2FASecret(user.username)

      // QR code data URL à partir de l’otpauth
      const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url)

      // Stockage temporaire du secret (pas encore "enabled")
      await dbRun('UPDATE users SET two_factor_secret = ? WHERE id = ?', [secret.base32, user.id])

      return reply.send({
        secret: secret.base32,
        qrCode: qrCodeUrl,
        manualEntryKey: secret.base32,
      })
    } catch (error) {
      console.error('❌ [twofa] setup:', error)
      return reply.code(500).send({ error: 'Erreur lors de la configuration 2FA' })
    }
  })

  // 2) Activer la 2FA (vérifie le code)
  fastify.post('/auth/2fa/enable', { preHandler: authenticateHybrid }, async (req, reply) => {
    const { code } = req.body || {}
    if (!code) return sendBadRequest(reply, 'Code de vérification requis')

    try {
      const username = req.user && req.user.username
      if (!username) return reply.code(401).send({ error: 'Non authentifié' })

      const user = await dbGet('SELECT * FROM users WHERE username = ?', [username])
      if (!user || !user.two_factor_secret) {
        return sendBadRequest(reply, 'Configuration 2FA non initialisée')
      }
      if (user.two_factor_enabled) return sendBadRequest(reply, '2FA déjà activée')

      const isValid = verify2FAToken(user.two_factor_secret, code)
      if (!isValid) return sendBadRequest(reply, 'Code de vérification invalide')

      const backupCodes = generateBackupCodes()

      await dbRun(
        'UPDATE users SET two_factor_enabled = 1, backup_codes = ? WHERE id = ?',
        [JSON.stringify(backupCodes), user.id]
      )

      return reply.send({
        message: '2FA activée avec succès',
        backupCodes,
      })
    } catch (error) {
      console.error('❌ [twofa] enable:', error)
      return reply.code(500).send({ error: 'Erreur lors de l’activation 2FA' })
    }
  })

  // 3) Désactiver la 2FA (mot de passe + code)
  fastify.post('/auth/2fa/disable', { preHandler: authenticateHybrid }, async (req, reply) => {
    const { code, password } = req.body || {}
    if (!code || !password) {
      return sendBadRequest(reply, 'Code 2FA et mot de passe requis')
    }
    if (!verifyPassword) {
      return reply.code(500).send({ error: 'verifyPassword indisponible côté serveur' })
    }

    try {
      const username = req.user && req.user.username
      if (!username) return reply.code(401).send({ error: 'Non authentifié' })

      const user = await dbGet('SELECT * FROM users WHERE username = ?', [username])
      if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' })
      if (!user.two_factor_enabled) return sendBadRequest(reply, '2FA déjà désactivée')

      // Vérif mot de passe
      const okPwd = verifyPassword(password, user.salt, user.password_hash)
      if (!okPwd) return reply.code(401).send({ error: 'Mot de passe incorrect' })

      // Vérif code TOTP (ou autorise un code de récup en 8 chars — facultatif)
      let valid = verify2FAToken(user.two_factor_secret, code)
      if (!valid && user.backup_codes) {
        const list = JSON.parse(user.backup_codes || '[]')
        const idx = list.indexOf(String(code).toUpperCase())
        if (idx !== -1) valid = true
      }
      if (!valid) return sendBadRequest(reply, 'Code 2FA invalide')

      await dbRun(
        'UPDATE users SET two_factor_enabled = 0, two_factor_secret = NULL, backup_codes = NULL WHERE id = ?',
        [user.id]
      )

      return reply.send({ message: '2FA désactivée avec succès' })
    } catch (error) {
      console.error('❌ [twofa] disable:', error)
      return reply.code(500).send({ error: 'Erreur lors de la désactivation 2FA' })
    }
  })

  // 4) Régénérer les codes de récupération (nécessite un code TOTP valide)
  fastify.post('/auth/2fa/regenerate-backup', { preHandler: authenticateHybrid }, async (req, reply) => {
    const { code } = req.body || {}
    if (!code) return sendBadRequest(reply, 'Code 2FA requis')

    try {
      const username = req.user && req.user.username
      if (!username) return reply.code(401).send({ error: 'Non authentifié' })

      const user = await dbGet('SELECT * FROM users WHERE username = ?', [username])
      if (!user || !user.two_factor_enabled) {
        return sendBadRequest(reply, '2FA non activée')
      }

      const isValid = verify2FAToken(user.two_factor_secret, code)
      if (!isValid) return sendBadRequest(reply, 'Code 2FA invalide')

      const backupCodes = generateBackupCodes()
      await dbRun('UPDATE users SET backup_codes = ? WHERE id = ?', [JSON.stringify(backupCodes), user.id])

      return reply.send({
        message: 'Nouveaux codes de récupération générés',
        backupCodes,
      })
    } catch (error) {
      console.error('❌ [twofa] regenerate-backup:', error)
      return reply.code(500).send({ error: 'Erreur lors de la régénération des codes' })
    }
  })

  // 5) Statut 2FA
  fastify.get('/auth/2fa/status', { preHandler: authenticateHybrid }, async (req, reply) => {
    try {
      const userId = req.user && req.user.userId
      if (!userId) return reply.code(401).send({ error: 'Non authentifié' })

      const row = await dbGet('SELECT two_factor_enabled FROM users WHERE id = ?', [userId])
      if (!row) return reply.code(404).send({ error: 'Utilisateur non trouvé' })

      return reply.send({ twoFactorEnabled: !!row.two_factor_enabled })
    } catch (error) {
      console.error('❌ [twofa] status:', error)
      return reply.code(500).send({ error: 'Erreur lors de la vérification du statut 2FA' })
    }
  })
}
