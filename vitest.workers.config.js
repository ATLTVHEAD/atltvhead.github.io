import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      miniflare: { compatibilityDate: '2026-10-27' },
    }),
  ],
  test: {
    include: ['tests/workers/**/*.test.js'],
  },
});
