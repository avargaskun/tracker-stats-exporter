import { withRetry } from './retry';

describe('withRetry', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    test('resolves on the first attempt without retrying', async () => {
        const onRetry = jest.fn();
        const operation = jest.fn().mockResolvedValue('ok');

        const result = await withRetry(operation, { retries: 3, onRetry });

        expect(result).toBe('ok');
        expect(operation).toHaveBeenCalledTimes(1);
        expect(onRetry).not.toHaveBeenCalled();
    });

    test('retries then succeeds, invoking onRetry once per retry', async () => {
        jest.useFakeTimers();
        const onRetry = jest.fn();
        const operation = jest.fn()
            .mockRejectedValueOnce(new Error('boom 1'))
            .mockRejectedValueOnce(new Error('boom 2'))
            .mockResolvedValue('ok');

        const promise = withRetry(operation, { retries: 3, onRetry });
        await jest.runAllTimersAsync();
        const result = await promise;

        expect(result).toBe('ok');
        expect(operation).toHaveBeenCalledTimes(3);
        expect(onRetry).toHaveBeenCalledTimes(2);
    });

    test('exhausts all retries and throws the last error', async () => {
        jest.useFakeTimers();
        const onRetry = jest.fn();
        const operation = jest.fn()
            .mockRejectedValueOnce(new Error('boom 1'))
            .mockRejectedValueOnce(new Error('boom 2'))
            .mockRejectedValueOnce(new Error('boom 3'))
            .mockRejectedValue(new Error('boom final'));

        const assertion = expect(withRetry(operation, { retries: 3, onRetry })).rejects.toThrow('boom final');
        await jest.runAllTimersAsync();
        await assertion;

        expect(operation).toHaveBeenCalledTimes(4);
        expect(onRetry).toHaveBeenCalledTimes(3);
    });

    test('retries = 0 makes a single attempt and does not retry', async () => {
        const onRetry = jest.fn();
        const operation = jest.fn().mockRejectedValue(new Error('boom'));

        await expect(withRetry(operation, { retries: 0, onRetry })).rejects.toThrow('boom');

        expect(operation).toHaveBeenCalledTimes(1);
        expect(onRetry).not.toHaveBeenCalled();
    });

    test('backoff doubles from 150ms and caps at 1500ms', async () => {
        jest.useFakeTimers();
        const delays: number[] = [];
        const operation = jest.fn().mockRejectedValue(new Error('boom'));

        const assertion = expect(
            withRetry(operation, { retries: 6, onRetry: (_attempt, delayMs) => delays.push(delayMs) })
        ).rejects.toThrow('boom');
        await jest.runAllTimersAsync();
        await assertion;

        expect(delays).toEqual([150, 300, 600, 1200, 1500, 1500]);
    });

    test('respects injected baseDelayMs and maxDelayMs', async () => {
        jest.useFakeTimers();
        const delays: number[] = [];
        const operation = jest.fn().mockRejectedValue(new Error('boom'));

        const assertion = expect(
            withRetry(operation, { retries: 4, baseDelayMs: 10, maxDelayMs: 40, onRetry: (_a, d) => delays.push(d) })
        ).rejects.toThrow('boom');
        await jest.runAllTimersAsync();
        await assertion;

        expect(delays).toEqual([10, 20, 40, 40]);
    });

    test('passes the 1-based retry number and error to onRetry', async () => {
        jest.useFakeTimers();
        const calls: Array<{ attempt: number; message: string }> = [];
        const operation = jest.fn()
            .mockRejectedValueOnce(new Error('first'))
            .mockResolvedValue('ok');

        const promise = withRetry(operation, {
            retries: 3,
            onRetry: (attempt, _delayMs, error) => calls.push({ attempt, message: (error as Error).message })
        });
        await jest.runAllTimersAsync();
        await promise;

        expect(calls).toEqual([{ attempt: 1, message: 'first' }]);
    });
});
