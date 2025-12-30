import { solveChallenge } from './flaresolverr';
import { fetch } from 'undici';
import { getLogger } from '../logger';

// Mock dependencies
jest.mock('undici', () => ({
    fetch: jest.fn()
}));
jest.mock('../logger', () => ({
    getLogger: jest.fn().mockReturnValue({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
    })
}));

const mockFetch = fetch as jest.Mock;

describe('solveChallenge', () => {
    const serviceUrl = 'http://localhost:8191/v1';
    const targetUrl = 'http://example.com';
    const timeout = 60000;
    const cookies = 'foo=bar';

    beforeEach(() => {
        mockFetch.mockReset();
    });

    it('should successfully solve challenge and return html and cookies', async () => {
        const mockResponse = {
            status: 'ok',
            solution: {
                response: '<html>Success</html>',
                cookies: [{ name: 'baz', value: 'qux' }],
                status: 200
            }
        };

        mockFetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const result = await solveChallenge(serviceUrl, targetUrl, timeout, cookies);

        expect(result.html).toBe('<html>Success</html>');
        expect(result.cookies).toEqual([{ name: 'baz', value: 'qux' }]);

        expect(mockFetch).toHaveBeenCalledWith(serviceUrl, expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('"cmd":"request.get"')
        }));
    });

    it('should include proxy in payload if provided', async () => {
        const mockResponse = {
            status: 'ok',
            solution: { response: 'html', cookies: [], status: 200 }
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        const proxy = { url: 'http://1.2.3.4:8080' };
        await solveChallenge(serviceUrl, targetUrl, timeout, cookies, proxy);

        expect(mockFetch).toHaveBeenCalledWith(serviceUrl, expect.objectContaining({
            body: expect.stringContaining('"proxy":{"url":"http://1.2.3.4:8080"}')
        }));
    });

    it('should throw if FlareSolverr returns error status', async () => {
        const mockResponse = {
            status: 'error',
            message: 'Browser crashed'
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        await expect(solveChallenge(serviceUrl, targetUrl, timeout, cookies))
            .rejects.toThrow('FlareSolverr failed: Browser crashed');
    });

    it('should throw if target site returns error status', async () => {
        const mockResponse = {
            status: 'ok',
            solution: {
                response: '<html>Error</html>',
                cookies: [],
                status: 403
            }
        };
        mockFetch.mockResolvedValue({
            ok: true,
            json: jest.fn().mockResolvedValue(mockResponse)
        });

        await expect(solveChallenge(serviceUrl, targetUrl, timeout, cookies))
            .rejects.toThrow('Target site returned 403 after FlareSolverr attempt.');
    });

    it('should throw if fetch fails', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'));

        await expect(solveChallenge(serviceUrl, targetUrl, timeout, cookies))
            .rejects.toThrow('Network error');
    });
});
