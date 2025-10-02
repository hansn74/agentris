import { createHash } from 'crypto';
import { Redis } from 'ioredis';

export interface CacheConfig {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * LLM response cache for reducing API calls and improving performance
 */
export class LLMCache {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private redis: Redis | null = null;
  private readonly defaultTTL = 3600; // 1 hour default
  private readonly maxMemoryCacheSize = 100;
  private readonly prefix: string;

  constructor(config: CacheConfig = {}) {
    this.prefix = config.prefix || 'llm_cache';
    
    // Try to connect to Redis if available
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        console.log('LLM Cache: Using Redis for caching');
      } catch (error) {
        console.warn('LLM Cache: Redis connection failed, using memory cache:', error);
      }
    } else {
      console.log('LLM Cache: Using in-memory cache');
    }
  }

  /**
   * Generate cache key from prompt and parameters
   */
  generateKey(prompt: string, params: Record<string, any> = {}): string {
    const content = JSON.stringify({ prompt, params });
    const hash = createHash('sha256').update(content).digest('hex');
    return `${this.prefix}:${hash}`;
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Try Redis first
    if (this.redis) {
      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const entry: CacheEntry<T> = JSON.parse(cached);
          // Update hit count
          entry.hits++;
          await this.redis.set(
            key, 
            JSON.stringify(entry),
            'EX',
            this.defaultTTL
          );
          return entry.value;
        }
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    // Fallback to memory cache
    const entry = this.memoryCache.get(key);
    if (entry) {
      const now = Date.now();
      const age = (now - entry.timestamp) / 1000;
      
      if (age < this.defaultTTL) {
        entry.hits++;
        return entry.value;
      } else {
        // Expired
        this.memoryCache.delete(key);
      }
    }

    return null;
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      hits: 0,
    };

    const ttlSeconds = ttl || this.defaultTTL;

    // Store in Redis if available
    if (this.redis) {
      try {
        await this.redis.set(
          key,
          JSON.stringify(entry),
          'EX',
          ttlSeconds
        );
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }

    // Also store in memory cache
    this.memoryCache.set(key, entry);

    // Evict oldest entries if cache is too large
    if (this.memoryCache.size > this.maxMemoryCacheSize) {
      this.evictOldest();
    }
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }
    this.memoryCache.delete(key);
  }

  /**
   * Clear all cached values
   */
  async clear(): Promise<void> {
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}:*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
        }
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }
    this.memoryCache.clear();
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    size: number;
    memorySize: number;
    redisConnected: boolean;
    topKeys: Array<{ key: string; hits: number }>;
  }> {
    const topKeys: Array<{ key: string; hits: number }> = [];
    
    // Get top keys from memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      topKeys.push({ key, hits: entry.hits });
    }
    topKeys.sort((a, b) => b.hits - a.hits);

    let redisSize = 0;
    if (this.redis) {
      try {
        const keys = await this.redis.keys(`${this.prefix}:*`);
        redisSize = keys.length;
      } catch (error) {
        console.error('Redis stats error:', error);
      }
    }

    return {
      size: redisSize || this.memoryCache.size,
      memorySize: this.memoryCache.size,
      redisConnected: !!this.redis,
      topKeys: topKeys.slice(0, 10),
    };
  }

  /**
   * Evict oldest entries from memory cache
   */
  private evictOldest(): void {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 10% of entries
    const toRemove = Math.ceil(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.memoryCache.delete(entries[i][0]);
    }
  }

  /**
   * Wrap an async function with caching
   */
  wrap<T>(
    fn: (...args: any[]) => Promise<T>,
    keyGenerator: (...args: any[]) => string,
    ttl?: number
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      const key = keyGenerator(...args);
      
      // Check cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Call function
      const result = await fn(...args);
      
      // Cache result
      await this.set(key, result, ttl);
      
      return result;
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
    this.memoryCache.clear();
  }
}

// Singleton instance
let cacheInstance: LLMCache | null = null;

export function getLLMCache(config?: CacheConfig): LLMCache {
  if (!cacheInstance) {
    cacheInstance = new LLMCache(config);
  }
  return cacheInstance;
}