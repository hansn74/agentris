import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  JiraError,
  JiraAuthenticationError,
  JiraRateLimitError,
  JiraPermissionError,
  JiraNotFoundError,
  JiraConnectionError,
  JiraValidationError,
  JiraOAuthError,
  CircuitBreaker,
  ErrorRecovery,
} from './errors';

describe('Jira Error Classes', () => {
  describe('JiraError', () => {
    it('should create base error with all properties', () => {
      const error = new JiraError(
        'Test error',
        500,
        ['error1', 'error2'],
        { field1: 'error' },
        true
      );

      expect(error.message).toBe('Test error');
      expect(error.name).toBe('JiraError');
      expect(error.statusCode).toBe(500);
      expect(error.errorMessages).toEqual(['error1', 'error2']);
      expect(error.errors).toEqual({ field1: 'error' });
      expect(error.retryable).toBe(true);
    });
  });

  describe('JiraAuthenticationError', () => {
    it('should create authentication error with 401 status', () => {
      const error = new JiraAuthenticationError();

      expect(error.name).toBe('JiraAuthenticationError');
      expect(error.statusCode).toBe(401);
      expect(error.retryable).toBe(false);
    });
  });

  describe('JiraRateLimitError', () => {
    it('should create rate limit error with retry after', () => {
      const error = new JiraRateLimitError('Rate limited', 60);

      expect(error.name).toBe('JiraRateLimitError');
      expect(error.statusCode).toBe(429);
      expect(error.retryable).toBe(true);
      expect(error.retryAfter).toBe(60);
    });
  });

  describe('JiraPermissionError', () => {
    it('should create permission error with 403 status', () => {
      const error = new JiraPermissionError();

      expect(error.name).toBe('JiraPermissionError');
      expect(error.statusCode).toBe(403);
      expect(error.retryable).toBe(false);
    });
  });

  describe('JiraNotFoundError', () => {
    it('should create not found error with resource name', () => {
      const error = new JiraNotFoundError('TEST-123');

      expect(error.name).toBe('JiraNotFoundError');
      expect(error.message).toBe('Jira resource not found: TEST-123');
      expect(error.statusCode).toBe(404);
      expect(error.retryable).toBe(false);
    });
  });

  describe('JiraConnectionError', () => {
    it('should create connection error as retryable', () => {
      const error = new JiraConnectionError();

      expect(error.name).toBe('JiraConnectionError');
      expect(error.retryable).toBe(true);
    });
  });

  describe('JiraValidationError', () => {
    it('should create validation error with field errors', () => {
      const errors = {
        summary: 'Summary is required',
        description: 'Description too long',
      };
      const error = new JiraValidationError('Validation failed', errors);

      expect(error.name).toBe('JiraValidationError');
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(errors);
      expect(error.retryable).toBe(false);
    });
  });

  describe('JiraOAuthError', () => {
    it('should create OAuth error with error code', () => {
      const error = new JiraOAuthError('Invalid grant', 'invalid_grant');

      expect(error.name).toBe('JiraOAuthError');
      expect(error.message).toBe('Invalid grant');
      expect(error.statusCode).toBe(400);
      expect(error.errorMessages).toEqual(['invalid_grant']);
      expect(error.retryable).toBe(false);
    });
  });
});

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    circuitBreaker = new CircuitBreaker(3, 1000, 2);
  });

  it('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should remain CLOSED on successful calls', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    await circuitBreaker.execute(fn, 'test');
    await circuitBreaker.execute(fn, 'test');

    expect(circuitBreaker.getState()).toBe('CLOSED');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should trip to OPEN after threshold failures', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // First 2 failures
    for (let i = 0; i < 2; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }
    expect(circuitBreaker.getState()).toBe('CLOSED');

    // Third failure should trip the breaker
    try {
      await circuitBreaker.execute(fn, 'test');
    } catch {}

    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  it('should reject calls when OPEN', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }

    // Should reject without calling function
    const successFn = vi.fn().mockResolvedValue('success');
    await expect(circuitBreaker.execute(successFn, 'test')).rejects.toThrow(
      'Circuit breaker is OPEN'
    );
    expect(successFn).not.toHaveBeenCalled();
  });

  it('should enter HALF_OPEN state after recovery timeout', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }

    expect(circuitBreaker.getState()).toBe('OPEN');

    // Wait for recovery timeout
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Should allow one attempt
    const successFn = vi.fn().mockResolvedValue('success');
    await circuitBreaker.execute(successFn, 'test');

    expect(circuitBreaker.getState()).toBe('HALF_OPEN');
  });

  it('should reset to CLOSED after successful HALF_OPEN attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }

    // Wait for recovery
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Successful calls in HALF_OPEN
    const successFn = vi.fn().mockResolvedValue('success');
    await circuitBreaker.execute(successFn, 'test');
    await circuitBreaker.execute(successFn, 'test');

    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should not count 4xx errors toward circuit breaker', async () => {
    const error = new JiraValidationError('Bad request');
    const fn = vi.fn().mockRejectedValue(error);

    // Multiple 400 errors shouldn't trip breaker
    for (let i = 0; i < 5; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }

    expect(circuitBreaker.getState()).toBe('CLOSED');
  });

  it('should count 429 errors toward circuit breaker', async () => {
    const error = new JiraRateLimitError();
    const fn = vi.fn().mockRejectedValue(error);

    // Rate limit errors should trip breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(fn, 'test');
      } catch {}
    }

    expect(circuitBreaker.getState()).toBe('OPEN');
  });

  it('should provide metrics', () => {
    const metrics = circuitBreaker.getMetrics();

    expect(metrics).toHaveProperty('state');
    expect(metrics).toHaveProperty('failureCount');
    expect(metrics.state).toBe('CLOSED');
    expect(metrics.failureCount).toBe(0);
  });
});

describe('ErrorRecovery', () => {
  describe('isRecoverable', () => {
    it('should identify recoverable Jira errors', () => {
      const recoverableError = new JiraRateLimitError();
      const nonRecoverableError = new JiraAuthenticationError();

      expect(ErrorRecovery.isRecoverable(recoverableError)).toBe(true);
      expect(ErrorRecovery.isRecoverable(nonRecoverableError)).toBe(false);
    });

    it('should identify connection errors as recoverable', () => {
      const connectionErrors = [
        { code: 'ECONNREFUSED' },
        { code: 'ENOTFOUND' },
        { code: 'ETIMEDOUT' },
        { code: 'ECONNRESET' },
      ];

      connectionErrors.forEach((error) => {
        expect(ErrorRecovery.isRecoverable(error)).toBe(true);
      });
    });

    it('should identify rate limits as recoverable', () => {
      const error = { statusCode: 429 };
      expect(ErrorRecovery.isRecoverable(error)).toBe(true);
    });

    it('should identify server errors as recoverable', () => {
      const errors = [{ statusCode: 500 }, { statusCode: 502 }, { statusCode: 503 }];

      errors.forEach((error) => {
        expect(ErrorRecovery.isRecoverable(error)).toBe(true);
      });
    });

    it('should identify client errors as non-recoverable', () => {
      const errors = [
        { statusCode: 400 },
        { statusCode: 401 },
        { statusCode: 403 },
        { statusCode: 404 },
      ];

      errors.forEach((error) => {
        expect(ErrorRecovery.isRecoverable(error)).toBe(false);
      });
    });
  });

  describe('getRetryDelay', () => {
    it('should use retry-after for rate limit errors', () => {
      const error = new JiraRateLimitError('Rate limited', 30);
      const delay = ErrorRecovery.getRetryDelay(error, 1);

      expect(delay).toBe(30000); // 30 seconds in ms
    });

    it('should use exponential backoff for rate limits without retry-after', () => {
      const error = { statusCode: 429 };

      expect(ErrorRecovery.getRetryDelay(error, 0)).toBe(1000);
      expect(ErrorRecovery.getRetryDelay(error, 1)).toBe(2000);
      expect(ErrorRecovery.getRetryDelay(error, 2)).toBe(4000);
    });

    it('should cap delay at maximum', () => {
      const error = { statusCode: 429 };
      const delay = ErrorRecovery.getRetryDelay(error, 10);

      expect(delay).toBeLessThanOrEqual(60000);
    });

    it('should use exponential backoff for other errors', () => {
      const error = new Error('Generic error');

      expect(ErrorRecovery.getRetryDelay(error, 0)).toBe(1000);
      expect(ErrorRecovery.getRetryDelay(error, 1)).toBe(2000);
      expect(ErrorRecovery.getRetryDelay(error, 2)).toBe(4000);
    });
  });
});
