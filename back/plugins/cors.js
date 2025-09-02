const fp = require('fastify-plugin');
const cors = require('@fastify/cors');

module.exports = fp(async function corsPlugin(fastify) {
  const { FRONT_ORIGINS } = fastify.config;

  const isPrivateIp = (host) => (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
    /^127\./.test(host) || host === 'localhost'
  );

  // Fonction pour vérifier si l'origine est autorisée (strings, regex, et IP locales)
  const isOriginAllowed = (origin) => {
    if (!origin) return true; // requêtes sans Origin (curl, tests, same-origin)
    try {
      const u = new URL(origin);
      if (isPrivateIp(u.hostname)) return true;
    } catch {}
    return FRONT_ORIGINS.some((allowed) => {
      if (typeof allowed === 'string') return allowed === origin;
      if (allowed instanceof RegExp) return allowed.test(origin);
      return false;
    });
  };

  await fastify.register(cors, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) {
        return cb(null, true);
      }
      console.log(`CORS: Origin non autorisée: ${origin}`);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Username'],
    preflightContinue: false,
    strictPreflight: true
  });

  fastify.addHook('onSend', (req, reply, payload, done) => {
    const o = req.headers.origin;
    if (o && isOriginAllowed(o)) {
      if (!reply.getHeader('Access-Control-Allow-Origin')) {
        reply.header('Access-Control-Allow-Origin', o);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Vary', 'Origin');
      }
    }
    done();
  });
});
