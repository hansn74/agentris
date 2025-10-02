import { TRPCError } from '@trpc/server';
import { Redis } from 'ioredis';

// Rate limiting configuration for batch operations
const RATE_LIMIT = {
  MAX_REQUESTS: 50,
  WINDOW_MS: 60 * 1000, // 1 minute
};

// In-memory store as fallback if Redis is not available
class InMemoryRateLimitStore {
  private store: Map<string, { count: number; resetTime: number }> = new Map();

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record || now > record.resetTime) {
      const resetTime = now + RATE_LIMIT.WINDOW_MS;
      this.store.set(key, { count: 1, resetTime });
      return { count: 1, ttl: RATE_LIMIT.WINDOW_MS };
    }

    record.count++;
    return { 
      count: record.count, 
      ttl: Math.max(0, record.resetTime - now)
    };
  }

  cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Redis store for production
class RedisRateLimitStore {
  constructor(private redis: Redis) {}

  async increment(key: string): Promise<{ count: number; ttl: number }> {
    const multi = this.redis.multi();
    multi.incr(key);
    multi.ttl(key);
    multi.expire(key, Math.ceil(RATE_LIMIT.WINDOW_MS / 1000));
    
    const results = await multi.exec();
    if (!results) {
      throw new Error('Redis transaction failed');
    }

    const count = results[0][1] as number;
    const ttl = results[1][1] as number;
    
    return { 
      count, 
      ttl: ttl > 0 ? ttl * 1000 : RATE_LIMIT.WINDOW_MS 
    };
  }
}

// Initialize rate limit store lazily
let rateLimitStore: InMemoryRateLimitStore | RedisRateLimitStore | null = null;

function getRateLimitStore(): InMemoryRateLimitStore | RedisRateLimitStore {
  if (rateLimitStore) {
    return rateLimitStore;
  }
  
  if (process.env.REDIS_URL && process.env.REDIS_URL !== '') {
    try {
      const redis = new Redis(process.env.REDIS_URL);
      rateLimitStore = new RedisRateLimitStore(redis);
      console.log('Rate limiting: Using Redis store');
    } catch (error) {
      console.warn('Redis connection failed, falling back to in-memory rate limiting:', error);
      rateLimitStore = new InMemoryRateLimitStore();
    }
  } else {
    rateLimitStore = new InMemoryRateLimitStore();
    console.log('Rate limiting: Using in-memory store');
  }
  
  return rateLimitStore;
}

// Setup cleanup interval when store is initialized
function setupCleanupInterval() {
  const store = getRateLimitStore();
  if (store instanceof InMemoryRateLimitStore) {
    setInterval(() => {
      store.cleanup();
    }, 60 * 1000); // Clean every minute
  }
}

/**
 * Rate limiting middleware for batch operations
 * Enforces 50 requests per minute per user
 */
export async function batchRateLimit(userId: string, operation: string) {
  const key = `batch_rate_limit:${userId}:${operation}`;
  const store = getRateLimitStore();
  
  try {
    const { count, ttl } = await store.increment(key);
    
    if (count > RATE_LIMIT.MAX_REQUESTS) {
      const retryAfter = Math.ceil(ttl / 1000);
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT.MAX_REQUESTS} requests per minute. Try again in ${retryAfter} seconds.`,
        cause: {
          retryAfter,
          limit: RATE_LIMIT.MAX_REQUESTS,
          windowMs: RATE_LIMIT.WINDOW_MS,
        },
      });
    }
    
    return {
      remaining: RATE_LIMIT.MAX_REQUESTS - count,
      reset: Date.now() + ttl,
    };
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }
    
    // Log error but don't block the request if rate limiting fails
    console.error('Rate limiting error:', error);
    return {
      remaining: RATE_LIMIT.MAX_REQUESTS,
      reset: Date.now() + RATE_LIMIT.WINDOW_MS,
    };
  }
}

// Export for testing
export const _testExports = {
  InMemoryRateLimitStore,
  RedisRateLimitStore,
  RATE_LIMIT,
};