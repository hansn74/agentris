import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { RetryHandler } from './retry-handler';

describe('RetryHandler', () => {
  let handler: RetryHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('execute', () => {
    it('should return successful result without retry', async () => {
      handler = new RetryHandler();
      const fn = vi.fn().mockResolvedValue('success');

      const result = await handler.execute(fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and succeed', async () => {
      handler = new RetryHandler({ maxRetries: 3, initialDelayMs: 100 });
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      
      // Fast-forward through delays
      await vi.runAllTimersAsync();
      
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should throw after max retries', async () => {
      handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 100 });
      const fn = vi.fn().mockRejectedValue(new Error('Persistent failure'));

      const promise = handler.execute(fn);
      
      // Fast-forward through delays
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toThrow('Failed after 3 attempts');
      expect(fn).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should not retry non-retryable errors', async () => {
      handler = new RetryHandler();
      const authError = new Error('Authentication failed');
      authError.name = 'AuthenticationError';
      const fn = vi.fn().mockRejectedValue(authError);

      await expect(handler.execute(fn)).rejects.toThrow('Authentication failed');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should call onRetry callback', async () => {
      const onRetry = vi.fn();
      handler = new RetryHandler({ 
        maxRetries: 2, 
        initialDelayMs: 100,
        onRetry 
      });
      
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      await promise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ message: 'First failure' }),
        expect.any(Number)
      );
    });
  });

  describe('retry conditions', () => {
    it('should retry on rate limit error (429)', async () => {
      handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 100 });
      const rateLimitError: any = new Error('Rate limited');
      rateLimitError.status = 429;
      
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on timeout error', async () => {
      handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 100 });
      const timeoutError: any = new Error('Request timeout');
      timeoutError.code = 'ETIMEDOUT';
      
      const fn = vi.fn()
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on network errors', async () => {
      handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 100 });
      const networkError: any = new Error('Connection reset');
      networkError.code = 'ECONNRESET';
      
      const fn = vi.fn()
        .mockRejectedValueOnce(networkError)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should retry on service unavailable (503)', async () => {
      handler = new RetryHandler({ maxRetries: 1, initialDelayMs: 100 });
      const serviceError: any = new Error('Service unavailable');
      serviceError.status = 503;
      
      const fn = vi.fn()
        .mockRejectedValueOnce(serviceError)
        .mockResolvedValue('success');

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('delay calculation', () => {
    it('should use exponential backoff', async () => {
      const delays: number[] = [];
      handler = new RetryHandler({
        maxRetries: 3,
        initialDelayMs: 1000,
        backoffMultiplier: 2,
        onRetry: (_, __, delay) => delays.push(delay),
      });

      const fn = vi.fn().mockRejectedValue(new Error('Error'));

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      
      try {
        await promise;
      } catch {
        // Expected to fail
      }

      // Check that delays are exponentially increasing (with some jitter)
      expect(delays.length).toBe(3);
      expect(delays[0]).toBeGreaterThan(800); // ~1000ms ± 20%
      expect(delays[0]).toBeLessThan(1200);
      expect(delays[1]).toBeGreaterThan(1600); // ~2000ms ± 20%
      expect(delays[1]).toBeLessThan(2400);
      expect(delays[2]).toBeGreaterThan(3200); // ~4000ms ± 20%
      expect(delays[2]).toBeLessThan(4800);
    });

    it('should respect max delay', async () => {
      const delays: number[] = [];
      handler = new RetryHandler({
        maxRetries: 5,
        initialDelayMs: 1000,
        backoffMultiplier: 10,
        maxDelayMs: 5000,
        onRetry: (_, __, delay) => delays.push(delay),
      });

      const fn = vi.fn().mockRejectedValue(new Error('Error'));

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();
      
      try {
        await promise;
      } catch {
        // Expected to fail
      }

      // All delays should be capped at maxDelayMs (± jitter)
      delays.forEach(delay => {
        expect(delay).toBeLessThan(6000); // 5000ms + 20% jitter
      });
    });
  });

  describe('static helpers', () => {
    it('should work with withRetry helper', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('Failure'))
        .mockResolvedValue('success');

      const promise = RetryHandler.withRetry(fn, { 
        maxRetries: 1, 
        initialDelayMs: 100 
      });
      
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should work with withRateLimitRetry helper', async () => {
      const rateLimitError: any = new Error('Rate limited');
      rateLimitError.status = 429;
      
      const fn = vi.fn()
        .mockRejectedValueOnce(rateLimitError)
        .mockResolvedValue('success');

      const promise = RetryHandler.withRateLimitRetry(fn);
      
      await vi.runAllTimersAsync();
      const result = await promise;

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('error wrapping', () => {
    it('should wrap final error with attempt count', async () => {
      handler = new RetryHandler({ maxRetries: 2, initialDelayMs: 100 });
      const originalError = new Error('Original error');
      const fn = vi.fn().mockRejectedValue(originalError);

      const promise = handler.execute(fn);
      await vi.runAllTimersAsync();

      await expect(promise).rejects.toMatchObject({
        message: 'Failed after 3 attempts: Original error',
        name: 'RetryExhaustedError',
        cause: originalError,
      });
    });
  });
});