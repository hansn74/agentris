import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        '.next/**',
        '**/*.config.*',
        '**/*.d.ts',
        '**/index.ts',
      ],
    },
  },
  resolve: {
    alias: {
      '@agentris/api': path.resolve(__dirname, './packages/api/src'),
      '@agentris/db': path.resolve(__dirname, './packages/db/src'),
      '@agentris/auth': path.resolve(__dirname, './packages/auth/src'),
      '@agentris/integrations': path.resolve(__dirname, './packages/integrations/src'),
      '@agentris/ai-engine': path.resolve(__dirname, './packages/ai-engine/src'),
      '@agentris/services': path.resolve(__dirname, './packages/services/src'),
      '@agentris/shared': path.resolve(__dirname, './packages/shared/src'),
    },
  },
});
