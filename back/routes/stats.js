const fp = require('fastify-plugin');
const { dbGet, dbAll } = require('../db');

module.exports = fp(async function statsRoutes(fastify) {
  const getSocketState = () => fastify.socketState || {}

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

  fastify.get('/stats/overview', async (_req, reply) => {
    try {
      const { socketsByUserMulti = new Map(), gameLobbies = new Map(), activeGameRooms = new Map() } = getSocketState()

      const playersOnline = socketsByUserMulti.size
      const lobbiesOpen = Array.from(gameLobbies.values()).filter(l => l.status === 'lobby').length
      const tournamentsLive = Array.from(activeGameRooms.values()).filter(room => room?.source === 'tournament' && room?.gameState?.status !== 'finished').length

      const matchesRow = await dbGet("SELECT COUNT(*) AS count FROM games WHERE datetime(played_at) >= datetime('now','start of day')")
      const matchesToday = matchesRow?.count || 0

      reply.send({ playersOnline, matchesToday, tournamentsLive, lobbiesOpen })
    } catch (e) {
      reply.code(500).send({ error: e?.message || 'overview_failed' })
    }
  })

  fastify.get('/stats/live/matches', async (_req, reply) => {
    try {
      const { gameLobbies = new Map(), activeGameRooms = new Map() } = getSocketState()

      const matches = []
      for (const [roomId, room] of activeGameRooms.entries()) {
        const state = room?.gameState || {}
        const score = state.score || {}
        const players = room?.playerUsernames || state.usernames || {}
        const roomSockets = fastify.io?.sockets?.adapter?.rooms?.get(roomId)
        const socketCount = roomSockets ? roomSockets.size : 0
        const playerIds = [room?.playerSockets?.p1, room?.playerSockets?.p2].filter(Boolean)
        const spectators = Math.max(0, socketCount - new Set(playerIds).size)

        matches.push({
          id: roomId,
          source: room?.source || 'duel',
          mode: 'duel',
          status: state.status || 'unknown',
          createdAt: room?.createdAt || null,
          spectators,
          score: {
            player1: Number(score.player1 ?? 0),
            player2: Number(score.player2 ?? 0)
          },
          players: {
            p1: players?.p1 || null,
            p2: players?.p2 || null
          }
        })
      }

      const lobbies = []
      for (const lobby of gameLobbies.values()) {
        lobbies.push({
          id: lobby.id,
          name: lobby.name,
          status: lobby.status,
          hasPassword: !!lobby.password,
          maxPlayers: lobby.maxPlayers,
          currentPlayers: Array.isArray(lobby.currentPlayers) ? lobby.currentPlayers.length : 0,
          accelBall: !!lobby.accelBall,
          paddleDash: !!lobby.paddleDash,
          createdAt: lobby.createdAt || null
        })
      }

      reply.send({ matches, lobbies })
    } catch (e) {
      reply.code(500).send({ error: e?.message || 'live_failed' })
    }
  })
});
