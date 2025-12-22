import { PrometheusExporter } from '../src/exporter';
import { TrackerConfig } from '../src/config';
import { createTrackerClient } from '../src/clients/tracker';

// Mock createTrackerClient
jest.mock('../src/clients/tracker');

describe('PrometheusExporter', () => {
  const configs: TrackerConfig[] = [{
    name: 'TEST',
    url: 'https://test.com',
    apiKey: 'key',
    type: 'UNIT3D'
  }];

  beforeEach(() => {
    process.env.STATS_TTL = '5m'; // Force 5m cache for tests
    (createTrackerClient as jest.Mock).mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    delete process.env.STATS_TTL;
    jest.useRealTimers();
  });

  it('should initialize gauges and update metrics', async () => {
    // Setup mock return value
    const mockGetUserStats = jest.fn().mockResolvedValue({
      uploaded: 1000,
      downloaded: 500,
      buffer: 500,
      ratio: 2.0,
      seedbonus: 100,
      seeding: 5,
      leeching: 1,
      hit_and_runs: 0
    });

    (createTrackerClient as jest.Mock).mockImplementation(() => ({
      getUserStats: mockGetUserStats
    }));

    const exporter = new PrometheusExporter(configs);
    await exporter.updateMetrics();

    expect(mockGetUserStats).toHaveBeenCalled();
  });

  it('should use cached metrics if called within cache duration', async () => {
    const mockGetUserStats = jest.fn().mockResolvedValue({
      uploaded: 1000,
      downloaded: 500,
      buffer: 0,
      ratio: 2.0,
      seedbonus: 100,
      seeding: 5,
      leeching: 0,
      hit_and_runs: 0
    });

    (createTrackerClient as jest.Mock).mockImplementation(() => ({
      getUserStats: mockGetUserStats
    }));

    const exporter = new PrometheusExporter(configs);

    // First call: should fetch
    await exporter.updateMetrics();
    expect(mockGetUserStats).toHaveBeenCalledTimes(1);

    // Advance time by 4 minutes (less than 5 min cache)
    jest.advanceTimersByTime(4 * 60 * 1000);

    // Second call: should use cache
    await exporter.updateMetrics();
    expect(mockGetUserStats).toHaveBeenCalledTimes(1);

    // Advance time by another 2 minutes (total 6 minutes)
    jest.advanceTimersByTime(2 * 60 * 1000);

    // Third call: should fetch again
    await exporter.updateMetrics();
    expect(mockGetUserStats).toHaveBeenCalledTimes(2);
  });

  it('should handle update errors gracefully', async () => {
     const mockGetUserStats = jest.fn().mockRejectedValue(new Error('Fetch failed'));

    (createTrackerClient as jest.Mock).mockImplementation(() => ({
      getUserStats: mockGetUserStats
    }));

    const exporter = new PrometheusExporter(configs);
    await expect(exporter.updateMetrics()).resolves.not.toThrow();
  });
});
