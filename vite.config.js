import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFileSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const waspjsVersion = JSON.parse(readFileSync(resolve(__dirname, 'node_modules/webwaspjs/package.json'), 'utf8')).version;
const DEFAULT_PAGES_BASE_PATH = '/Wasp-Atas-Explorer/';

function normalizeBasePath(value) {
  if (!value || value === '/') {
    return '/';
  }

  const trimmed = value.replace(/^\/+|\/+$/g, '');
  return trimmed ? `/${trimmed}/` : '/';
}

function resolveBasePath(mode) {
  if (process.env.VITE_BASE_PATH) {
    return normalizeBasePath(process.env.VITE_BASE_PATH);
  }

  if (mode !== 'production') {
    return '/';
  }

  const repoName = process.env.GITHUB_REPOSITORY?.split('/').pop();
  return normalizeBasePath(repoName ? `/${repoName}/` : DEFAULT_PAGES_BASE_PATH);
}

export default defineConfig(({ mode }) => ({
  define: {
    __WASPJS_VERSION__: JSON.stringify(waspjsVersion),
  },
  root: __dirname,
  publicDir: resolve(__dirname, 'public'),
  resolve: {
    alias: {
      webwaspjs: resolve(__dirname, 'node_modules/webwaspjs/dist/index.js'),
    },
  },
  optimizeDeps: {
    exclude: ['webwaspjs'],
  },
  build: {
    outDir: resolve(__dirname, 'dist')
  },
  base: resolveBasePath(mode),
}));
