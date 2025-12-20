export interface TrackerConfig {
  name: string;
  url: string;
  apiKey: string;
  type?: string;
}

export function parseConfig(): TrackerConfig[] {
  const trackers: Record<string, Partial<TrackerConfig>> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || !key.startsWith('TRACKER_')) continue;

    const parts = key.split('_');
    // Expected format: TRACKER_{NAME}_{OPTION}
    if (parts.length < 3) continue;

    let name = '';
    let option = '';

    if (key.endsWith('_URL')) {
        option = 'url';
        name = key.slice(8, -4);
    } else if (key.endsWith('_API_KEY')) {
        option = 'apiKey';
        name = key.slice(8, -8);
    } else if (key.endsWith('_TYPE')) {
        option = 'type';
        name = key.slice(8, -5);
    } else {
        continue;
    }

    if (!name) continue;

    if (!trackers[name]) {
      trackers[name] = { name };
    }

    (trackers[name] as any)[option] = value;
  }

  const validTrackers: TrackerConfig[] = [];

  for (const [name, config] of Object.entries(trackers)) {
    // If URL is missing, we can't determine hostname or connect, so skip.
    // apiKey is also generally required for these types of trackers.
    if (config.url && config.apiKey) {
      let type = config.type;

      if (!type) {
        try {
          const hostname = new URL(config.url).hostname;
          if (hostname === 'digitalcore.club') {
            type = 'DIGITALCORE';
          } else {
            type = 'UNIT3D';
          }
        } catch (e) {
          console.warn(`Invalid URL for tracker ${name}: ${config.url}`);
          continue;
        }
      }

      // Enforce uppercase for comparison consistency
      type = type.toUpperCase();

      if (type === 'UNIT3D') {
        validTrackers.push({
          ...config,
          type
        } as TrackerConfig);
      } else {
        console.warn(`Skipping tracker ${name} with unsupported type: ${type}`);
      }

    } else {
      console.warn(`Skipping incomplete configuration for tracker: ${name}. Missing: ${!config.url ? 'URL ' : ''}${!config.apiKey ? 'API_KEY ' : ''}`);
    }
  }

  return validTrackers;
}
