import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// GitHub Pages serves this at /<repo>/. Getting `base` wrong 404s every asset
// while index.html still loads, so the Actions run stays green and the page is
// blank. Sourced from the repo name so it cannot drift.
const REPO = 'recurrence-field';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? `/${REPO}/` : '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
}));
