// @ts-check
import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [
    react(),
  ],
  vite: {
    define: {
      'import.meta.env.PUBLIC_API_URL': JSON.stringify(process.env.PUBLIC_API_URL || 'https://stock-api-worker.luahoateam.workers.dev'),
      'import.meta.env.PUBLIC_JWT_SECRET': JSON.stringify(process.env.PUBLIC_JWT_SECRET || 'lua-hoa-secret-key-super-secure-2026'),
    }
  }
});
