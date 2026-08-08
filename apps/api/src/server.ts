import { buildApp } from './app.js';
import { config } from './config.js';

const app = await buildApp();

async function shutdown(signal: string) {
  app.log.info({ signal }, 'Shutting down');
  await app.close();
  process.exit(0);
}

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ host: config.HOST, port: config.PORT });
  app.log.info(
    { provider: config.resolvedProvider, model: config.GEMINI_MODEL, dataDir: config.dataDir },
    'BlackIn generation backend ready',
  );
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
