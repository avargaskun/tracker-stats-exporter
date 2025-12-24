import { TrackerClient, UserStats } from './tracker';
import { TrackerConfig, getProxyAgent } from '../config';
import { getLogger } from '../logger';
import { Logger } from 'winston';
import { fetch } from 'undici';
import { getUserStats } from '../extractor';

export class ScrapingClient implements TrackerClient {
  private config: TrackerConfig;
  private logger: Logger;

  constructor(config: TrackerConfig) {
    if (!config.cookie) {
      throw new Error(`Cookie is required for Scraping client (tracker: ${config.name})`);
    }
    this.config = config;
    this.logger = getLogger(`ScrapingClient:${config.name}`);
  }

  async getUserStats(): Promise<UserStats> {
    const { url, cookie } = this.config;

    this.logger.debug(`Fetching stats page from ${url}`);

    try {
      const dispatcher = getProxyAgent();

      const response = await fetch(url, {
        headers: {
          'Cookie': cookie!,
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        dispatcher
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch page from ${this.config.name}: ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      return getUserStats(html);

    } catch (error) {
      this.logger.error(`Error scraping stats for ${this.config.name}: ${error}`);
      throw error;
    }
  }
}
