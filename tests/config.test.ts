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

  it('should parse a single valid tracker config with default type', () => {
    process.env.TRACKER_TEST1_URL = 'https://test1.com';
    process.env.TRACKER_TEST1_API_KEY = 'key1';
    // Username is no longer required

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0]).toEqual({
      name: 'TEST1',
      url: 'https://test1.com',
      apiKey: 'key1',
      type: 'UNIT3D' // Defaults to UNIT3D
    });
  });

  it('should parse multiple valid tracker configs', () => {
    process.env.TRACKER_T1_URL = 'https://t1.com';
    process.env.TRACKER_T1_API_KEY = 'k1';
    process.env.TRACKER_T1_TYPE = 'UNIT3D';

    process.env.TRACKER_T2_URL = 'https://t2.com';
    process.env.TRACKER_T2_API_KEY = 'k2';
    // T2 defaults to UNIT3D

    const configs = parseConfig();
    expect(configs).toHaveLength(2);
    expect(configs.find(c => c.name === 'T1')).toBeDefined();
    expect(configs.find(c => c.name === 'T2')).toBeDefined();
  });

  it('should ignore incomplete configs for UNIT3D (missing apiKey)', () => {
    process.env.TRACKER_INC_URL = 'https://inc.com';
    process.env.TRACKER_INC_TYPE = 'UNIT3D';
    // Missing API_KEY for INC (required for UNIT3D)

    process.env.TRACKER_FULL_URL = 'https://full.com';
    process.env.TRACKER_FULL_API_KEY = 'k';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('FULL');
  });

  it('should ignore incomplete configs (missing URL)', () => {
    process.env.TRACKER_NOURL_API_KEY = 'k';

    const configs = parseConfig();
    expect(configs).toHaveLength(0);
  });

  it('should ignore unsupported types', () => {
    process.env.TRACKER_BAD_URL = 'https://bad.com';
    process.env.TRACKER_BAD_API_KEY = 'k';
    process.env.TRACKER_BAD_TYPE = 'UNSUPPORTED';

    process.env.TRACKER_GOOD_URL = 'https://good.com';
    process.env.TRACKER_GOOD_API_KEY = 'k';
    process.env.TRACKER_GOOD_TYPE = 'UNIT3D';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('GOOD');
  });

  it('should auto-detect DIGITALCORE type but exclude it for now (since we only support UNIT3D)', () => {
      process.env.TRACKER_DC_URL = 'https://digitalcore.club';
      process.env.TRACKER_DC_API_KEY = 'k';

      const configs = parseConfig();
      expect(configs).toHaveLength(0);
  });

  it('should auto-detect UNIT3D type', () => {
      process.env.TRACKER_U3_URL = 'https://some-unit3d-site.com';
      process.env.TRACKER_U3_API_KEY = 'k';

      const configs = parseConfig();
      expect(configs).toHaveLength(1);
      expect(configs[0].type).toBe('UNIT3D');
  });

  it('should ignore non-tracker env vars', () => {
    process.env.OTHER_VAR = 'something';
    process.env.TRACKER_VALID_URL = 'https://valid.com';
    process.env.TRACKER_VALID_API_KEY = 'k';

    const configs = parseConfig();
    expect(configs).toHaveLength(1);
    expect(configs[0].name).toBe('VALID');
  });

  it('should handle underscores in keys correctly', () => {
      process.env.TRACKER_MY_TRACKER_URL = 'https://my.com';
      process.env.TRACKER_MY_TRACKER_API_KEY = 'key';

      const configs = parseConfig();
      expect(configs).toHaveLength(1);
      expect(configs[0].name).toBe('MY_TRACKER');
  });
});
