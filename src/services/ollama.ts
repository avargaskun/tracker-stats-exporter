import { Ollama } from 'ollama';
import { getOllamaConfig } from '../config';
import { getLogger } from '../logger';
import { z } from 'zod';

const logger = getLogger('OllamaService');

const StatsSchema = z.object({
  uploaded: z.string(),
  downloaded: z.string(),
  ratio: z.string().transform((val) => {
    // Handle "Inf." or similar
    const num = parseFloat(val.replace(/,/g, ''));
    return isNaN(num) ? '0' : num.toString();
  })
});

export type ExtractedStats = z.infer<typeof StatsSchema>;

export class OllamaService {
  private client: Ollama;
  private model: string;

  constructor() {
    const config = getOllamaConfig();
    this.client = new Ollama({ host: config.host });
    this.model = config.model;
    logger.info(`Initialized OllamaService with host: ${config.host}, model: ${this.model}`);
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch (error) {
      logger.error(`Failed to connect to Ollama: ${error}`);
      return false;
    }
  }

  async extractStats(markdown: string): Promise<ExtractedStats> {
    const prompt = `You are a data extractor. Extract 'uploaded', 'downloaded', and 'ratio' from the following text. Return ONLY valid JSON. Use strings for values including units (e.g., '1.4 TB').

Text:
${markdown}

JSON Output:`;

    try {
      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        format: 'json',
        stream: false
      });

      const json = JSON.parse(response.response);
      const result = StatsSchema.parse(json);
      return result;

    } catch (error) {
      logger.error(`Error during inference or parsing: ${error}`);
      throw error;
    }
  }
}
