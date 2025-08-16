import { defineConfig } from 'vite'
import fs from 'fs'
import react from '@vitejs/plugin-react'

let httpsConfig = false
const defaultKey = './localhost-key.pem'
const defaultCert = './localhost-cert.pem'
try {
  if (fs.existsSync(defaultKey) && fs.existsSync(defaultCert)) {
    httpsConfig = { key: fs.readFileSync(defaultKey), cert: fs.readFileSync(defaultCert) }
  } else if (process.env.VITE_HTTPS === 'true' && process.env.VITE_SSL_KEY && process.env.VITE_SSL_CERT) {
    httpsConfig = { key: fs.readFileSync(process.env.VITE_SSL_KEY), cert: fs.readFileSync(process.env.VITE_SSL_CERT) }
  }
} catch {}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // 0.0.0.0 for LAN
    port: 5173,
    https: httpsConfig,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})
