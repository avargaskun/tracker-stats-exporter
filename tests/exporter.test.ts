import { PrometheusExporter } from '../src/exporter';
import { TrackerConfig } from '../src/config';
import { Unit3DClient } from '../src/tracker';
import { Registry } from 'prom-client';

// Mock Unit3DClient
jest.mock('../src/tracker');

describe('PrometheusExporter', () => {
  const configs: TrackerConfig[] = [{
    name: 'TEST',
    url: 'https://test.com',
    apiKey: 'key',
    username: 'user'
  }];

  beforeEach(() => {
    (Unit3DClient as jest.Mock).mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should initialize gauges and update metrics', async () => {
    // Setup mock return value
    const mockGetUserStats = jest.fn().mockResolvedValue({
      uploaded: 1000,
      downloaded: 500,
      ratio: 2.0,
      bonus_points: 100,
      seeding_count: 5
    });

    (Unit3DClient as jest.Mock).mockImplementation(() => ({
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
      ratio: 2.0,
      bonus_points: 100,
      seeding_count: 5
    });

    (Unit3DClient as jest.Mock).mockImplementation(() => ({
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

    (Unit3DClient as jest.Mock).mockImplementation(() => ({
      getUserStats: mockGetUserStats
    }));

    const exporter = new PrometheusExporter(configs);
    await expect(exporter.updateMetrics()).resolves.not.toThrow();
  });
});
