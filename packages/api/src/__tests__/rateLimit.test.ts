import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';
import {
  checkRateLimit,
  getRateLimitInfo,
  clearRateLimitStore,
  getRateLimitStoreSize,
  addRateLimitHeaders,
  ROLE_RATE_LIMITS,
} from '../middleware/rateLimit';

describe('Rate Limiting', () => {
  beforeEach(() => {
    clearRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('checkRateLimit', () => {
    it('should allow requests within rate limit', () => {
      const result1 = checkRateLimit('user1', 'login');
      expect(result1.remaining).toBe(4);
      expect(result1.limit).toBe(5);

      const result2 = checkRateLimit('user1', 'login');
      expect(result2.remaining).toBe(3);

      const result3 = checkRateLimit('user1', 'login');
      expect(result3.remaining).toBe(2);
    });

    it('should throw error when rate limit exceeded', () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user1', 'login');
      }

      // Next attempt should throw
      expect(() => checkRateLimit('user1', 'login')).toThrow(TRPCError);
      expect(() => checkRateLimit('user1', 'login')).toThrow('Too many attempts');
    });

    it('should reset counter after time window', () => {
      // Use up some attempts
      checkRateLimit('user1', 'login');
      checkRateLimit('user1', 'login');

      // Advance time past the window
      vi.advanceTimersByTime(16 * 60 * 1000); // 16 minutes for login window

      // Should be able to make requests again
      const result = checkRateLimit('user1', 'login');
      expect(result.remaining).toBe(4);
    });

    it('should track different identifiers separately', () => {
      checkRateLimit('user1', 'login');
      checkRateLimit('user1', 'login');

      const result = checkRateLimit('user2', 'login');
      expect(result.remaining).toBe(4); // user2 starts fresh
    });

    it('should track different limit types separately', () => {
      checkRateLimit('user1', 'login');
      checkRateLimit('user1', 'login');

      const result = checkRateLimit('user1', 'passwordReset');
      expect(result.remaining).toBe(2); // Different limit type
    });

    it('should apply exponential backoff for repeated violations', () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user1', 'login');
      }

      // First violation
      expect(() => checkRateLimit('user1', 'login')).toThrow();

      // Second violation should have longer wait time
      try {
        checkRateLimit('user1', 'login');
      } catch (error: any) {
        expect(error.message).toContain('minute');
      }
    });

    it('should respect custom limits', () => {
      const result = checkRateLimit('user1', 'login', {
        customLimit: 10,
        customWindow: 60000,
      });

      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
    });

    it('should skip backoff when requested', () => {
      // Use up all attempts
      for (let i = 0; i < 5; i++) {
        checkRateLimit('user1', 'login');
      }

      // Should throw without backoff multiplier
      expect(() => checkRateLimit('user1', 'login', { skipBackoff: true })).toThrow(TRPCError);
    });
  });

  describe('getRateLimitInfo', () => {
    it('should return info without incrementing counter', () => {
      checkRateLimit('user1', 'login');
      checkRateLimit('user1', 'login');

      const info = getRateLimitInfo('user1', 'login');
      expect(info?.remaining).toBe(3);

      // Should still be 3 after checking info
      const info2 = getRateLimitInfo('user1', 'login');
      expect(info2?.remaining).toBe(3);
    });

    it('should return full limit for new identifier', () => {
      const info = getRateLimitInfo('newuser', 'login');
      expect(info?.remaining).toBe(5);
      expect(info?.limit).toBe(5);
    });

    it('should handle expired windows', () => {
      checkRateLimit('user1', 'login');
      vi.advanceTimersByTime(16 * 60 * 1000);

      const info = getRateLimitInfo('user1', 'login');
      expect(info?.remaining).toBe(5);
    });
  });

  describe('addRateLimitHeaders', () => {
    it('should format headers correctly', () => {
      const headers = addRateLimitHeaders({
        remaining: 10,
        limit: 50,
        resetTime: 1234567890000,
      });

      expect(headers['X-RateLimit-Limit']).toBe('50');
      expect(headers['X-RateLimit-Remaining']).toBe('10');
      expect(headers['X-RateLimit-Reset']).toBe('1234567890');
    });
  });

  describe('getRateLimitStoreSize', () => {
    it('should return current store size', () => {
      expect(getRateLimitStoreSize()).toBe(0);

      checkRateLimit('user1', 'login');
      expect(getRateLimitStoreSize()).toBe(1);

      checkRateLimit('user2', 'login');
      expect(getRateLimitStoreSize()).toBe(2);

      clearRateLimitStore();
      expect(getRateLimitStoreSize()).toBe(0);
    });
  });

  describe('Role-based rate limits', () => {
    it('should have correct role mappings', () => {
      expect(ROLE_RATE_LIMITS.CONSULTANT).toBe('consultantApi');
      expect(ROLE_RATE_LIMITS.MANAGER).toBe('managerApi');
      expect(ROLE_RATE_LIMITS.ADMIN).toBe('adminApi');
    });

    it('should apply different limits per role', () => {
      const consultantResult = checkRateLimit('user1', 'consultantApi');
      expect(consultantResult.limit).toBe(60);

      const managerResult = checkRateLimit('user2', 'managerApi');
      expect(managerResult.limit).toBe(120);

      const adminResult = checkRateLimit('user3', 'adminApi');
      expect(adminResult.limit).toBe(240);
    });
  });

  describe('Specific endpoint limits', () => {
    it('should apply AI generation limits', () => {
      const result = checkRateLimit('user1', 'aiGeneration');
      expect(result.limit).toBe(10);
      expect(result.remaining).toBe(9);
    });

    it('should apply Salesforce sync limits', () => {
      const result = checkRateLimit('user1', 'salesforceSync');
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(4);
    });

    it('should apply deployment limits', () => {
      const result = checkRateLimit('user1', 'deployment');
      expect(result.limit).toBe(3);
      expect(result.remaining).toBe(2);
    });
  });
});
