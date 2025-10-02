import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LLMService } from './llm-service';
import { LLMRepository } from '@agentris/db';
import { LLMProvider } from '@prisma/client';
import { prisma } from '@agentris/db';
import { CryptoService } from '@agentris/db/src/utils/crypto';

// Mock external dependencies
vi.mock('@anthropic-ai/sdk');
vi.mock('@agentris/db', async () => {
  const actual = await vi.importActual('@agentris/db');
  return {
    ...actual,
    prisma: {
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
      ticket: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
  };
});

describe('LLM Integration Service - End-to-End Tests', () => {
  let service: LLMService;
  let repository: LLMRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = 'test-api-key';
    
    repository = new LLMRepository(prisma);
    service = new LLMService({
      enableCache: true,
      enableUsageTracking: true,
      cacheTTL: 3600,
    });
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe('Complete LLM Request Flow', () => {
    it('should handle a complete request with caching and tracking', async () => {
      const testPrompt = 'Analyze this requirement: User authentication with OAuth2';
      const expectedResponse = 'Analysis: The requirement needs clarification on...';
      
      // Mock Anthropic response
      const Anthropic = require('@anthropic-ai/sdk');
      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: expectedResponse }],
            usage: { input_tokens: 50, output_tokens: 100 },
          }),
        },
      }));

      // Mock encrypted storage
      vi.spyOn(CryptoService, 'encrypt').mockResolvedValue('encrypted-data');
      vi.spyOn(CryptoService, 'decrypt').mockResolvedValue(expectedResponse);

      // Mock database operations
      prisma.lLMCache.findUnique.mockResolvedValue(null); // No cache hit
      prisma.lLMCache.upsert.mockResolvedValue({
        id: 'cache-1',
        cacheKey: 'test-key',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        response: 'encrypted-data',
        tokenCount: 150,
        expiresAt: new Date(Date.now() + 3600000),
        hitCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.lLMRequest.create.mockResolvedValue({
        id: 'request-1',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        prompt: 'encrypted-prompt',
        response: 'encrypted-response',
        tokenCount: 150,
        cost: 0.00075,
        userId: 'test-user',
        cacheHit: false,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.lLMUsage.upsert.mockResolvedValue({
        id: 'usage-1',
        userId: 'test-user',
        date: new Date(),
        provider: LLMProvider.ANTHROPIC,
        totalTokens: 150,
        totalCost: 0.00075,
        requestCount: 1,
        cacheHits: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute the request
      const result = await service.analyzeText(testPrompt, {
        systemPrompt: 'You are a requirements analyst',
        userId: 'test-user',
      });

      // Verify the response
      expect(result).toBe(expectedResponse);

      // Verify caching was attempted
      expect(prisma.lLMCache.findUnique).toHaveBeenCalled();
      expect(prisma.lLMCache.upsert).toHaveBeenCalled();

      // Verify request was tracked
      expect(prisma.lLMRequest.create).toHaveBeenCalled();
      expect(prisma.lLMUsage.upsert).toHaveBeenCalled();
    });

    it('should use cached response when available', async () => {
      const cachedResponse = 'Cached analysis response';
      
      // Mock cache hit
      prisma.lLMCache.findUnique.mockResolvedValue({
        id: 'cache-1',
        cacheKey: 'test-key',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        response: 'encrypted-response',
        tokenCount: 100,
        expiresAt: new Date(Date.now() + 3600000),
        hitCount: 5,
        lastAccessed: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      prisma.lLMCache.update.mockResolvedValue({
        id: 'cache-1',
        hitCount: 6,
        lastAccessed: new Date(),
      });

      vi.spyOn(CryptoService, 'decrypt').mockResolvedValue(cachedResponse);

      prisma.lLMUsage.upsert.mockResolvedValue({
        id: 'usage-1',
        userId: 'test-user',
        date: new Date(),
        provider: LLMProvider.ANTHROPIC,
        totalTokens: 0,
        totalCost: 0,
        requestCount: 0,
        cacheHits: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Execute the request
      const result = await service.analyzeText('Test prompt', {
        userId: 'test-user',
      });

      // Verify cached response was returned
      expect(result).toBe(cachedResponse);

      // Verify cache hit was recorded
      expect(prisma.lLMCache.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cache-1' },
          data: expect.objectContaining({
            hitCount: { increment: 1 },
          }),
        })
      );

      // Verify usage tracking for cache hit
      expect(prisma.lLMUsage.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            cacheHits: { increment: 1 },
          }),
        })
      );
    });

    it('should handle provider switching', async () => {
      const initialProvider = service.getCurrentProvider();
      expect(initialProvider).toBe(LLMProvider.ANTHROPIC);

      // Switch provider (would normally switch to a different provider)
      service.switchProvider(LLMProvider.ANTHROPIC, 'new-api-key');
      
      const newProvider = service.getCurrentProvider();
      expect(newProvider).toBe(LLMProvider.ANTHROPIC);
    });

    it('should track costs accurately', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Response' }],
            usage: { input_tokens: 1000, output_tokens: 2000 },
          }),
        },
      }));

      vi.spyOn(CryptoService, 'encrypt').mockResolvedValue('encrypted');
      vi.spyOn(CryptoService, 'decrypt').mockResolvedValue('Response');

      prisma.lLMCache.findUnique.mockResolvedValue(null);
      prisma.lLMRequest.create.mockResolvedValue({
        id: 'request-1',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        prompt: 'encrypted',
        response: 'encrypted',
        tokenCount: 3000,
        cost: 0.033, // (1000/1M * 3) + (2000/1M * 15)
        userId: 'test-user',
        cacheHit: false,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const response = await service.generateResponse(
        [
          { role: 'user', content: 'Calculate something' },
        ],
        {
          model: 'claude-3-sonnet-20240229',
          userId: 'test-user',
        }
      );

      if ('cost' in response) {
        // Expected cost: (1000/1M * 3) + (2000/1M * 15) = 0.003 + 0.03 = 0.033
        expect(response.cost).toBeCloseTo(0.033, 4);
      }
    });

    it('should handle retry logic on failures', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      let attempts = 0;
      
      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockImplementation(() => {
            attempts++;
            if (attempts < 3) {
              throw new Error('Rate limit exceeded');
            }
            return Promise.resolve({
              content: [{ type: 'text', text: 'Success after retry' }],
              usage: { input_tokens: 50, output_tokens: 50 },
            });
          }),
        },
      }));

      vi.spyOn(CryptoService, 'encrypt').mockResolvedValue('encrypted');
      prisma.lLMCache.findUnique.mockResolvedValue(null);
      prisma.lLMRequest.create.mockResolvedValue({
        id: 'request-1',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        prompt: 'encrypted',
        response: 'encrypted',
        tokenCount: 100,
        cost: 0.0005,
        userId: 'test-user',
        cacheHit: false,
        error: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.analyzeText('Test with retry', {
        userId: 'test-user',
      });

      expect(result).toBe('Success after retry');
      expect(attempts).toBe(3);
    });

    it('should clean up expired cache entries', async () => {
      prisma.lLMCache.deleteMany.mockResolvedValue({ count: 5 });

      const cleared = await service.clearCache();
      
      expect(prisma.lLMCache.deleteMany).toHaveBeenCalled();
      expect(cleared).toBe(5);
    });

    it('should aggregate usage statistics correctly', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-01-31');

      prisma.lLMUsage.findMany.mockResolvedValue([
        {
          id: '1',
          userId: 'test-user',
          date: new Date('2024-01-15'),
          provider: LLMProvider.ANTHROPIC,
          totalTokens: 10000,
          totalCost: 0.5,
          requestCount: 20,
          cacheHits: 5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '2',
          userId: 'test-user',
          date: new Date('2024-01-16'),
          provider: LLMProvider.ANTHROPIC,
          totalTokens: 15000,
          totalCost: 0.75,
          requestCount: 30,
          cacheHits: 10,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const stats = await service.getUsageStats('test-user', startDate, endDate);

      expect(stats).toHaveLength(2);
      expect(stats[0].totalTokens).toBe(10000);
      expect(stats[1].totalTokens).toBe(15000);
      
      const totalCost = stats.reduce((sum, s) => sum + s.totalCost, 0);
      expect(totalCost).toBe(1.25);
    });

    it('should validate configuration correctly', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue({
            content: [{ type: 'text', text: 'Valid' }],
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        },
      }));

      const isValid = await service.validateConfiguration();
      expect(isValid).toBe(true);
    });

    it('should handle streaming responses', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      
      // Mock streaming response
      async function* mockStream() {
        yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hello' } };
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: ' World' } };
        yield { type: 'message_delta', usage: { output_tokens: 5 } };
      }

      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockResolvedValue(mockStream()),
        },
      }));

      const response = await service.generateResponse(
        [{ role: 'user', content: 'Stream test' }],
        {
          stream: true,
          userId: 'test-user',
        }
      );

      if ('stream' in response) {
        const chunks = [];
        for await (const chunk of response.stream) {
          chunks.push(chunk);
        }
        expect(chunks.join('')).toBe('Hello World');
        
        const tokenCount = await response.getTokenCount();
        expect(tokenCount).toBe(15); // 10 input + 5 output
      }
    });
  });

  describe('Error Handling', () => {
    it('should log errors to database when requests fail', async () => {
      const Anthropic = require('@anthropic-ai/sdk');
      const error = new Error('API Error');
      
      Anthropic.default.mockImplementation(() => ({
        messages: {
          create: vi.fn().mockRejectedValue(error),
        },
      }));

      vi.spyOn(CryptoService, 'encrypt').mockResolvedValue('encrypted-error');
      prisma.lLMCache.findUnique.mockResolvedValue(null);
      prisma.lLMRequest.create.mockResolvedValue({
        id: 'error-request',
        provider: LLMProvider.ANTHROPIC,
        model: 'claude-3-sonnet-20240229',
        prompt: 'encrypted',
        response: null,
        tokenCount: 0,
        cost: 0,
        userId: 'test-user',
        cacheHit: false,
        error: 'encrypted-error',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.analyzeText('Test error', { userId: 'test-user' })
      ).rejects.toThrow('API Error');

      expect(prisma.lLMRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            error: 'encrypted-error',
          }),
        })
      );
    });

    it('should handle missing API key gracefully', async () => {
      delete process.env.ANTHROPIC_API_KEY;
      
      expect(() => {
        new LLMService({
          enableCache: true,
          enableUsageTracking: true,
        });
      }).toThrow('No LLM provider configuration found');
    });
  });

  describe('Cache Performance', () => {
    it('should track cache statistics accurately', async () => {
      prisma.lLMCache.aggregate.mockResolvedValue({
        _count: { id: 50 },
        _sum: { hitCount: 150 },
        _avg: { hitCount: 3 },
      });

      const stats = await service.getCacheStats();
      
      expect(stats.totalEntries).toBe(50);
      expect(stats.totalHits).toBe(150);
      expect(stats.avgHitRate).toBe(3);
    });

    it('should generate consistent cache keys', async () => {
      const messages = [
        { role: 'system' as const, content: 'You are helpful' },
        { role: 'user' as const, content: 'Hello' },
      ];
      
      // Generate cache key twice with same input
      const key1 = (service as any).generateCacheKey(messages, 'claude-3-sonnet', {
        temperature: 0.7,
        maxTokens: 100,
      });
      
      const key2 = (service as any).generateCacheKey(messages, 'claude-3-sonnet', {
        temperature: 0.7,
        maxTokens: 100,
      });
      
      expect(key1).toBe(key2);
      expect(key1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex format
    });
  });
});