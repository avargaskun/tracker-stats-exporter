import { getExporterConfig, getFetchConcurrency, getFetchRetries, getRequestTimeout, parseConfig } from './config';
import fs from 'fs';

jest.mock('fs');

describe('Exporter Configuration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.resetModules();
        process.env = {};
        jest.clearAllMocks();
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    describe('getExporterConfig', () => {
        test('should return default values when no environment variables are set', () => {
            const config = getExporterConfig();
            expect(config.port).toBe(9100);
            expect(config.metricsPath).toBe('/metrics');
            expect(config.cacheDuration).toBe(15 * 60 * 1000); // 15m
        });

        test('should parse EXPORTER_PORT correctly', () => {
            process.env.EXPORTER_PORT = '8080';
            const config = getExporterConfig();
            expect(config.port).toBe(8080);
        });

        test('should parse EXPORTER_PATH correctly', () => {
            process.env.EXPORTER_PATH = '/custom-metrics';
            const config = getExporterConfig();
            expect(config.metricsPath).toBe('/custom-metrics');
        });

        test('should parse STATS_TTL correctly (e.g. 10m)', () => {
            process.env.STATS_TTL = '10m';
            const config = getExporterConfig();
            expect(config.cacheDuration).toBe(10 * 60 * 1000);
        });

        test('should enforce minimum 5m for STATS_TTL', () => {
            process.env.STATS_TTL = '1m';
            const config = getExporterConfig();
            expect(config.cacheDuration).toBe(5 * 60 * 1000);
        });

        test('should use default if STATS_TTL is invalid', () => {
            process.env.STATS_TTL = 'invalid';
            const config = getExporterConfig();
            expect(config.cacheDuration).toBe(15 * 60 * 1000);
        });

        test('should use default if STATS_TTL is undefined', () => {
            delete process.env.STATS_TTL;
            const config = getExporterConfig();
            expect(config.cacheDuration).toBe(15 * 60 * 1000);
        });
    });

    describe('getRequestTimeout', () => {
        test('should default to 30s when REQUEST_TIMEOUT is unset', () => {
            delete process.env.REQUEST_TIMEOUT;
            expect(getRequestTimeout()).toBe(30000);
        });

        test('should parse a valid duration string', () => {
            process.env.REQUEST_TIMEOUT = '45s';
            expect(getRequestTimeout()).toBe(45000);
        });

        test('should fall back to default on an invalid value', () => {
            process.env.REQUEST_TIMEOUT = 'not-a-duration';
            expect(getRequestTimeout()).toBe(30000);
        });
    });

    describe('getFetchConcurrency', () => {
        test('should default to 2 when FETCH_CONCURRENCY is unset', () => {
            delete process.env.FETCH_CONCURRENCY;
            expect(getFetchConcurrency()).toBe(2);
        });

        test('should parse a positive integer', () => {
            process.env.FETCH_CONCURRENCY = '1';
            expect(getFetchConcurrency()).toBe(1);
        });

        test('should fall back to default on a non-positive value', () => {
            process.env.FETCH_CONCURRENCY = '0';
            expect(getFetchConcurrency()).toBe(2);
        });

        test('should fall back to default on a non-numeric value', () => {
            process.env.FETCH_CONCURRENCY = 'abc';
            expect(getFetchConcurrency()).toBe(2);
        });
    });

    describe('getFetchRetries', () => {
        test('should default to 3 when FETCH_RETRIES is unset', () => {
            delete process.env.FETCH_RETRIES;
            expect(getFetchRetries()).toBe(3);
        });

        test('should parse a positive integer', () => {
            process.env.FETCH_RETRIES = '5';
            expect(getFetchRetries()).toBe(5);
        });

        test('should allow 0 to disable retries', () => {
            process.env.FETCH_RETRIES = '0';
            expect(getFetchRetries()).toBe(0);
        });

        test('should fall back to default on a negative value', () => {
            process.env.FETCH_RETRIES = '-1';
            expect(getFetchRetries()).toBe(3);
        });

        test('should fall back to default on a non-numeric value', () => {
            process.env.FETCH_RETRIES = 'abc';
            expect(getFetchRetries()).toBe(3);
        });
    });

    describe('parseConfig', () => {
        test('should parse basic tracker config', () => {
            process.env.TRACKER_TEST_URL = 'https://test.com';
            process.env.TRACKER_TEST_API_KEY = 'key123';
        
            const configs = parseConfig();
            expect(configs).toHaveLength(1);
            expect(configs[0]).toEqual({
                name: 'TEST',
                url: 'https://test.com',
                apiKey: 'key123',
                type: 'UNIT3D'
            });
        });

        test('should parse scraping tracker with cookie', () => {
            process.env.TRACKER_SCRAPE_URL = 'https://scrape.com';
            process.env.TRACKER_SCRAPE_TYPE = 'SCRAPING';
            process.env.TRACKER_SCRAPE_COOKIE = 'session=123';
        
            const configs = parseConfig();
            expect(configs).toHaveLength(1);
            expect(configs[0].cookie).toBe('session=123');
        });

        test('should parse scraping tracker with cookie file', () => {
            process.env.TRACKER_SCRAPE_URL = 'https://scrape.com';
            process.env.TRACKER_SCRAPE_TYPE = 'SCRAPING';
            process.env.TRACKER_SCRAPE_COOKIE_FILE = '/path/to/cookie.txt';
        
            (fs.readFileSync as jest.Mock).mockReturnValue('cookie-from-file\n');
        
            const configs = parseConfig();
            expect(configs).toHaveLength(1);
            expect(configs[0].cookie).toBe('cookie-from-file');
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/cookie.txt', 'utf8');
        });

        test('cookie file should take precedence over cookie env var', () => {
            process.env.TRACKER_SCRAPE_URL = 'https://scrape.com';
            process.env.TRACKER_SCRAPE_TYPE = 'SCRAPING';
            process.env.TRACKER_SCRAPE_COOKIE = 'direct-cookie';
            process.env.TRACKER_SCRAPE_COOKIE_FILE = '/path/to/cookie.txt';
        
            (fs.readFileSync as jest.Mock).mockReturnValue('file-cookie');
        
            const configs = parseConfig();
            expect(configs[0].cookie).toBe('file-cookie');
        });

        test('should skip scraping tracker if cookie and cookie file are missing', () => {
            process.env.TRACKER_SCRAPE_URL = 'https://scrape.com';
            process.env.TRACKER_SCRAPE_TYPE = 'SCRAPING';
        
            const configs = parseConfig();
            expect(configs).toHaveLength(0);
        });

        test('should parse tracker with api key file', () => {
            process.env.TRACKER_TEST_URL = 'https://test.com';
            process.env.TRACKER_TEST_API_KEY_FILE = '/path/to/key.txt';

            (fs.readFileSync as jest.Mock).mockReturnValue('key-from-file\n');

            const configs = parseConfig();
            expect(configs).toHaveLength(1);
            expect(configs[0]).toMatchObject({
                name: 'TEST',
                url: 'https://test.com',
                apiKey: 'key-from-file',
                type: 'UNIT3D'
            });
            expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/key.txt', 'utf8');
        });

        test('api key file should take precedence over api key env var', () => {
            process.env.TRACKER_TEST_URL = 'https://test.com';
            process.env.TRACKER_TEST_API_KEY = 'direct-key';
            process.env.TRACKER_TEST_API_KEY_FILE = '/path/to/key.txt';

            (fs.readFileSync as jest.Mock).mockReturnValue('file-key');

            const configs = parseConfig();
            expect(configs[0].apiKey).toBe('file-key');
        });
    });
});
