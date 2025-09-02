// back/utils/auth.js
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const crypto = require('crypto');

// Utilise .env ou ce qu'il y a apres ||
const JWT_SECRET = process.env.JWT_SECRET || 'jwt-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'jwt-refresh-key';

// Durées des tokens
const ACCESS_TOKEN_EXPIRY = '15m';  // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d';  // 7 jours

// Génère un token d'accès JWT
function generateAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}

// Génère un refresh token JWT
function generateRefreshToken(payload) {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRY });
}


// Vérifie un token d'accès
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    throw new Error('Token invalide ou expiré');
  }
}

// Vérifie un refresh token
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET);
  } catch (error) {
    throw new Error('Refresh token invalide ou expiré');
  }
}


// Génère un secret 2FA pour un utilisateur (optimisé pour Google Authenticator)
function generate2FASecret(username) {
  return speakeasy.generateSecret({
    name: `Transcendance (${username})`,
    issuer: 'ft_transcendance',
    length: 32
  });
}


// Vérifie un code 2FA (compatible Google Authenticator)
function verify2FAToken(secret, token) {
  return speakeasy.totp.verify({
    secret: secret,
    encoding: 'base32',
    token: token,
    window: 2 // Accepte ±60 secondes de décalage
  });
}


// Génère des codes de récupération
function generateBackupCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
  }
  return codes;
}


// Middleware d'authentification JWT
//function authenticateToken(request, reply, done) {
//  const authHeader = request.headers['authorization'];
//  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
//
//  if (!token) {
//    return reply.code(401).send({ error: 'Token d\'accès requis' });
//  }
//
//  try {
//    const decoded = verifyAccessToken(token);
//    request.user = decoded;
//    done();
//  } catch (error) {
//    reply.code(403).send({ error: 'Token invalide ou expiré' });
//  }
//}


// Middleware optionnel pour les routes publiques
//function optionalAuth(request, reply, done) {
//  const authHeader = request.headers['authorization'];
//  const token = authHeader && authHeader.split(' ')[1];
//
//  if (token) {
//    try {
//      const decoded = verifyAccessToken(token);
//      request.user = decoded;
//    } catch (error) {
//    }
//  }
//  done();
//}


function authenticateHybrid(request, reply, done) {
  // Essayer avec JWT
  const authHeader = request.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      request.user = decoded;
      return done();
    } catch (error) {
      // Token invalide, continuer avec l'ancien système
    }
  }
  const username = request.headers['x-username'] || request.body?.username;
  
  if (username) {
    request.user = { username, userId: null };
    return done();
  }

  return reply.code(401).send({ error: 'Authentification requise' });
}

// Permet d'utiliser les fonctions dans d'autres fichiers
module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generate2FASecret,
  verify2FAToken,
  generateBackupCodes,
  authenticateHybrid,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};