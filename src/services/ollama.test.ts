import { OllamaService } from './ollama';
import { Ollama } from 'ollama';

// Proper Jest mock for ES modules/classes
jest.mock('ollama');

describe('OllamaService', () => {
  let service: OllamaService;
  let mockOllamaInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset singleton instance for testing isolation
    (OllamaService as any).instance = undefined;
    
    // Instantiate service which creates the Ollama instance
    service = OllamaService.getInstance();

    // Get the mocked instance
    mockOllamaInstance = (Ollama as unknown as jest.Mock).mock.instances[0];
  });

  describe('ensureModelAndConnection', () => {
    
    it('should not pull if model exists', async () => {
      // Mock list returning the model (default is gemma3:270m)
      mockOllamaInstance.list.mockResolvedValue({ 
        models: [{ name: 'gemma3:270m' }] 
      });

      await service.ensureModelAndConnection();

      expect(mockOllamaInstance.list).toHaveBeenCalled();
      expect(mockOllamaInstance.pull).not.toHaveBeenCalled();
    });

    it('should pull if model is missing', async () => {
      // Mock list returning empty or other models
      mockOllamaInstance.list.mockResolvedValue({ models: [{ name: 'other:model' }] });

      // Mock pull returning an async iterator
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
  })

  describe('extractStats', () => {

    it('should extract stats correctly', async () => {
      const mockResponse = {
        response: JSON.stringify({
          uploaded: 1.5,
          uploaded_units: 'TB',
          downloaded: 500,
          downloaded_units: 'GiB',
          ratio: 3.0
        })
      };
      mockOllamaInstance.generate.mockResolvedValue(mockResponse);
  
      const stats = await service.extractStats('some markdown text');
  
      expect(stats.uploaded).toBe(1.5);
      expect(stats.uploaded_units).toBe("TB");
      expect(stats.downloaded).toBe(500);
      expect(stats.downloaded_units).toBe("GiB");
      expect(stats.ratio).toBe(3);
      expect(mockOllamaInstance.generate).toHaveBeenCalledTimes(2);
    });
  
    it('should throw error on invalid JSON', async () => {
      mockOllamaInstance.generate.mockResolvedValue({ response: 'Invalid JSON' });
      await expect(service.extractStats('text')).rejects.toThrow();
    });

  })
});
