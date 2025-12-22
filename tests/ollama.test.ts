import { OllamaService } from '../src/services/ollama';
import { Ollama } from 'ollama';

// Proper Jest mock for ES modules/classes
jest.mock('ollama');

describe('OllamaService', () => {
  let service: OllamaService;
  let mockOllamaInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Instantiate service which creates the Ollama instance
    service = new OllamaService();

    // Get the mocked instance
    mockOllamaInstance = (Ollama as unknown as jest.Mock).mock.instances[0];
  });

  it('should check connection successfully', async () => {
    mockOllamaInstance.list.mockResolvedValue({ models: [] });

    const result = await service.checkConnection();

    expect(result).toBe(true);
    expect(mockOllamaInstance.list).toHaveBeenCalled();
  });

  it('should handle connection failure', async () => {
    mockOllamaInstance.list.mockRejectedValue(new Error('Connection failed'));

    const result = await service.checkConnection();

    expect(result).toBe(false);
  });

  it('should extract stats correctly', async () => {
    const mockResponse = {
      response: JSON.stringify({
        uploaded: '1.5 TB',
        downloaded: '500 GB',
        ratio: '3.0'
      })
    };
    mockOllamaInstance.generate.mockResolvedValue(mockResponse);

    const stats = await service.extractStats('some markdown text');

    expect(stats.uploaded).toBe('1.5 TB');
    expect(stats.downloaded).toBe('500 GB');
    expect(stats.ratio).toBe('3');
    expect(mockOllamaInstance.generate).toHaveBeenCalledWith(expect.objectContaining({
      prompt: expect.stringContaining('You are a data extractor'),
      format: 'json'
    }));
  });

  it('should handle infinite ratio', async () => {
    const mockResponse = {
      response: JSON.stringify({
        uploaded: '1.0 TB',
        downloaded: '0 B',
        ratio: 'Inf.'
      })
    };
    mockOllamaInstance.generate.mockResolvedValue(mockResponse);

    const stats = await service.extractStats('text');
    expect(stats.ratio).toBe('0');
  });

  it('should throw error on invalid JSON', async () => {
    mockOllamaInstance.generate.mockResolvedValue({ response: 'Invalid JSON' });
    await expect(service.extractStats('text')).rejects.toThrow();
  });
});
