import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider } from '@agentris/db';
import {
  BaseProvider,
  LLMMessage,
  LLMResponse,
  LLMStreamResponse,
  ProviderConfig,
} from './base-provider';
import { RetryHandler } from '../utils/retry-handler';

export class AnthropicProvider extends BaseProvider {
  protected provider = LLMProvider.ANTHROPIC;
  private client: Anthropic;
  private retryHandler: RetryHandler;

  // Pricing per 1M tokens (as of 2024)
  private readonly pricing = {
    'claude-3-opus-20240229': { input: 15, output: 75 },
    'claude-3-sonnet-20240229': { input: 3, output: 15 },
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-2.1': { input: 8, output: 24 },
    'claude-2.0': { input: 8, output: 24 },
    'claude-instant-1.2': { input: 0.8, output: 2.4 },
  };

  constructor(config: ProviderConfig) {
    super(config);
    this.validateConfig();
    
    this.client = new Anthropic({
      apiKey: this.sanitizeApiKey(config.apiKey),
      baseURL: config.baseUrl,
      maxRetries: 0, // We handle retries ourselves
      timeout: config.timeout || 60000,
    });

    // Initialize retry handler with Anthropic-specific config
    this.retryHandler = new RetryHandler({
      maxRetries: config.maxRetries || 5,
      initialDelayMs: 2000,
      maxDelayMs: 32000,
      backoffMultiplier: 2,
      onRetry: (attempt, error, delayMs) => {
        // Use structured logging without exposing sensitive error details
        // Logger should be injected, but for now, silently handle retries
        // TODO: Inject Pino logger instance
      },
    });
  }

  async sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<LLMResponse | LLMStreamResponse> {
    // Convert our message format to Anthropic format
    const anthropicMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    // Extract system message if present
    const systemMessage = messages.find(m => m.role === 'system');

    if (options?.stream) {
      return this.streamMessage(
        anthropicMessages,
        model,
        systemMessage?.content,
        options
      );
    }

    const response = await this.retryHandler.execute(() =>
      this.client.messages.create({
        model,
        messages: anthropicMessages,
        system: systemMessage?.content,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
      })
    );

    const content = response.content[0]?.type === 'text' 
      ? response.content[0].text 
      : '';

    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const cost = this.calculateCost(inputTokens, outputTokens, model);

    return {
      content,
      tokenCount: totalTokens,
      cost,
      model,
      provider: this.provider,
    };
  }

  private async streamMessage(
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    model: string,
    system?: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): Promise<LLMStreamResponse> {
    const stream = await this.retryHandler.execute(() =>
      this.client.messages.create({
        model,
        messages,
        system,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature || 0.7,
        stream: true,
      })
    );

    let inputTokens = 0;
    let outputTokens = 0;

    async function* generateStream() {
      for await (const chunk of stream) {
        if (chunk.type === 'message_start') {
          inputTokens = chunk.message.usage?.input_tokens || 0;
        } else if (chunk.type === 'content_block_delta') {
          if (chunk.delta.type === 'text_delta') {
            yield chunk.delta.text;
          }
        } else if (chunk.type === 'message_delta') {
          outputTokens = chunk.usage?.output_tokens || 0;
        }
      }
    }

    return {
      stream: generateStream(),
      getTokenCount: async () => inputTokens + outputTokens,
      getCost: async () => this.calculateCost(inputTokens, outputTokens, model),
    };
  }

  async countTokens(text: string, model: string): Promise<number> {
    // Anthropic doesn't provide a direct token counting API
    // Use approximation: ~4 characters per token for English text
    // This is a rough estimate and should be replaced with proper tokenization
    return Math.ceil(text.length / 4);
  }

  calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number {
    const modelPricing = this.pricing[model as keyof typeof this.pricing];
    
    if (!modelPricing) {
      // Default to Claude 3 Sonnet pricing if model not found
      const defaultPricing = this.pricing['claude-3-sonnet-20240229'];
      return (
        (inputTokens / 1_000_000) * defaultPricing.input +
        (outputTokens / 1_000_000) * defaultPricing.output
      );
    }

    return (
      (inputTokens / 1_000_000) * modelPricing.input +
      (outputTokens / 1_000_000) * modelPricing.output
    );
  }

  getAvailableModels(): string[] {
    return Object.keys(this.pricing);
  }

  async validateApiKey(): Promise<boolean> {
    try {
      // Make a minimal API call to validate the key
      // Don't retry on authentication errors
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 1,
      });
      return true;
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        return false;
      }
      // Other errors might be rate limiting, network issues, etc.
      throw error;
    }
  }
}