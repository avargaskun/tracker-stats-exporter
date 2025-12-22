import * as http from 'http';
import { Registry, Gauge } from 'prom-client';
import { createTrackerClient, TrackerClient } from './clients/tracker';
import { TrackerConfig, getExporterConfig } from './config';
import { getLogger } from './logger';
import { Logger } from 'winston';

export class PrometheusExporter {
  private registry: Registry;
  private clients: TrackerClient[];
  private configs: TrackerConfig[];
  private logger: Logger;

  private uploadGauge: Gauge;
  private downloadGauge: Gauge;
  private bufferGauge: Gauge;
  private ratioGauge: Gauge;
  private bonusGauge: Gauge;
  private seedingGauge: Gauge;
  private leechingGauge: Gauge;
  private hnrGauge: Gauge;
  private upStatusGauge: Gauge;

  private lastScrapeTime: number = 0;
  private cacheDuration: number;
  private metricsPath: string;

  constructor(configs: TrackerConfig[]) {
    this.configs = configs;
    this.clients = configs.map(config => createTrackerClient(config));
    this.registry = new Registry();
    this.logger = getLogger('PrometheusExporter');

    const exporterConfig = getExporterConfig();
    this.cacheDuration = exporterConfig.cacheDuration;
    this.metricsPath = exporterConfig.metricsPath;

    this.logger.info(`Initialized exporter with cache duration: ${this.cacheDuration}ms and metrics path: ${this.metricsPath}`);

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

    this.bufferGauge = new Gauge({
        name: 'tracker_buffer_bytes',
        help: 'Buffer in bytes',
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
      help: 'User bonus points (seed bonus)',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.seedingGauge = new Gauge({
      name: 'tracker_seeding_count',
      help: 'Number of torrents seeding',
      labelNames: ['tracker'],
      registers: [this.registry]
    });

    this.leechingGauge = new Gauge({
        name: 'tracker_leeching_count',
        help: 'Number of torrents leeching',
        labelNames: ['tracker'],
        registers: [this.registry]
    });

    this.hnrGauge = new Gauge({
        name: 'tracker_hit_and_runs_count',
        help: 'Number of hit and runs',
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
      this.logger.debug('Returning cached metrics');
      return;
    }

    this.logger.debug('Cache expired or empty. Fetching new metrics...');

    await Promise.all(this.clients.map(async (client, index) => {
      const trackerName = this.configs[index].name;
      try {
        const stats = await client.getUserStats();

        this.uploadGauge.set({ tracker: trackerName }, stats.uploaded);
        this.downloadGauge.set({ tracker: trackerName }, stats.downloaded);
        this.bufferGauge.set({ tracker: trackerName }, stats.buffer);
        this.ratioGauge.set({ tracker: trackerName }, stats.ratio);
        this.bonusGauge.set({ tracker: trackerName }, stats.seedbonus);
        this.seedingGauge.set({ tracker: trackerName }, stats.seeding);
        this.leechingGauge.set({ tracker: trackerName }, stats.leeching);
        this.hnrGauge.set({ tracker: trackerName }, stats.hit_and_runs);
        this.upStatusGauge.set({ tracker: trackerName }, 1);

        this.logger.debug(`Successfully updated metrics for ${trackerName}`);

      } catch (error) {
        this.logger.error(`Failed to update metrics for ${trackerName}: ${error}`);
        // Log error already handled in client, just set status to 0
        this.upStatusGauge.set({ tracker: trackerName }, 0);
      }
    }));

    this.lastScrapeTime = Date.now();
  }

  startServer(port: number) {
    const server = http.createServer(async (req, res) => {
      if (req.url === this.metricsPath) {
        try {
          await this.updateMetrics();
          const metrics = await this.registry.metrics();
          res.writeHead(200, { 'Content-Type': this.registry.contentType });
          res.end(metrics);
        } catch (ex) {
          this.logger.error(`Error generating metrics: ${ex}`);
          res.writeHead(500);
          res.end(ex instanceof Error ? ex.message : 'Unknown error');
        }
      } else {
        res.writeHead(404);
        res.end('Not Found');
      }
    });

    server.listen(port, () => {
      this.logger.info(`Server listening on port ${port}, metrics exposed at ${this.metricsPath}`);
    });

    return server;
  }
}
