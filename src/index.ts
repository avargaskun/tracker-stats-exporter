import { parseConfig, getProxyConfig } from './config';
import { PrometheusExporter } from './exporter';
import { setGlobalDispatcher, ProxyAgent } from 'undici';

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
       console.warn('Partial proxy credentials provided. Ignoring username/password.');
    }

    const agent = new ProxyAgent(uri);
    setGlobalDispatcher(agent);
    console.log(`Global proxy configured: ${proxyConfig.url}`);
  } catch (error) {
    console.error('Failed to configure global proxy:', error);
    process.exit(1);
  }
}

const configs = parseConfig();

if (configs.length === 0) {
  console.warn('No valid tracker configurations found. Please set TRACKER_{NAME}_{URL|API_KEY|USERNAME} environment variables.');
  // We can still start the server, it will just return empty metrics or we can exit.
  // Given "exporter", usually it runs even if empty.
} else {
  console.log(`Loaded configuration for ${configs.length} trackers: ${configs.map(c => c.name).join(', ')}`);
}

const exporter = new PrometheusExporter(configs);
const port = 9100;

const server = exporter.startServer(port);

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing server...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});
