import { ScrapingClient } from './scraping';
import { OllamaService } from '../services/ollama';
import { TrackerConfig } from '../config';
import http from 'http';
import { AddressInfo } from 'net';

// Mock OllamaService class
jest.mock('../services/ollama');

// Define mock functions outside
const mockExtractStats = jest.fn();
const mockCheckConnection = jest.fn();

describe('ScrapingClient Integration', () => {
  let server: http.Server;
  let port: number;
  let client: ScrapingClient;

  const sampleHtml = `
  <html>
  <head><title>User Profile</title></head>
  <body>
    <div id="stats">
      <span>Uploaded: 3.03 TB</span>
      <span>Downloaded: 575.67 GB</span>
      <span>Ratio: 5.39</span>
    </div>
  </body>
  </html>
  `;

  beforeAll((done) => {
    // Start a local server to serve the sample HTML
    server = http.createServer((req, res) => {
      if (req.headers.cookie !== 'uid=123; pass=abc;') {
        res.writeHead(403);
        res.end('Unauthorized');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(sampleHtml);
    });

    server.listen(0, () => {
      port = (server.address() as AddressInfo).port;
      done();
    });
  });

  afterAll((done) => {
    server.close(done);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup Mock Implementation
    const MockOllamaService = OllamaService as unknown as jest.Mock;
    
    const mockInstance = {
      checkConnection: mockCheckConnection.mockResolvedValue(true),
      extractStats: mockExtractStats
    };

    // Mock static getInstance
    (MockOllamaService as any).getInstance = jest.fn().mockReturnValue(mockInstance);

    const config: TrackerConfig = {
      name: 'TestTracker',
      url: `http://localhost:${port}/profile`,
      type: 'SCRAPING',
      cookie: 'uid=123; pass=abc;'
    };

    client = new ScrapingClient(config);
  });

  it('should scrape and extract stats correctly', async () => {
    // Mock the Ollama response
    mockExtractStats.mockResolvedValue({
      uploaded: 3.03,
      uploaded_units: 'TB',
      downloaded: 575.67,
      downloaded_units: 'GB',
      ratio: 5.39
    });

    const stats = await client.getUserStats();

    // Verify request went to Ollama
    expect(mockExtractStats).toHaveBeenCalled();
    const calledWithMarkdown = mockExtractStats.mock.calls[0][0];
    expect(calledWithMarkdown).toContain('Uploaded: 3.03 TB');

    // Verify byte conversion
    expect(stats.uploaded).toBeGreaterThan(3000000000000);
    expect(stats.downloaded).toBeGreaterThan(500000000000);
    expect(stats.ratio).toBe(5.39);
  });

  it('should handle cookie authentication', async () => {
    mockExtractStats.mockResolvedValue({
      uploaded: 3.03,
      uploaded_units: 'TB',
      downloaded: 575.67,
      downloaded_units: 'GB',
      ratio: 5.39
    });

    // If we change the cookie in the config, the server should return 403
    const badConfig: TrackerConfig = {
        name: 'TestTracker',
        url: `http://localhost:${port}/profile`,
        type: 'SCRAPING',
        cookie: 'bad=cookie;'
    };
    const badClient = new ScrapingClient(badConfig);

    await expect(badClient.getUserStats()).rejects.toThrow('Failed to fetch page');
  });
});
