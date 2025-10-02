import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProviderFactory } from './provider-factory';
import { AnthropicProvider } from './anthropic-provider';
import { LLMProvider } from '@agentris/db';

vi.mock('./anthropic-provider', () => ({
  AnthropicProvider: vi.fn().mockImplementation(() => ({
    validateApiKey: vi.fn().mockResolvedValue(true),
  })),
}));

describe('ProviderFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ProviderFactory.clearProviders();
    // Clear environment variables
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
  });

  describe('createProvider', () => {
    it('should create AnthropicProvider', () => {
      const config = {
        apiKey: 'test-key',
        maxRetries: 3,
      };

      const provider = ProviderFactory.createProvider(
        LLMProvider.ANTHROPIC,
        config
      );

      expect(AnthropicProvider).toHaveBeenCalledWith(config);
      expect(provider).toBeDefined();
    });

    it('should return cached provider for same type', () => {
      const config = { apiKey: 'test-key' };

      const provider1 = ProviderFactory.createProvider(
        LLMProvider.ANTHROPIC,
        config
      );
      const provider2 = ProviderFactory.createProvider(
        LLMProvider.ANTHROPIC,
        config
      );

      expect(provider1).toBe(provider2);
      expect(AnthropicProvider).toHaveBeenCalledTimes(1);
    });

    it('should throw error for unimplemented providers', () => {
      const config = { apiKey: 'test-key' };

      expect(() =>
        ProviderFactory.createProvider(LLMProvider.OPENAI, config)
      ).toThrow('OpenAI provider not yet implemented');

      expect(() =>
        ProviderFactory.createProvider(LLMProvider.GEMINI, config)
      ).toThrow('Gemini provider not yet implemented');
    });
  });

  describe('getProvider', () => {
    it('should return cached provider', () => {
      const config = { apiKey: 'test-key' };
      const created = ProviderFactory.createProvider(
        LLMProvider.ANTHROPIC,
        config
      );

      const retrieved = ProviderFactory.getProvider(LLMProvider.ANTHROPIC);
      expect(retrieved).toBe(created);
    });

    it('should return undefined for non-cached provider', () => {
      const provider = ProviderFactory.getProvider(LLMProvider.OPENAI);
      expect(provider).toBeUndefined();
    });
  });

  describe('validateProvider', () => {
    it('should validate provider configuration', async () => {
      const config = { apiKey: 'test-key' };

      const isValid = await ProviderFactory.validateProvider(
        LLMProvider.ANTHROPIC,
        config
      );

      expect(isValid).toBe(true);
    });

    it('should return false for invalid configuration', async () => {
      const mockProvider = {
        validateApiKey: vi.fn().mockResolvedValue(false),
      };
      (AnthropicProvider as any).mockImplementationOnce(() => mockProvider);

      const config = { apiKey: 'invalid-key' };
      const isValid = await ProviderFactory.validateProvider(
        LLMProvider.ANTHROPIC,
        config
      );

      expect(isValid).toBe(false);
    });

    it('should return false on exception', async () => {
      const config = { apiKey: 'test-key' };

      const isValid = await ProviderFactory.validateProvider(
        LLMProvider.OPENAI,
        config
      );

      expect(isValid).toBe(false);
    });
  });

  describe('getAvailableProviders', () => {
    it('should return list of available providers', () => {
      const providers = ProviderFactory.getAvailableProviders();
      expect(providers).toContain(LLMProvider.ANTHROPIC);
      expect(providers).toHaveLength(1); // Only Anthropic implemented so far
    });
  });

  describe('getProviderFromEnv', () => {
    it('should return Anthropic config from environment', () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.ANTHROPIC_BASE_URL = 'https://custom.anthropic.com';
      process.env.ANTHROPIC_ORGANIZATION = 'org-123';

      const result = ProviderFactory.getProviderFromEnv();

      expect(result).toEqual({
        provider: LLMProvider.ANTHROPIC,
        config: {
          apiKey: 'anthropic-key',
          baseUrl: 'https://custom.anthropic.com',
          organization: 'org-123',
        },
      });
    });

    it('should return OpenAI config from environment', () => {
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.OPENAI_BASE_URL = 'https://custom.openai.com';
      process.env.OPENAI_ORGANIZATION = 'org-456';

      const result = ProviderFactory.getProviderFromEnv();

      expect(result).toEqual({
        provider: LLMProvider.OPENAI,
        config: {
          apiKey: 'openai-key',
          baseUrl: 'https://custom.openai.com',
          organization: 'org-456',
        },
      });
    });

    it('should return Gemini config from environment', () => {
      process.env.GEMINI_API_KEY = 'gemini-key';
      process.env.GEMINI_BASE_URL = 'https://custom.gemini.com';

      const result = ProviderFactory.getProviderFromEnv();

      expect(result).toEqual({
        provider: LLMProvider.GEMINI,
        config: {
          apiKey: 'gemini-key',
          baseUrl: 'https://custom.gemini.com',
        },
      });
    });

    it('should prioritize Anthropic over other providers', () => {
      process.env.ANTHROPIC_API_KEY = 'anthropic-key';
      process.env.OPENAI_API_KEY = 'openai-key';
      process.env.GEMINI_API_KEY = 'gemini-key';

      const result = ProviderFactory.getProviderFromEnv();

      expect(result?.provider).toBe(LLMProvider.ANTHROPIC);
    });

    it('should return null if no API keys in environment', () => {
      const result = ProviderFactory.getProviderFromEnv();
      expect(result).toBeNull();
    });
  });

  describe('clearProviders', () => {
    it('should clear all cached providers', () => {
      const config = { apiKey: 'test-key' };
      ProviderFactory.createProvider(LLMProvider.ANTHROPIC, config);

      expect(ProviderFactory.getProvider(LLMProvider.ANTHROPIC)).toBeDefined();

      ProviderFactory.clearProviders();

      expect(ProviderFactory.getProvider(LLMProvider.ANTHROPIC)).toBeUndefined();
    });
  });
});