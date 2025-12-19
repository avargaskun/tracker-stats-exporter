import { TrackerConfig } from './config';

export interface UserStats {
  uploaded: number;
  downloaded: number;
  ratio: number;
  bonus_points: number;
  seeding_count: number;
}

export class Unit3DClient {
  private config: TrackerConfig;

  constructor(config: TrackerConfig) {
    this.config = config;
  }

  async getUserStats(): Promise<UserStats> {
    const { url, apiKey, username } = this.config;
    // Ensure URL doesn't have a trailing slash
    const baseUrl = url.replace(/\/$/, '');

    // Construct the API URL.
    // Standard Unit3D: /api/users/{username}?api_token={key}
    const apiUrl = `${baseUrl}/api/users/${username}?api_token=${apiKey}`;

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

      // Unit3D API response structure varies but typically data is in a 'data' property
      // or directly in the root.
      // Example structure: { data: { ...attributes } } or { ...attributes }

      const attributes = data.data ? data.data : data;

      // Extract fields with fallbacks
      // uploaded/downloaded are bytes. ratio is float. bonus_points might be 'seed_bonus' or 'bonus_points'.

      const uploaded = this.parseBytes(attributes.uploaded);
      const downloaded = this.parseBytes(attributes.downloaded);
      const ratio = parseFloat(attributes.ratio || '0');

      let bonus_points = 0;
      if (attributes.bonus_points !== undefined) bonus_points = parseFloat(attributes.bonus_points);
      else if (attributes.seed_bonus !== undefined) bonus_points = parseFloat(attributes.seed_bonus);

      // Seeding count. Sometimes it's in a relationship or a simple count.
      // Often 'torrents_seeding_count' or derived from relationships.
      // Let's check for common fields.
      let seeding_count = 0;
      if (attributes.torrents_seeding_count !== undefined) {
          seeding_count = parseInt(attributes.torrents_seeding_count, 10);
      } else if (attributes.seeding_count !== undefined) {
          seeding_count = parseInt(attributes.seeding_count, 10);
      }

      return {
        uploaded,
        downloaded,
        ratio,
        bonus_points,
        seeding_count
      };

    } catch (error) {
      console.error(`Error fetching stats for ${this.config.name}:`, error);
      throw error;
    }
  }

  private parseBytes(value: any): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return parseInt(value, 10);
    return 0;
  }
}
