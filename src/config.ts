export interface TrackerConfig {
  name: string;
  url: string;
  apiKey: string;
  username: string;
}

export function parseConfig(): TrackerConfig[] {
  const trackers: Record<string, Partial<TrackerConfig>> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (!value || !key.startsWith('TRACKER_')) continue;

    const parts = key.split('_');
    // Expected format: TRACKER_{NAME}_{OPTION}
    // Minimal length: TRACKER, NAME, OPTION (3 parts)
    if (parts.length < 3) continue;

    // NAME is the second part (index 1)
    // OPTION is the rest joined by underscore (in case option has underscores, though spec says URL, API_KEY, USERNAME)
    // Actually, let's look at the spec: TRACKER_{NAME}_{OPTION}
    // Options are URL, API_KEY, USERNAME.
    // So if NAME contains underscores, this split might be tricky.
    // However, usually NAME is an identifier.
    // Let's assume NAME does not contain underscores, or we parse from the end.
    // The spec says: TRACKER_{NAME}_URL, TRACKER_{NAME}_API_KEY, TRACKER_{NAME}_USERNAME.
    // API_KEY has an underscore.

    // Let's match against the known suffixes.
    let name = '';
    let option = '';

    if (key.endsWith('_URL')) {
        option = 'url';
        name = key.slice(8, -4); // Remove TRACKER_ and _URL
    } else if (key.endsWith('_API_KEY')) {
        option = 'apiKey';
        name = key.slice(8, -8); // Remove TRACKER_ and _API_KEY
    } else if (key.endsWith('_USERNAME')) {
        option = 'username';
        name = key.slice(8, -9); // Remove TRACKER_ and _USERNAME
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
    if (config.url && config.apiKey && config.username) {
      validTrackers.push(config as TrackerConfig);
    } else {
      console.warn(`Skipping incomplete configuration for tracker: ${name}. Missing: ${!config.url ? 'URL ' : ''}${!config.apiKey ? 'API_KEY ' : ''}${!config.username ? 'USERNAME' : ''}`);
    }
  }

  return validTrackers;
}
