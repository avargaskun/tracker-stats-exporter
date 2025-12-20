import { TrackerConfig } from './config';
import parser from 'filesize-parser';

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

export class Unit3DClient implements TrackerClient {
  private config: TrackerConfig;

  constructor(config: TrackerConfig) {
    if (!config.apiKey) {
        throw new Error(`API key is required for Unit3D client (tracker: ${config.name})`);
    }
    this.config = config;
  }

  async getUserStats(): Promise<UserStats> {
    const { url, apiKey } = this.config;
    const baseUrl = url.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/user?api_token=${apiKey}`;

    try {
      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stats from ${this.config.name}: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const attributes = data.data ? data.data : data;

      // Parse fields
      const uploaded = this.parseBytes(attributes.uploaded);
      const downloaded = this.parseBytes(attributes.downloaded);
      const buffer = this.parseBytes(attributes.buffer);
      const ratio = parseFloat(attributes.ratio || '0');

      let seedbonus = 0;
      if (attributes.seedbonus !== undefined) seedbonus = parseFloat(attributes.seedbonus);
      else if (attributes.bonus_points !== undefined) seedbonus = parseFloat(attributes.bonus_points);
      else if (attributes.seed_bonus !== undefined) seedbonus = parseFloat(attributes.seed_bonus);

      const seeding = parseInt(attributes.seeding, 10) || 0;
      const leeching = parseInt(attributes.leeching, 10) || 0;
      const hit_and_runs = parseInt(attributes.hit_and_runs, 10) || 0;

      return {
        uploaded,
        downloaded,
        ratio,
        seedbonus,
        seeding,
        leeching,
        buffer,
        hit_and_runs
      };

    } catch (error) {
      console.error(`Error fetching stats for ${this.config.name}:`, error);
      throw error;
    }
  }

  private parseBytes(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
        try {
            return parser(value);
        } catch (e) {
            return 0;
        }
    }
    return 0;
  }
}

export function createTrackerClient(config: TrackerConfig): TrackerClient {
    // In the future we can switch based on config.type
    // For now we only support UNIT3D (config filtering ensures only UNIT3D gets here ideally)
    return new Unit3DClient(config);
}
