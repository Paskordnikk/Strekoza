import { defineConfig } from 'vite';
import { resolve } from 'path';
import { writeFileSync, existsSync, mkdirSync } from 'fs';

export default defineConfig({
  root: 'src',
  base: '/Strekoza/', // Измените на '/your-repo-name/' если сайт размещен в подпапке
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        login: resolve(__dirname, 'src/login.html'),
      },
    },
  },
  publicDir: '../public',
  server: {
    port: 3000,
    open: true,
  },
  plugins: [
    {
      name: 'create-nojekyll',
      closeBundle() {
        // Создаем .nojekyll файл для GitHub Pages
        const distDir = resolve(__dirname, 'dist');
        if (!existsSync(distDir)) {
          mkdirSync(distDir, { recursive: true });
        }
        const nojekyllDest = resolve(distDir, '.nojekyll');
        writeFileSync(nojekyllDest, '');
      },
    },
  ],
});

