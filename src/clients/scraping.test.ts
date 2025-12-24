import { ScrapingClient } from './scraping';
import { TrackerConfig } from '../config';
import http from 'http';
import { AddressInfo } from 'net';

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
      <span>Seeding: 12</span>
      <span>Leeching: 0</span>
      <span>Hit and Run: 0</span>
      <span>Bonus Points: 1,234.56</span>
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
    const config: TrackerConfig = {
      name: 'TestTracker',
      url: `http://localhost:${port}/profile`,
      type: 'SCRAPING',
      cookie: 'uid=123; pass=abc;'
    };

    client = new ScrapingClient(config);
  });

  it('should scrape and extract stats correctly', async () => {
    const stats = await client.getUserStats();

    // 3.03 TB = 3.03 * 1024^4 = 3,331,525,833,523
    // 575.67 GB = 575.67 * 1024^3 = 618,138,574,356
    
    // We expect approximate values due to float math, or we can check parsing logic from extractor
    // extractor.ts uses 1024 based multipliers.
    
    const expectedUploaded = Math.floor(3.03 * (1024 ** 4));
    const expectedDownloaded = Math.floor(575.67 * (1024 ** 3));

    expect(stats.uploaded).toBe(expectedUploaded);
    expect(stats.downloaded).toBe(expectedDownloaded);
    expect(stats.ratio).toBe(5.39);
    expect(stats.seeding).toBe(12);
    expect(stats.leeching).toBe(0);
    expect(stats.hitAndRuns).toBe(0);
    expect(stats.bonus).toBe(1234.56);
  });

  it('should handle cookie authentication', async () => {
    // If we change the cookie in the config, the server should return 403
    const badConfig: TrackerConfig = {
        name: 'TestTracker',
        url: `http://localhost:${port}/profile`,
        type: 'SCRAPING',
        cookie: 'bad=cookie;'
    };
    const badClient = new ScrapingClient(badConfig);

    await expect(badClient.getUserStats()).rejects.toThrow('Failed to fetch page from TestTracker: 403 Forbidden');
  });
});