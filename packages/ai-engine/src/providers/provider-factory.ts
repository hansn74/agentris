import { LLMProvider } from '@agentris/db';
import { BaseProvider, ProviderConfig } from './base-provider';
import { AnthropicProvider } from './anthropic-provider';

export class ProviderFactory {
  private static providers: Map<LLMProvider, BaseProvider> = new Map();

  static createProvider(
    provider: LLMProvider,
    config: ProviderConfig
  ): BaseProvider {
    // Check if we have a cached instance with the same config
    const cachedProvider = this.providers.get(provider);
    if (cachedProvider) {
      return cachedProvider;
    }

    let providerInstance: BaseProvider;

    switch (provider) {
      case LLMProvider.ANTHROPIC:
        providerInstance = new AnthropicProvider(config);
        break;
      case LLMProvider.OPENAI:
        // Placeholder for OpenAI implementation
        throw new Error('OpenAI provider not yet implemented');
      case LLMProvider.GEMINI:
        // Placeholder for Gemini implementation
        throw new Error('Gemini provider not yet implemented');
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Cache the provider instance
    this.providers.set(provider, providerInstance);
    return providerInstance;
  }

  static getProvider(provider: LLMProvider): BaseProvider | undefined {
    return this.providers.get(provider);
  }

  static clearProviders(): void {
    this.providers.clear();
  }

  static async validateProvider(
    provider: LLMProvider,
    config: ProviderConfig
  ): Promise<boolean> {
    try {
      const providerInstance = this.createProvider(provider, config);
      return await providerInstance.validateApiKey();
    } catch (error) {
      return false;
    }
  }

  static getAvailableProviders(): LLMProvider[] {
    return [LLMProvider.ANTHROPIC];
    // Add other providers as they are implemented
  }

  static getProviderFromEnv(): { provider: LLMProvider; config: ProviderConfig } | null {
    // Check for Anthropic API key
    if (process.env.ANTHROPIC_API_KEY) {
      return {
        provider: LLMProvider.ANTHROPIC,
        config: {
          apiKey: process.env.ANTHROPIC_API_KEY,
          baseUrl: process.env.ANTHROPIC_BASE_URL,
          organization: process.env.ANTHROPIC_ORGANIZATION,
        },
      };
    }

    // Check for OpenAI API key
    if (process.env.OPENAI_API_KEY) {
      return {
        provider: LLMProvider.OPENAI,
        config: {
          apiKey: process.env.OPENAI_API_KEY,
          baseUrl: process.env.OPENAI_BASE_URL,
          organization: process.env.OPENAI_ORGANIZATION,
        },
      };
    }

    // Check for Gemini API key
    if (process.env.GEMINI_API_KEY) {
      return {
        provider: LLMProvider.GEMINI,
        config: {
          apiKey: process.env.GEMINI_API_KEY,
          baseUrl: process.env.GEMINI_BASE_URL,
        },
      };
    }

    return null;
  }
}