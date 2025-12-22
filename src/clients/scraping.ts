import { TrackerClient, UserStats } from '../tracker';
import { TrackerConfig, getProxyAgent } from '../config';
import { OllamaService } from '../services/ollama';
import { getLogger } from '../logger';
import { Logger } from 'winston';
import { fetch } from 'undici';
import TurndownService from 'turndown';
import parser from 'filesize-parser';
import xbytes from 'xbytes';

export class ScrapingClient implements TrackerClient {
  private config: TrackerConfig;
  private logger: Logger;
  private ollama: OllamaService;
  private turndown: TurndownService;

  constructor(config: TrackerConfig) {
    if (!config.cookie) {
      throw new Error(`Cookie is required for Scraping client (tracker: ${config.name})`);
    }
    this.config = config;
    this.logger = getLogger(`ScrapingClient:${config.name}`);
    this.ollama = new OllamaService();
    this.turndown = new TurndownService();

    // Remove unwanted elements to reduce token count
    this.turndown.remove(['script', 'style', 'head', 'img', 'svg', 'nav', 'footer' as any]);

    // Async check, don't await in constructor but log result
    this.ollama.checkConnection().then(connected => {
        if (!connected) {
            this.logger.warn('Ollama connection check failed on startup.');
        } else {
            this.logger.debug('Ollama connection verified.');
        }
    });
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

      // 1. Clean HTML to Markdown
      const markdown = this.htmlToMarkdownWithKeywords(html);

      // 2. Inference
      const extracted = await this.ollama.extractStats(markdown);
      this.logger.debug(`Extracted data: ${JSON.stringify(extracted)}`);

      // 3. Parse fields
      const uploaded = this.parseBytes(extracted.uploaded + extracted.uploaded_units);
      const downloaded = this.parseBytes(extracted.downloaded + extracted.downloaded_units);
      const ratio = extracted.ratio;

      // Scraping limits what we can easily get reliably without specialized prompts for every tracker
      // Default other stats to 0 as per requirements/impl
      return {
        uploaded,
        downloaded,
        ratio,
        seedbonus: 0,
        seeding: 0,
        leeching: 0,
        buffer: 0,
        hit_and_runs: 0
      };

    } catch (error) {
      this.logger.error(`Error scraping stats for ${this.config.name}: ${error}`);
      throw error;
    }
  }

  private parseBytes(value: string): number {
    if (!value) return 0;

    // Try filesize-parser first (simple, standard)
    try {
        return parser(value);
    } catch (e) {
        // Fallback to xbytes for better IEC/SI handling if the first fails
        try {
            return xbytes.parseSize(value);
        } catch (ex) {
            this.logger.warn(`Failed to parse bytes string: ${value}`);
            return 0;
        }
    }
  }

  private htmlToMarkdownWithKeywords(
    html: string,
    keywords: string[] = ['ratio', 'upload', 'download'],
    padding: number = 300
  ): string {
    // 1. Get normalized text
    const cleanText = this.turndown.turndown(html);
    const lowerText = cleanText.toLowerCase();

    let minIndex = Infinity;
    let maxIndex = -1;
    let foundAny = false;

    // 2. Find the absolute bounds of all keywords
    keywords.forEach((word) => {
      const wordLower = word.toLowerCase();
      let pos = lowerText.indexOf(wordLower);
      
      while (pos !== -1) {
        foundAny = true;
        if (pos < minIndex) minIndex = pos;
        if (pos + word.length > maxIndex) maxIndex = pos + word.length;
        
        // Keep searching for other occurrences of the same word
        pos = lowerText.indexOf(wordLower, pos + 1);
      }
    });

    if (!foundAny) {
      this.logger.info("Could not find keywords on page after transforming to markdown. Using original which may exhaust available tokens for LLM.");
      return html;
    }

    // 3. Extract the single window with padding
    const start = Math.max(0, minIndex - padding);
    const end = Math.min(cleanText.length, maxIndex + padding);

    return cleanText.slice(start, end);
  }
}
