import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import { batchRateLimit, _testExports } from './batchRateLimit';

const { InMemoryRateLimitStore, RATE_LIMIT } = _testExports;

describe('batchRateLimit', () => {
  describe('InMemoryRateLimitStore', () => {
    let store: InstanceType<typeof InMemoryRateLimitStore>;

    beforeEach(() => {
      store = new InMemoryRateLimitStore();
    });

    it('should track request count', async () => {
      const key = 'test-user';
      
      const result1 = await store.increment(key);
      expect(result1.count).toBe(1);
      
      const result2 = await store.increment(key);
      expect(result2.count).toBe(2);
      
      const result3 = await store.increment(key);
      expect(result3.count).toBe(3);
    });

    it('should reset count after window expires', async () => {
      const key = 'test-user';
      
      // First request
      const result1 = await store.increment(key);
      expect(result1.count).toBe(1);
      
      // Mock time passing
      vi.useFakeTimers();
      vi.advanceTimersByTime(RATE_LIMIT.WINDOW_MS + 1);
      
      // Should reset
      const result2 = await store.increment(key);
      expect(result2.count).toBe(1);
      
      vi.useRealTimers();
    });

    it('should cleanup expired entries', () => {
      const store = new InMemoryRateLimitStore();
      // @ts-ignore - accessing private property for testing
      store.store.set('old-key', { count: 5, resetTime: Date.now() - 1000 });
      store.store.set('current-key', { count: 1, resetTime: Date.now() + 1000 });
      
      store.cleanup();
      
      // @ts-ignore
      expect(store.store.has('old-key')).toBe(false);
      // @ts-ignore
      expect(store.store.has('current-key')).toBe(true);
    });
  });

  describe('batchRateLimit middleware', () => {
    it('should allow requests under the limit', async () => {
      const userId = 'user-123';
      const operation = 'testOperation';
      
      for (let i = 0; i < 10; i++) {
        const result = await batchRateLimit(userId, operation);
        expect(result.remaining).toBeGreaterThan(0);
      }
    });

    it('should throw error when rate limit exceeded', async () => {
      const userId = 'user-456';
      const operation = 'testOperation';
      
      // Make requests up to the limit
      for (let i = 0; i < RATE_LIMIT.MAX_REQUESTS; i++) {
        await batchRateLimit(userId, operation);
      }
      
      // Next request should throw
      await expect(batchRateLimit(userId, operation)).rejects.toThrow(TRPCError);
      
      try {
        await batchRateLimit(userId, operation);
      } catch (error) {
        expect(error).toBeInstanceOf(TRPCError);
        expect((error as TRPCError).code).toBe('TOO_MANY_REQUESTS');
        expect((error as TRPCError).message).toContain('50 requests per minute');
      }
    });

    it('should track different operations separately', async () => {
      const userId = 'user-789';
      
      // Different operations should have separate limits
      const result1 = await batchRateLimit(userId, 'operation1');
      const result2 = await batchRateLimit(userId, 'operation2');
      
      expect(result1.remaining).toBe(RATE_LIMIT.MAX_REQUESTS - 1);
      expect(result2.remaining).toBe(RATE_LIMIT.MAX_REQUESTS - 1);
    });

    it('should track different users separately', async () => {
      const operation = 'testOperation';
      
      // Different users should have separate limits
      const result1 = await batchRateLimit('user1', operation);
      const result2 = await batchRateLimit('user2', operation);
      
      expect(result1.remaining).toBe(RATE_LIMIT.MAX_REQUESTS - 1);
      expect(result2.remaining).toBe(RATE_LIMIT.MAX_REQUESTS - 1);
    });
  });
});