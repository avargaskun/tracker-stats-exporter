import { parseConfig, getProxyConfig, getExporterConfig } from './config';
import { PrometheusExporter } from './exporter';
import { setGlobalDispatcher, ProxyAgent } from 'undici';
import { getLogger } from './logger';

const logger = getLogger('Main');

// Configure global proxy if present
const proxyConfig = getProxyConfig();
if (proxyConfig) {
  try {
    // Basic validation of the URL
    new URL(proxyConfig.url);

    let uri = proxyConfig.url;
    // Construct authenticated URL if credentials are provided
    if (proxyConfig.username && proxyConfig.password) {
       const urlObj = new URL(proxyConfig.url);
       urlObj.username = proxyConfig.username;
       urlObj.password = proxyConfig.password;
       uri = urlObj.toString();
    } else if (proxyConfig.username || proxyConfig.password) {
       logger.warn('Partial proxy credentials provided. Ignoring username/password.');
    }

    const agent = new ProxyAgent(uri);
    setGlobalDispatcher(agent);
    logger.info(`Global proxy configured: ${proxyConfig.url}`);
  } catch (error) {
    logger.error('Failed to configure global proxy:', error);
    process.exit(1);
  }
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
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Closing server...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Closing server...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});
