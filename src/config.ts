import ms from 'ms';
import { getLogger } from './logger';
import { ProxyAgent } from 'undici';
import fs from 'fs';

const logger = getLogger('Config');

export interface TrackerConfig {
    name: string;
    url: string;
    apiKey?: string;
    type?: string;
    cookie?: string;
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
        } else if (key.endsWith('_COOKIE_FILE')) {
            option = 'cookieFile';
            name = key.slice(8, -12);
        } else if (key.endsWith('_COOKIE')) {
            option = 'cookie';
            name = key.slice(8, -7);
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
    // Resolve cookie file if present
        const cookieFile = (config as any).cookieFile;
        if (cookieFile) {
            try {
                config.cookie = fs.readFileSync(cookieFile, 'utf8').trim();
            } catch (e) {
                logger.error(`Failed to read cookie file for tracker ${name} at ${cookieFile}: ${e}`);
            }
        }

        // URL is always required to identify the tracker and connectivity
        if (config.url) {
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
                    logger.warn(`Invalid URL for tracker ${name}: ${config.url}`);
                    continue;
                }
            }

            // Enforce uppercase for comparison consistency
            type = type.toUpperCase();

            if (type === 'UNIT3D') {
                if (config.apiKey) {
                    validTrackers.push({
                        ...config,
                        type
                    } as TrackerConfig);
                } else {
                    logger.warn(`Skipping incomplete configuration for tracker: ${name}. Missing: API_KEY (required for UNIT3D)`);
                }
            } else if (type === 'SCRAPING') {
                if (config.cookie) {
                    validTrackers.push({
                        ...config,
                        type
                    } as TrackerConfig);
                } else {
                    logger.warn(`Skipping incomplete configuration for tracker: ${name}. Missing: COOKIE (required for SCRAPING)`);
                }
            } else {
                logger.warn(`Skipping tracker ${name} with unsupported type: ${type}`);
            }

        } else {
            logger.warn(`Skipping incomplete configuration for tracker: ${name}. Missing: URL`);
        }
    }

    return validTrackers;
}

export interface ProxyConfig {
    url: string;
    username?: string;
    password?: string;
}

export function getProxyConfig(): ProxyConfig | undefined {
    const url = process.env.PROXY_URL;
    if (!url) return undefined;

    const username = process.env.PROXY_USERNAME;
    const password = process.env.PROXY_PASSWORD;

    return {
        url,
        username,
        password
    };
}

let sharedProxyAgent: ProxyAgent | undefined;

export function getProxyAgent(): ProxyAgent | undefined {
    const config = getProxyConfig();
    if (!config) return undefined;

    if (!sharedProxyAgent) {
        let uri = config.url;
        if (config.username && config.password) {
            try {
                const urlObj = new URL(config.url);
                urlObj.username = config.username;
                urlObj.password = config.password;
                uri = urlObj.toString();
            } catch (e) {
                logger.warn(`Invalid proxy URL: ${config.url}`);
            }
        }
        sharedProxyAgent = new ProxyAgent(uri);
    }

    return sharedProxyAgent;
}

export function resetProxyAgent(): void {
    sharedProxyAgent = undefined;
}

export function getExporterConfig() {
    const port = process.env.EXPORTER_PORT ? parseInt(process.env.EXPORTER_PORT, 10) : 9100;
    const metricsPath = process.env.EXPORTER_PATH || '/metrics';

    let cacheDuration = 15 * 60 * 1000; // Default 15m
    const ttl = process.env.STATS_TTL;

    if (ttl) {
        try {
            const parsedMs = ms(ttl as any);
            if (typeof parsedMs === 'number') {
                if (parsedMs >= 5 * 60 * 1000) {
                    cacheDuration = parsedMs;
                } else {
                    logger.warn(`STATS_TTL (${ttl}) is less than 5 minutes. Enforcing minimum of 5 minutes.`);
                    cacheDuration = 5 * 60 * 1000;
                }
            } else {
                logger.warn(`Invalid STATS_TTL format (${ttl}). Using default 15m.`);
            }
        } catch (e) {
            logger.warn(`Error parsing STATS_TTL (${ttl}). Using default 15m.`, e);
        }
    }

    return {
        port,
        metricsPath,
        cacheDuration
    };
}

export function getOllamaConfig() {
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'gemma3:270m';

    return {
        host,
        model
    };
}
