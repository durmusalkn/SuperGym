import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    // Go sunucusu bu klasörü uygulamanın içine gömer.
    outDir: '../core/dist',
    emptyOutDir: true,
  },
  server: {
    // `npm run dev` sırasında API isteklerini Go sunucusuna yönlendir.
    // changeOrigin: Go sunucusu yalnızca kendi adresine gelen istekleri kabul eder.
    proxy: { '/api': { target: 'http://127.0.0.1:8080', changeOrigin: true } },
  },
})
