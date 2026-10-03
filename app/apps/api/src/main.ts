import { buildServer } from './server';
import { apiConfig } from './config';

async function main(): Promise<void> {
  const config = apiConfig();
  const app = await buildServer();
  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(
      {
        appEnv: config.APP_ENV,
        authMode: config.AUTH_MODE,
        storageMode: config.STORAGE_MODE,
        extractionProvider: config.EXTRACTION_PROVIDER,
      },
      'glucoflow api listening',
    );
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

void main();
