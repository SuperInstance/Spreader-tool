/**
 * Provider Registry - Manage available LLM providers
 *
 * Central registry for all LLM providers with auto-detection
 * and dynamic registration support.
 *
 * @module providers/registry
 */

import type { LLMProvider } from './provider.js';
import type { ProviderConfig } from '../types/index.js';

/**
 * Provider auto-detection result
 */
export interface ProviderDetection {
  provider: string;
  available: boolean;
  reason?: string;
  config?: ProviderConfig;
}

/**
 * Provider Registry
 *
 * Manages available LLM providers and handles auto-detection.
 */
export class ProviderRegistry {
  private providers: Map<string, LLMProvider> = new Map();

  /**
   * Register a provider
   *
   * @param provider - LLM provider to register
   */
  register(provider: LLMProvider): void {
    this.providers.set(provider.name, provider);
  }

  /**
   * Unregister a provider
   *
   * @param name - Provider name
   */
  unregister(name: string): void {
    this.providers.delete(name);
  }

  /**
   * Get a provider by name
   *
   * @param name - Provider name
   * @returns Provider or undefined if not found
   */
  get(name: string): LLMProvider | undefined {
    return this.providers.get(name);
  }

  /**
   * Check if provider is registered
   *
   * @param name - Provider name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.providers.has(name);
  }

  /**
   * List all registered provider names
   *
   * @returns Array of provider names
   */
  list(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get all registered providers
   *
   * @returns Array of providers
   */
  getAll(): LLMProvider[] {
    return Array.from(this.providers.values());
  }

  /**
   * Clear all providers
   */
  clear(): void {
    this.providers.clear();
  }

  /**
   * Get count of registered providers
   *
   * @returns Provider count
   */
  get count(): number {
    return this.providers.size;
  }

  /**
   * Auto-detect available providers
   *
   * Checks environment variables and connectivity for various providers.
   *
   * @returns Array of detection results
   */
  async autoDetect(): Promise<ProviderDetection[]> {
    const detections: ProviderDetection[] = [];

    // Detect OpenAI
    detections.push(await this.detectOpenAI());

    // Detect Anthropic
    detections.push(await this.detectAnthropic());

    // Detect Ollama
    detections.push(await this.detectOllama());

    // Filter available providers and register them
    for (const detection of detections) {
      if (detection.available && detection.config) {
        // Provider will be registered externally with full config
        // This just reports availability
      }
    }

    return detections;
  }

  /**
   * Detect OpenAI availability
   */
  private async detectOpenAI(): Promise<ProviderDetection> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        provider: 'openai',
        available: false,
        reason: 'OPENAI_API_KEY environment variable not set',
      };
    }

    return {
      provider: 'openai',
      available: true,
      config: {
        name: 'openai',
        type: 'openai',
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4-turbo',
      },
    };
  }

  /**
   * Detect Anthropic availability
   */
  private async detectAnthropic(): Promise<ProviderDetection> {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        provider: 'anthropic',
        available: false,
        reason: 'ANTHROPIC_API_KEY environment variable not set',
      };
    }

    return {
      provider: 'anthropic',
      available: true,
      config: {
        name: 'anthropic',
        type: 'anthropic',
        apiKey,
        baseURL: process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com',
        defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL || 'claude-3-opus-20240229',
      },
    };
  }

  /**
   * Detect Ollama availability
   */
  private async detectOllama(): Promise<ProviderDetection> {
    const baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    try {
      // Try to connect to Ollama
      const response = await fetch(`${baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        return {
          provider: 'ollama',
          available: true,
          config: {
            name: 'ollama',
            type: 'ollama',
            baseURL,
            defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama2',
          },
        };
      }

      return {
        provider: 'ollama',
        available: false,
        reason: `Ollama API returned status ${response.status}`,
      };
    } catch (error) {
      return {
        provider: 'ollama',
        available: false,
        reason: `Cannot connect to Ollama at ${baseURL}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get provider by type
   *
   * @param type - Provider type
   * @returns First provider matching type or undefined
   */
  getByType(type: string): LLMProvider | undefined {
    return Array.from(this.providers.values()).find(p => p.type === type);
  }

  /**
   * Get default provider
   *
   * Returns OpenAI if available, otherwise Anthropic, otherwise Ollama, otherwise first available
   *
   * @returns Default provider or undefined
   */
  getDefault(): LLMProvider | undefined {
    // Prefer OpenAI
    const openai = this.get('openai');
    if (openai) return openai;

    // Then Anthropic
    const anthropic = this.get('anthropic');
    if (anthropic) return anthropic;

    // Then Ollama
    const ollama = this.get('ollama');
    if (ollama) return ollama;

    // Fall back to first available
    return this.getAll()[0];
  }

  /**
   * Validate provider configuration
   *
   * @param config - Provider configuration
   * @returns True if valid
   */
  validateConfig(config: ProviderConfig): boolean {
    const provider = this.get(config.name);

    if (!provider) {
      return false;
    }

    return provider.validateConfig(config);
  }

  /**
   * Get provider capabilities
   *
   * @param name - Provider name
   * @returns Provider capabilities or undefined
   */
  getCapabilities(name: string) {
    const provider = this.get(name);
    return provider?.getCapabilities();
  }

  /**
   * Check if provider supports streaming
   *
   * @param name - Provider name
   * @returns True if streaming supported
   */
  supportsStreaming(name: string): boolean {
    const provider = this.get(name);
    return provider?.getCapabilities().supportsStreaming ?? false;
  }

  /**
   * Check if provider requires API key
   *
   * @param name - Provider name
   * @returns True if API key required
   */
  requiresApiKey(name: string): boolean {
    const provider = this.get(name);
    return provider?.getCapabilities().requiresApiKey ?? false;
  }
}
