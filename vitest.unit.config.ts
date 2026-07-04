import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

// Pure unit tests — no Twenty server required. Kept separate from the
// integration harness (vitest.config.ts) which installs/uninstalls the app.
export default defineConfig({
  plugins: [
    tsconfigPaths({
      projects: ['tsconfig.spec.json'],
      ignoreConfigErrors: true,
    }),
  ],
  test: {
    include: ['src/**/*.unit-test.ts'],
  },
});
