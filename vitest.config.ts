import { defineConfig } from 'vitest/config';
import { readFileSync } from 'node:fs';

const waspjsVersion = JSON.parse(readFileSync(new URL('./node_modules/webwaspjs/package.json', import.meta.url), 'utf8')).version;

export default defineConfig({
  define: { __WASPJS_VERSION__: JSON.stringify(waspjsVersion) },
  root: '.',
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'node',
  },
});
