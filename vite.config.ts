import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const serverPort = Number(process.env.PORT ?? 4317);

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3117,
    proxy: {
      '/api': `http://localhost:${serverPort}`,
    },
  },
  build: {
    outDir: 'dist',
  },
});
