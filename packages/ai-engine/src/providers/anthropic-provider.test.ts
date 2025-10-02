import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnthropicProvider } from './anthropic-provider';
import { LLMProvider } from '@agentris/db';
import Anthropic from '@anthropic-ai/sdk';

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn();
  const MockAnthropic = vi.fn(() => ({
    messages: {
      create: mockCreate,
    },
  }));
  MockAnthropic.AuthenticationError = class extends Error {};
  return { default: MockAnthropic };
});

describe('AnthropicProvider', () => {
  let provider: AnthropicProvider;
  let mockClient: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new AnthropicProvider({
      apiKey: 'test-api-key',
      maxRetries: 3,
      timeout: 60000,
    });
    mockClient = (Anthropic as any).mock.results[0].value;
  });

  describe('sendMessage', () => {
    it('should send a message and return response', async () => {
      const mockResponse = {
        content: [{ type: 'text', text: 'Hello, how can I help?' }],
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      mockClient.messages.create.mockResolvedValue(mockResponse);

      const result = await provider.sendMessage(
        [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
        'claude-3-sonnet-20240229'
      );

      expect(mockClient.messages.create).toHaveBeenCalledWith({
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: 'Hello' }],
        system: 'You are a helpful assistant',
        max_tokens: 4096,
        temperature: 0.7,
      });

      expect(result).toEqual({
        content: 'Hello, how can I help?',
        tokenCount: 30,
        cost: expect.any(Number),
        model: 'claude-3-sonnet-20240229',
        provider: LLMProvider.ANTHROPIC,
      });
    });

    it('should handle streaming responses', async () => {
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield { type: 'message_start', message: { usage: { input_tokens: 10 } } };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: 'Hello' },
          };
          yield {
            type: 'content_block_delta',
            delta: { type: 'text_delta', text: ' world' },
          };
          yield { type: 'message_delta', usage: { output_tokens: 5 } };
        },
      };

      mockClient.messages.create.mockResolvedValue(mockStream);

      const result = await provider.sendMessage(
        [{ role: 'user', content: 'Hi' }],
        'claude-3-haiku-20240307',
        { stream: true }
      );

      expect('stream' in result).toBe(true);
      
      if ('stream' in result) {
        const chunks = [];
        for await (const chunk of result.stream) {
          chunks.push(chunk);
        }
        expect(chunks).toEqual(['Hello', ' world']);

        const tokenCount = await result.getTokenCount();
        expect(tokenCount).toBe(15);
      }
    });
  });

  describe('calculateCost', () => {
    it('should calculate cost for known models', () => {
      const cost = provider.calculateCost(1000, 2000, 'claude-3-sonnet-20240229');
      // (1000/1M * 3) + (2000/1M * 15) = 0.003 + 0.03 = 0.033
      expect(cost).toBeCloseTo(0.033, 5);
    });

    it('should use default pricing for unknown models', () => {
      const cost = provider.calculateCost(1000, 2000, 'unknown-model');
      // Should use claude-3-sonnet pricing as default
      expect(cost).toBeCloseTo(0.033, 5);
    });
  });

  describe('countTokens', () => {
    it('should estimate token count', async () => {
      const text = 'This is a test message with some content';
      const tokens = await provider.countTokens(text, 'claude-3-sonnet-20240229');
      // Rough estimate: ~4 chars per token
      expect(tokens).toBeGreaterThan(0);
      expect(tokens).toBeLessThan(text.length);
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', () => {
      const models = provider.getAvailableModels();
      expect(models).toContain('claude-3-opus-20240229');
      expect(models).toContain('claude-3-sonnet-20240229');
      expect(models).toContain('claude-3-haiku-20240307');
    });
  });

  describe('validateApiKey', () => {
    it('should return true for valid API key', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Hi' }],
        usage: { input_tokens: 1, output_tokens: 1 },
      });

      const isValid = await provider.validateApiKey();
      expect(isValid).toBe(true);
    });

    it('should return false for invalid API key', async () => {
      mockClient.messages.create.mockRejectedValue(
        new Anthropic.AuthenticationError('Invalid API key')
      );

      const isValid = await provider.validateApiKey();
      expect(isValid).toBe(false);
    });

    it('should throw other errors', async () => {
      mockClient.messages.create.mockRejectedValue(new Error('Network error'));

      await expect(provider.validateApiKey()).rejects.toThrow('Network error');
    });
  });
});