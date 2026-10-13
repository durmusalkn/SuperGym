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
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
})
