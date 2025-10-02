import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMService } from './llm-service';
import { LLMProvider } from '@agentris/db';
import { ProviderFactory } from './providers';

// Mock dependencies
vi.mock('@agentris/db', () => ({
  LLMProvider: {
    ANTHROPIC: 'ANTHROPIC',
    OPENAI: 'OPENAI',
    GEMINI: 'GEMINI',
  },
  LLMRepository: vi.fn().mockImplementation(() => ({
    getCachedResponse: vi.fn(),
    setCachedResponse: vi.fn(),
    createRequest: vi.fn(),
    upsertUsage: vi.fn(),
    clearAllCache: vi.fn(),
    getCacheStats: vi.fn(),
    getUsageByUser: vi.fn(),
    generateCacheKey: vi.fn(),
  })),
  prisma: {},
}));

vi.mock('./providers', () => ({
  ProviderFactory: {
    createProvider: vi.fn(),
    getProviderFromEnv: vi.fn(),
  },
}));

vi.mock('./config/api-key-provider', () => ({
  ApiKeyProvider: vi.fn().mockImplementation(() => ({
    getAnthropicKey: vi.fn(),
  })),
}));

describe('LLMService', () => {
  let service: LLMService;
  let mockProvider: any;
  let mockRepository: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock provider
    mockProvider = {
      sendMessage: vi.fn(),
      countTokens: vi.fn(),
      calculateCost: vi.fn(),
      getAvailableModels: vi.fn(),
      validateApiKey: vi.fn(),
    };

    // Setup ProviderFactory mock
    (ProviderFactory.createProvider as any).mockReturnValue(mockProvider);
    (ProviderFactory.getProviderFromEnv as any).mockReturnValue({
      provider: LLMProvider.ANTHROPIC,
      config: { apiKey: 'test-key' },
    });

    // Default mock implementations
    mockProvider.getAvailableModels.mockReturnValue([
      'claude-3-sonnet-20240229',
      'claude-3-opus-20240229',
    ]);
    mockProvider.countTokens.mockResolvedValue(100);
    mockProvider.validateApiKey.mockResolvedValue(true);
  });

  describe('initialization', () => {
    it('should initialize with config', () => {
      service = new LLMService({
        provider: LLMProvider.ANTHROPIC,
        apiKey: 'test-api-key',
      });

      expect(ProviderFactory.createProvider).toHaveBeenCalledWith(
        LLMProvider.ANTHROPIC,
        { apiKey: 'test-api-key' }
      );
    });

    it('should initialize from environment', () => {
      service = new LLMService();

      expect(ProviderFactory.getProviderFromEnv).toHaveBeenCalled();
      expect(ProviderFactory.createProvider).toHaveBeenCalled();
    });

    it('should throw error if no provider config found', () => {
      (ProviderFactory.getProviderFromEnv as any).mockReturnValue(null);

      expect(() => new LLMService()).toThrow('No LLM provider configuration found');
    });
  });

  describe('analyzeText', () => {
    beforeEach(() => {
      service = new LLMService();
      mockRepository = (service as any).repository;
    });

    it('should analyze text with system prompt', async () => {
      const mockResponse = {
        content: 'Analysis result',
        tokenCount: 150,
        cost: 0.01,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      };

      mockProvider.sendMessage.mockResolvedValue(mockResponse);

      const result = await service.analyzeText('Analyze this text', {
        systemPrompt: 'You are an analyzer',
        userId: 'user123',
      });

      expect(mockProvider.sendMessage).toHaveBeenCalledWith(
        [
          { role: 'system', content: 'You are an analyzer' },
          { role: 'user', content: 'Analyze this text' },
        ],
        'claude-3-sonnet-20240229',
        expect.any(Object)
      );

      expect(result).toBe('Analysis result');
    });

    it('should work without system prompt', async () => {
      const mockResponse = {
        content: 'Response',
        tokenCount: 100,
        cost: 0.005,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      };

      mockProvider.sendMessage.mockResolvedValue(mockResponse);

      const result = await service.analyzeText('Process this');

      expect(mockProvider.sendMessage).toHaveBeenCalledWith(
        [{ role: 'user', content: 'Process this' }],
        'claude-3-sonnet-20240229',
        expect.any(Object)
      );

      expect(result).toBe('Response');
    });
  });

  describe('generateResponse', () => {
    beforeEach(() => {
      service = new LLMService();
      mockRepository = (service as any).repository;
    });

    it('should generate response and cache it', async () => {
      const mockResponse = {
        content: 'Generated response',
        tokenCount: 200,
        cost: 0.02,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      };

      mockProvider.sendMessage.mockResolvedValue(mockResponse);
      mockRepository.getCachedResponse.mockResolvedValue(null);

      const result = await service.generateResponse(
        [{ role: 'user', content: 'Generate something' }],
        { userId: 'user123' }
      );

      expect(mockRepository.setCachedResponse).toHaveBeenCalled();
      expect(mockRepository.createRequest).toHaveBeenCalled();
      expect(mockRepository.upsertUsage).toHaveBeenCalled();
      expect(result).toEqual(mockResponse);
    });

    it('should return cached response if available', async () => {
      const cachedResponse = {
        response: 'Cached content',
        tokenCount: 150,
        provider: LLMProvider.ANTHROPIC,
      };

      mockRepository.getCachedResponse.mockResolvedValue(cachedResponse);

      const result = await service.generateResponse(
        [{ role: 'user', content: 'Generate something' }],
        { userId: 'user123' }
      );

      expect(mockProvider.sendMessage).not.toHaveBeenCalled();
      expect(mockRepository.upsertUsage).toHaveBeenCalledWith(
        expect.objectContaining({
          cacheHits: 1,
          requestCount: 0,
        })
      );
      expect(result).toEqual({
        content: 'Cached content',
        tokenCount: 150,
        cost: 0,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      });
    });

    it('should handle streaming responses', async () => {
      const mockStreamResponse = {
        stream: (async function* () {
          yield 'Hello';
          yield ' world';
        })(),
        getTokenCount: vi.fn().mockResolvedValue(100),
        getCost: vi.fn().mockResolvedValue(0.01),
      };

      mockProvider.sendMessage.mockResolvedValue(mockStreamResponse);

      const result = await service.generateResponse(
        [{ role: 'user', content: 'Stream this' }],
        { stream: true, userId: 'user123' }
      );

      expect('stream' in result).toBe(true);
      
      if ('stream' in result) {
        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }
        expect(chunks).toEqual(['Hello', ' world']);

        const tokenCount = await result.getTokenCount();
        expect(tokenCount).toBe(100);
      }
    });

    it('should handle errors and log them', async () => {
      const error = new Error('Provider error');
      mockProvider.sendMessage.mockRejectedValue(error);

      await expect(
        service.generateResponse([{ role: 'user', content: 'Fail' }])
      ).rejects.toThrow('Provider error');

      expect(mockRepository.createRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          error: 'Provider error',
        })
      );
    });
  });

  describe('utility methods', () => {
    beforeEach(() => {
      service = new LLMService();
      mockRepository = (service as any).repository;
    });

    it('should validate configuration', async () => {
      const isValid = await service.validateConfiguration();
      expect(isValid).toBe(true);
      expect(mockProvider.validateApiKey).toHaveBeenCalled();
    });

    it('should get available models', () => {
      const models = service.getAvailableModels();
      expect(models).toEqual([
        'claude-3-sonnet-20240229',
        'claude-3-opus-20240229',
      ]);
    });

    it('should clear cache', async () => {
      mockRepository.clearAllCache.mockResolvedValue(10);
      const cleared = await service.clearCache();
      expect(cleared).toBe(10);
    });

    it('should get cache stats', async () => {
      const stats = {
        totalEntries: 100,
        totalHits: 500,
        avgHitRate: 5,
      };
      mockRepository.getCacheStats.mockResolvedValue(stats);

      const result = await service.getCacheStats();
      expect(result).toEqual(stats);
    });

    it('should get usage stats', async () => {
      const usage = [
        { date: new Date(), totalTokens: 1000, totalCost: 0.1 },
      ];
      mockRepository.getUsageByUser.mockResolvedValue(usage);

      const result = await service.getUsageStats('user123');
      expect(result).toEqual(usage);
    });

    it('should switch provider', () => {
      service.switchProvider(LLMProvider.ANTHROPIC, 'new-key');
      expect(ProviderFactory.createProvider).toHaveBeenCalledWith(
        LLMProvider.ANTHROPIC,
        { apiKey: 'new-key' }
      );
    });
  });

  describe('caching behavior', () => {
    it('should not cache when disabled', async () => {
      service = new LLMService({ enableCache: false });
      mockRepository = (service as any).repository;

      const mockResponse = {
        content: 'Response',
        tokenCount: 100,
        cost: 0.01,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      };

      mockProvider.sendMessage.mockResolvedValue(mockResponse);

      await service.generateResponse([{ role: 'user', content: 'Test' }]);

      expect(mockRepository.getCachedResponse).not.toHaveBeenCalled();
      expect(mockRepository.setCachedResponse).not.toHaveBeenCalled();
    });

    it('should not cache streaming responses', async () => {
      service = new LLMService({ enableCache: true });
      mockRepository = (service as any).repository;

      const mockStreamResponse = {
        stream: (async function* () {
          yield 'Stream';
        })(),
        getTokenCount: vi.fn().mockResolvedValue(10),
        getCost: vi.fn().mockResolvedValue(0.001),
      };

      mockProvider.sendMessage.mockResolvedValue(mockStreamResponse);

      await service.generateResponse(
        [{ role: 'user', content: 'Test' }],
        { stream: true }
      );

      expect(mockRepository.getCachedResponse).not.toHaveBeenCalled();
      expect(mockRepository.setCachedResponse).not.toHaveBeenCalled();
    });
  });

  describe('usage tracking', () => {
    it('should not track when disabled', async () => {
      service = new LLMService({ enableUsageTracking: false });
      mockRepository = (service as any).repository;

      const mockResponse = {
        content: 'Response',
        tokenCount: 100,
        cost: 0.01,
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      };

      mockProvider.sendMessage.mockResolvedValue(mockResponse);

      await service.generateResponse([{ role: 'user', content: 'Test' }]);

      expect(mockRepository.createRequest).not.toHaveBeenCalled();
      expect(mockRepository.upsertUsage).not.toHaveBeenCalled();
    });
  });
});