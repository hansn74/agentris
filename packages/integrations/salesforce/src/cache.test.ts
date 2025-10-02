import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  MetadataCache,
  CacheKeys,
  CacheTTL,
  CacheTags,
  getGlobalCache,
  clearGlobalCache,
} from './cache';

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('MetadataCache', () => {
  let cache: MetadataCache;

  beforeEach(() => {
    vi.useFakeTimers();
    cache = new MetadataCache({
      defaultTTL: 1000, // 1 second for testing
      maxSize: 3, // Small size for testing eviction
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('basic operations', () => {
    it('should set and get values', async () => {
      await cache.set('key1', { data: 'value1' });
      const result = await cache.get('key1');

      expect(result).toEqual({ data: 'value1' });
    });

    it('should return null for non-existent keys', async () => {
      const result = await cache.get('nonexistent');
      expect(result).toBeNull();
    });

    it('should delete values', async () => {
      await cache.set('key1', 'value1');
      const deleted = await cache.delete('key1');

      expect(deleted).toBe(true);

      const result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should return false when deleting non-existent key', async () => {
      const deleted = await cache.delete('nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('TTL and expiration', () => {
    it('should expire entries after TTL', async () => {
      await cache.set('key1', 'value1', 500); // 500ms TTL

      // Should exist immediately
      let result = await cache.get('key1');
      expect(result).toBe('value1');

      // Should expire after 500ms
      vi.advanceTimersByTime(501);
      result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should use default TTL when not specified', async () => {
      await cache.set('key1', 'value1'); // Uses default 1000ms

      // Should exist at 999ms
      vi.advanceTimersByTime(999);
      let result = await cache.get('key1');
      expect(result).toBe('value1');

      // Should expire after 1000ms
      vi.advanceTimersByTime(2);
      result = await cache.get('key1');
      expect(result).toBeNull();
    });

    it('should clean up expired entries periodically', async () => {
      await cache.set('key1', 'value1', 500);
      await cache.set('key2', 'value2', 1500);

      // Advance past key1 expiration but not key2
      vi.advanceTimersByTime(60000); // Trigger cleanup interval

      const result1 = await cache.get('key1');
      const result2 = await cache.get('key2');

      expect(result1).toBeNull();
      expect(result2).toBeNull(); // Also expired after 60s
    });
  });

  describe('capacity management', () => {
    it('should evict oldest entry when capacity is reached', async () => {
      // Fill cache to capacity
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Adding fourth item should evict first
      await cache.set('key4', 'value4');

      const result1 = await cache.get('key1');
      const result4 = await cache.get('key4');

      expect(result1).toBeNull(); // Evicted
      expect(result4).toBe('value4'); // Still present
    });
  });

  describe('tags and invalidation', () => {
    it('should store and invalidate by tags', async () => {
      await cache.set('key1', 'value1', undefined, ['tag1', 'tag2']);
      await cache.set('key2', 'value2', undefined, ['tag2', 'tag3']);
      await cache.set('key3', 'value3', undefined, ['tag3']);

      // Invalidate by tag2
      const count = await cache.invalidateByTags(['tag2']);

      expect(count).toBe(2);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBe('value3');
    });

    it('should invalidate by pattern', async () => {
      await cache.set('user:1', 'value1');
      await cache.set('user:2', 'value2');
      await cache.set('post:1', 'value3');

      const count = await cache.invalidate('user:.*');

      expect(count).toBe(2);
      expect(await cache.get('user:1')).toBeNull();
      expect(await cache.get('user:2')).toBeNull();
      expect(await cache.get('post:1')).toBe('value3');
    });

    it('should clear all entries when pattern is not provided', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      const count = await cache.invalidate();

      expect(count).toBe(3);
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBeNull();
    });
  });

  describe('cache warming', () => {
    it('should warm cache with provided data', async () => {
      const loader = async () => [
        { key: 'key1', value: 'value1', ttl: 2000 },
        { key: 'key2', value: 'value2', tags: ['tag1'] },
        { key: 'key3', value: { nested: 'data' } },
      ];

      const count = await cache.warmCache(loader);

      expect(count).toBe(3);
      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toEqual({ nested: 'data' });
    });

    it('should handle errors in cache warming', async () => {
      const loader = async () => {
        throw new Error('Loading failed');
      };

      const count = await cache.warmCache(loader);
      expect(count).toBe(0);
    });
  });

  describe('statistics', () => {
    it('should track cache hits and misses', async () => {
      await cache.set('key1', 'value1');

      // Hit
      await cache.get('key1');
      // Miss
      await cache.get('key2');
      // Hit
      await cache.get('key1');

      const stats = cache.getStats();

      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(66.67, 1);
    });

    it('should track sets and deletes', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.delete('key1');

      const stats = cache.getStats();

      expect(stats.sets).toBe(2);
      expect(stats.deletes).toBe(1);
      expect(stats.size).toBe(1);
    });

    it('should reset statistics', () => {
      cache.set('key1', 'value1');
      cache.get('key1');

      cache.resetStats();
      const stats = cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
    });
  });

  describe('Redis integration', () => {
    it('should use Redis when client is provided', async () => {
      const mockRedisClient = {
        get: vi.fn(),
        setex: vi.fn(),
        del: vi.fn(),
        keys: vi.fn(),
      };

      const cacheWithRedis = new MetadataCache({
        redisClient: mockRedisClient,
      });

      // Test set
      await cacheWithRedis.set('key1', 'value1', 5000);
      expect(mockRedisClient.setex).toHaveBeenCalledWith(
        expect.stringContaining('key1'),
        5,
        expect.any(String)
      );

      // Test get - Redis returns null, falls back to memory
      mockRedisClient.get.mockResolvedValue(null);
      await cacheWithRedis.get('key1');
      expect(mockRedisClient.get).toHaveBeenCalled();

      // Test delete
      await cacheWithRedis.delete('key1');
      expect(mockRedisClient.del).toHaveBeenCalled();
    });

    it('should handle Redis errors gracefully', async () => {
      const mockRedisClient = {
        get: vi.fn().mockRejectedValue(new Error('Redis error')),
        setex: vi.fn().mockRejectedValue(new Error('Redis error')),
        del: vi.fn().mockRejectedValue(new Error('Redis error')),
      };

      const cacheWithRedis = new MetadataCache({
        redisClient: mockRedisClient,
      });

      // Should still work with memory cache despite Redis errors
      await cacheWithRedis.set('key1', 'value1');
      const result = await cacheWithRedis.get('key1');
      expect(result).toBe('value1');
    });
  });

  describe('cache key generators', () => {
    it('should generate consistent cache keys', () => {
      expect(CacheKeys.orgGlobal('org123')).toBe('org:org123:global');
      expect(CacheKeys.objectDescribe('org123', 'Account')).toBe('org:org123:object:Account');
      expect(CacheKeys.objectFields('org123', 'Contact')).toBe('org:org123:fields:Contact');
      expect(CacheKeys.objectLayouts('org123', 'Lead')).toBe('org:org123:layouts:Lead');
      expect(CacheKeys.objectValidationRules('org123', 'Opportunity')).toBe(
        'org:org123:rules:Opportunity'
      );
      expect(CacheKeys.orgLimits('org123')).toBe('org:org123:limits');
      expect(CacheKeys.deployment('deploy123')).toBe('deployment:deploy123');
    });
  });

  describe('cache tags generators', () => {
    it('should generate consistent cache tags', () => {
      expect(CacheTags.ORG('org123')).toBe('org:org123');
      expect(CacheTags.OBJECT('org123', 'Account')).toBe('object:org123:Account');
      expect(CacheTags.METADATA).toBe('metadata');
      expect(CacheTags.LIMITS).toBe('limits');
      expect(CacheTags.DEPLOYMENT).toBe('deployment');
    });
  });

  describe('cache TTL presets', () => {
    it('should have correct TTL values', () => {
      expect(CacheTTL.SHORT).toBe(300000); // 5 minutes
      expect(CacheTTL.MEDIUM).toBe(1800000); // 30 minutes
      expect(CacheTTL.LONG).toBe(3600000); // 1 hour
      expect(CacheTTL.VERY_LONG).toBe(86400000); // 24 hours
    });
  });

  describe('global cache', () => {
    afterEach(() => {
      clearGlobalCache();
    });

    it('should provide singleton global cache', () => {
      const cache1 = getGlobalCache();
      const cache2 = getGlobalCache();

      expect(cache1).toBe(cache2);
    });

    it('should clear global cache', async () => {
      const globalCache = getGlobalCache();
      await globalCache.set('key1', 'value1');

      clearGlobalCache();

      const newCache = getGlobalCache();
      const result = await newCache.get('key1');
      expect(result).toBeNull();
    });
  });
});
