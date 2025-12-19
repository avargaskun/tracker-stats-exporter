import { parseConfig } from './config';
import { PrometheusExporter } from './exporter';

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
