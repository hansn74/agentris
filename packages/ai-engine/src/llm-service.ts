import { LLMProvider, LLMRepository, prisma } from '@agentris/db';
import { 
  BaseProvider, 
  LLMMessage, 
  LLMResponse, 
  LLMStreamResponse,
  ProviderFactory 
} from './providers';
import { ApiKeyProvider } from './config/api-key-provider';
import { createHash } from 'crypto';

export interface LLMServiceConfig {
  provider?: LLMProvider;
  apiKey?: string;
  enableCache?: boolean;
  cacheTTL?: number;
  enableUsageTracking?: boolean;
}

export class LLMService {
  private provider: BaseProvider;
  private repository: LLMRepository;
  private config: LLMServiceConfig;
  private apiKeyProvider: ApiKeyProvider;

  constructor(config: LLMServiceConfig = {}) {
    this.config = {
      enableCache: true,
      cacheTTL: 3600, // 1 hour default
      enableUsageTracking: true,
      ...config,
    };

    this.repository = new LLMRepository(prisma);
    this.apiKeyProvider = (ApiKeyProvider as any).getInstance();

    // Initialize provider
    this.provider = this.initializeProvider();
  }

  private initializeProvider(): BaseProvider {
    // Try to get provider from config, then environment
    let providerConfig = null;

    if (this.config.provider && this.config.apiKey) {
      providerConfig = {
        provider: this.config.provider,
        config: { apiKey: this.config.apiKey },
      };
    } else {
      providerConfig = ProviderFactory.getProviderFromEnv();
    }

    if (!providerConfig) {
      // Try to get from ApiKeyProvider
      const apiKey = (this.apiKeyProvider as any).getAnthropicKey?.() || process.env.ANTHROPIC_API_KEY;
      if (apiKey) {
        providerConfig = {
          provider: LLMProvider.ANTHROPIC,
          config: { apiKey },
        };
      }
    }

    if (!providerConfig) {
      throw new Error('No LLM provider configuration found');
    }

    return ProviderFactory.createProvider(
      providerConfig.provider,
      providerConfig.config
    );
  }

  async analyzeText(
    text: string,
    options?: {
      systemPrompt?: string;
      model?: string;
      temperature?: number;
      maxTokens?: number;
      userId?: string;
    }
  ): Promise<string> {
    const messages: LLMMessage[] = [];
    
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    
    messages.push({ role: 'user', content: text });

    const response = await this.generateResponse(messages, {
      ...options,
      stream: false,
    });

    if ('content' in response) {
      return response.content;
    }

    // Should not happen with stream: false
    throw new Error('Unexpected streaming response');
  }

  async generateResponse(
    messages: LLMMessage[],
    options?: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      stream?: boolean;
      userId?: string;
    }
  ): Promise<LLMResponse | LLMStreamResponse> {
    const model = options?.model || this.getDefaultModel();
    const userId = options?.userId || 'system';

    // Check cache if enabled and not streaming
    if (this.config.enableCache && !options?.stream) {
      const cacheKey = this.generateCacheKey(messages, model, options);
      const cached = await this.repository.getCachedResponse(cacheKey);

      if (cached) {
        // Track cache hit in usage
        if (this.config.enableUsageTracking) {
          await this.trackUsage(
            userId,
            this.provider['provider'],
            0,
            0,
            0,
            true
          );
        }

        return {
          content: cached.response,
          tokenCount: cached.tokenCount,
          cost: 0, // No cost for cached response
          model,
          provider: cached.provider,
        };
      }
    }

    // Count input tokens
    const promptText = messages.map(m => m.content).join('\n');
    const inputTokens = await this.provider.countTokens(promptText, model);

    try {
      // Send to provider
      const response = await this.provider.sendMessage(messages, model, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
        stream: options?.stream,
      });

      // Handle non-streaming response
      if ('content' in response) {
        // Calculate output tokens
        const outputTokens = response.tokenCount - inputTokens;

        // Store in database if tracking enabled
        if (this.config.enableUsageTracking) {
          await this.repository.createRequest({
            provider: response.provider,
            model: response.model,
            prompt: promptText,
            response: response.content,
            tokenCount: response.tokenCount,
            cost: response.cost,
            userId,
            cacheHit: false,
          });

          await this.trackUsage(
            userId,
            response.provider,
            response.tokenCount,
            response.cost,
            1,
            false
          );
        }

        // Cache the response if enabled
        if (this.config.enableCache) {
          const cacheKey = this.generateCacheKey(messages, model, options);
          await this.repository.setCachedResponse({
            cacheKey,
            provider: response.provider,
            model: response.model,
            response: response.content,
            tokenCount: response.tokenCount,
            ttlSeconds: this.config.cacheTTL,
          });
        }

        return response;
      } else {
        // Handle streaming response
        const originalStream = response.stream;
        const chunks: string[] = [];
        
        // Create a new stream that collects chunks for caching
        async function* collectingStream() {
          for await (const chunk of originalStream) {
            chunks.push(chunk);
            yield chunk;
          }
        }

        // After streaming completes, we can cache and track
        const wrappedResponse: LLMStreamResponse = {
          stream: collectingStream(),
          getTokenCount: async () => {
            const count = await response.getTokenCount();
            
            // Track usage after streaming completes
            if (this.config.enableUsageTracking) {
              const cost = await response.getCost();
              const fullResponse = chunks.join('');
              
              await this.repository.createRequest({
                provider: this.provider['provider'],
                model,
                prompt: promptText,
                response: fullResponse,
                tokenCount: count,
                cost,
                userId,
                cacheHit: false,
              });

              await this.trackUsage(
                userId,
                this.provider['provider'],
                count,
                cost,
                1,
                false
              );
            }
            
            return count;
          },
          getCost: response.getCost,
        };

        return wrappedResponse;
      }
    } catch (error) {
      // Log error to database if tracking enabled
      if (this.config.enableUsageTracking) {
        await this.repository.createRequest({
          provider: this.provider['provider'],
          model,
          prompt: promptText,
          tokenCount: inputTokens,
          cost: 0,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  private async trackUsage(
    userId: string,
    provider: LLMProvider,
    tokens: number,
    cost: number,
    requests: number,
    cacheHit: boolean
  ): Promise<void> {
    await this.repository.upsertUsage({
      userId,
      date: new Date(),
      provider,
      totalTokens: tokens,
      totalCost: cost,
      requestCount: requests,
      cacheHits: cacheHit ? 1 : 0,
    });
  }

  private generateCacheKey(
    messages: LLMMessage[],
    model: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
    }
  ): string {
    const hash = createHash('sha256');
    const cacheData = {
      messages,
      model,
      temperature: options?.temperature || 0.7,
      maxTokens: options?.maxTokens || 4096,
    };
    hash.update(JSON.stringify(cacheData));
    return hash.digest('hex');
  }

  private getDefaultModel(): string {
    const models = this.provider.getAvailableModels();
    // Prefer Claude 3 Sonnet as default
    if (models.includes('claude-3-sonnet-20240229')) {
      return 'claude-3-sonnet-20240229';
    }
    // Fallback to first available model
    return models[0] || 'claude-3-sonnet-20240229';
  }

  async validateConfiguration(): Promise<boolean> {
    return this.provider.validateApiKey();
  }

  getAvailableModels(): string[] {
    return this.provider.getAvailableModels();
  }

  getCurrentProvider(): LLMProvider {
    // Access the protected provider property to get the current provider type
    return (this.provider as any).provider || LLMProvider.ANTHROPIC;
  }

  async clearCache(): Promise<number> {
    return this.repository.clearAllCache();
  }

  async getCacheStats() {
    return this.repository.getCacheStats();
  }

  async getUsageStats(userId: string, startDate?: Date, endDate?: Date) {
    return this.repository.getUsageByUser(userId, startDate, endDate);
  }

  switchProvider(provider: LLMProvider, apiKey: string): void {
    this.provider = ProviderFactory.createProvider(provider, { apiKey });
  }
}