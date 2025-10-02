import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMRepository } from './LLMRepository';
import { PrismaClient, LLMProvider } from '@prisma/client';
import { CryptoService } from '../utils/crypto';

// Mock the CryptoService to avoid actual encryption in tests
vi.mock('../utils/crypto', () => ({
  CryptoService: {
    encrypt: vi.fn((text) => Promise.resolve('encrypted:' + text)),
    decrypt: vi.fn((text) => Promise.resolve(text.replace('encrypted:', ''))),
  },
}));

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(() => ({
    lLMRequest: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    lLMUsage: {
      upsert: vi.fn(),
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    lLMCache: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      aggregate: vi.fn(),
    },
  })),
  LLMProvider: {
    ANTHROPIC: 'ANTHROPIC',
    OPENAI: 'OPENAI',
    GEMINI: 'GEMINI',
  },
}));

describe('LLMRepository', () => {
  let repository: LLMRepository;
  let prisma: any;

  beforeEach(() => {
    prisma = new PrismaClient();
    repository = new LLMRepository(prisma);
    vi.clearAllMocks();
  });

  describe('createRequest', () => {
    it('should create an LLM request', async () => {
      const requestData = {
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-opus',
        prompt: 'Test prompt',
        response: 'Test response',
        tokenCount: 100,
        cost: 0.01,
        userId: 'user123',
        cacheHit: false,
      };

      const encryptedData = {
        ...requestData,
        prompt: 'encrypted:' + requestData.prompt,
        response: requestData.response ? 'encrypted:' + requestData.response : undefined,
        error: undefined,
      };
      const expected = { id: 'req123', ...encryptedData, createdAt: new Date() };
      prisma.lLMRequest.create.mockResolvedValue(expected);

      const result = await repository.createRequest(requestData);

      expect(CryptoService.encrypt).toHaveBeenCalledWith(requestData.prompt);
      expect(prisma.lLMRequest.create).toHaveBeenCalled();
      expect(result.prompt).toEqual(requestData.prompt); // Should be decrypted
    });
  });

  describe('getRequestById', () => {
    it('should retrieve a request by ID', async () => {
      const expected = {
        id: 'req123',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-opus',
        prompt: 'encrypted:Test',
        response: null,
        error: null,
        tokenCount: 100,
        cost: 0.01,
        userId: 'user123',
      };

      prisma.lLMRequest.findUnique.mockResolvedValue(expected);

      const result = await repository.getRequestById('req123');

      expect(prisma.lLMRequest.findUnique).toHaveBeenCalledWith({
        where: { id: 'req123' },
      });
      expect(result).not.toBeNull();
      expect(result!.prompt).toEqual('Test'); // Should be decrypted
      expect(CryptoService.decrypt).toHaveBeenCalledWith('encrypted:Test');
    });

    it('should return null if request not found', async () => {
      prisma.lLMRequest.findUnique.mockResolvedValue(null);

      const result = await repository.getRequestById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('upsertUsage', () => {
    it('should upsert usage statistics', async () => {
      const usageData = {
        userId: 'user123',
        date: new Date('2024-01-15'),
        provider: LLMProvider.ANTHROPIC,
        totalTokens: 1000,
        totalCost: 0.1,
        requestCount: 10,
        cacheHits: 2,
      };

      const expected = { id: 'usage123', ...usageData };
      prisma.lLMUsage.upsert.mockResolvedValue(expected);

      const result = await repository.upsertUsage(usageData);

      expect(prisma.lLMUsage.upsert).toHaveBeenCalled();
      expect(result).toEqual(expected);
    });
  });

  describe('Cache operations', () => {
    describe('generateCacheKey', () => {
      it('should generate consistent cache keys', () => {
        const key1 = repository.generateCacheKey(
          LLMProvider.ANTHROPIC,
          'claude-3-opus',
          'Test prompt'
        );
        const key2 = repository.generateCacheKey(
          LLMProvider.ANTHROPIC,
          'claude-3-opus',
          'Test prompt'
        );

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex string
      });

      it('should generate different keys for different inputs', () => {
        const key1 = repository.generateCacheKey(
          LLMProvider.ANTHROPIC,
          'claude-3-opus',
          'Prompt 1'
        );
        const key2 = repository.generateCacheKey(
          LLMProvider.ANTHROPIC,
          'claude-3-opus',
          'Prompt 2'
        );

        expect(key1).not.toBe(key2);
      });
    });

    describe('getCachedResponse', () => {
      it('should return cached response if not expired', async () => {
        const futureDate = new Date(Date.now() + 3600000);
        const cached = {
          id: 'cache123',
          cacheKey: 'key123',
          response: 'encrypted:Cached response',
          expiresAt: futureDate,
          hitCount: 5,
        };

        prisma.lLMCache.findUnique.mockResolvedValue(cached);
        prisma.lLMCache.update.mockResolvedValue({ ...cached, hitCount: 6 });

        const result = await repository.getCachedResponse('key123');

        expect(prisma.lLMCache.findUnique).toHaveBeenCalledWith({
          where: { cacheKey: 'key123' },
        });
        expect(prisma.lLMCache.update).toHaveBeenCalledWith({
          where: { id: 'cache123' },
          data: {
            hitCount: { increment: 1 },
            lastAccessed: expect.any(Date),
          },
        });
        expect(result).toBeTruthy();
        expect(result!.response).toBe('Cached response'); // Should be decrypted
      });

      it('should delete and return null for expired cache', async () => {
        const pastDate = new Date(Date.now() - 3600000);
        const cached = {
          id: 'cache123',
          cacheKey: 'key123',
          response: 'Expired response',
          expiresAt: pastDate,
        };

        prisma.lLMCache.findUnique.mockResolvedValue(cached);
        prisma.lLMCache.delete.mockResolvedValue(cached);

        const result = await repository.getCachedResponse('key123');

        expect(prisma.lLMCache.delete).toHaveBeenCalledWith({
          where: { id: 'cache123' },
        });
        expect(result).toBeNull();
      });
    });

    describe('setCachedResponse', () => {
      it('should create or update cache entry', async () => {
        const cacheData = {
          cacheKey: 'key123',
          provider: LLMProvider.ANTHROPIC,
          model: 'claude-3-opus',
          response: 'Test response',
          tokenCount: 100,
          ttlSeconds: 7200,
        };

        const expected = {
          id: 'cache123',
          ...cacheData,
          expiresAt: new Date(Date.now() + 7200000),
        };

        prisma.lLMCache.upsert.mockResolvedValue(expected);

        const result = await repository.setCachedResponse(cacheData);

        expect(prisma.lLMCache.upsert).toHaveBeenCalled();
        expect(result).toEqual(expected);
      });

      it('should use default TTL if not specified', async () => {
        const cacheData = {
          cacheKey: 'key123',
          provider: LLMProvider.ANTHROPIC,
          model: 'claude-3-opus',
          response: 'Test response',
          tokenCount: 100,
        };

        prisma.lLMCache.upsert.mockResolvedValue({ id: 'cache123' });

        await repository.setCachedResponse(cacheData);

        const call = prisma.lLMCache.upsert.mock.calls[0][0];
        const expiresAt = call.create.expiresAt;
        const expectedExpiry = Date.now() + 3600000; // 1 hour default

        expect(Math.abs(expiresAt.getTime() - expectedExpiry)).toBeLessThan(1000);
      });
    });

    describe('clearExpiredCache', () => {
      it('should delete expired cache entries', async () => {
        prisma.lLMCache.deleteMany.mockResolvedValue({ count: 5 });

        const result = await repository.clearExpiredCache();

        expect(prisma.lLMCache.deleteMany).toHaveBeenCalledWith({
          where: {
            expiresAt: { lt: expect.any(Date) },
          },
        });
        expect(result).toBe(5);
      });
    });

    describe('getCacheStats', () => {
      it('should return cache statistics', async () => {
        prisma.lLMCache.aggregate.mockResolvedValue({
          _count: { id: 10 },
          _sum: { hitCount: 50 },
          _avg: { hitCount: 5 },
        });

        const result = await repository.getCacheStats();

        expect(result).toEqual({
          totalEntries: 10,
          totalHits: 50,
          avgHitRate: 5,
        });
      });
    });
  });

  describe('Usage aggregation', () => {
    describe('getUsageByUser', () => {
      it('should retrieve usage for a user within date range', async () => {
        const startDate = new Date('2024-01-01');
        const endDate = new Date('2024-01-31');
        const expected = [
          { id: 'usage1', userId: 'user123', date: new Date('2024-01-15') },
          { id: 'usage2', userId: 'user123', date: new Date('2024-01-20') },
        ];

        prisma.lLMUsage.findMany.mockResolvedValue(expected);

        const result = await repository.getUsageByUser('user123', startDate, endDate);

        expect(prisma.lLMUsage.findMany).toHaveBeenCalledWith({
          where: {
            userId: 'user123',
            date: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: { date: 'desc' },
        });
        expect(result).toEqual(expected);
      });
    });

    describe('getAggregatedUsage', () => {
      it('should return aggregated usage statistics', async () => {
        const expected = {
          _sum: {
            totalTokens: 10000,
            totalCost: 1.5,
            requestCount: 100,
            cacheHits: 20,
          },
        };

        prisma.lLMUsage.aggregate.mockResolvedValue(expected);

        const result = await repository.getAggregatedUsage(
          new Date('2024-01-01'),
          new Date('2024-01-31')
        );

        expect(prisma.lLMUsage.aggregate).toHaveBeenCalled();
        expect(result).toEqual(expected);
      });
    });
  });
});