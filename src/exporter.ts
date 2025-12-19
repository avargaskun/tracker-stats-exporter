import * as http from 'http';
import { Registry, Gauge } from 'prom-client';
import { Unit3DClient } from './tracker';
import { TrackerConfig } from './config';

export class PrometheusExporter {
  private registry: Registry;
  private clients: Unit3DClient[];
  private configs: TrackerConfig[];

  private uploadGauge: Gauge;
  private downloadGauge: Gauge;
  private ratioGauge: Gauge;
  private bonusGauge: Gauge;
  private seedingGauge: Gauge;
  private upStatusGauge: Gauge;

  private lastScrapeTime: number = 0;
  // 5 minutes in milliseconds
  private cacheDuration: number = 5 * 60 * 1000;

  constructor(configs: TrackerConfig[]) {
    this.configs = configs;
    this.clients = configs.map(config => new Unit3DClient(config));
    this.registry = new Registry();

    this.uploadGauge = new Gauge({
      name: 'tracker_upload_bytes',
      help: 'Total upload in bytes',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.downloadGauge = new Gauge({
      name: 'tracker_download_bytes',
      help: 'Total download in bytes',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.ratioGauge = new Gauge({
      name: 'tracker_ratio',
      help: 'User ratio',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.bonusGauge = new Gauge({
      name: 'tracker_bonus_points',
      help: 'User bonus points',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.seedingGauge = new Gauge({
      name: 'tracker_seeding_count',
      help: 'Number of torrents seeding',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.upStatusGauge = new Gauge({
      name: 'tracker_up_status',
      help: 'Status of the last scrape (1 = success, 0 = failure)',
      labelNames: ['tracker'],
      registers: [this.registry]
    });
  }

  async updateMetrics() {
    const now = Date.now();
    if (now - this.lastScrapeTime < this.cacheDuration && this.lastScrapeTime !== 0) {
      // Return cached metrics (already in registry)
      return;
    }

    await Promise.all(this.clients.map(async (client, index) => {
      const trackerName = this.configs[index].name;
      try {
        const stats = await client.getUserStats();

        this.uploadGauge.set({ tracker: trackerName }, stats.uploaded);
        this.downloadGauge.set({ tracker: trackerName }, stats.downloaded);
        this.ratioGauge.set({ tracker: trackerName }, stats.ratio);
        this.bonusGauge.set({ tracker: trackerName }, stats.bonus_points);
        this.seedingGauge.set({ tracker: trackerName }, stats.seeding_count);
        this.upStatusGauge.set({ tracker: trackerName }, 1);

      } catch (error) {
        // Log error already handled in client, just set status to 0
        this.upStatusGauge.set({ tracker: trackerName }, 0);
      }
    }));

    this.lastScrapeTime = Date.now();
  }

  startServer(port: number) {
    const server = http.createServer(async (req, res) => {
      if (req.url === '/metrics') {
        try {
          await this.updateMetrics();
          const metrics = await this.registry.metrics();
          res.writeHead(200, { 'Content-Type': this.registry.contentType });
          res.end(metrics);
        } catch (ex) {
          res.writeHead(500);
          res.end(ex instanceof Error ? ex.message : 'Unknown error');
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });

    return server;
  }
}
