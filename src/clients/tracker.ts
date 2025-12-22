import { TrackerConfig } from '../config';
import { ScrapingClient } from './scraping';
import { Unit3DClient } from './unit3d';

export interface UserStats {
  uploaded: number;
  downloaded: number;
  ratio: number;
  seedbonus: number;
  seeding: number;
  leeching: number;
  buffer: number;
  hit_and_runs: number;
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
