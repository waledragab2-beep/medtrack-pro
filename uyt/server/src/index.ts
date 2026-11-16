import { buildApp, corsOrigins } from './app.js';
import { config } from './config.js';
import { pool } from './db/pool.js';
import { migrate } from './db/migrate.js';
import { getProvider } from './notifications/providers/index.js';
import { startOutboxWorker, stopOutboxWorker } from './notifications/outbox.js';
import { attachRealtime, closeRealtime } from './realtime/io.js';

async function main() {
  await migrate((m) => console.info(`[db] ${m}`));
  const app = await buildApp();
  attachRealtime(app.server, corsOrigins());
  await app.listen({ port: config.PORT, host: config.HOST });

  for (const name of ['fcm', 'apns', 'webpush', 'expo'] as const) {
    app.log.info(`[push] ${name}: ${getProvider(name).isConfigured() ? 'configured' : 'NOT configured'}${config.PUSH_MOCK ? ' (mock mode)' : ''}`);
  }
  if (config.NOTIFICATION_WORKER) startOutboxWorker();

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} received, shutting down`);
    stopOutboxWorker();
    await closeRealtime();
    await app.close();
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
