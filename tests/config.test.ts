import { getExporterConfig } from '../src/config';

describe('Exporter Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

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
