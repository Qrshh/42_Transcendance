const fp = require('fastify-plugin');
const client = require('prom-client');

module.exports = fp(async function metricsPlugin(fastify) {
  client.register.setDefaultLabels({ app: 'ft_transcendance' });
  client.collectDefaultMetrics();

  const loginAttempts = new client.Counter({
    name: 'login_attempts_total',
    help: 'Total login attempts',
    labelNames: ['status', 'method'],
  });
  const httpRequests = new client.Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status_code'],
  });
  const httpDuration = new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 2, 5],
  });
  const gameSessionsActive = new client.Gauge({
    name: 'game_sessions_active',
    help: 'Number of active game sessions',
  });
  const websocketConnections = new client.Gauge({
    name: 'websocket_connections_active',
    help: 'Number of active WebSocket connections',
  });
  const dbConnections = new client.Gauge({
    name: 'database_connections_active',
    help: 'Number of active database connections',
  });

  fastify.decorate('metrics', {
    client, loginAttempts, httpRequests, httpDuration, gameSessionsActive, websocketConnections, dbConnections
  });

  fastify.addHook('onRequest', async (req) => { req.startTime = Date.now(); });
  fastify.addHook('onResponse', async (req, reply) => {
    const duration = (Date.now() - req.startTime) / 1000;
    const route = req.routerPath || 'unknown';
    httpRequests.inc({ method: req.method, route, status_code: reply.statusCode });
    httpDuration.observe({ method: req.method, route, status_code: reply.statusCode }, duration);
  });

  fastify.get('/metrics', async (_, reply) => {
    reply.header('Content-Type', client.register.contentType);
    return client.register.metrics();
  });

  // petites routes de démo (facultatif)
  fastify.get('/test/login-success', async () => { loginAttempts.inc({ status: 'success', method: 'test' }); return { ok: true }; });
  fastify.get('/test/login-failure', async () => { loginAttempts.inc({ status: 'failure', method: 'test' }); return { ok: true }; });
  fastify.get('/test/game-session', async (request) => {
    const action = request.query.action || 'start';
    if (action === 'start') { gameSessionsActive.inc(); return { message: 'Started' }; }
    if (action === 'end')   { gameSessionsActive.dec(); return { message: 'Ended' }; }
    return { message: 'Invalid action' };
  });
  fastify.get('/test/websocket', async (request) => {
    const action = request.query.action || 'connect';
    if (action === 'connect')    { websocketConnections.inc(); return { message: 'WS connected' }; }
    if (action === 'disconnect') { websocketConnections.dec(); return { message: 'WS disconnected' }; }
    return { message: 'Invalid action' };
  });
});
