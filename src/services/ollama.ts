import { Ollama } from 'ollama';
import { getOllamaConfig } from '../config';
import { getLogger } from '../logger';
import { z } from 'zod';

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

  async checkConnection(): Promise<boolean> {
    try {
      await this.client.list();
      return true;
    } catch (error) {
      logger.error(`Failed to connect to Ollama: ${error}`);
      return false;
    }
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
    const summary = await this.summarize(markdown);
    return await this.extract(summary);
  }

  private async summarize(markdown: string): Promise<string> {
    const prompt = `You are a data extractor. The following is the markdown version of a webpage showing the user profile for a bittorrent tracker. Your task is to extract the following information:

- Amount of data uploaded by the user
- Amount of data downloaded by the user
- Ratio of data sharing

Return the information in bullet points. Do not return any other information than what was mentioned earlier.

Input:

${markdown}`;

    try {
      logger.debug(`Sending prompt to model: ${prompt}`);

      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false
      });

      logger.debug(`Response from service: ${response.response}`);

      return response.response;
    } catch (error) {
      logger.error(`Error during inference or parsing: ${error}`);
      throw error;
    }
  }

  private async extract(summary: string): Promise<TrackerStats> {
    const prompt = `You are a data extractor. You generate VALID JSON as output. From the following input, your task is to generate a JSON object with the following attributes:

- upload_size (number)
- upload_unit (string, like "GB", "TB", etc.)
- download_size (number)
- download_unit (string, like "GB", "TB", etc.)
- ratio

The JSON object must ONLY contain one or more of the attributes above, no other attribute is allowed.

Input:

${summary}`

    try {
      logger.debug(`Sending prompt to model: ${prompt}`);

      const response = await this.client.generate({
        model: this.model,
        prompt: prompt,
        stream: false,
        format: z.toJSONSchema(TrackerStatsSchema)
      });

      logger.debug(`Response from service: ${response.response}`);

      const json = JSON.parse(response.response);
      const result = TrackerStatsSchema.parse(json);
      return result;
    } catch (error) {
      logger.error(`Error during inference or parsing: ${error}`);
      throw error;
    }
  }
}
