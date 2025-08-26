const fp = require('fastify-plugin');
const { dbGet, dbAll } = require('../db');

module.exports = fp(async function statsRoutes(fastify) {
  fastify.get('/user/:username/stats', async (req, reply) => {
    const { username } = req.params;
    try {
      const user = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
      if (!user) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

      const totalGamesRow = await dbGet('SELECT COUNT(*) as count FROM games WHERE player_id = ?', [user.id]);
      const totalGames = totalGamesRow?.count || 0;
      const gamesWonRow = await dbGet('SELECT COUNT(*) as count FROM games WHERE player_id = ? AND result = "win"', [user.id]);
      const gamesWon = gamesWonRow?.count || 0;
      const winRate = totalGames > 0 ? Math.round((gamesWon / totalGames) * 100) : 0;

      const rankingRow = await dbGet(`
        SELECT rank FROM (
          SELECT player_id, RANK() OVER (ORDER BY COUNT(CASE WHEN result = "win" THEN 1 END) DESC) as rank
          FROM games GROUP BY player_id
        ) WHERE player_id = ?
      `, [user.id]);
      const ranking = rankingRow?.rank || null;

      reply.send({ totalGames, gamesWon, winRate, ranking });
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });

  fastify.get('/user/:username/history', async (req, reply) => {
    const { username } = req.params;
    try {
      const u = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
      if (!u) return reply.code(404).send({ error: 'Utilisateur non trouvé' });

      const rows = await dbAll(`
        SELECT g.id, g.result, g.score, g.opponent_score, g.played_at, u2.username AS opponent
        FROM games g LEFT JOIN users u2 ON u2.id = g.opponent_id
        WHERE g.player_id = ? ORDER BY g.played_at DESC LIMIT 50
      `, [u.id]);

      reply.send(rows.map(r => ({
        id: r.id,
        opponent: r.opponent || 'Inconnu',
        result: r.result === 'win' ? 'win' : 'loss',
        playerScore: r.score,
        opponentScore: r.opponent_score,
        date: r.played_at,
        duration: ''
      })));
    } catch (e) { reply.code(500).send({ error: e.message }); }
  });
});
