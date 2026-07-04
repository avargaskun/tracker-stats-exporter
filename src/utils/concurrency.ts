/**
 * Runs `worker` over `items` with at most `concurrency` invocations in flight at
 * any time, preserving input order in the returned results array.
 *
 * Used to avoid firing every tracker request at once: when all requests share a
 * single VPN/proxy tunnel, a large parallel burst saturates it and trips the
 * connection timeout, so a small concurrency keeps each request fast.
 */
export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    concurrency: number,
    worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    const results: R[] = new Array(items.length);
    const limit = Math.max(1, Math.min(Math.floor(concurrency), items.length));
    let cursor = 0;

    const run = async (): Promise<void> => {
        for (let index = cursor++; index < items.length; index = cursor++) {
            results[index] = await worker(items[index], index);
        }
    };

    await Promise.all(Array.from({ length: limit }, () => run()));
    return results;
}
