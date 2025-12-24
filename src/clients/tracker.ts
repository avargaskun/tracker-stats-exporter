import { TrackerConfig } from '../config';
import { ScrapingClient } from './scraping';
import { Unit3DClient } from './unit3d';

export interface UserStats {
  uploaded: number | undefined;
  downloaded: number | undefined;
  ratio: number | undefined;
  bonus: number | undefined;
  seeding: number | undefined;
  leeching: number | undefined;
  buffer: number | undefined;
  hitAndRuns: number | undefined;
}

export interface TrackerClient {
  getUserStats(): Promise<UserStats>;
}

export function createTrackerClient(config: TrackerConfig): TrackerClient {
  if (config.type === 'SCRAPING') {
    return new ScrapingClient(config);
  }
  return new Unit3DClient(config);
}
