import { LLMProvider } from '@agentris/db';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  tokenCount: number;
  cost: number;
  model: string;
  provider: LLMProvider;
}

export interface LLMStreamResponse {
  stream: AsyncIterable<string>;
  getTokenCount: () => Promise<number>;
  getCost: () => Promise<number>;
}

export interface ProviderConfig {
  apiKey: string;
  maxRetries?: number;
  timeout?: number;
  baseUrl?: string;
  organization?: string;
}

export abstract class BaseProvider {
  protected config: ProviderConfig;
  protected abstract provider: LLMProvider;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract sendMessage(
    messages: LLMMessage[],
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
    }
  ): Promise<LLMResponse | LLMStreamResponse>;

  abstract countTokens(text: string, model: string): Promise<number>;

  abstract calculateCost(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number;

  abstract getAvailableModels(): string[];

  abstract validateApiKey(): Promise<boolean>;

  protected sanitizeApiKey(apiKey: string): string {
    // Ensure API key is properly formatted
    return apiKey.trim();
  }

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }
  }
}