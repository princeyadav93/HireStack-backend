import { defineConfig } from 'vitest/config';

// .mts, not .ts: package.json has no "type": "module", so a .ts config is
// loaded as CommonJS and Vite warns about the ESM syntax in it.
export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.ts'],

        // Starts one in-memory MongoDB replica set for the whole run and
        // publishes its URI. Integration files opt in via useTestDatabase();
        // unit files never connect.
        globalSetup: ['tests/setup/globalSetup.ts'],

        // Runs before every test file, and before that file's imports are
        // evaluated — which matters, because src/config/env.ts throws at
        // import time when a required variable is missing.
        setupFiles: ['tests/setup/env.ts'],

        // Booting mongod and building indexes is slower than a pure unit test.
        testTimeout: 20_000,
        hookTimeout: 60_000,
    },
});
