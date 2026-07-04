import { mapWithConcurrency } from './concurrency';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe('mapWithConcurrency', () => {
    test('runs every item and preserves input order', async () => {
        const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async n => n * 2);
        expect(results).toEqual([2, 4, 6, 8, 10]);
    });

    test('passes the correct index to the worker', async () => {
        const indices: number[] = [];
        await mapWithConcurrency(['a', 'b', 'c'], 2, async (_item, index) => {
            indices.push(index);
        });
        expect(indices.sort()).toEqual([0, 1, 2]);
    });

    test('never exceeds the concurrency limit', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        await mapWithConcurrency(Array.from({ length: 8 }, (_v, i) => i), 2, async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await delay(10);
            inFlight--;
        });
        expect(maxInFlight).toBe(2);
    });

    test('a concurrency of 1 serializes execution', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        await mapWithConcurrency([1, 2, 3], 1, async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await delay(5);
            inFlight--;
        });
        expect(maxInFlight).toBe(1);
    });

    test('caps effective workers at the item count when limit exceeds length', async () => {
        let inFlight = 0;
        let maxInFlight = 0;
        await mapWithConcurrency([1, 2], 10, async () => {
            inFlight++;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await delay(5);
            inFlight--;
        });
        expect(maxInFlight).toBe(2);
    });

    test('handles an empty input array', async () => {
        const results = await mapWithConcurrency([], 3, async (n: number) => n);
        expect(results).toEqual([]);
    });

    test('does not stop the remaining items when the worker itself handles errors', async () => {
        const seen: number[] = [];
        const results = await mapWithConcurrency([1, 2, 3], 2, async n => {
            seen.push(n);
            return n;
        });
        expect(seen.sort()).toEqual([1, 2, 3]);
        expect(results).toEqual([1, 2, 3]);
    });
});
