import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const BACK_TARGET = env.VITE_BACK_TARGET || 'http://localhost:3000'
  const allowed = (env.VITE_ALLOWED_HOSTS || 'http://localhost:3000').split(',').map(s=>s.trim()).filter(Boolean)

  return {
    plugins: [ vue(), vueDevTools() ],
    resolve: { alias: { '@': fileURLToPath(new URL('./', import.meta.url)) } },
    server: {
      host: '0.0.0.0',
      port: Number(env.FRONT_PORT || 5173),
      allowedHosts: allowed,
      proxy: {
        '/auth':      { target: BACK_TARGET, changeOrigin: true },
        '/user':      { target: BACK_TARGET, changeOrigin: true },
        '/friends':   { target: BACK_TARGET, changeOrigin: true },
        '/chat':      { target: BACK_TARGET, changeOrigin: true },
        '/avatars':   { target: BACK_TARGET, changeOrigin: true },
        '/banners':   { target: BACK_TARGET, changeOrigin: true },
        '/socket.io': { target: BACK_TARGET, changeOrigin: true, ws: true },
      }
    }
  }
})
