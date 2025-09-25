import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACK_TARGET = env.VITE_BACK_TARGET || 'http://localhost:3000'

  // allowedHosts expects hostnames or RegExp patterns (no scheme)
  const allowedHostsEnv = env.VITE_ALLOWED_HOSTS?.trim()
  const defaultAllowedHosts: Array<string | RegExp> = [
    'localhost',
    '127.0.0.1',
    /^\[?::1]?$/,
    /^192\.168\.\d{1,3}\.\d{1,3}$/,
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}$/,
  ]

  const allowed: Array<string | RegExp> = (!allowedHostsEnv || allowedHostsEnv === 'auto')
    ? defaultAllowedHosts
    : allowedHostsEnv.split(',')
        .map((raw) => raw.trim())
        .filter(Boolean)
        .map((value) => {
          if (value === '*') return /.*/
          if (value.startsWith('/') && value.endsWith('/')) {
            try { return new RegExp(value.slice(1, -1)) } catch { return value }
          }
          return value
        })

  // HMR behind HTTPS reverse proxy (nginx on 8443)
  const HMR_PROTOCOL = env.VITE_HMR_PROTOCOL || 'wss'
  const rawHmrHost = env.VITE_HMR_HOST?.trim()
  const HMR_HOST = rawHmrHost && rawHmrHost !== 'auto' ? rawHmrHost : undefined // fallback: browser host
  const rawClientPort = (env.VITE_HMR_CLIENT_PORT || '').trim()
  const parsedPort = rawClientPort ? Number(rawClientPort) : NaN
  const HMR_CLIENT_PORT = Number.isFinite(parsedPort) ? parsedPort : undefined

  const withXFWD = (extra: any = {}) => ({
    target: BACK_TARGET,
    changeOrigin: true,
    ...extra,
    configure: (proxy: any, _options: any) => {
      // preserve original browser host for absolute URL generation in backend
      proxy.on('proxyReq', (proxyReq: any, req: any) => {
        const h = (req.headers && req.headers['host']) || undefined
        if (h) proxyReq.setHeader('x-forwarded-host', h)
      })
      proxy.on('proxyReqWs', (proxyReq: any, req: any) => {
        const h = (req.headers && req.headers['host']) || undefined
        if (h) proxyReq.setHeader('x-forwarded-host', h)
      })
    }
  })

  const hmrConfig: Record<string, any> = {
    protocol: HMR_PROTOCOL as 'ws' | 'wss',
    host: HMR_HOST,
  }
  if (HMR_CLIENT_PORT !== undefined) {
    hmrConfig.clientPort = HMR_CLIENT_PORT
  }

  return {
    plugins: [ vue(), vueDevTools() ],
    resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
    server: {
      host: '0.0.0.0',
      port: Number(env.FRONT_PORT || 5173),
      allowedHosts: allowed as any,
      hmr: hmrConfig,
      proxy: {
        '/register':  withXFWD(),
        '/auth':      withXFWD(),
        '/user':      withXFWD(),
        '/friends':   withXFWD(),
        '/chat':      withXFWD(),
        '/avatars':   withXFWD(),
        '/banners':   withXFWD(),
        '/socket.io': withXFWD({ ws: true }),
      }
    }
  }
})
