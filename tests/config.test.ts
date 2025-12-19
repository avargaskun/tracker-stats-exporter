import { parseConfig } from '../src/config';

describe('Config Parser', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should parse a single valid tracker config', () => {
    process.env.TRACKER_TEST1_URL = 'https://test1.com';
    process.env.TRACKER_TEST1_API_KEY = 'key1';
    process.env.TRACKER_TEST1_USERNAME = 'user1';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual({
      name: 'TEST1',
      url: 'https://test1.com',
      apiKey: 'key1',
      username: 'user1'
    });
  });

  it('should parse multiple valid tracker configs', () => {
    process.env.TRACKER_T1_URL = 'https://t1.com';
    process.env.TRACKER_T1_API_KEY = 'k1';
    process.env.TRACKER_T1_USERNAME = 'u1';

    process.env.TRACKER_T2_URL = 'https://t2.com';
    process.env.TRACKER_T2_API_KEY = 'k2';
    process.env.TRACKER_T2_USERNAME = 'u2';

    const configs = parseConfig();
    expect(configs).toHaveLength(2);
    expect(configs.find(c => c.name === 'T1')).toBeDefined();
    expect(configs.find(c => c.name === 'T2')).toBeDefined();
  });

  it('should ignore incomplete configs', () => {
    process.env.TRACKER_INC_URL = 'https://inc.com';
    // Missing API_KEY and USERNAME for INC

    process.env.TRACKER_FULL_URL = 'https://full.com';
    process.env.TRACKER_FULL_API_KEY = 'k';
    process.env.TRACKER_FULL_USERNAME = 'u';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('FULL');
  });

  it('should ignore non-tracker env vars', () => {
    process.env.OTHER_VAR = 'something';
    process.env.TRACKER_VALID_URL = 'https://valid.com';
    process.env.TRACKER_VALID_API_KEY = 'k';
    process.env.TRACKER_VALID_USERNAME = 'u';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('VALID');
  });

  it('should handle underscores in keys correctly', () => {
      // The logic relies on suffix matching, so this should work even if NAME has underscores,
      // IF the suffix matching is robust.
      // E.g. TRACKER_MY_TRACKER_URL
      // name = MY_TRACKER
      process.env.TRACKER_MY_TRACKER_URL = 'https://my.com';
      process.env.TRACKER_MY_TRACKER_API_KEY = 'key';
      process.env.TRACKER_MY_TRACKER_USERNAME = 'user';

      const configs = parseConfig();
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe('MY_TRACKER');
  });
});
