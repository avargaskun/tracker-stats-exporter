import { parseConfig, getProxyAgent, getExporterConfig } from './config';
import { PrometheusExporter } from './exporter';
import { setGlobalDispatcher } from 'undici';
import { getLogger } from './logger';

const logger = getLogger('Main');

async function main() {
  // Configure global proxy if present
  const agent = getProxyAgent();
  if (agent) {
    setGlobalDispatcher(agent);
    logger.info('Global proxy configured');
  }

  const configs = parseConfig();

  if (configs.length === 0) {
    logger.warn('No valid tracker configurations found. Please set TRACKER_{NAME}_{URL|API_KEY|USERNAME} environment variables.');
    // We can still start the server, it will just return empty metrics or we can exit.
    // Given "exporter", usually it runs even if empty.
  } else {
    logger.info(`Loaded configuration for ${configs.length} trackers: ${configs.map(c => c.name).join(', ')}`);
  }

  const exporter = new PrometheusExporter(configs);
  const exporterConfig = getExporterConfig();
  const port = exporterConfig.port;

  const server = exporter.startServer(port);

  // Handle graceful shutdown
  const shutdown = (signal: string) => {
    logger.info(`${signal} received. Closing server...`);
    server.close(() => {
      logger.info('Server closed.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch(err => {
  logger.error(`Startup error: ${err}`);
  process.exit(1);
});