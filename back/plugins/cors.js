const fp = require('fastify-plugin');
const cors = require('@fastify/cors');

module.exports = fp(async function corsPlugin(fastify) {
  const { FRONT_ORIGINS } = fastify.config;

  await fastify.register(cors, {
    // Autorise explicitement tes origines front
    origin: (origin, cb) => {
      // requêtes sans Origin (curl, tests, same-origin) -> OK
      if (!origin) return cb(null, true);
      if (FRONT_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT','PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Username'],
    preflightContinue: false,
    strictPreflight: true
  });
  fastify.addHook('onSend', (req, reply, payload, done) => {
    const o = req.headers.origin;
    if (o && FRONT_ORIGINS.includes(o)) {
      if (!reply.getHeader('Access-Control-Allow-Origin')) {
        reply.header('Access-Control-Allow-Origin', o);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Vary', 'Origin');
      }
    }
    done();
  });
});
