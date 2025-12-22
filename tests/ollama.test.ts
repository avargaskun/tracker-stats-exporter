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
});
