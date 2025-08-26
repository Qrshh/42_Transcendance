const fp = require('fastify-plugin');
const multipart = require('@fastify/multipart');

module.exports = fp(async function multipartPlugin(fastify) {
  // important: registre AVANT les routes, au scope racine
  await fastify.register(multipart, {
    attachFieldsToBody: false,     // on utilise req.file()
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    throwFileSizeLimit: true
  });

  // petit log utile au démarrage
  fastify.log?.info('🧩 @fastify/multipart prêt');
});
