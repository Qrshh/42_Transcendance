import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACK_TARGET = env.VITE_BACK_TARGET || 'http://localhost:3000'
  // allowedHosts expects hostnames (not full origins)
  const allowed = (env.VITE_ALLOWED_HOSTS || 'localhost,127.0.0.1')
    .split(',')
    .map(s=>s.trim())
    .filter(Boolean)

  // HMR behind HTTPS reverse proxy (nginx on 8443)
  const HMR_PROTOCOL = env.VITE_HMR_PROTOCOL || 'wss'
  const HMR_HOST = env.VITE_HMR_HOST || undefined // e.g. '192.168.1.35' or domain
  const HMR_CLIENT_PORT = Number(env.VITE_HMR_CLIENT_PORT || env.NGINX_PORT || 8443)

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

  return {
    plugins: [ vue(), vueDevTools() ],
    resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
    server: {
      host: '0.0.0.0',
      port: Number(env.FRONT_PORT || 5173),
      allowedHosts: allowed,
      hmr: {
        protocol: HMR_PROTOCOL as 'ws' | 'wss',
        host: HMR_HOST,
        clientPort: HMR_CLIENT_PORT,
      },
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
