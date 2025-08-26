const fp = require('fastify-plugin')
const { dbGet, dbRun } = require('../db')
const { absoluteUrl } = require('../utils/media')
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  verify2FAToken,
} = require('../utils/auth')
const { verifyPassword } = require('../utils/hash')

module.exports = fp(async function authLoginRoutes (fastify) {
  const { SERVER_ORIGIN, PORT } = fastify.config

  fastify.post('/auth/login', async (req, reply) => {
    const { email, password, twoFactorCode } = req.body || {}
    if (!email || !password) {
      return reply.code(400).send({ error: 'Email et mot de passe requis' })
    }

    try {
      const user = await dbGet(
        'SELECT * FROM users WHERE email = ? OR username = ?',
        [email, email]
      )
      if (!user) return reply.code(401).send({ message: 'Email ou username inconnu' })

      const ok = verifyPassword(password, user.salt, user.password_hash)
      if (!ok) return reply.code(401).send({ message: 'Mot de passe incorrect' })

      // 2FA activée → on exige un code (TOTP ou code de récupération)
      if (user.two_factor_enabled) {
        if (!twoFactorCode) {
          return reply.code(200).send({
            requiresTwoFactor: true,
            message: "Code d'authentification à deux facteurs requis"
          })
        }

        let valid = false

        // TOTP
        if (user.two_factor_secret) {
          valid = verify2FAToken(user.two_factor_secret, String(twoFactorCode))
        }

        // Codes de récupération (8 chars HEX stockés en JSON)
        if (!valid && user.backup_codes) {
          const list = JSON.parse(user.backup_codes || '[]')
          const idx = list.indexOf(String(twoFactorCode).toUpperCase())
          if (idx !== -1) {
            valid = true
            list.splice(idx, 1) // on consomme le code
            await dbRun('UPDATE users SET backup_codes = ? WHERE id = ?', [JSON.stringify(list), user.id])
          }
        }

        if (!valid) return reply.code(401).send({ message: 'Code d’authentification invalide' })
      }

      // OK → génère access + refresh
      const payload = { userId: user.id, username: user.username, email: user.email }
      const accessToken  = generateAccessToken(payload)
      const refreshToken = generateRefreshToken(payload)

      // stocke le refresh 7 jours
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      await dbRun(
        'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshToken, expiresAt.toISOString()]
      )

      return reply.send({
        message: 'Connexion réussie',
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: absoluteUrl(user.avatar || '/avatars/default.png', req, SERVER_ORIGIN, PORT),
          twoFactorEnabled: !!user.two_factor_enabled
        },
        tokens: { accessToken, refreshToken }
      })
    } catch (err) {
      console.error('❌ [/auth/login] error:', err)
      return reply.code(500).send({ error: 'Erreur interne du serveur' })
    }
  })

  fastify.post('/auth/refresh', async (req, reply) => {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return reply.code(401).send({ error: 'Refresh token requis' })
    try {
      // vérifie la signature/expiration
      verifyRefreshToken(refreshToken)

      // vérifie qu’il est stocké et non expiré côté DB
      const row = await dbGet(
        'SELECT * FROM refresh_tokens WHERE token = ? AND expires_at > datetime("now")',
        [refreshToken]
      )
      if (!row) return reply.code(403).send({ error: 'Refresh token invalide ou expiré' })

      const user = await dbGet('SELECT * FROM users WHERE id = ?', [row.user_id])
      if (!user) return reply.code(403).send({ error: 'Utilisateur non trouvé' })

      const payload = { userId: user.id, username: user.username, email: user.email }
      const newAccessToken = generateAccessToken(payload)

      return reply.send({
        accessToken: newAccessToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatar: absoluteUrl(user.avatar || '/avatars/default.png', req, SERVER_ORIGIN, PORT),
          twoFactorEnabled: !!user.two_factor_enabled
        }
      })
    } catch (err) {
      console.error('❌ [/auth/refresh] error:', err)
      return reply.code(403).send({ error: 'Refresh token invalide' })
    }
  })

  fastify.post('/auth/logout', async (req, reply) => {
    const { refreshToken } = req.body || {}
    if (refreshToken) {
      try { await dbRun('DELETE FROM refresh_tokens WHERE token = ?', [refreshToken]) } catch {}
    }
    return reply.send({ message: 'Déconnexion réussie' })
  })
})
