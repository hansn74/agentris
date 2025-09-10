import pino from 'pino';

const logger = pino({ name: 'jira-errors' });

/**
 * Base Jira error class
 */
export class JiraError extends Error {
  public statusCode?: number;
  public errorMessages?: string[];
  public errors?: Record<string, string>;
  public retryable: boolean;

  constructor(
    message: string,
    statusCode?: number,
    errorMessages?: string[],
    errors?: Record<string, string>,
    retryable = false
  ) {
    super(message);
    this.name = 'JiraError';
    this.statusCode = statusCode;
    this.errorMessages = errorMessages;
    this.errors = errors;
    this.retryable = retryable;
  }
}

/**
 * Authentication error
 */
export class JiraAuthenticationError extends JiraError {
  constructor(message = 'Jira authentication failed') {
    super(message, 401, undefined, undefined, false);
    this.name = 'JiraAuthenticationError';
  }
}

/**
 * Rate limit error
 */
export class JiraRateLimitError extends JiraError {
  public retryAfter?: number;

  constructor(message = 'Jira API rate limit exceeded', retryAfter?: number) {
    super(message, 429, undefined, undefined, true);
    this.name = 'JiraRateLimitError';
    this.retryAfter = retryAfter;
  }
}

/**
 * Permission error
 */
export class JiraPermissionError extends JiraError {
  constructor(message = 'Insufficient permissions for Jira operation') {
    super(message, 403, undefined, undefined, false);
    this.name = 'JiraPermissionError';
  }
}

/**
 * Not found error
 */
export class JiraNotFoundError extends JiraError {
  constructor(resource: string) {
    super(`Jira resource not found: ${resource}`, 404, undefined, undefined, false);
    this.name = 'JiraNotFoundError';
  }
}

/**
 * Connection error
 */
export class JiraConnectionError extends JiraError {
  constructor(message = 'Failed to connect to Jira') {
    super(message, undefined, undefined, undefined, true);
    this.name = 'JiraConnectionError';
  }
}

/**
 * Validation error
 */
export class JiraValidationError extends JiraError {
  constructor(message: string, errors?: Record<string, string>) {
    super(message, 400, undefined, errors, false);
    this.name = 'JiraValidationError';
  }
}

/**
 * OAuth error
 */
export class JiraOAuthError extends JiraError {
  constructor(message: string, errorCode?: string) {
    super(message, 400, [errorCode || 'oauth_error'], undefined, false);
    this.name = 'JiraOAuthError';
  }
}

/**
 * Circuit breaker for Jira API calls
 */
export class CircuitBreaker {
  private failureCount = 0;
  private lastFailureTime?: Date;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private readonly failureThreshold: number;
  private readonly recoveryTimeout: number;
  private readonly halfOpenMaxAttempts: number;
  private halfOpenAttempts = 0;

  constructor(
    failureThreshold = 5,
    recoveryTimeout = 60000, // 1 minute
    halfOpenMaxAttempts = 3
  ) {
    this.failureThreshold = failureThreshold;
    this.recoveryTimeout = recoveryTimeout;
    this.halfOpenMaxAttempts = halfOpenMaxAttempts;
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async execute<T>(fn: () => Promise<T>, operationName: string): Promise<T> {
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.halfOpenAttempts = 0;
        logger.info(`Circuit breaker entering HALF_OPEN state for ${operationName}`);
      } else {
        throw new JiraConnectionError('Circuit breaker is OPEN - Jira API temporarily unavailable');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  /**
   * Handle successful operation
   */
  private onSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.reset();
        logger.info('Circuit breaker reset to CLOSED state');
      }
    } else {
      this.failureCount = 0;
    }
  }

  /**
   * Handle failed operation
   */
  private onFailure(error: any): void {
    this.lastFailureTime = new Date();

    // Only count failures that should trip the breaker
    if (this.shouldCountFailure(error)) {
      this.failureCount++;

      if (this.state === 'HALF_OPEN') {
        this.trip();
        logger.warn('Circuit breaker tripped from HALF_OPEN to OPEN');
      } else if (this.failureCount >= this.failureThreshold) {
        this.trip();
        logger.warn('Circuit breaker tripped to OPEN state', {
          failureCount: this.failureCount,
          threshold: this.failureThreshold,
        });
      }
    }
  }

  /**
   * Check if failure should count toward circuit breaker
   */
  private shouldCountFailure(error: any): boolean {
    // Don't count client errors (4xx except 429) toward circuit breaker
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return error.statusCode === 429; // Only count rate limits
    }

    // Count server errors and connection errors
    return true;
  }

  /**
   * Check if enough time has passed to attempt reset
   */
  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) {
      return true;
    }

    const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
    return timeSinceLastFailure >= this.recoveryTimeout;
  }

  /**
   * Trip the circuit breaker
   */
  private trip(): void {
    this.state = 'OPEN';
    this.lastFailureTime = new Date();
  }

  /**
   * Reset the circuit breaker
   */
  private reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.halfOpenAttempts = 0;
    this.lastFailureTime = undefined;
  }

  /**
   * Get current state
   */
  public getState(): string {
    return this.state;
  }

  /**
   * Get metrics
   */
  public getMetrics(): {
    state: string;
    failureCount: number;
    lastFailureTime?: Date;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}

/**
 * Error recovery strategies
 */
export class ErrorRecovery {
  /**
   * Determine if error is recoverable
   */
  public static isRecoverable(error: any): boolean {
    if (error instanceof JiraError) {
      return error.retryable;
    }

    // Connection errors are usually recoverable
    if (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET'
    ) {
      return true;
    }

    // Rate limits are recoverable
    if (error.statusCode === 429) {
      return true;
    }

    // Server errors might be recoverable
    if (error.statusCode >= 500) {
      return true;
    }

    return false;
  }

  /**
   * Get retry delay based on error type
   */
  public static getRetryDelay(error: any, attemptNumber: number): number {
    // Rate limit error with retry-after header
    if (error instanceof JiraRateLimitError && error.retryAfter) {
      return error.retryAfter * 1000;
    }

    // Rate limit without retry-after
    if (error.statusCode === 429) {
      return Math.min(60000, 1000 * Math.pow(2, attemptNumber));
    }

    // Exponential backoff for other errors
    return Math.min(30000, 1000 * Math.pow(2, attemptNumber));
  }

  /**
   * Log error with appropriate level
   */
  public static logError(error: any, context: Record<string, any>): void {
    const errorInfo = {
      ...context,
      errorName: error.name,
      errorMessage: error.message,
      statusCode: error.statusCode,
      errorCode: error.code,
    };

    if (error instanceof JiraAuthenticationError || error instanceof JiraPermissionError) {
      logger.error('Jira authorization error', errorInfo);
    } else if (error instanceof JiraRateLimitError) {
      logger.warn('Jira rate limit hit', errorInfo);
    } else if (error instanceof JiraConnectionError) {
      logger.error('Jira connection error', errorInfo);
    } else if (error instanceof JiraValidationError) {
      logger.warn('Jira validation error', { ...errorInfo, errors: error.errors });
    } else {
      logger.error('Unexpected Jira error', errorInfo);
    }
  }
}
