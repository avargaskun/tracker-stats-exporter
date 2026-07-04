export interface RetryOptions {
    /** Number of retries after the initial attempt. `0` disables retrying (a single attempt). */
    retries: number;
    /** Delay before the first retry, in ms. Doubles each subsequent retry. */
    baseDelayMs?: number;
    /** Upper bound for the backoff delay, in ms. */
    maxDelayMs?: number;
    /** Called before each backoff sleep with the 1-based retry number, the delay, and the error. */
    onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

/**
 * Runs `operation`, retrying on rejection with exponential backoff.
 *
 * A momentary failure (e.g. a single VPN/proxy tunnel blip) would otherwise be
 * cached as a hard failure for the whole refresh interval, so a few short retries
 * let a transient error recover within one scrape. The delay doubles from
 * `baseDelayMs`, capped at `maxDelayMs`. With `retries = 0` the operation is
 * attempted exactly once with no delay, preserving the pre-retry behavior.
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    options: RetryOptions
): Promise<T> {
    const { retries, baseDelayMs = 150, maxDelayMs = 1500, onRetry } = options;
    const maxRetries = Math.max(0, Math.floor(retries));
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error) {
            lastError = error;
            if (attempt >= maxRetries) {
                break;
            }
            const delayMs = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs);
            onRetry?.(attempt + 1, delayMs, error);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    throw lastError;
}
