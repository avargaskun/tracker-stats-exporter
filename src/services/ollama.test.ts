import { OllamaService } from './ollama';
import { Ollama } from 'ollama';
import { extract } from '@lightfeed/extractor';

// Proper Jest mock for ES modules/classes
jest.mock('ollama');
jest.mock('@lightfeed/extractor', () => ({
  extract: jest.fn(),
  LLMProvider: { OPENAI: 'openai' },
  ContentFormat: { MARKDOWN: 'markdown' }
}));

describe('OllamaService', () => {
  let service: OllamaService;
  let mockOllamaInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {};

    // Reset singleton instance for testing isolation
    (OllamaService as any).instance = undefined;
    
    // Instantiate service which creates the Ollama instance
    service = OllamaService.getInstance();

    // Get the mocked instance
    mockOllamaInstance = (Ollama as unknown as jest.Mock).mock.instances[0];
  });

  describe('ensureModelAndConnection', () => {
    it('should not pull if model exists', async () => {
      mockOllamaInstance.list.mockResolvedValue({ 
        models: [{ name: 'gemma3:270m' }] 
      });

      await service.ensureModelAndConnection();

      expect(mockOllamaInstance.list).toHaveBeenCalled();
      expect(mockOllamaInstance.pull).not.toHaveBeenCalled();
    });

    it('should pull if model is missing', async () => {
      mockOllamaInstance.list.mockResolvedValue({ models: [{ name: 'other:model' }] });

      const asyncIterator = {
        [Symbol.asyncIterator]: async function* () {
          yield { status: 'pulling' };
          yield { status: 'success' };
        }
      };
      mockOllamaInstance.pull.mockResolvedValue(asyncIterator);

      await service.ensureModelAndConnection();

      expect(mockOllamaInstance.list).toHaveBeenCalled();
      expect(mockOllamaInstance.pull).toHaveBeenCalledWith({ 
        model: 'gemma3:270m', 
        stream: true 
      });
    });

    it('should throw if connection fails', async () => {
      mockOllamaInstance.list.mockRejectedValue(new Error('Connection failed'));

      await expect(service.ensureModelAndConnection()).rejects.toThrow('Connection failed');
    });

    it('should throw if pull fails', async () => {
      mockOllamaInstance.list.mockResolvedValue({ models: [] });
      mockOllamaInstance.pull.mockRejectedValue(new Error('Pull failed'));

      await expect(service.ensureModelAndConnection()).rejects.toThrow('Pull failed');
    });
  });

  describe('extractStats', () => {
    it('should extract stats correctly using @lightfeed/extractor', async () => {
      const mockData = {
        uploaded: 1.5,
        uploaded_units: 'TB',
        downloaded: 500,
        downloaded_units: 'GiB',
        ratio: 3.0
      };
      // Mock extract to return the data
      (extract as jest.Mock).mockResolvedValue({ data: mockData });

      const stats = await service.extractStats('some markdown text');

      expect(extract).toHaveBeenCalled();
      const callArgs = (extract as jest.Mock).mock.calls[0][0];
      expect(callArgs.content).toBe('some markdown text');
      expect(callArgs.provider).toBe('openai');
      expect(callArgs.openaiApiKey).toBe('ollama');
      expect(callArgs.schema).toBeDefined();
      
      expect(stats).toEqual(mockData);
    });

    it('should set OPENAI_BASE_URL correctly during extraction', async () => {
        let capturedBaseUrl;
        (extract as jest.Mock).mockImplementation(async () => {
            capturedBaseUrl = process.env.OPENAI_BASE_URL;
            return { data: {} };
        });

        // Config default is http://localhost:11434
        await service.extractStats('test');

        expect(capturedBaseUrl).toBe('http://localhost:11434/v1');
    });

    it('should throw error if extraction returns no data', async () => {
      (extract as jest.Mock).mockResolvedValue({ data: null });
      await expect(service.extractStats('text')).rejects.toThrow('Extraction returned no data');
    });
    
    it('should restore OPENAI_BASE_URL after extraction', async () => {
        process.env.OPENAI_BASE_URL = 'original';
        (extract as jest.Mock).mockResolvedValue({ data: {} });
        
        await service.extractStats('test');
        
        expect(process.env.OPENAI_BASE_URL).toBe('original');
    });
  });
});