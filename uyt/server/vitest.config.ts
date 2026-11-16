import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? 'postgres://uyt:uyt@localhost:5432/uyt_test',
      JWT_SECRET: 'test-secret-test-secret-test-secret-123456',
      PUBLIC_WEB_URL: 'http://localhost:5173',
      PUSH_MOCK: 'false',
      NOTIFICATION_WORKER: 'false',
      VAPID_PUBLIC_KEY: '',
      VAPID_PRIVATE_KEY: '',
      FIREBASE_SERVICE_ACCOUNT: '',
      UPLOAD_DIR: './.test-uploads',
    },
  },
});
