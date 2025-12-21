import { Unit3DClient } from '../src/tracker';
import { TrackerConfig, resetProxyAgent } from '../src/config';
import * as http from 'http';
import { AddressInfo } from 'net';

describe('Proxy Behavior', () => {
    let trackerServer: http.Server;
    let proxyServer: http.Server;
    let trackerUrl: string;
    let proxyUrl: string;
    let proxyHit: boolean;

    beforeAll((done) => {
        // Setup Mock Tracker Server
        trackerServer = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                data: {
                    uploaded: '100 GB',
                    downloaded: '50 GB',
                    ratio: '2.0',
                    seedbonus: '1000',
                    seeding: '5',
                    leeching: '1',
                    buffer: '50 GB',
                    hit_and_runs: '0'
                }
            }));
        });
        trackerServer.listen(0, () => {
            const port = (trackerServer.address() as AddressInfo).port;
            trackerUrl = `http://127.0.0.1:${port}`;
            
            // Setup Mock Proxy Server
            proxyServer = http.createServer((req, res) => {
                proxyHit = true;
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    data: {
                        uploaded: '100 GB',
                        downloaded: '50 GB',
                        ratio: '2.0',
                        seedbonus: '1000',
                        seeding: '5',
                        leeching: '1',
                        buffer: '50 GB',
                        hit_and_runs: '0'
                    }
                }));
            });

            proxyServer.on('connect', (req, socket, head) => {
                proxyHit = true;
                socket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
                
                // For this test, we simulate the "Tunnel" by responding directly on the socket
                // as if we were the target server.
                // We wait for the client to send the request through the tunnel.
                socket.once('data', (chunk) => {
                    // console.log('Proxy tunnel received data:', chunk.toString());
                    socket.write('HTTP/1.1 200 OK\r\n');
                    socket.write('Content-Type: application/json\r\n\r\n');
                    socket.write(JSON.stringify({
                        data: {
                            uploaded: '100 GB',
                            downloaded: '50 GB',
                            ratio: '2.0',
                            seedbonus: '1000',
                            seeding: '5',
                            leeching: '1',
                            buffer: '50 GB',
                            hit_and_runs: '0'
                        }
                    }));
                    socket.end();
                });
            });

            proxyServer.listen(0, () => {
                const proxyPort = (proxyServer.address() as AddressInfo).port;
                proxyUrl = `http://127.0.0.1:${proxyPort}`;
                done();
            });
        });
    });

    afterAll((done) => {
        trackerServer.close(() => {
            proxyServer.close(done);
        });
    });

    beforeEach(() => {
        proxyHit = false;
        delete process.env.PROXY_URL;
        resetProxyAgent();
    });

    test('(1) Request goes through without proxy when PROXY_URL is not specified', async () => {
        const config: TrackerConfig = {
            name: 'TestTracker',
            url: trackerUrl,
            apiKey: '12345',
            type: 'UNIT3D'
        };

        const client = new Unit3DClient(config);
        const stats = await client.getUserStats();

        expect(stats.uploaded).toBeGreaterThan(0);
        expect(proxyHit).toBe(false);
    });

    test('(2) Request goes through proxy when PROXY_URL is set', async () => {
        process.env.PROXY_URL = proxyUrl;

        const config: TrackerConfig = {
            name: 'TestTracker',
            url: trackerUrl, // In a real proxy scenario, this would be the target
            apiKey: '12345',
            type: 'UNIT3D'
        };
        
        // Note: For this test to pass, the client MUST use the proxy.
        // If it ignores PROXY_URL, it will hit the trackerServer directly 
        // (which is running), so stats will be returned, BUT proxyHit will be false.
        
        // We actually want the client to hit the proxyServer.
        // If we want to strictly prove it went through proxy, we can make the trackerServer
        // reject connections or check headers?
        // But checking `proxyHit` variable on our mock proxy is the most direct way.

        const client = new Unit3DClient(config);
        const stats = await client.getUserStats();

        expect(stats.uploaded).toBeGreaterThan(0);
        expect(proxyHit).toBe(true);
    }, 10000);

    test('(3) Request fails when PROXY_URL is set to an unreachable address', async () => {
        // Set to a port that is likely closed
        process.env.PROXY_URL = 'http://127.0.0.1:54321';

        const config: TrackerConfig = {
            name: 'TestTracker',
            url: trackerUrl,
            apiKey: '12345',
            type: 'UNIT3D'
        };

        const client = new Unit3DClient(config);
        
        await expect(client.getUserStats()).rejects.toThrow();
    });
});
