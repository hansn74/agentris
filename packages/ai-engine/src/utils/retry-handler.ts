export interface RetryConfig {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableErrors?: string[];
  retryableStatusCodes?: number[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

export class RetryHandler {
  private config: Required<RetryConfig>;

  constructor(config: RetryConfig = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 5,
      initialDelayMs: config.initialDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 32000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      retryableErrors: config.retryableErrors ?? [
        'ECONNRESET',
        'ETIMEDOUT',
        'ENOTFOUND',
        'ENETUNREACH',
      ],
      retryableStatusCodes: config.retryableStatusCodes ?? [
        429, // Too Many Requests
        502, // Bad Gateway
        503, // Service Unavailable
        504, // Gateway Timeout
      ],
      onRetry: config.onRetry ?? (() => {}),
    };
  }

  async execute<T>(
    fn: () => Promise<T>,
    customConfig?: Partial<RetryConfig>
  ): Promise<T> {
    const config = { ...this.config, ...customConfig };
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;

        if (attempt === config.maxRetries) {
          throw this.wrapError(lastError, attempt);
        }

        if (!this.shouldRetry(lastError, config)) {
          throw lastError;
        }

        const delayMs = this.calculateDelay(attempt, config);
        config.onRetry(attempt + 1, lastError, delayMs);

        await this.delay(delayMs);
      }
    }

    // This should never be reached, but TypeScript doesn't know that
    throw lastError || new Error('Retry handler failed unexpectedly');
  }

  private shouldRetry(error: Error, config: Required<RetryConfig>): boolean {
    // Check if it's a rate limit error (429)
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Check if it's a timeout error
    if (this.isTimeoutError(error)) {
      return true;
    }

    // Check if it's a network error
    if (this.isNetworkError(error, config)) {
      return true;
    }

    // Check if it has a retryable status code
    if (this.hasRetryableStatusCode(error, config)) {
      return true;
    }

    return false;
  }

  private isRateLimitError(error: any): boolean {
    // Check for common rate limit indicators
    if (error.status === 429 || error.statusCode === 429) {
      return true;
    }

    if (error.message?.toLowerCase().includes('rate limit')) {
      return true;
    }

    if (error.response?.status === 429) {
      return true;
    }

    return false;
  }

  private isTimeoutError(error: any): boolean {
    if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
      return true;
    }

    if (error.message?.toLowerCase().includes('timeout')) {
      return true;
    }

    if (error.name === 'TimeoutError') {
      return true;
    }

    return false;
  }

  private isNetworkError(error: any, config: Required<RetryConfig>): boolean {
    if (error.code && config.retryableErrors.includes(error.code)) {
      return true;
    }

    if (error.errno && config.retryableErrors.includes(error.errno)) {
      return true;
    }

    return false;
  }

  private hasRetryableStatusCode(
    error: any,
    config: Required<RetryConfig>
  ): boolean {
    const statusCode = error.status || error.statusCode || error.response?.status;
    
    if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }

    return false;
  }

  private calculateDelay(attempt: number, config: Required<RetryConfig>): number {
    // Exponential backoff with jitter
    const baseDelay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );

    // Add jitter (±20% of base delay)
    const jitter = baseDelay * 0.2 * (Math.random() - 0.5) * 2;
    
    return Math.round(baseDelay + jitter);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private wrapError(error: Error, attempts: number): Error {
    const wrappedError = new Error(
      `Failed after ${attempts + 1} attempts: ${error.message}`
    );
    wrappedError.name = 'RetryExhaustedError';
    wrappedError.cause = error;
    return wrappedError;
  }

  // Static helper for common use cases
  static async withRetry<T>(
    fn: () => Promise<T>,
    config?: RetryConfig
  ): Promise<T> {
    const handler = new RetryHandler(config);
    return handler.execute(fn);
  }

  // Helper for rate-limited APIs
  static async withRateLimitRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const handler = new RetryHandler({
      maxRetries: 10,
      initialDelayMs: 2000,
      maxDelayMs: 60000,
      ...config,
    });
    return handler.execute(fn);
  }
}