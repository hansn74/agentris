import { TRPCError } from '@trpc/server';

// In-memory rate limit store (replace with Redis in production)
const rateLimitStore = new Map<string, { count: number; resetTime: number; violations: number }>();

// Configuration constants
export const RATE_LIMIT_CONFIG = {
  // Auth endpoints
  login: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxAttempts: 5,
    tier: 'auth',
  },
  passwordReset: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    tier: 'auth',
  },
  register: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    tier: 'auth',
  },
  // API endpoints by role
  publicApi: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 30,
    tier: 'public',
  },
  consultantApi: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 60,
    tier: 'consultant',
  },
  managerApi: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 120,
    tier: 'manager',
  },
  adminApi: {
    windowMs: 60 * 1000, // 1 minute
    maxAttempts: 240,
    tier: 'admin',
  },
  // Specific endpoint limits
  aiGeneration: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 10,
    tier: 'ai',
  },
  salesforceSync: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 5,
    tier: 'integration',
  },
  deployment: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxAttempts: 3,
    tier: 'deployment',
  },
} as const;

export type RateLimitType = keyof typeof RATE_LIMIT_CONFIG;

// Role-based rate limit tiers
export const ROLE_RATE_LIMITS: Record<string, RateLimitType> = {
  CONSULTANT: 'consultantApi',
  MANAGER: 'managerApi',
  ADMIN: 'adminApi',
};

// Exponential backoff for repeated violations
const BACKOFF_MULTIPLIERS = [1, 2, 4, 8, 16, 32];

export function checkRateLimit(
  identifier: string,
  limitType: RateLimitType,
  options?: {
    customLimit?: number;
    customWindow?: number;
    skipBackoff?: boolean;
  }
): { remaining: number; limit: number; resetTime: number } {
  const config = RATE_LIMIT_CONFIG[limitType];
  const maxAttempts = options?.customLimit ?? config.maxAttempts;
  const windowMs = options?.customWindow ?? config.windowMs;
  const now = Date.now();
  const key = `${limitType}:${identifier}`;

  const existing = rateLimitStore.get(key);

  if (existing) {
    if (now > existing.resetTime) {
      // Window expired, reset counter but keep violation count
      rateLimitStore.set(key, {
        count: 1,
        resetTime: now + windowMs,
        violations: 0, // Reset violations on successful window completion
      });
      return {
        remaining: maxAttempts - 1,
        limit: maxAttempts,
        resetTime: now + windowMs,
      };
    } else if (existing.count >= maxAttempts) {
      // Rate limit exceeded
      const violations = existing.violations || 0;
      const backoffMultiplier = !options?.skipBackoff
        ? BACKOFF_MULTIPLIERS[Math.min(violations, BACKOFF_MULTIPLIERS.length - 1)]
        : 1;

      // Update violations count
      rateLimitStore.set(key, {
        ...existing,
        violations: violations + 1,
      });

      const minutesRemaining = Math.ceil(((existing.resetTime - now) / 60000) * backoffMultiplier);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many attempts. Please try again in ${minutesRemaining} minute${
          minutesRemaining === 1 ? '' : 's'
        }.`,
      });
    } else {
      // Increment counter
      rateLimitStore.set(key, {
        ...existing,
        count: existing.count + 1,
      });
      return {
        remaining: maxAttempts - existing.count - 1,
        limit: maxAttempts,
        resetTime: existing.resetTime,
      };
    }
  } else {
    // First attempt
    rateLimitStore.set(key, {
      count: 1,
      resetTime: now + windowMs,
      violations: 0,
    });
    return {
      remaining: maxAttempts - 1,
      limit: maxAttempts,
      resetTime: now + windowMs,
    };
  }
}

// Get rate limit info without incrementing
export function getRateLimitInfo(
  identifier: string,
  limitType: RateLimitType
): { remaining: number; limit: number; resetTime: number } | null {
  const config = RATE_LIMIT_CONFIG[limitType];
  const key = `${limitType}:${identifier}`;
  const existing = rateLimitStore.get(key);

  if (!existing) {
    return {
      remaining: config.maxAttempts,
      limit: config.maxAttempts,
      resetTime: 0,
    };
  }

  const now = Date.now();
  if (now > existing.resetTime) {
    return {
      remaining: config.maxAttempts,
      limit: config.maxAttempts,
      resetTime: 0,
    };
  }

  return {
    remaining: Math.max(0, config.maxAttempts - existing.count),
    limit: config.maxAttempts,
    resetTime: existing.resetTime,
  };
}

// Middleware to add rate limit headers to response
export function addRateLimitHeaders(info: {
  remaining: number;
  limit: number;
  resetTime: number;
}): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(info.limit),
    'X-RateLimit-Remaining': String(info.remaining),
    'X-RateLimit-Reset': String(Math.floor(info.resetTime / 1000)),
  };
}

// Clean up expired entries periodically
if (typeof globalThis !== 'undefined' && typeof globalThis.setInterval === 'function') {
  globalThis.setInterval(
    () => {
      const now = Date.now();
      for (const [key, value] of rateLimitStore.entries()) {
        if (now > value.resetTime + 60 * 60 * 1000) {
          // Keep for 1 hour after expiry
          rateLimitStore.delete(key);
        }
      }
    },
    5 * 60 * 1000
  ); // Clean up every 5 minutes
}

// Export for testing
export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}

// Get current store size for monitoring
export function getRateLimitStoreSize(): number {
  return rateLimitStore.size;
}
