import { ScrapingClient } from './scraping';
import { TrackerConfig, getFlareSolverrConfig } from '../config';
import http from 'http';
import { AddressInfo } from 'net';
import fs from 'fs';
import path from 'path';
import { solveChallenge } from '../utils/flaresolverr';

// Mock getFlareSolverrConfig to verify interaction
jest.mock('../config', () => {
    const actual = jest.requireActual('../config');
    return {
        ...actual,
        getFlareSolverrConfig: jest.fn()
    };
});

// Mock solveChallenge
jest.mock('../utils/flaresolverr', () => ({
    solveChallenge: jest.fn()
}));

const mockSolveChallenge = solveChallenge as jest.Mock;
const mockGetFlareSolverrConfig = getFlareSolverrConfig as jest.Mock;

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
            // Check for initial cookie or the updated cookie
            if (req.headers.cookie !== 'uid=123; pass=abc;' && req.headers.cookie !== 'uid=123; pass=new_pass') {
                res.writeHead(403);
                res.end('Unauthorized');
                return;
            }

            const headers: http.OutgoingHttpHeaders = { 'Content-Type': 'text/html' };

            // Emulate cookie rotation if a specific query param is set
            if (req.url?.includes('rotate')) {
                headers['Set-Cookie'] = 'pass=new_pass; Path=/; HttpOnly';
            }

            res.writeHead(200, headers);
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
        mockGetFlareSolverrConfig.mockReturnValue(undefined);
        mockSolveChallenge.mockReset();
    });

    it('should scrape and extract stats correctly', async () => {
        const stats = await client.getUserStats();
    
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

    it('should update and persist cookie when Set-Cookie header is received', async () => {
        const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-test-'));
        const cookieFile = path.join(tmpDir, 'cookie.txt');
        fs.writeFileSync(cookieFile, 'uid=123; pass=abc;');

        const config: TrackerConfig = {
            name: 'TestTrackerPersistence',
            url: `http://localhost:${port}/profile?rotate=true`,
            type: 'SCRAPING',
            cookie: 'uid=123; pass=abc;',
            cookieFile: cookieFile
        };

        const scrapingClient = new ScrapingClient(config);

        // First call triggers the rotation
        await scrapingClient.getUserStats();

        // Check if internal state updated
        expect((scrapingClient as any).config.cookie).toContain('pass=new_pass');

        // Check if file was updated
        const fileContent = fs.readFileSync(cookieFile, 'utf8');
        expect(fileContent).toContain('pass=new_pass');

        // Cleanup
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should use the configured User-Agent', async () => {
        const customUA = 'MyCustomUserAgent/1.0';
        process.env.SCRAPING_USER_AGENT = customUA;

        let capturedUserAgent = '';

        const uaServer = http.createServer((req, res) => {
            capturedUserAgent = req.headers['user-agent'] || '';
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(sampleHtml);
        });

        await new Promise<void>((resolve) => {
            uaServer.listen(0, () => {
                const uaPort = (uaServer.address() as AddressInfo).port;
                const config: TrackerConfig = {
                    name: 'TestTrackerUA',
                    url: `http://localhost:${uaPort}/profile`,
                    type: 'SCRAPING',
                    cookie: 'uid=123; pass=abc;'
                };
                client = new ScrapingClient(config);
                resolve();
            });
        });

        await client.getUserStats();

        expect(capturedUserAgent).toBe(customUA);

        uaServer.close();
        delete process.env.SCRAPING_USER_AGENT;
    });

    describe('FlareSolverr Integration', () => {
        it('should call FlareSolverr on 403 when configured', async () => {
            const badConfig: TrackerConfig = {
                name: 'TestTrackerFS',
                url: `http://localhost:${port}/profile`,
                type: 'SCRAPING',
                cookie: 'bad=cookie;' // Causes 403
            };
            const fsClient = new ScrapingClient(badConfig);

            mockGetFlareSolverrConfig.mockReturnValue({
                url: 'http://flaresolverr:8191/v1',
                timeout: 30000
            });

            mockSolveChallenge.mockResolvedValue({
                html: sampleHtml,
                cookies: [{ name: 'uid', value: '123' }, { name: 'pass', value: 'abc' }]
            });

            const stats = await fsClient.getUserStats();

            expect(mockSolveChallenge).toHaveBeenCalledWith(
                'http://flaresolverr:8191/v1',
                badConfig.url,
                30000,
                'bad=cookie;',
                undefined
            );

            expect(stats.uploaded).toBeGreaterThan(0);
        });

        it('should throw if FlareSolverr fails', async () => {
            const badConfig: TrackerConfig = {
                name: 'TestTrackerFS',
                url: `http://localhost:${port}/profile`,
                type: 'SCRAPING',
                cookie: 'bad=cookie;'
            };
            const fsClient = new ScrapingClient(badConfig);

            mockGetFlareSolverrConfig.mockReturnValue({
                url: 'http://flaresolverr:8191/v1',
                timeout: 30000
            });

            mockSolveChallenge.mockRejectedValue(new Error('FS Timeout'));

            await expect(fsClient.getUserStats()).rejects.toThrow('Failed to fetch page from TestTrackerFS (403) and FlareSolverr failed');
        });

        it('should not call FlareSolverr if not configured', async () => {
            const badConfig: TrackerConfig = {
                name: 'TestTrackerFS',
                url: `http://localhost:${port}/profile`,
                type: 'SCRAPING',
                cookie: 'bad=cookie;'
            };
            const fsClient = new ScrapingClient(badConfig);

            mockGetFlareSolverrConfig.mockReturnValue(undefined);

            await expect(fsClient.getUserStats()).rejects.toThrow('Failed to fetch page');
            expect(mockSolveChallenge).not.toHaveBeenCalled();
        });
    });
});
