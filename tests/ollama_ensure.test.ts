import { OllamaService } from '../src/services/ollama';
import { Ollama } from 'ollama';

jest.mock('ollama');

describe('OllamaService - ensureModelAndConnection', () => {
  let service: OllamaService;
  let mockOllamaInstance: any;

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-instantiate to ensure fresh mock
    (OllamaService as any).instance = undefined;
    service = OllamaService.getInstance();
    mockOllamaInstance = (Ollama as unknown as jest.Mock).mock.instances[0];
  });

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
});
