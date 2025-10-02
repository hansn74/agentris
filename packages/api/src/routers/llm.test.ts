import { describe, it, expect, vi, beforeEach } from 'vitest';
import { llmRouter } from './llm';
import { createInnerTRPCContext } from '../trpc';
import { TRPCError } from '@trpc/server';
import { Session } from 'next-auth';

// Mock dependencies
vi.mock('@agentris/ai-engine', () => ({
  LLMService: vi.fn().mockImplementation(() => ({
    analyzeText: vi.fn(),
    generateResponse: vi.fn(),
    getAvailableModels: vi.fn(),
    validateConfiguration: vi.fn(),
  })),
  LLMProvider: {
    ANTHROPIC: 'ANTHROPIC',
  },
}));

vi.mock('@agentris/db', () => ({
  LLMRepository: vi.fn().mockImplementation(() => ({
    getUsageByUser: vi.fn(),
    getAggregatedUsage: vi.fn(),
    getCacheStats: vi.fn(),
    clearAllCache: vi.fn(),
    clearExpiredCache: vi.fn(),
  })),
  prisma: {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

describe('llmRouter', () => {
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let mockSession: Session;
  let mockLLMService: any;
  let mockRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSession = {
      user: {
        id: 'user123',
        email: 'test@example.com',
        name: 'Test User',
        role: 'ADMIN',
      },
      expires: new Date(Date.now() + 86400000).toISOString(),
    } as Session;

    ctx = createInnerTRPCContext({ session: mockSession });

    // Get mocked instances
    const { LLMService } = require('@agentris/ai-engine');
    mockLLMService = LLMService.mock.results[0]?.value;

    const { LLMRepository } = require('@agentris/db');
    mockRepository = LLMRepository.mock.results[0]?.value;
  });

  describe('analyzeRequirements', () => {
    it('should analyze requirements for a ticket', async () => {
      const { prisma } = require('@agentris/db');
      
      prisma.ticket.findUnique.mockResolvedValue({
        id: 'ticket123',
        summary: 'Test ticket',
      });

      prisma.ticket.update.mockResolvedValue({
        id: 'ticket123',
        status: 'ANALYZING',
      });

      mockLLMService.analyzeText.mockResolvedValue('Analysis result');

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.analyzeRequirements({
        ticketId: 'ticket123',
        text: 'Requirements text',
        systemPrompt: 'Analyze this',
      });

      expect(result).toEqual({
        ticketId: 'ticket123',
        analysis: 'Analysis result',
        timestamp: expect.any(Date),
      });

      expect(mockLLMService.analyzeText).toHaveBeenCalledWith(
        'Requirements text',
        expect.objectContaining({
          systemPrompt: 'Analyze this',
          userId: 'user123',
        })
      );
    });

    it('should throw error if ticket not found', async () => {
      const { prisma } = require('@agentris/db');
      prisma.ticket.findUnique.mockResolvedValue(null);

      const caller = llmRouter.createCaller(ctx);
      
      await expect(
        caller.analyzeRequirements({
          ticketId: 'nonexistent',
          text: 'Requirements',
        })
      ).rejects.toThrow('Ticket not found');
    });
  });

  describe('generateResponse', () => {
    it('should generate non-streaming response', async () => {
      mockLLMService.generateResponse.mockResolvedValue({
        content: 'Generated content',
        tokenCount: 100,
        cost: 0.01,
        model: 'claude-3-sonnet',
        provider: 'ANTHROPIC',
      });

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.generateResponse({
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toEqual({
        content: 'Generated content',
        tokenCount: 100,
        cost: 0.01,
        model: 'claude-3-sonnet',
        provider: 'ANTHROPIC',
        streamed: false,
      });
    });

    it('should handle streaming response', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield 'Hello';
          yield ' world';
        },
        getTokenCount: vi.fn().mockResolvedValue(50),
        getCost: vi.fn().mockResolvedValue(0.005),
      };

      mockLLMService.generateResponse.mockResolvedValue({
        stream: mockStream[Symbol.asyncIterator](),
        getTokenCount: mockStream.getTokenCount,
        getCost: mockStream.getCost,
      });

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.generateResponse({
        messages: [{ role: 'user', content: 'Stream this' }],
        stream: true,
      });

      expect(result).toEqual({
        content: 'Hello world',
        tokenCount: 50,
        cost: 0.005,
        streamed: true,
      });
    });
  });

  describe('getUsageStats', () => {
    it('should return usage statistics for admin', async () => {
      const mockUsage = [
        {
          date: new Date('2024-01-15'),
          totalTokens: 1000,
          totalCost: 0.1,
          requestCount: 10,
          cacheHits: 2,
          provider: 'ANTHROPIC',
        },
      ];

      mockRepository.getUsageByUser.mockResolvedValue(mockUsage);
      mockRepository.getAggregatedUsage.mockResolvedValue({
        _sum: {
          totalTokens: 5000,
          totalCost: 0.5,
          requestCount: 50,
          cacheHits: 10,
        },
      });
      mockRepository.getCacheStats.mockResolvedValue({
        totalEntries: 100,
        totalHits: 500,
        avgHitRate: 5,
      });

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.getUsageStats({
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      });

      expect(result.userUsage).toHaveLength(1);
      expect(result.aggregated).toEqual({
        totalTokens: 5000,
        totalCost: 0.5,
        totalRequests: 50,
        totalCacheHits: 10,
      });
      expect(result.cacheStats).toEqual({
        totalEntries: 100,
        totalHits: 500,
        avgHitRate: 5,
      });
    });

    it('should require admin role', async () => {
      ctx.session!.user = {
        ...ctx.session!.user,
        role: 'CONSULTANT',
      } as any;

      const caller = llmRouter.createCaller(ctx);
      
      await expect(
        caller.getUsageStats({})
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getMyUsage', () => {
    it('should return usage for current user', async () => {
      const mockUsage = [
        {
          date: new Date('2024-01-15'),
          totalTokens: 500,
          totalCost: 0.05,
          requestCount: 5,
          cacheHits: 1,
          provider: 'ANTHROPIC',
        },
      ];

      mockRepository.getUsageByUser.mockResolvedValue(mockUsage);

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.getMyUsage({});

      expect(result.usage).toHaveLength(1);
      expect(result.totals).toEqual({
        tokens: 500,
        cost: 0.05,
        requests: 5,
        cacheHits: 1,
      });
    });
  });

  describe('clearCache', () => {
    it('should clear all cache when specified', async () => {
      mockRepository.clearAllCache.mockResolvedValue(50);

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.clearCache({ all: true });

      expect(result).toEqual({
        success: true,
        entriesCleared: 50,
        clearedBy: 'test@example.com',
        timestamp: expect.any(Date),
      });
    });

    it('should clear expired cache when specified', async () => {
      mockRepository.clearExpiredCache.mockResolvedValue(10);

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.clearCache({ expired: true });

      expect(result).toEqual({
        success: true,
        entriesCleared: 10,
        clearedBy: 'test@example.com',
        timestamp: expect.any(Date),
      });
    });

    it('should throw error if neither option specified', async () => {
      const caller = llmRouter.createCaller(ctx);
      
      await expect(
        caller.clearCache({})
      ).rejects.toThrow('Specify either "all" or "expired" to clear cache');
    });

    it('should require admin role', async () => {
      ctx.session!.user = {
        ...ctx.session!.user,
        role: 'CONSULTANT',
      } as any;

      const caller = llmRouter.createCaller(ctx);
      
      await expect(
        caller.clearCache({ all: true })
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('getAvailableModels', () => {
    it('should return available models', async () => {
      mockLLMService.getAvailableModels.mockReturnValue([
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
      ]);

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.getAvailableModels();

      expect(result.models).toHaveLength(2);
      expect(result.models[0]).toEqual({
        id: 'claude-3-opus-20240229',
        name: 'Claude 3 opus 20240229',
        provider: 'anthropic',
      });
    });
  });

  describe('validateConfiguration', () => {
    it('should validate LLM configuration', async () => {
      mockLLMService.validateConfiguration.mockResolvedValue(true);

      const caller = llmRouter.createCaller(ctx);
      const result = await caller.validateConfiguration();

      expect(result).toEqual({
        valid: true,
        provider: 'anthropic',
        timestamp: expect.any(Date),
      });
    });

    it('should require admin role', async () => {
      ctx.session!.user = {
        ...ctx.session!.user,
        role: 'MANAGER',
      } as any;

      const caller = llmRouter.createCaller(ctx);
      
      await expect(
        caller.validateConfiguration()
      ).rejects.toThrow('Insufficient permissions');
    });
  });
});