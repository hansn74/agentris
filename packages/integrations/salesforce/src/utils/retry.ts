import pino from 'pino';

const logger = pino({ name: 'salesforce-retry' });

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  shouldRetry?: (error: any) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors or rate limit errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    // Retry on Salesforce rate limit errors
    if (
      error.message?.includes('REQUEST_LIMIT_EXCEEDED') ||
      error.message?.includes('TooManyRequests') ||
      error.statusCode === 429
    ) {
      return true;
    }

    // Retry on temporary Salesforce errors
    if (
      error.message?.includes('UNABLE_TO_LOCK_ROW') ||
      error.message?.includes('QUERY_TIMEOUT') ||
      error.message?.includes('SERVER_UNAVAILABLE')
    ) {
      return true;
    }

    return false;
  },
};

export async function retryWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: any;
  let delay = opts.initialDelay;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      logger.debug({ attempt, maxAttempts: opts.maxAttempts }, 'Attempting operation');
      const result = await fn();

      if (attempt > 1) {
        logger.info({ attempt }, 'Operation succeeded after retry');
      }

      return result;
    } catch (error) {
      lastError = error;

      logger.warn(
        {
          error,
          attempt,
          maxAttempts: opts.maxAttempts,
        },
        'Operation failed'
      );

      // Check if we should retry
      if (!opts.shouldRetry(error)) {
        logger.error({ error }, 'Error is not retryable');
        throw error;
      }

      // Check if we've exhausted all attempts
      if (attempt === opts.maxAttempts) {
        logger.error(
          {
            error,
            attempts: opts.maxAttempts,
          },
          'Max retry attempts exceeded'
        );
        break;
      }

      // Calculate delay with exponential backoff
      const jitter = Math.random() * 200; // Add some jitter
      const actualDelay = Math.min(delay + jitter, opts.maxDelay);

      logger.info(
        {
          attempt,
          nextAttempt: attempt + 1,
          delayMs: actualDelay,
        },
        'Retrying after delay'
      );

      await sleep(actualDelay);

      // Increase delay for next attempt
      delay = Math.min(delay * opts.multiplier, opts.maxDelay);
    }
  }

  throw lastError;
}

export async function retryOnRateLimit<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 5
): Promise<T> {
  return retryWithExponentialBackoff(fn, {
    maxAttempts,
    initialDelay: 2000,
    maxDelay: 60000,
    multiplier: 2.5,
    shouldRetry: (error) => {
      // Only retry on rate limit errors
      return (
        error.message?.includes('REQUEST_LIMIT_EXCEEDED') ||
        error.message?.includes('TooManyRequests') ||
        error.statusCode === 429
      );
    },
  });
}

export async function retryOnTransientError<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3
): Promise<T> {
  return retryWithExponentialBackoff(fn, {
    maxAttempts,
    initialDelay: 500,
    maxDelay: 5000,
    multiplier: 2,
    shouldRetry: (error) => {
      // Retry on transient Salesforce errors
      return (
        error.message?.includes('UNABLE_TO_LOCK_ROW') ||
        error.message?.includes('QUERY_TIMEOUT') ||
        error.message?.includes('SERVER_UNAVAILABLE') ||
        error.code === 'ECONNRESET' ||
        error.code === 'ETIMEDOUT'
      );
    },
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Circuit breaker pattern for API calls
export class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private readonly threshold: number = 5,
    private readonly timeout: number = 60000, // 1 minute
    private readonly resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      const now = Date.now();
      if (now - this.lastFailureTime < this.timeout) {
        throw new Error('Circuit breaker is open - API calls are temporarily suspended');
      }
      // Try to move to half-open state
      this.state = 'half-open';
    }

    try {
      const result = await fn();

      if (this.state === 'half-open') {
        // Success in half-open state, close the circuit
        this.reset();
      }

      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  private recordFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      logger.warn(
        {
          failures: this.failures,
          threshold: this.threshold,
        },
        'Circuit breaker opened'
      );

      // Schedule reset
      setTimeout(() => {
        this.state = 'half-open';
        logger.info('Circuit breaker moved to half-open state');
      }, this.resetTimeout);
    }
  }

  private reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
    logger.info('Circuit breaker reset');
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }

  getFailures(): number {
    return this.failures;
  }
}
