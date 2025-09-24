const fp = require('fastify-plugin');
const { Server } = require('socket.io');
const { buildPresence } = require('../utils/presence');
const { dbGet, dbRun } = require('../db');
module.exports = fp(async function socketsPlugin(fastify) {
  const { FRONT_ORIGINS } = fastify.config;

  // état partagé
  const { socketsByUserMulti, usersBySocket, addPresence, removePresence } = buildPresence();
  const connectedUsers = new Map();
  const gameLobbies = new Map();
  const activeGameRooms = new Map();
  const W = 800, H = 400;
  const DEFAULT_CUSTOMIZATION = {
    arena: 'classic',
    ballSpeed: 'normal',
    ballSize: 'standard',
    accelBall: false,
    paddleDash: false,
    powerUps: 'off'
  };
  const BALL_SPEED_VALUES = { normal: 4, fast: 6, extreme: 8 };
  const BALL_RADIUS_VALUES = { standard: 8, large: 14 };
  const PADDLE_SPEED = 8;
  const DASH_DISTANCE = 20;
  const DASH_DURATION = 10;
  const DASH_COOLDOWN = 60;
  const SPEED_INCREMENT = 1.05;
  const MAX_SPEED = 20;
  const COLLISION_COOLDOWN = 8;

  const ARENA_VALUES = new Set(['classic', 'neon', 'cosmic']);
  const BALL_SPEED_KEYS = new Set(['normal', 'fast', 'extreme']);
  const BALL_SIZE_KEYS = new Set(['standard', 'large']);
  const POWER_UP_KEYS = new Set(['off', 'rare', 'frequent']);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function normalizeCustomization(raw = {}) {
    const data = typeof raw === 'object' && raw !== null ? raw : {};
    const arena = ARENA_VALUES.has(data.arena) ? data.arena : DEFAULT_CUSTOMIZATION.arena;
    const ballSpeed = BALL_SPEED_KEYS.has(data.ballSpeed) ? data.ballSpeed : DEFAULT_CUSTOMIZATION.ballSpeed;
    const ballSize = BALL_SIZE_KEYS.has(data.ballSize) ? data.ballSize : DEFAULT_CUSTOMIZATION.ballSize;
    const powerUps = POWER_UP_KEYS.has(data.powerUps) ? data.powerUps : DEFAULT_CUSTOMIZATION.powerUps;

    return {
      arena,
      ballSpeed,
      ballSize,
      accelBall: !!data.accelBall,
      paddleDash: !!data.paddleDash,
      powerUps,
    };
  }

  const resolveBallSpeed = (speed) => BALL_SPEED_VALUES[speed] || BALL_SPEED_VALUES.normal;
  const resolveBallRadius = (size) => BALL_RADIUS_VALUES[size] || BALL_RADIUS_VALUES.standard;
  // --- Défis (challenges) ---
  const pendingChallenges = new Map(); // id -> { id, from, to, options, createdAt, status }
  
  function pickOneSocketId(username) {
    const set = socketsByUserMulti.get(username);
    return set && set.size ? Array.from(set)[0] : null;
  }

  // helpers exposés
  fastify.decorate('socketState', { socketsByUserMulti, usersBySocket, connectedUsers, gameLobbies, activeGameRooms });
  fastify.decorate('emitToUser', (username, event, payload) => {
    if (!fastify.io) return;
    const set = socketsByUserMulti.get(username);
    if (!set || set.size === 0) return;
    for (const sid of set) fastify.io.to(sid).emit(event, payload);
  });
  fastify.decorate('getUserStatus', (username) => {
    for (const [, room] of activeGameRooms.entries()) {
      if (room.playerUsernames?.p1 === username || room.playerUsernames?.p2 === username) return 'playing';
    }
    return socketsByUserMulti.has(username) ? 'online' : 'offline';
  });

  // Crée io quand le serveur http est prêt
  fastify.addHook('onReady', async () => {
    function isPrivateIp(host) {
      return /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) || /^127\./.test(host) || host === 'localhost';
    }
    function isWsOriginAllowed(origin) {
      if (!origin) return true;
      try {
        const u = new URL(origin);
        if (isPrivateIp(u.hostname)) return true;
      } catch {}
      return Array.isArray(FRONT_ORIGINS) && FRONT_ORIGINS.some((o) => o === origin);
    }
    const io = new Server(fastify.server, {
      cors: {
        origin: (origin, cb) => {
          if (isWsOriginAllowed(origin)) return cb(null, true);
          cb(new Error('WS CORS not allowed'));
        },
        methods: ['GET','POST'],
        credentials: true,
        allowedHeaders: ['X-Username','Content-Type','Authorization']
      }
    });
    fastify.decorate('io', io);
    // ajoute juste après "fastify.decorate('io', io);" dans onReady
    let ghostSweepTimer;
    
    async function sweepGhostSockets() {
      for (const [sid, username] of usersBySocket.entries()) {
        try {
          const row = await dbGet('SELECT 1 FROM users WHERE username = ?', [username]);
          if (!row) {
            // prévenir le client puis couper
            io.to(sid).emit('forceLogout', { reason: 'account_missing' });
            io.sockets.sockets.get(sid)?.disconnect(true);
    
            // nettoyage présence côté serveur
            connectedUsers.delete(sid);
            const { username: u, stillOnline } = removePresence(sid);
            if (u && !stillOnline) io.emit('userDisconnected', u);
          }
        } catch (e) {
          console.error('sweepGhostSockets error:', e.message);
        }
      }
    }
    
    // démarre le sweep toutes les 5s (ajuste si tu veux)
    ghostSweepTimer = setInterval(sweepGhostSockets, 5000);
    
    // et pense à le nettoyer quand le serveur se ferme
    fastify.addHook('onClose', async () => {
      if (ghostSweepTimer) clearInterval(ghostSweepTimer);
    });

    // ==== jeu util ====
    const initialGameStateTemplate = {
      gameId: null,
      ball: {
        x: W / 2,
        y: H / 2,
        vx: BALL_SPEED_VALUES.normal,
        vy: BALL_SPEED_VALUES.normal,
        radius: BALL_RADIUS_VALUES.standard,
        lastCollisionTime: 0
      },
      paddles: {
        p1: { x: 10, y: H / 2 - 50, width: 10, height: 100, vy: 0 },
        p2: { x: W - 20, y: H / 2 - 50, width: 10, height: 100, vy: 0 }
      },
      players: { p1: null, p2: null },
      score: { player1: 0, player2: 0 },
      status: 'waiting',
      settings: { ...DEFAULT_CUSTOMIZATION },
      baseSpeed: BALL_SPEED_VALUES.normal,
      gameOver: false,
      winner: null,
      countdown: 0,
      targetScore: 10
    };
    const resetBall = (ball, baseSpeed = BALL_SPEED_VALUES.normal) => {
      const speed = Math.max(1, baseSpeed || BALL_SPEED_VALUES.normal);
      ball.x = W / 2;
      ball.y = H / 2;
      ball.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
      ball.vy = (Math.random() > 0.5 ? 1 : -1) * speed;
      ball.lastCollisionTime = 0;
    };
    const collides = (ball, p) => (
      ball.x - ball.radius < p.x + p.width &&
      ball.x + ball.radius > p.x &&
      ball.y - ball.radius < p.y + p.height &&
      ball.y + ball.radius > p.y
    );
    const repositionBallAfterCollision = (ball, paddle) => {
      if (paddle.x < W / 2) {
        ball.x = paddle.x + paddle.width + ball.radius + 1;
      } else {
        ball.x = paddle.x - ball.radius - 1;
      }
    };
    function stopGameForRoom(roomId, silent = false) {
      const room = activeGameRooms.get(roomId);
      if (room) {
        if (room.durationTimer) { clearTimeout(room.durationTimer); room.durationTimer = null; }
        clearBots(room); // si tu utilises attachBot(...)
      }
      if (!room) return;
      if (room.intervalId) clearInterval(room.intervalId);
      if (room.durationTimer) clearTimeout(room.durationTimer);
      room.intervalId = null; room.durationTimer = null;
      room.gameState.status = 'finished';
      activeGameRooms.delete(roomId);
      if (!silent) io.to(roomId).emit('gameEnded', { message: 'La partie a été arrêtée.' });
    }

    async function persistAndNotifyRoomResult(roomId, winnerSide /* 'p1'|'p2' */) {
      try {
        const room = activeGameRooms.get(roomId);
        if (!room) return;
        const { score } = room.gameState;
        const p1Username = room.playerUsernames.p1;
        const p2Username = room.playerUsernames.p2;

        const p1User = await dbGet('SELECT id FROM users WHERE username = ?', [p1Username]);
        const p2User = await dbGet('SELECT id FROM users WHERE username = ?', [p2Username]);
        if (!p1User || !p2User) return;

        const winnerIsP1 = winnerSide === 'p1';
        const winnerId   = winnerIsP1 ? p1User.id : p2User.id;
        const loserId    = winnerIsP1 ? p2User.id : p1User.id;
        const winnerScore = winnerIsP1 ? score.player1 : score.player2;
        const loserScore  = winnerIsP1 ? score.player2 : score.player1;

        await dbRun('INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)', [winnerId, loserId, 'win',  winnerScore, loserScore]);
        await dbRun('INSERT INTO games (player_id, opponent_id, result, score, opponent_score) VALUES (?, ?, ?, ?, ?)', [loserId,  winnerId, 'loss', loserScore,  winnerScore]);

        io.to(roomId).emit('gameEnded', {
          winner: winnerIsP1 ? 'Player 1' : 'Player 2',
          winnerUsername: winnerIsP1 ? p1Username : p2Username,
          loserUsername:  winnerIsP1 ? p2Username : p1Username,
          finalScore: { ...score },
          roomId
        });

        fastify.emitToUser(p1Username, 'playerStatsUpdated', { username: p1Username });
        fastify.emitToUser(p2Username, 'playerStatsUpdated', { username: p2Username });
      } catch (e) {
        console.error('persistAndNotifyRoomResult failed:', e);
      } finally {
              // 👇 IMPORTANT : informer le tournoi AVANT de fermer la room
        const room = activeGameRooms.get(roomId);
        if (room?.tournamentContext && room?.playerUsernames) {
          const winnerUsername = (winnerSide === 'p1')
            ? room.playerUsernames.p1
            : room.playerUsernames.p2;
        
          if (winnerUsername) {
            handleTournamentMatchEnd(
              room.tournamentContext.tournamentId,
              room.tournamentContext.matchId,
              winnerUsername
            );
          }
        }
        // garde ton stop/silent comme avant
        stopGameForRoom(roomId, true);
      }
    }
    // ==========================  TOURNAMENT SYSTEM  ==========================
// Ajoute une gestion complète de tournoi par dessus le moteur 2-joueurs existant.

const tournaments = new Map(); // id -> Tournament

// ⏱ règles & helpers
const TOURN_FILL_TIMEOUT_MS = 60_000;  // cooldown pour remplir / auto-bots
const ROUND_COOLDOWN_MS     = 10_000;  // attente entre 2 rounds
const MATCH_START_COUNTDOWN = 3;       // compte à rebours avant chaque match
const allowedSizes = new Set([2,4,8,16]);

function nextPow2(n){let p=1;while(p<n)p<<=1;return p}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function pickSocket(username){const set=socketsByUserMulti.get(username);return set&&set.size?Array.from(set)[0]:null}

function buildBracket(participants /* [{username,isBot?}] */){
  const size=Math.max(2,nextPow2(participants.length));
  const roundsNb=Math.log2(size);
  const filled=participants.slice();
  while(filled.length<size) filled.push({username:'BYE',isBye:true});
  const rounds=[]; let idSeq=0;
  const r0=[];
  for(let i=0;i<size;i+=2){
    r0.push({id:`m${idSeq++}`,roundIndex:0,index:i/2,p1:filled[i]??null,p2:filled[i+1]??null,status:'pending',winner:null,roomId:null});
  }
  rounds.push(r0);
  let prevLen=r0.length;
  for(let r=1;r<roundsNb;r++){
    const arr=[]; for(let i=0;i<prevLen/2;i++) arr.push({id:`m${idSeq++}`,roundIndex:r,index:i,p1:null,p2:null,status:'pending',winner:null,roomId:null});
    rounds.push(arr); prevLen=arr.length;
  }
  for(let r=0;r<rounds.length-1;r++){
    for(let i=0;i<rounds[r].length;i++){
      const m=rounds[r][i]; m.nextMatchIndex=Math.floor(i/2); m.nextSlot=(i%2===0)?'p1':'p2';
    }
  }
  return { rounds, size, roundsNb };
}

function tournamentToPublic(t){
  return {
    id: t.id,
    name: t.name,
    host: t.host || t.hostAlias || t.hostId,
    status: t.status,
    maxPlayers: t.maxPlayers,
    maxPoints: t.maxPoints,
    durationMinutes: t.durationMinutes,
    createdAt: t.createdAt,
    currentRoundIndex: t.currentRoundIndex,
    ranking: t.ranking ?? null,
    participants: t.participants.map(p => ({ username: p.display || p.username, isBot: !!p.isBot, eliminated: !!p.eliminated })),
    bracket: t.bracket,
    runningRooms: Array.from(t.runningRooms ?? []),
    timeLeftToFill: t.fillDeadline ? Math.max(0, Math.floor((t.fillDeadline - Date.now())/1000)) : 0,
  };
}
function emitTournamentToAll(t){ io.to(`tournament:${t.id}`).emit('tournamentUpdate', tournamentToPublic(t)); }
function fillWithBotsIfNeeded(t){ const need=t.maxPlayers - t.participants.length; for(let i=0;i<need;i++) t.participants.push({username:`BOT#${Math.random().toString(36).slice(2,6)}`,isBot:true}) }

function attachBot(room, side /* 'p1'|'p2' */, opts={tickMs:1000,error:35}){
  if(!room.botControllers) room.botControllers=[];
  const h=setInterval(()=>{ const gs=room.gameState; if(!gs||gs.status!=='playing') return;
    const paddle=side==='p1'?gs.paddles.p1:gs.paddles.p2; const ballY=gs.ball.y+(Math.random()*2*opts.error-opts.error);
    const center=paddle.y+paddle.height/2; const dy=ballY-center; let vy=0;
    if(Math.abs(dy)>10) vy=dy>0?5:-5; // volontairement lent et grossier
    const atTop=paddle.y<=0, atBottom=paddle.y>=(H-paddle.height);
    if((atTop&&vy<0)||(atBottom&&vy>0)) vy=0;
    paddle.vy=vy;
  }, opts.tickMs);
  room.botControllers.push(h);
}
function clearBots(room){ if(!room?.botControllers) return; for(const h of room.botControllers) clearInterval(h); room.botControllers=[]; }

function launchMatch(t, match){
  const MAX_MATCH_MS_DEFAULT = 180_000; // 3 min sécurité
  const MAX_MATCH_MS_BOTVSBOT = 60_000; // 1 min si bot vs bot

  const p1U=match.p1?.username, p2U=match.p2?.username;
  const roomId=`tourn-${t.id}-r${match.roundIndex+1}-m${match.index}-${Math.random().toString(36).slice(2,8)}`;
  match.roomId=roomId;

  const gs = JSON.parse(JSON.stringify(initialGameStateTemplate));
  const customization = t.customization || DEFAULT_CUSTOMIZATION;
  gs.gameId = roomId;
  gs.usernames = { p1: p1U, p2: p2U };
  gs.settings = { ...DEFAULT_CUSTOMIZATION, ...customization };
  gs.baseSpeed = resolveBallSpeed(gs.settings.ballSpeed);
  gs.ball.radius = resolveBallRadius(gs.settings.ballSize);
  gs.ball.vx = 0;
  gs.ball.vy = 0;
  gs.accelBall = gs.settings.accelBall;
  gs.paddleDash = gs.settings.paddleDash;
  gs.powerUpsFrequency = gs.settings.powerUps;
  gs.targetScore = Number(t.maxPoints) || 10;
  gs.status = 'starting';
  gs.countdown = 0;
  const p1Sid= p1U && !match.p1.isBot ? pickSocket(p1U) : null;
  const p2Sid= p2U && !match.p2.isBot ? pickSocket(p2U) : null;
  if(p1Sid) io.sockets.sockets.get(p1Sid)?.join(roomId);
  if(p2Sid) io.sockets.sockets.get(p2Sid)?.join(roomId);
  gs.players={p1:p1Sid,p2:p2Sid};

  const room={ gameState:gs, intervalId:null, durationTimer:null,
    playerSockets:{p1:p1Sid,p2:p2Sid}, playerUsernames:{p1:p1U,p2:p2U},
    maxPoints:Number(t.maxPoints)||10, durationMinutes:Number(t.durationMinutes)||null,
    tournamentContext:{ tournamentId:t.id, matchId:match.id },
    customization: gs.settings,
    accelBall: !!gs.accelBall,
    paddleDash: !!gs.paddleDash,
    baseSpeed: gs.baseSpeed,
    source: 'tournament',
    createdAt: Date.now()
  };
  activeGameRooms.set(roomId, room);
  if(!t.runningRooms) t.runningRooms=new Set(); t.runningRooms.add(roomId);

  const startPayload = { tournamentId: t.id, roomId, roundIndex: match.roundIndex, matchIndex: match.index, p1: p1U, p2: p2U };
  io.to(`tournament:${t.id}`).emit('tournamentMatchStart', startPayload);
  // Cible aussi directement les deux joueurs pour éviter toute perte due aux rooms
  if (p1U && p1U !== 'BYE') fastify.emitToUser(p1U, 'tournamentMatchStart', startPayload);
  if (p2U && p2U !== 'BYE') fastify.emitToUser(p2U, 'tournamentMatchStart', startPayload);

  // Compte à rebours: envoie aussi 0 avant de démarrer
  let count = MATCH_START_COUNTDOWN;
  io.to(roomId).emit('matchCountdown', { roomId, count });
  const cd = setInterval(() => {
    count -= 1;
    io.to(roomId).emit('matchCountdown', { roomId, count });
    if (count <= 0) {
      clearInterval(cd);
      startGameForRoom(roomId);
      if(match.p1?.isBot) attachBot(room,'p1');
      if(match.p2?.isBot) attachBot(room,'p2');
    }
  }, 1000);
  const bothBots = !!(match.p1?.isBot && match.p2?.isBot);
const maxMs = bothBots ? MAX_MATCH_MS_BOTVSBOT
  : (room.durationMinutes ? room.durationMinutes * 60_000 : MAX_MATCH_MS_DEFAULT);

// ⏱️ Watchdog : si le match traîne, on choisit un gagnant (score >, sinon tirage)
room.durationTimer = setTimeout(() => {
  try {
    const sc1 = room.gameState?.score?.player1 ?? 0;
    const sc2 = room.gameState?.score?.player2 ?? 0;
    let winnerSide = 'p1';
    if (sc2 > sc1) winnerSide = 'p2';
    else if (sc2 === sc1) winnerSide = (Math.random() < 0.5 ? 'p1' : 'p2');

    persistAndNotifyRoomResult(roomId, winnerSide);
  } catch (e) { console.error('[watchdog] end match failed', e); }
}, maxMs);
}

function propagateWinner(t, fromMatch, winnerParticipant){
  const nextIndex=Math.floor(fromMatch.index/2), nextSlot=(fromMatch.index%2===0)?'p1':'p2';
  const target=t.bracket.rounds[fromMatch.roundIndex+1]?.[nextIndex]; if(!target) return;
  target[nextSlot]={ username:winnerParticipant.username, isBot:!!winnerParticipant.isBot };
}
const roundPlayableMatches = (round)=> round.filter(m=>!m.p1?.isBye && !m.p2?.isBye);

function autoResolveByes(t, rIndex){
  const round=t.bracket.rounds[rIndex];
  for(const m of round){
    if(m.status!=='pending') continue;
    if(m.p1?.isBye && m.p2?.isBye){ m.status='done'; m.winner=null; continue; }
    if(m.p1?.isBye && m.p2 && !m.p2.isBye){ m.status='done'; m.winner=m.p2.username; propagateWinner(t,m,m.p2); }
    else if(m.p2?.isBye && m.p1 && !m.p1.isBye){ m.status='done'; m.winner=m.p1.username; propagateWinner(t,m,m.p1); }
  }
}

function tryStartRound(t, rIndex){
  t.currentRoundIndex=rIndex;
  autoResolveByes(t, rIndex);
  emitTournamentToAll(t);

  const round=t.bracket.rounds[rIndex];
  const playable=roundPlayableMatches(round);
  if(playable.length===0){
    if(rIndex < t.bracket.rounds.length-1) setTimeout(()=>tryStartRound(t,rIndex+1),0);
    else finishTournament(t);
    return;
  }
  t.roundProgress={played:0,total:playable.length};
  for(const m of round){ if(m.p1?.isBye || m.p2?.isBye) continue; m.status='playing'; launchMatch(t,m); }
  emitTournamentToAll(t);
}

function handleTournamentMatchEnd(tournamentId, matchId, winnerUsername){
  const t=tournaments.get(tournamentId); if(!t||t.status!=='running') return;
  const round=t.bracket.rounds[t.currentRoundIndex]; const match=round.find(m=>m.id===matchId);
  if(!match || match.status==='done') return;
  match.status='done'; match.winner=winnerUsername;
  
  const loser=(match.p1?.username===winnerUsername)?match.p2?.username:match.p1?.username;
  if(loser && loser!=='BYE'){ const p=t.participants.find(pp=>pp.username===loser); if(p) p.eliminated=true; }

  const winnerPart=(match.p1?.username===winnerUsername)?match.p1:match.p2;
  if(winnerPart) propagateWinner(t,match,winnerPart);

  if(t.roundProgress) t.roundProgress.played++;
  if (match.roomId && t.runningRooms) {
    t.runningRooms.delete(match.roomId);
  }
  emitTournamentToAll(t);

  const remaining = roundPlayableMatches(round).length - (t.roundProgress?.played ?? 0);
  if(remaining<=0){
    io.to(`tournament:${t.id}`).emit('tournamentRoundComplete',{tournamentId:t.id,roundIndex:t.currentRoundIndex,cooldownMs:ROUND_COOLDOWN_MS});
    setTimeout(()=>{ if(t.currentRoundIndex < t.bracket.rounds.length-1) tryStartRound(t,t.currentRoundIndex+1); else finishTournament(t); }, ROUND_COOLDOWN_MS);
  }
}

function computeFullRanking(t){
  const last=t.bracket.rounds.length-1, rank=new Map();
  const final=t.bracket.rounds[last][0];
  if(final.winner) rank.set(final.winner,1);
  const finalLoser=(final.p1?.username===final.winner)?final.p2?.username:final.p1?.username;
  if(finalLoser && finalLoser!=='BYE') rank.set(finalLoser,2);
  if(last>=1){for(const m of t.bracket.rounds[last-1]){const loser=(m.winner===m.p1?.username)?m.p2?.username:m.p1?.username; if(loser && loser!=='BYE') rank.set(loser,3)}}
  if(last>=2){for(const m of t.bracket.rounds[last-2]){const loser=(m.winner===m.p1?.username)?m.p2?.username:m.p1?.username; if(loser && loser!=='BYE') rank.set(loser,5)}}
  for(const p of t.participants){ if(!rank.has(p.username) && !p.eliminated) rank.set(p.username,5) }
  return Array.from(rank.entries()).map(([username,place])=>({username,place})).sort((a,b)=>a.place-b.place);
}
function finishTournament(t){
  const last=t.bracket.rounds[t.bracket.rounds.length-1][0];
  const champion=last.winner;
  const runnerUp=(last.p1?.username===champion)?last.p2?.username:last.p1?.username;
  const semis = t.bracket.rounds.length>=2 ? t.bracket.rounds[t.bracket.rounds.length-2] : [];
  const thirdPlaces=[]; for(const m of semis){ if(m.p1?.username && m.p2?.username){ const loser=(m.winner===m.p1.username)?m.p2.username:m.p1.username; if(loser && loser!=='BYE') thirdPlaces.push(loser) } }
  t.status='completed'; t.ranking={champion,runnerUp,thirdPlaces,full:computeFullRanking(t)};
  emitTournamentToAll(t); io.to(`tournament:${t.id}`).emit('tournamentFinished', t.ranking);
}

function tournamentSummary(t){
  return {
    id: t.id,
    name: t.name,
    host: t.host || t.hostAlias || t.hostId,
    participants: t.participants.length,
    maxPlayers: t.maxPlayers,
    status: t.status,
    timeLeftToFill: t.fillDeadline ? Math.max(0, Math.floor((t.fillDeadline - Date.now())/1000)) : 0
  };
}

function broadcastTournamentList(){
  const arr = Array.from(tournaments.values()).map(tournamentSummary);
  io.emit('tournamentList', arr);
}

io.on('connection', (socket) => {
  socket.on('getTournamentList', () => {
    const arr = Array.from(tournaments.values()).map(tournamentSummary);
    socket.emit('tournamentList', arr);
  });
});


// ────────── Socket handlers pour tournois ──────────
io.on('connection', (socket) => {
  socket.on('createTournament', (data) => {
    try{
      const hostId = connectedUsers.get(socket.id) || 'anon';
      const alias = String(data?.alias || '').trim();
      if(!alias) return socket.emit('tournamentError', {message: 'Alias requis meme pour hote'});
      const name = String(data?.name || `Tournoi de ${alias}`).slice(0,60);
      const maxPlayers=Number(data?.maxPlayers)||4;
      const maxPoints=Number(data?.maxPoints)||10;
      const durationMinutes=data?.durationMinutes?Number(data.durationMinutes):null;
      if(!allowedSizes.has(maxPlayers)) return socket.emit('tournamentError',{message:'Taille invalide (2/4/6/8).'});
      const customization = normalizeCustomization(data?.customization);
      if (typeof data?.accelBall === 'boolean') customization.accelBall = data.accelBall;
      if (typeof data?.paddleDash === 'boolean') customization.paddleDash = data.paddleDash;
      const id=`t-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
      const t={ id,name,hostId, hostAlias: alias, host: alias, createdAt:Date.now(),status:'waiting',maxPlayers,maxPoints,durationMinutes,
        participants:[{ username: hostId, display: alias }], bracket:null, currentRoundIndex:0, fillDeadline:Date.now()+TOURN_FILL_TIMEOUT_MS, runningRooms:new Set(),
        customization };
      tournaments.set(id,t); socket.join(`tournament:${id}`);
      t.fillTimer=setTimeout(()=>{ if(t.status!=='waiting') return; fillWithBotsIfNeeded(t); startTournamentInternal(t); }, TOURN_FILL_TIMEOUT_MS);
      socket.emit('tournamentCreated',{id,name}); emitTournamentToAll(t);
    }catch(e){ console.error('createTournament',e); socket.emit('tournamentError',{message:'Création impossible.'}) }
  });

   socket.on('joinTournament', ({tournamentId, alias})=>{
    const t=tournaments.get(tournamentId); 
    if(!t)
      return socket.emit('tournamentError',{message:'Tournoi introuvable'});
    const real = connectedUsers.get(socket.id) || 'anon';
    if(!real) return socket.emit('tournamentError',{message:'Non identifié'});
    const already = t.participants.some(p=>p.username===real);
    if(already) {
      socket.join(`tournament:${t.id}`);
      return socket.emit('tournamentUpdate', tournamentToPublic(t));
    }
    if(t.status!=='waiting')
      return socket.emit('tournamentError',{message:'Tournoi déjà démarré'});
    if(t.participants.length>=t.maxPlayers) 
      return socket.emit('tournamentError',{message:'Tournoi plein'});
    const display = String(alias || '').trim() || real;
    t.participants.push({ username: real, display });
    socket.join(`tournament:${t.id}`); 
    emitTournamentToAll(t);
  });

  socket.on('leaveTournament', ({tournamentId})=>{
    const t=tournaments.get(tournamentId); if(!t) return;
    const username=connectedUsers.get(socket.id)||'anon';
    t.participants=t.participants.filter(p=>p.username!==username);
    socket.leave(`tournament:${t.id}`); emitTournamentToAll(t);
  });

  socket.on('forceFillWithBots', ({tournamentId})=>{
    const t=tournaments.get(tournamentId); const username=connectedUsers.get(socket.id)||'anon';
    if(!t || t.hostId!==username || t.status!=='waiting') return;
    fillWithBotsIfNeeded(t); emitTournamentToAll(t);
  });

  socket.on('startTournament', ({tournamentId})=>{
    const t=tournaments.get(tournamentId); const username=connectedUsers.get(socket.id)||'anon';
    if(!t || t.hostId!==username || t.status!=='waiting') return socket.emit('tournamentError',{message:'Impossible de démarrer.'});
    startTournamentInternal(t);
  });

  socket.on('spectateMatch', ({roomId})=>{
    if(!roomId || !activeGameRooms.has(roomId)) return socket.emit('tournamentError',{message:'Match introuvable'});
    socket.join(roomId);
    const room=activeGameRooms.get(roomId);
    if(room?.gameState){
      socket.emit('gameState', room.gameState);
      if (typeof room.gameState.countdown === 'number') {
        socket.emit('matchCountdown', { roomId, count: room.gameState.countdown });
      }
    }
  });
});

function startTournamentInternal(t){
  if(t.status!=='waiting') return;
  // BYE gérés dans buildBracket ; bots ajoutés si timer a déjà rempli
  t.bracket = buildBracket(t.participants.map(p=>({username:p.username,isBot:!!p.isBot})));
  t.status='running'; t.currentRoundIndex=0;
  if(t.fillTimer){ clearTimeout(t.fillTimer); t.fillTimer=null; }
  emitTournamentToAll(t); tryStartRound(t,0);
}
// ========================  END TOURNAMENT SYSTEM  ========================

    function startGameForRoom(roomId) {
      const room = activeGameRooms.get(roomId);
      if (!room || room.gameState.status === 'playing') return;
      let customization = room.customization || room.gameState.settings;
      if (!customization && room.tournamentContext?.tournamentId) {
        const t = tournaments.get(room.tournamentContext.tournamentId);
        if (t?.customization) customization = t.customization;
      }
      customization = { ...DEFAULT_CUSTOMIZATION, ...(customization || {}) };
      room.customization = customization;
      room.gameState.settings = { ...customization };
      room.gameState.accelBall = !!room.gameState.settings.accelBall;
      room.gameState.paddleDash = !!room.gameState.settings.paddleDash;
      room.gameState.baseSpeed = resolveBallSpeed(room.gameState.settings.ballSpeed);
      room.gameState.ball.radius = resolveBallRadius(room.gameState.settings.ballSize);
      room.gameState.targetScore = Number(room.maxPoints) || room.gameState.targetScore || 10;
      room.gameState.gameOver = false;
      room.gameState.winner = null;
      room.gameState.countdown = 0;
      room.accelBall = room.gameState.accelBall;
      room.paddleDash = room.gameState.paddleDash;
      room.baseSpeed = room.gameState.baseSpeed;

      resetBall(room.gameState.ball, room.baseSpeed);
      room.gameState.status = 'playing';
      io.to(roomId).emit('gameState', room.gameState);
      room.intervalId = setInterval(() => gameLoopForRoom(roomId), 1000/60);
      if (room.durationMinutes && !room.durationTimer) {
        room.durationTimer = setTimeout(() => {
          if (!activeGameRooms.has(roomId)) return;
          io.to(roomId).emit('gameEnded', { message: 'Fin du temps.' });
          stopGameForRoom(roomId);
        }, room.durationMinutes * 60 * 1000);
      }
    }

    function gameLoopForRoom(roomId) {
      const room = activeGameRooms.get(roomId);
      if (!room || room.gameState.status !== 'playing') return;

      const { ball, paddles, score } = room.gameState;
      const accelerate = !!room.accelBall;
      const dashEnabled = !!room.paddleDash;
      const baseSpeed = room.baseSpeed || room.gameState.baseSpeed || BALL_SPEED_VALUES.normal;
      const targetScore = Number(room.maxPoints) || room.gameState.targetScore || 10;

      if (ball.lastCollisionTime && ball.lastCollisionTime > 0) {
        ball.lastCollisionTime -= 1;
      }

      [paddles.p1, paddles.p2].forEach((p, index) => {
        if (dashEnabled) {
          if (p.dashCooldown && p.dashCooldown > 0) p.dashCooldown -= 1;
          if (p.isDashing) {
            p.dashProgress = (p.dashProgress ?? 0) + 1;
            if (p.startX === undefined) p.startX = p.x;
            const direction = index === 0 ? 1 : -1;
            if (p.dashProgress <= DASH_DURATION) {
              p.x = p.startX + direction * (DASH_DISTANCE * (p.dashProgress / DASH_DURATION));
            } else if (p.dashProgress <= DASH_DURATION * 2) {
              const backProgress = p.dashProgress - DASH_DURATION;
              p.x = p.startX + direction * (DASH_DISTANCE * (1 - backProgress / DASH_DURATION));
            } else {
              p.x = p.startX;
              p.isDashing = false;
              p.dashProgress = undefined;
              p.startX = undefined;
            }
          }
        }

        p.y += p.vy;

        if (p.y < 0) {
          p.y = 0;
          if (p.vy < 0) p.vy = 0;
        }
        const maxY = H - p.height;
        if (p.y > maxY) {
          p.y = maxY;
          if (p.vy > 0) p.vy = 0;
        }
      });

      ball.x += ball.vx;
      ball.y += ball.vy;

      if (ball.y - ball.radius < 0 || ball.y + ball.radius > H) {
        ball.vy *= -1;
      }

      const canCollide = !ball.lastCollisionTime || ball.lastCollisionTime <= 0;

      if (canCollide && ball.vx < 0 && collides(ball, paddles.p1)) {
        handlePaddleCollision(ball, paddles.p1, accelerate);
      } else if (canCollide && ball.vx > 0 && collides(ball, paddles.p2)) {
        handlePaddleCollision(ball, paddles.p2, accelerate);
      }

      if (ball.x - ball.radius < 0) {
        score.player2 += 1;
        if (score.player2 >= targetScore) {
          room.gameState.status = 'finished';
          room.gameState.winner = 'Player 2';
          room.gameState.gameOver = true;
          io.to(roomId).emit('gameState', room.gameState);
          io.to(roomId).emit('gameEnded', { winner: 'Player 2', finalScore: { ...score } });
          return persistAndNotifyRoomResult(roomId, 'p2');
        }
        resetBall(ball, baseSpeed);
      } else if (ball.x + ball.radius > W) {
        score.player1 += 1;
        if (score.player1 >= targetScore) {
          room.gameState.status = 'finished';
          room.gameState.winner = 'Player 1';
          room.gameState.gameOver = true;
          io.to(roomId).emit('gameState', room.gameState);
          io.to(roomId).emit('gameEnded', { winner: 'Player 1', finalScore: { ...score } });
          return persistAndNotifyRoomResult(roomId, 'p1');
        }
        resetBall(ball, baseSpeed);
      }

      io.to(roomId).emit('gameState', room.gameState);
    }

    function handlePaddleCollision(ball, paddle, accelerating) {
      ball.vx *= -1;
      repositionBallAfterCollision(ball, paddle);

      if (accelerating) {
        ball.vx *= SPEED_INCREMENT;
        ball.vy *= SPEED_INCREMENT;
        ball.vx = clamp(ball.vx, -MAX_SPEED, MAX_SPEED);
        ball.vy = clamp(ball.vy, -MAX_SPEED, MAX_SPEED);
      }

      if (paddle.isDashing) {
        ball.vx *= 1.2;
        ball.vy *= 1.2;
        ball.vx = clamp(ball.vx, -MAX_SPEED, MAX_SPEED);
        ball.vy = clamp(ball.vy, -MAX_SPEED, MAX_SPEED);
      }

      ball.lastCollisionTime = COLLISION_COOLDOWN;
    }


    function broadcastGameListUpdate() {
      const available = Array.from(gameLobbies.values()).filter(g => g.status === 'lobby');
      io.emit('gameListUpdate', available.map(game => ({
        id: game.id, name: game.name,
        currentPlayers: game.currentPlayers.length, maxPlayers: game.maxPlayers,
        estimatedWaitTime: null, hasPassword: !!game.password, status: game.status
      })));
    }

    // ======== SOCKET HANDLERS =========
    io.on('connection', (socket) => {
      fastify.metrics?.websocketConnections?.inc();
      // --- helpers DB promisifiés (avec fastify.db décoré dans server.js)
      const getAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          fastify.db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
        });
      const allAsync = (sql, params = []) =>
        new Promise((resolve, reject) => {
          fastify.db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
        });
  
      const userExists = async (username) =>
        !!(await getAsync('SELECT 1 FROM users WHERE username = ?', [username]));
  
      const kickUserEverywhere = (username, reason = 'account_missing') => {
        const set = socketsByUserMulti.get(username);
        if (!set || set.size === 0) return;
        for (const sid of set) {
          io.to(sid).emit('forceLogout', { reason });
          io.sockets.sockets.get(sid)?.disconnect(true);
        }
        socketsByUserMulti.delete(username);
      };
        // presence
      socket.on('identify', async (usernameRaw) => {
        const username = String(usernameRaw || '').trim();
        if (!username) return;
    
        // 1) refuse si compte inexistant (après reset DB, etc.)
        try {
          if (!(await userExists(username))) {
            socket.emit('forceLogout', { reason: 'account_missing' });
            return socket.disconnect(true);
          }
        } catch (e) {
          console.error('identify->userExists error:', e);
          // par prudence, on ne garde pas la session si la DB est en vrac
          socket.emit('forceLogout', { reason: 'server_error' });
          return socket.disconnect(true);
        }
    
        // 2) enregistre la présence
        connectedUsers.set(socket.id, username);
        addPresence(username, socket.id);
    
        // 3) announce si 1er onglet
        const set = socketsByUserMulti.get(username);
        if (set && set.size === 1) socket.broadcast.emit('userConnected', username);
    
        // 4) renvoie la liste des connectés, filtrée côté DB
        try {
          const names = Array.from(socketsByUserMulti.keys());
          if (names.length === 0) return socket.emit('connectedUsersList', []);
    
          // batch check en un seul SELECT IN (...)
          const placeholders = names.map(() => '?').join(',');
          const rows = await allAsync(
            `SELECT username FROM users WHERE username IN (${placeholders})`,
            names
          );
          const ok = new Set(rows.map((r) => r.username));
          const filtered = [];
    
          for (const n of names) {
            if (ok.has(n)) filtered.push(n);
            else kickUserEverywhere(n); // purge fantôme trouvé à l’occasion
          }
    
          socket.emit('connectedUsersList', filtered);
        } catch (e) {
          console.error('identify->list filter error:', e);
          // fallback: liste brute
          socket.emit('connectedUsersList', Array.from(socketsByUserMulti.keys()));
        }
      });

      // renvoie la liste filtrée et purge les fantômes au passage
      socket.on('requestConnectedUsers', async () => {
        try {
          const names = Array.from(socketsByUserMulti.keys());
          if (names.length === 0) return socket.emit('connectedUsersList', []);
    
          const placeholders = names.map(() => '?').join(',');
          const rows = await allAsync(
            `SELECT username FROM users WHERE username IN (${placeholders})`,
            names
          );
          const ok = new Set(rows.map((r) => r.username));
          const filtered = [];
    
          for (const n of names) {
            if (ok.has(n)) filtered.push(n);
            else kickUserEverywhere(n);
          }
          socket.emit('connectedUsersList', filtered);
        } catch (e) {
          console.error('requestConnectedUsers error:', e);
          socket.emit('connectedUsersList', Array.from(socketsByUserMulti.keys()));
        }
      });
      // chat temps réel
      socket.on('sendMessage', async ({ sender, receiver, content }) => {
        const blocked = await dbGet('SELECT 1 FROM blocked_users WHERE blocker = ? AND blocked = ?', [receiver, sender]);
        if (blocked) return socket.emit('messageError', { error: 'Vous avez été bloqué par cet utilisateur' });
        await dbRun('INSERT INTO messages (sender, receiver, content) VALUES (?, ?, ?)', [sender, receiver, content]);
        const payload = { sender, receiver, content, timestamp: new Date().toISOString() };
        const recvSet = socketsByUserMulti.get(receiver);
        if (recvSet) for (const sid of recvSet) io.to(sid).emit('newMessage', payload);
        socket.emit('messageSent', payload);
      });

      socket.on('typing', ({ sender, receiver }) => {
        const recvSet = socketsByUserMulti.get(receiver);
        if (recvSet) for (const sid of recvSet) io.to(sid).emit('userTyping', { sender });
      });
      socket.on('stopTyping', ({ sender, receiver }) => {
        const recvSet = socketsByUserMulti.get(receiver);
        if (recvSet) for (const sid of recvSet) io.to(sid).emit('userStoppedTyping', { sender });
      });

      // Le challenger envoie un défi
      socket.on('challengePlayer', async ({ from, to, options }) => {
        try {
          from = String(from || '').trim();
          to   = String(to   || '').trim();
          if (!from || !to || from === to) {
            return socket.emit('challengeError', { error: 'Paramètres invalides' });
          }
          const fromU = await dbGet('SELECT id FROM users WHERE username = ?', [from]);
          const toU   = await dbGet('SELECT id FROM users WHERE username = ?', [to]);
          if (!fromU || !toU) return socket.emit('challengeError', { error: 'Utilisateur introuvable' });
      
          const challengeId = `ch-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
          const customization = normalizeCustomization(options?.customization);
          if (typeof options?.accelBall === 'boolean') customization.accelBall = options.accelBall;
          if (typeof options?.paddleDash === 'boolean') customization.paddleDash = options.paddleDash;
          const payload = {
            id: challengeId,
            from, to,
            options: {
              maxPoints: Number(options?.maxPoints) || 10,
              durationMinutes: Number(options?.durationMinutes) || null,
              customization
            },
            createdAt: new Date().toISOString(),
            status: 'pending'
          };
          pendingChallenges.set(challengeId, payload);
      
          // Notif + événement dédié côté destinataire
          fastify.emitToUser(to, 'newNotification', {
            id: challengeId, type: 'challenge', icon: '🎯',
            title: 'Défi reçu', message: `${from} te défie à un match !`,
            timestamp: payload.createdAt, actionable: true,
            actionText: 'Accepter', actionData: { type: 'challenge', id: challengeId }
          });
          fastify.emitToUser(to, 'challengeIncoming', payload);
      
          // Feedback au challenger
          fastify.emitToUser(from, 'challengeSent', { id: challengeId, to, options: payload.options });
        } catch (e) {
          socket.emit('challengeError', { error: e?.message || 'Erreur envoi défi' });
        }
      });
      
      // Le destinataire répond (accepte/refuse)
      socket.on('challengeRespond', async ({ challengeId, accept }) => {
        const ch = pendingChallenges.get(challengeId);
        if (!ch || ch.status !== 'pending') {
          return socket.emit('challengeError', { error: 'Défi introuvable ou expiré' });
        }
      
        if (!accept) {
          ch.status = 'declined';
          pendingChallenges.delete(challengeId);
          fastify.emitToUser(ch.from, 'challengeDeclined', { id: ch.id, to: ch.to });
          fastify.emitToUser(ch.to,   'challengeDeclinedAck', { id: ch.id });
          return;
        }
      
        // Accepté → créer une room dédiée et y placer les deux joueurs
        ch.status = 'accepted';
        pendingChallenges.delete(challengeId);
      
        const roomId = `game-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;

        const gs = JSON.parse(JSON.stringify(initialGameStateTemplate));
        const customization = ch.options?.customization || DEFAULT_CUSTOMIZATION;
        gs.gameId = roomId;
        gs.usernames = { p1: ch.from, p2: ch.to };
        gs.settings = { ...DEFAULT_CUSTOMIZATION, ...customization };
        gs.baseSpeed = resolveBallSpeed(gs.settings.ballSpeed);
        gs.ball.radius = resolveBallRadius(gs.settings.ballSize);
        gs.ball.vx = 0;
        gs.ball.vy = 0;
        gs.accelBall = gs.settings.accelBall;
        gs.paddleDash = gs.settings.paddleDash;
        gs.powerUpsFrequency = gs.settings.powerUps;
        gs.targetScore = Number(ch.options?.maxPoints) || 10;
        gs.status = 'starting';
        gs.countdown = 0;
      
        const p1Sid = pickOneSocketId(ch.from);
        const p2Sid = pickOneSocketId(ch.to);
        if (!p1Sid || !p2Sid) {
          fastify.emitToUser(ch.from, 'challengeError', { error: 'Un joueur est hors-ligne' });
          fastify.emitToUser(ch.to,   'challengeError', { error: 'Un joueur est hors-ligne' });
          return;
        }
      
        // Join room côté serveur + binder les contrôleurs
        fastify.io.sockets.sockets.get(p1Sid)?.join(roomId);
        fastify.io.sockets.sockets.get(p2Sid)?.join(roomId);
        gs.players = { p1: p1Sid, p2: p2Sid };
      
        activeGameRooms.set(roomId, {
          gameState: gs,
          intervalId: null,
          playerSockets:  { p1: p1Sid, p2: p2Sid },
          playerUsernames:{ p1: ch.from, p2: ch.to },
          maxPoints: Number(ch.options?.maxPoints) || 10,
          durationMinutes: Number(ch.options?.durationMinutes) || null,
          durationTimer: null,
          accelBall: !!gs.accelBall,
          paddleDash: !!gs.paddleDash,
          customization: gs.settings,
          baseSpeed: gs.baseSpeed,
          source: 'challenge',
          createdAt: Date.now()
        });
      
        // Informer d’ouvrir l’écran de jeu
      process.nextTick(() => {
        fastify.emitToUser(ch.from, 'challengeStart', { roomId, mode: 'remote' });
        fastify.emitToUser(ch.to,   'challengeStart', { roomId, mode: 'remote' });
      });
        // Pousser un état initial, puis compte à rebours (inclut 0) comme en tournoi
        fastify.io.to(roomId).emit('gameState', gs);
        let count = MATCH_START_COUNTDOWN || 3;
        fastify.io.to(roomId).emit('matchCountdown', { roomId, count });
        const cd = setInterval(() => {
          count -= 1;
          fastify.io.to(roomId).emit('matchCountdown', { roomId, count });
          if (count <= 0) { clearInterval(cd); startGameForRoom(roomId); }
        }, 1000);
      });
      
      // Annulation du défi par l’émetteur
      socket.on('challengeCancel', ({ challengeId }) => {
        const ch = pendingChallenges.get(challengeId);
        if (ch) {
          pendingChallenges.delete(challengeId);
          fastify.emitToUser(ch.to, 'challengeCanceled', { id: challengeId, from: ch.from });
          fastify.emitToUser(ch.from, 'challengeCanceledAck', { id: challengeId });
        }
      });
      
      // Re-bind du contrôleur si l’utilisateur rouvre la room dans un autre onglet
      socket.on('joinChallengeRoom', ({ roomId, username }) => {
        try {
          const room = activeGameRooms.get(roomId);
          if (!room) return socket.emit('challengeError', { error: 'Room introuvable' });
      
          const isP1 = room.playerUsernames?.p1 === username;
          const isP2 = room.playerUsernames?.p2 === username;
          if (!isP1 && !isP2) return socket.emit('challengeError', { error: 'Tu ne fais pas partie de cette room' });
      
          const prevSid = isP1 ? room.playerSockets.p1 : room.playerSockets.p2;
          if (prevSid && prevSid !== socket.id) fastify.io.sockets.sockets.get(prevSid)?.leave(roomId);
      
          socket.join(roomId);
          if (isP1) { room.playerSockets.p1 = socket.id; room.gameState.players.p1 = socket.id; }
          else      { room.playerSockets.p2 = socket.id; room.gameState.players.p2 = socket.id; }
      
          socket.emit('gameState', room.gameState);
        } catch (e) {
          socket.emit('challengeError', { error: e?.message || 'Erreur joinChallengeRoom' });
        }
      });

      // lobbies
      socket.on('createGame', (gameData = {}) => {
        const newGameId = `game-${Date.now()}-${Math.random().toString(36).slice(2,11)}`;
        const userId = connectedUsers.get(socket.id) || socket.id;
        const customization = normalizeCustomization(gameData.customization);
        if (typeof gameData.accelBall === 'boolean') customization.accelBall = gameData.accelBall;
        if (typeof gameData.paddleDash === 'boolean') customization.paddleDash = gameData.paddleDash;
        const lobby = {
          id: newGameId,
          name: gameData.name,
          password: gameData.password,
          creatorId: userId,
          maxPlayers: gameData.maxPlayers,
          currentPlayers: [{ id: userId, socketId: socket.id }],
          status: 'lobby',
          durationMinutes: gameData.durationMinutes,
          maxPoints: gameData.maxPoints,
          createdAt: Date.now(),
          //modes de jeu
          accelBall: customization.accelBall,
          paddleDash: customization.paddleDash,
          customization
        };
        gameLobbies.set(newGameId, lobby);
        socket.join(newGameId);
        socket.emit('gameCreatedConfirmation', {
          id: lobby.id,
          name: lobby.name,
          accelBall: lobby.accelBall,
          paddleDash: lobby.paddleDash,
          customization: lobby.customization
        });
        broadcastGameListUpdate();
      });

      socket.on('requestGameList', () => broadcastGameListUpdate());

      socket.on('joinGame', ({ gameId, password }) => {
        const lobby = gameLobbies.get(gameId);
        const userId = connectedUsers.get(socket.id) || socket.id;
        if (!lobby) return socket.emit('gameJoinError', { message: 'Partie introuvable.' });
        if (lobby.currentPlayers.some(p => p.id === userId)) return socket.emit('gameJoinError', { message: 'Déjà dans la partie.' });
        if (lobby.currentPlayers.length >= lobby.maxPlayers) return socket.emit('gameJoinError', { message: 'La partie est pleine.' });
        if (lobby.password && password !== lobby.password) return socket.emit('gameJoinError', { message: 'Mot de passe incorrect.' });

        lobby.currentPlayers.push({ id: userId, socketId: socket.id });
        socket.join(gameId);
        broadcastGameListUpdate();
        lobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
          gameId: lobby.id, currentPlayers: lobby.currentPlayers.length, maxPlayers: lobby.maxPlayers, status: lobby.status, estimatedWaitTime: null
        }));

        if (lobby.currentPlayers.length === lobby.maxPlayers && lobby.status === 'lobby') {
          lobby.status = 'starting';
          gameLobbies.delete(gameId);
          broadcastGameListUpdate();

          const gs = JSON.parse(JSON.stringify(initialGameStateTemplate));
          const customization = lobby.customization || DEFAULT_CUSTOMIZATION;
          gs.gameId = gameId;
          gs.players.p1 = lobby.currentPlayers[0].socketId;
          gs.players.p2 = lobby.currentPlayers[1].socketId;
          const p1Username = connectedUsers.get(gs.players.p1);
          const p2Username = connectedUsers.get(gs.players.p2);
          gs.usernames = { p1: p1Username, p2: p2Username };
          gs.settings = { ...DEFAULT_CUSTOMIZATION, ...customization };
          gs.baseSpeed = resolveBallSpeed(gs.settings.ballSpeed);
          gs.ball.radius = resolveBallRadius(gs.settings.ballSize);
          gs.ball.vx = 0;
          gs.ball.vy = 0;
          gs.accelBall = gs.settings.accelBall;
          gs.paddleDash = gs.settings.paddleDash;
          gs.powerUpsFrequency = gs.settings.powerUps;
          gs.targetScore = Number(lobby.maxPoints) || 10;
          gs.status = 'starting';
          gs.countdown = 0;

          activeGameRooms.set(gameId, {
            gameState: gs,
            intervalId: null,
            playerSockets: { p1: gs.players.p1, p2: gs.players.p2 },
            playerUsernames: { p1: p1Username, p2: p2Username },
            maxPoints: Number(lobby.maxPoints) || 10,
            durationMinutes: Number(lobby.durationMinutes) || null,
            durationTimer: null,
            accelBall: !!gs.accelBall,
            paddleDash: !!gs.paddleDash,
            customization: gs.settings,
            baseSpeed: gs.baseSpeed,
            source: 'lobby',
            createdAt: Date.now()
          });

          io.to(gameId).emit('gameState', gs);

          setTimeout(() => {
            if (activeGameRooms.has(gameId)) {
              startGameForRoom(gameId);
              lobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
                gameId: lobby.id, currentPlayers: lobby.currentPlayers.length, maxPlayers: lobby.maxPlayers, status: 'started', roomId: lobby.id
              }));
            }
          }, 1500);
        }
      });

      socket.on('leaveGame', ({ gameId }) => {
        const userId = connectedUsers.get(socket.id) || socket.id;
        const lobby = gameLobbies.get(gameId);
        if (lobby) {
          const before = lobby.currentPlayers.length;
          lobby.currentPlayers = lobby.currentPlayers.filter(p => p.id !== userId);
          if (lobby.currentPlayers.length < before) {
            socket.leave(gameId);
            if (lobby.currentPlayers.length === 0) gameLobbies.delete(gameId);
            else lobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
              gameId: lobby.id, currentPlayers: lobby.currentPlayers.length, maxPlayers: lobby.maxPlayers, status: lobby.status, estimatedWaitTime: null
            }));
            broadcastGameListUpdate();
            socket.emit('leftGameConfirmation', { gameId });
            return;
          }
        }
        const active = activeGameRooms.get(gameId);
        if (active) { stopGameForRoom(gameId); socket.emit('leftGameConfirmation', { gameId }); return; }
        socket.emit('leaveGameError', { message: 'Partie introuvable ou vous n\'êtes pas dedans.' });
      });

      socket.on('movePaddle', ({ roomId, direction }) => {
        const room = activeGameRooms.get(roomId);
        if (!room || room.gameState.status !== 'playing') return;
        if (typeof direction !== 'string') return;
          
        const { gameState } = room;
        const isP1 = socket.id === (room.playerSockets?.p1) || socket.id === (gameState.players?.p1);
        const isP2 = socket.id === (room.playerSockets?.p2) || socket.id === (gameState.players?.p2);
        if (!isP1 && !isP2) return;
          
        const p = isP1 ? gameState.paddles.p1 : gameState.paddles.p2;
        if (direction === 'dash') {
          if (!room.paddleDash) return;
          if (!p.isDashing && (!p.dashCooldown || p.dashCooldown <= 0)) {
            p.isDashing = true;
            p.dashCooldown = DASH_COOLDOWN;
            p.dashProgress = 0;
            p.startX = p.x;
          }
          return;
        }

        let vy = direction === 'up' ? -PADDLE_SPEED : direction === 'down' ? PADDLE_SPEED : 0;
        const atTop = p.y <= 0;
        const atBottom = p.y >= (H - p.height);
        if ((atTop && vy < 0) || (atBottom && vy > 0)) vy = 0;
          
        p.vy = vy;
      });

      // déconnexion
      socket.on('disconnect', () => {
        fastify.metrics?.websocketConnections?.dec();
        const username = connectedUsers.get(socket.id);
        const result = removePresence(socket.id);
        if (username) connectedUsers.delete(socket.id);
        if (result.username && !result.stillOnline) socket.broadcast.emit('userDisconnected', result.username);

        // nettoyer lobbies
        for (const [gameId, lobby] of gameLobbies.entries()) {
          
          const before = lobby.currentPlayers.length;
          lobby.currentPlayers = lobby.currentPlayers.filter(p => p.socketId !== socket.id);
          if (lobby.currentPlayers.length < before) {
            socket.leave(gameId);
            if (lobby.currentPlayers.length === 0) gameLobbies.delete(gameId);
            else lobby.currentPlayers.forEach(p => io.to(p.socketId).emit('gameQueueUpdate', {
              gameId: lobby.id, currentPlayers: lobby.currentPlayers.length, maxPlayers: lobby.maxPlayers, status: lobby.status, estimatedWaitTime: null
            }));
            broadcastGameListUpdate();
            break;
          }
        }
        for (const [gid, room] of activeGameRooms.entries()) {
          if (room.playerSockets.p1 === socket.id || room.playerSockets.p2 === socket.id) {
            if (room.tournamentContext) {
              const winnerSide = (room.playerSockets.p1 === socket.id) ? 'p2' : 'p1'; // forfait
              persistAndNotifyRoomResult(gid, winnerSide);
              
            } else {
              stopGameForRoom(gid);
            }
            break;
          }
        }

      });
    });

    console.log('⚡️ Serveur WebSocket prêt.');
  });

});
