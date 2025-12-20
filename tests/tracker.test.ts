import { Unit3DClient } from '../src/tracker';
import { TrackerConfig } from '../src/config';

// Mock global fetch
global.fetch = jest.fn();

describe('Unit3DClient', () => {
  const config: TrackerConfig = {
    name: 'TEST',
    url: 'https://test.tracker',
    apiKey: 'abc',
    type: 'UNIT3D'
  };

  const client = new Unit3DClient(config);

  beforeEach(() => {
    (global.fetch as jest.Mock).mockClear();
  });

  it('should construct correct API URL', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          uploaded: 100,
          downloaded: 50,
          ratio: 2.0,
          bonus_points: 1000,
          seeding: 5,
          leeching: 0,
          buffer: 100,
          hit_and_runs: 0
        }
      })
    });

    await client.getUserStats();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.tracker/api/user?api_token=abc',
      expect.objectContaining({
        headers: { 'Accept': 'application/json' }
      })
    );
  });

  it('should parse bytes from strings', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          uploaded: '1000',
          downloaded: '500',
          buffer: '100',
          ratio: '2.0',
          bonus_points: '100',
          seeding: '10',
          leeching: '2',
          hit_and_runs: '1'
        }
      })
    });

    const stats = await client.getUserStats();
    expect(stats).toEqual({
      uploaded: 1000,
      downloaded: 500,
      buffer: 100,
      ratio: 2.0,
      seedbonus: 100,
      seeding: 10,
      leeching: 2,
      hit_and_runs: 1
    });
  });

  it('should parse bytes with units', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          uploaded: '1 KiB', // 1024
          downloaded: '512 B', // 512
          buffer: '1 KB', // 1000 or 1024 depending on lib, bytes uses 1000 for KB usually unless options but let's check basic
          // actually bytes('1KB') is 1024. bytes('1kB') is 1000? No 'bytes' lib standard.
          // Let's stick to simple ones or rely on library correctness.
          ratio: '2.0',
          bonus_points: '100',
          seeding: 0,
          leeching: 0,
          hit_and_runs: 0
        }
      })
    });

    const stats = await client.getUserStats();
    expect(stats.uploaded).toBe(1024);
  });

  it('should handle missing nesting (direct attributes)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploaded: 100,
        downloaded: 50,
        buffer: 10,
        ratio: 2.0,
        bonus_points: 10,
        seeding: 1,
        leeching: 0,
        hit_and_runs: 0
      })
    });

    const stats = await client.getUserStats();
    expect(stats).toEqual({
      uploaded: 100,
      downloaded: 50,
      buffer: 10,
      ratio: 2.0,
      seedbonus: 10,
      seeding: 1,
      leeching: 0,
      hit_and_runs: 0
    });
  });

  it('should handle alternative field names', async () => {
     (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          uploaded: 100,
          downloaded: 50,
          buffer: 0,
          ratio: 2.0,
          seed_bonus: 500,
          seeding: 5,
          leeching: 1,
          hit_and_runs: 0
        }
      })
    });

    const stats = await client.getUserStats();
    expect(stats.seedbonus).toBe(500);
    expect(stats.seeding).toBe(5);
  });

  it('should throw error on failed fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    });

    await expect(client.getUserStats()).rejects.toThrow('Failed to fetch stats from TEST: 404 Not Found');
  });
});
