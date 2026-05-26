/**
 * fetchWithRetry — resilient fetch with exponential backoff
 *
 * Retries on network errors and 5xx responses. Does NOT retry 4xx (client errors).
 * Used for tournament-critical operations (result submission, state fetch).
 */
import { authFetch } from "./apiFetch";

interface RetryOptions {
  /** Max number of retries (default: 2 = 3 total attempts) */
  maxRetries?: number;
  /** Base delay in ms (default: 1000). Doubles each retry. */
  baseDelay?: number;
  /** Only retry on these HTTP status codes (default: 500+) */
  retryStatuses?: number[];
}

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOpts?: RetryOptions
): Promise<Response> {
  const maxRetries = retryOpts?.maxRetries ?? 2;
  const baseDelay = retryOpts?.baseDelay ?? 1000;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await authFetch(url, options);
      // Don't retry client errors (4xx)
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        return res;
      }
      // Server error — retry
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
      return res; // Return the failed response on last attempt
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }
  throw lastError ?? new Error("fetchWithRetry: all attempts failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
