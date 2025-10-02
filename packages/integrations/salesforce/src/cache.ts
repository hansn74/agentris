import pino from 'pino';
import { z } from 'zod';

const logger = pino({ name: 'salesforce-metadata-cache' });

// Cache entry schema for validation
const cacheEntrySchema = z.object({
  data: z.any(),
  timestamp: z.number(),
  ttl: z.number(),
  tags: z.array(z.string()).optional(),
});

type CacheEntry = z.infer<typeof cacheEntrySchema>;

export interface CacheOptions {
  defaultTTL?: number; // milliseconds
  maxSize?: number; // max entries in memory cache
  prefix?: string; // key prefix for namespacing
  redisClient?: any; // Optional Redis client
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
  hitRate: number;
}

export class MetadataCache {
  private memoryCache: Map<string, CacheEntry>;
  private stats: CacheStats;
  private options: Required<Omit<CacheOptions, 'redisClient'>> & { redisClient?: any };
  private readonly DEFAULT_TTL = 1800000; // 30 minutes
  private readonly MAX_SIZE = 1000;

  constructor(options: CacheOptions = {}) {
    this.options = {
      defaultTTL: options.defaultTTL || this.DEFAULT_TTL,
      maxSize: options.maxSize || this.MAX_SIZE,
      prefix: options.prefix || 'sf:metadata:',
      redisClient: options.redisClient,
    };

    this.memoryCache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: 0,
      hitRate: 0,
    };

    // Start cleanup interval for expired entries
    this.startCleanupInterval();
  }

  async get<T>(key: string): Promise<T | null> {
    const fullKey = this.getFullKey(key);

    try {
      // Try Redis first if available
      if (this.options.redisClient) {
        const redisValue = await this.getFromRedis(fullKey);
        if (redisValue !== null) {
          this.stats.hits++;
          this.updateHitRate();
          logger.debug({ key: fullKey }, 'Cache hit (Redis)');
          return redisValue as T;
        }
      }

      // Fall back to memory cache
      const entry = this.memoryCache.get(fullKey);

      if (entry) {
        // Check if entry is expired
        if (this.isExpired(entry)) {
          this.memoryCache.delete(fullKey);
          this.stats.misses++;
          this.updateHitRate();
          logger.debug({ key: fullKey }, 'Cache miss (expired)');
          return null;
        }

        this.stats.hits++;
        this.updateHitRate();
        logger.debug({ key: fullKey }, 'Cache hit (memory)');
        return entry.data as T;
      }

      this.stats.misses++;
      this.updateHitRate();
      logger.debug({ key: fullKey }, 'Cache miss');
      return null;
    } catch (error) {
      logger.error({ error, key: fullKey }, 'Cache get error');
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number, tags?: string[]): Promise<void> {
    const fullKey = this.getFullKey(key);
    const ttlMs = ttl || this.options.defaultTTL;

    try {
      const entry: CacheEntry = {
        data: value,
        timestamp: Date.now(),
        ttl: ttlMs,
        tags: tags,
      };

      // Store in Redis if available
      if (this.options.redisClient) {
        await this.setInRedis(fullKey, entry, ttlMs);
      }

      // Store in memory cache
      this.ensureCapacity();
      this.memoryCache.set(fullKey, entry);

      // Update tags index
      if (tags && tags.length > 0) {
        this.updateTagsIndex(fullKey, tags);
      }

      this.stats.sets++;
      this.stats.size = this.memoryCache.size;

      logger.debug(
        {
          key: fullKey,
          ttl: ttlMs,
          tags,
        },
        'Cache set'
      );
    } catch (error) {
      logger.error({ error, key: fullKey }, 'Cache set error');
    }
  }

  async delete(key: string): Promise<boolean> {
    const fullKey = this.getFullKey(key);

    try {
      let deleted = false;

      // Delete from Redis if available
      if (this.options.redisClient) {
        await this.deleteFromRedis(fullKey);
        deleted = true;
      }

      // Delete from memory cache
      if (this.memoryCache.delete(fullKey)) {
        deleted = true;
      }

      if (deleted) {
        this.stats.deletes++;
        this.stats.size = this.memoryCache.size;
        logger.debug({ key: fullKey }, 'Cache delete');
      }

      return deleted;
    } catch (error) {
      logger.error({ error, key: fullKey }, 'Cache delete error');
      return false;
    }
  }

  async invalidate(pattern?: string): Promise<number> {
    let count = 0;

    try {
      if (pattern) {
        // Invalidate by pattern
        const regex = new RegExp(pattern);
        const keysToDelete: string[] = [];

        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            keysToDelete.push(key);
          }
        }

        for (const key of keysToDelete) {
          if (await this.delete(key.replace(this.options.prefix, ''))) {
            count++;
          }
        }

        logger.info({ pattern, count }, 'Cache invalidated by pattern');
      } else {
        // Clear all
        count = this.memoryCache.size;
        this.memoryCache.clear();

        if (this.options.redisClient) {
          await this.clearRedis();
        }

        this.stats.size = 0;
        logger.info({ count }, 'Cache cleared');
      }

      return count;
    } catch (error) {
      logger.error({ error, pattern }, 'Cache invalidate error');
      return count;
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    let count = 0;
    const keysToDelete: string[] = [];

    try {
      // Find all keys with matching tags
      for (const [key, entry] of this.memoryCache.entries()) {
        if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
          keysToDelete.push(key);
        }
      }

      // Delete matching keys
      for (const key of keysToDelete) {
        if (await this.delete(key.replace(this.options.prefix, ''))) {
          count++;
        }
      }

      logger.info({ tags, count }, 'Cache invalidated by tags');
      return count;
    } catch (error) {
      logger.error({ error, tags }, 'Cache invalidate by tags error');
      return count;
    }
  }

  async warmCache(
    loader: () => Promise<{ key: string; value: any; ttl?: number; tags?: string[] }[]>
  ): Promise<number> {
    try {
      logger.info('Starting cache warming');
      const items = await loader();

      for (const item of items) {
        await this.set(item.key, item.value, item.ttl, item.tags);
      }

      logger.info({ count: items.length }, 'Cache warming completed');
      return items.length;
    } catch (error) {
      logger.error({ error }, 'Cache warming failed');
      return 0;
    }
  }

  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.memoryCache.size,
      hitRate:
        this.stats.hits + this.stats.misses > 0
          ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100
          : 0,
    };
  }

  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      size: this.memoryCache.size,
      hitRate: 0,
    };
    logger.info('Cache stats reset');
  }

  // Helper methods

  private getFullKey(key: string): string {
    return `${this.options.prefix}${key}`;
  }

  private isExpired(entry: CacheEntry): boolean {
    return Date.now() > entry.timestamp + entry.ttl;
  }

  private ensureCapacity(): void {
    if (this.memoryCache.size >= this.options.maxSize) {
      // Remove oldest entry (FIFO)
      const firstKey = this.memoryCache.keys().next().value;
      if (firstKey) {
        this.memoryCache.delete(firstKey);
        logger.debug({ key: firstKey }, 'Evicted oldest cache entry');
      }
    }
  }

  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    if (total > 0) {
      this.stats.hitRate = (this.stats.hits / total) * 100;
    }
  }

  private updateTagsIndex(key: string, tags: string[]): void {
    // In a production system, this would update a tags index
    // For now, tags are stored with the entry
  }

  private startCleanupInterval(): void {
    setInterval(() => {
      let cleaned = 0;
      const now = Date.now();

      for (const [key, entry] of this.memoryCache.entries()) {
        if (now > entry.timestamp + entry.ttl) {
          this.memoryCache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.stats.size = this.memoryCache.size;
        logger.debug({ cleaned }, 'Cleaned expired cache entries');
      }
    }, 60000); // Run every minute
  }

  // Redis operations (placeholders for when Redis is configured)

  private async getFromRedis(key: string): Promise<any | null> {
    if (!this.options.redisClient) return null;

    try {
      const value = await this.options.redisClient.get(key);
      if (value) {
        const entry = JSON.parse(value);
        if (!this.isExpired(entry)) {
          return entry.data;
        }
        await this.options.redisClient.del(key);
      }
      return null;
    } catch (error) {
      logger.error({ error, key }, 'Redis get error');
      return null;
    }
  }

  private async setInRedis(key: string, entry: CacheEntry, ttlMs: number): Promise<void> {
    if (!this.options.redisClient) return;

    try {
      const value = JSON.stringify(entry);
      const ttlSeconds = Math.ceil(ttlMs / 1000);
      await this.options.redisClient.setex(key, ttlSeconds, value);
    } catch (error) {
      logger.error({ error, key }, 'Redis set error');
    }
  }

  private async deleteFromRedis(key: string): Promise<void> {
    if (!this.options.redisClient) return;

    try {
      await this.options.redisClient.del(key);
    } catch (error) {
      logger.error({ error, key }, 'Redis delete error');
    }
  }

  private async clearRedis(): Promise<void> {
    if (!this.options.redisClient) return;

    try {
      const pattern = `${this.options.prefix}*`;
      const keys = await this.options.redisClient.keys(pattern);
      if (keys.length > 0) {
        await this.options.redisClient.del(...keys);
      }
    } catch (error) {
      logger.error({ error }, 'Redis clear error');
    }
  }
}

// Singleton instance for global cache
let globalCache: MetadataCache | null = null;

export function getGlobalCache(options?: CacheOptions): MetadataCache {
  if (!globalCache) {
    globalCache = new MetadataCache(options);
  }
  return globalCache;
}

export function clearGlobalCache(): void {
  if (globalCache) {
    globalCache.invalidate();
    globalCache = null;
  }
}

// Cache key generators for consistent key formatting
export const CacheKeys = {
  orgGlobal: (orgId: string) => `org:${orgId}:global`,
  objectDescribe: (orgId: string, objectName: string) => `org:${orgId}:object:${objectName}`,
  objectFields: (orgId: string, objectName: string) => `org:${orgId}:fields:${objectName}`,
  objectLayouts: (orgId: string, objectName: string) => `org:${orgId}:layouts:${objectName}`,
  objectValidationRules: (orgId: string, objectName: string) => `org:${orgId}:rules:${objectName}`,
  orgLimits: (orgId: string) => `org:${orgId}:limits`,
  deployment: (deploymentId: string) => `deployment:${deploymentId}`,
};

// Cache TTL presets (in milliseconds)
export const CacheTTL = {
  SHORT: 300000, // 5 minutes
  MEDIUM: 1800000, // 30 minutes
  LONG: 3600000, // 1 hour
  VERY_LONG: 86400000, // 24 hours
};

// Cache tags for invalidation groups
export const CacheTags = {
  ORG: (orgId: string) => `org:${orgId}`,
  OBJECT: (orgId: string, objectName: string) => `object:${orgId}:${objectName}`,
  METADATA: 'metadata',
  LIMITS: 'limits',
  DEPLOYMENT: 'deployment',
};
