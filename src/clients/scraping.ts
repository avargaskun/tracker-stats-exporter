import { TrackerClient, UserStats } from './tracker';
import { TrackerConfig, getProxyAgent } from '../config';
import { getLogger } from '../logger';
import { Logger } from 'winston';
import { fetch } from 'undici';
import { getUserStats } from '../extractor';
import { mergeCookies } from '../utils/cookies';
import fs from 'fs';

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

            // Handle cookie updates
            const setCookie = response.headers.getSetCookie();
            if (setCookie && setCookie.length > 0) {
                const newCookieString = mergeCookies(this.config.cookie, setCookie);

                if (newCookieString !== this.config.cookie) {
                    this.logger.info(`Cookie updated for tracker ${this.config.name}`);
                    this.config.cookie = newCookieString;

                    if (this.config.cookieFile) {
                        try {
                            fs.writeFileSync(this.config.cookieFile, newCookieString, 'utf8');
                            this.logger.info(`Persisted new cookie to ${this.config.cookieFile}`);
                        } catch (e) {
                            this.logger.error(`Failed to write updated cookie to file: ${e}`);
                        }
                    } else {
                        this.logger.warn(`Cookie updated for tracker ${this.config.name} but no cookie file configured. The new cookie will be lost on restart.`);
                    }
                }
            }

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
