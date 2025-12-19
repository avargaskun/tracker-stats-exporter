import { Unit3DClient } from '../src/tracker';
import { TrackerConfig } from '../src/config';

// Mock global fetch
global.fetch = jest.fn();

describe('Unit3DClient', () => {
  const config: TrackerConfig = {
    name: 'TEST',
    url: 'https://test.tracker',
    apiKey: 'abc',
    username: 'tester'
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
          torrents_seeding_count: 5
        }
      })
    });

    await client.getUserStats();

    expect(global.fetch).toHaveBeenCalledWith(
      'https://test.tracker/api/users/tester?api_token=abc',
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
          ratio: '2.0',
          bonus_points: '100',
          torrents_seeding_count: '10'
        }
      })
    });

    const stats = await client.getUserStats();
    expect(stats).toEqual({
      uploaded: 1000,
      downloaded: 500,
      ratio: 2.0,
      bonus_points: 100,
      seeding_count: 10
    });
  });

  it('should handle missing nesting (direct attributes)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        uploaded: 100,
        downloaded: 50,
        ratio: 2.0,
        bonus_points: 10,
        seeding_count: 1
      })
    });

    const stats = await client.getUserStats();
    expect(stats).toEqual({
      uploaded: 100,
      downloaded: 50,
      ratio: 2.0,
      bonus_points: 10,
      seeding_count: 1
    });
  });

  it('should handle alternative field names', async () => {
     (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          uploaded: 100,
          downloaded: 50,
          ratio: 2.0,
          seed_bonus: 500,
          seeding_count: 5
        }
      })
    });

    const stats = await client.getUserStats();
    expect(stats.bonus_points).toBe(500);
    expect(stats.seeding_count).toBe(5);
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
