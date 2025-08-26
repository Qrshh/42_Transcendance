const fp = require('fastify-plugin');

module.exports = fp(async function gamesRoutes(fastify) {
  fastify.get('/api/games/available', (req, reply) => {
    const lobbies = fastify.socketState?.gameLobbies || new Map();
    const available = Array.from(lobbies.values()).filter(g => g.status === 'lobby');
    reply.send(available.map(game => ({
      id: game.id,
      name: game.name,
      currentPlayers: game.currentPlayers.length,
      maxPlayers: game.maxPlayers,
      estimatedWaitTime: null,
      hasPassword: !!game.password,
      status: game.status
    })));
  });
});
