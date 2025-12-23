import { Ollama } from 'ollama';
import { getOllamaConfig } from '../config';
import { getLogger } from '../logger';
import { z } from 'zod';
import { extract, LLMProvider, ContentFormat } from '@lightfeed/extractor';

const logger = getLogger('OllamaService');

const TrackerStatsSchema = z.object({
  uploaded: z.number(),
  uploaded_units: z.string(),
  downloaded: z.number(),
  downloaded_units: z.string(),
  ratio: z.number(),
});

export type TrackerStats = z.infer<typeof TrackerStatsSchema>;

export class OllamaService {
  private static instance: OllamaService;
  private client: Ollama;
  private model: string;

  private constructor() {
    const config = getOllamaConfig();
    this.client = new Ollama({ host: config.host });
    this.model = config.model;
    logger.info(`Initialized OllamaService with host: ${config.host}, model: ${this.model}`);
  }

  public static getInstance(): OllamaService {
    if (!OllamaService.instance) {
      OllamaService.instance = new OllamaService();
    }
    return OllamaService.instance;
  }

  async ensureModelAndConnection(): Promise<void> {
    try {
      // 1. Check connection and list models
      const list = await this.client.list();
      logger.info(`Ollama connection established. Found ${list.models.length} models.`);

      // 2. Check if model exists
      // exact match or match with implied tag if configured model has no tag?
      // Usually users provide full name "gemma:2b".
      const modelExists = list.models.some(m => m.name === this.model);

      if (modelExists) {
        logger.info(`Model '${this.model}' is available.`);
        return;
      }

      // 3. Pull model if missing
      logger.info(`Model '${this.model}' not found locally. Pulling... (this may take a while)`);

      const response = await this.client.pull({ model: this.model, stream: true });

      for await (const part of response) {
         if (part.status) {
             logger.info(`Pull status: ${part.status}`);
         }
      }

      logger.info(`Model '${this.model}' pulled successfully.`);

    } catch (error) {
      logger.error(`Failed to ensure Ollama model availability: ${error}`);
      throw error;
    }
  }

  async extractStats(markdown: string): Promise<TrackerStats> {
    const config = getOllamaConfig();
    const originalBaseUrl = process.env.OPENAI_BASE_URL;
    
    // Set Ollama as OpenAI compatible endpoint
    // Ensure we have the /v1 suffix for OpenAI SDK compatibility
    const baseUrl = config.host.endsWith('/v1') ? config.host : `${config.host}/v1`;
    process.env.OPENAI_BASE_URL = baseUrl;

    try {
      logger.debug(`Starting extraction with model ${this.model} at ${baseUrl}`);
      
      const result = await extract({
        content: markdown,
        format: ContentFormat.MARKDOWN,
        schema: TrackerStatsSchema,
        provider: LLMProvider.OPENAI,
        modelName: this.model,
        openaiApiKey: 'ollama', // Required but ignored by Ollama
        prompt: "Extract the user statistics (upload, download, ratio) from the provided tracker profile markdown content.",
      } as any);

      logger.debug(`Result from extract: ${JSON.stringify(result)}`);

      if (!result.data) {
         throw new Error("Extraction returned no data");
      }

      return result.data;

    } catch (error) {
      logger.error(`Error during extraction: ${error}`);
      throw error;
    } finally {
        if (originalBaseUrl) {
            process.env.OPENAI_BASE_URL = originalBaseUrl;
        } else {
            delete process.env.OPENAI_BASE_URL;
        }
    }
  }
}