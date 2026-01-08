/**
 * LLM Provider Interface and Types
 *
 * Defines the contract for all LLM providers in the Spreader tool.
 * Each provider must implement this interface to be compatible with the
 * specialist execution system.
 *
 * @packageDocumentation
 */

/**
 * Provider type identifiers
 */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'ollama'
  | 'mcp'
  | 'custom'

/**
 * Completion options for LLM requests
 */
export interface CompletionOptions {
  /**
   * Model identifier (e.g., 'gpt-4-turbo', 'claude-3-opus-20240229')
   */
  model?: string

  /**
   * Sampling temperature (0.0 to 1.0)
   * Lower = more deterministic, Higher = more creative
   * @default 0.7
   */
  temperature?: number

  /**
   * Maximum tokens to generate
   * @default 4096
   */
  maxTokens?: number

  /**
   * Sequences that will stop generation
   */
  stopSequences?: string[]

  /**
   * System prompt to guide model behavior
   */
  systemPrompt?: string

  /**
   * Top-p sampling parameter (0.0 to 1.0)
   * @default 1.0
   */
  topP?: number

  /**
   * Top-k sampling parameter
   */
  topK?: number

  /**
   * Presence penalty (-2.0 to 2.0)
   * @default 0
   */
  presencePenalty?: number

  /**
   * Frequency penalty (-2.0 to 2.0)
   * @default 0
   */
  frequencyPenalty?: number
}

/**
 * Completion result from LLM
 */
export interface CompletionResult {
  /**
   * Generated text content
   */
  text: string

  /**
   * Total tokens used (prompt + completion)
   */
  tokensUsed: number

  /**
   * Prompt tokens used
   */
  promptTokens?: number

  /**
   * Completion tokens used
   */
  completionTokens?: number

  /**
   * Reason for completion termination
   */
  finishReason: 'stop' | 'length' | 'content_filter' | 'error'

  /**
   * Model identifier used
   */
  model: string

  /**
   * Additional metadata (provider-specific)
   */
  metadata?: Record<string, unknown>
}

/**
 * Progress callback for streaming completions
 */
export type ProgressCallback = (delta: string, done: boolean) => void

/**
 * LLM Provider interface
 *
 * All providers must implement this interface to work with Spreader.
 */
export interface LLMProvider {
  /**
   * Unique provider name
   */
  readonly name: string

  /**
   * Provider type identifier
   */
  readonly type: ProviderType

  /**
   * Provider version
   */
  readonly version: string

  /**
   * Generate a completion (non-streaming)
   *
   * @param prompt - The user prompt to complete
   * @param options - Completion options
   * @returns Promise resolving to completion result
   *
   * @example
   * ```typescript
   * const result = await provider.complete(
   *   'Explain quantum computing',
   *   { model: 'gpt-4-turbo', temperature: 0.7 }
   * )
   * console.log(result.text)
   * console.log(`Tokens used: ${result.tokensUsed}`)
   * ```
   */
  complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<CompletionResult>

  /**
   * Generate a completion with streaming progress
   *
   * @param prompt - The user prompt to complete
   * @param options - Completion options
   * @param onProgress - Callback for streaming progress
   * @returns Promise resolving to completion result
   *
   * @example
   * ```typescript
   * const result = await provider.streamComplete(
   *   'Explain quantum computing',
   *   { model: 'gpt-4-turbo' },
   *   (delta, done) => {
   *     process.stdout.write(delta)
   *     if (done) console.log('\n[Complete]')
   *   }
   * )
   * ```
   */
  streamComplete(
    prompt: string,
    options: CompletionOptions,
    onProgress: ProgressCallback
  ): Promise<CompletionResult>

  /**
   * Count tokens in text
   *
   * Used for cost tracking and context management.
   * Should use the provider's tokenizer if available, otherwise estimate.
   *
   * @param text - Text to count tokens in
   * @returns Estimated token count
   *
   * @example
   * ```typescript
   * const tokens = provider.countTokens('Hello, world!')
   * console.log(`Estimated tokens: ${tokens}`)
   * ```
   */
  countTokens(text: string): number

  /**
   * Validate provider configuration
   *
   * Should check API keys, endpoints, and other settings.
   *
   * @param config - Configuration object to validate
   * @returns True if configuration is valid
   * @throws Error with validation details if invalid
   *
   * @example
   * ```typescript
   * try {
   *   provider.validateConfig({ apiKey: 'sk-...' })
   *   console.log('Configuration is valid')
   * } catch (error) {
   *   console.error('Invalid configuration:', error.message)
   * }
   * ```
   */
  validateConfig(config: unknown): boolean

  /**
   * Check if provider is available
   *
   * Should verify API connectivity, credentials, and service health.
   *
   * @returns True if provider is ready to use
   *
   * @example
   * ```typescript
   * if (await provider.isAvailable()) {
   *   console.log('Provider is ready')
   * } else {
   *   console.log('Provider is unavailable')
   * }
   * ```
   */
  isAvailable(): Promise<boolean>

  /**
   * Get provider capabilities
   *
   * Returns information about what the provider supports.
   *
   * @returns Provider capabilities
   *
   * @example
   * ```typescript
   * const capabilities = provider.getCapabilities()
   * console.log(`Max tokens: ${capabilities.maxTokens}`)
   * console.log(`Streaming: ${capabilities.supportsStreaming}`)
   * ```
   */
  getCapabilities(): ProviderCapabilities
}

/**
 * Provider capabilities
 */
export interface ProviderCapabilities {
  /**
   * Maximum context window size
   */
  maxContextWindow: number

  /**
   * Maximum output tokens
   */
  maxOutputTokens: number

  /**
   * Whether streaming is supported
   */
  supportsStreaming: boolean

  /**
   * Whether function calling is supported
   */
  supportsFunctionCalling: boolean

  /**
   * Whether system prompts are supported
   */
  supportsSystemPrompt: boolean

  /**
   * Available models
   */
  availableModels: string[]

  /**
   * Whether the provider requires an API key
   */
  requiresApiKey: boolean

  /**
   * Whether the provider supports custom base URLs
   */
  supportsCustomBaseURL: boolean
}

/**
 * Provider configuration interface
 */
export interface ProviderConfig {
  /**
   * API key for authentication
   */
  apiKey?: string

  /**
   * Custom base URL
   */
  baseURL?: string

  /**
   * Default model to use
   */
  defaultModel?: string

  /**
   * Default completion options
   */
  defaultOptions?: Partial<CompletionOptions>

  /**
   * Request timeout in milliseconds
   */
  timeout?: number

  /**
   * Maximum retries
   */
  maxRetries?: number

  /**
   * Additional provider-specific configuration
   */
  [key: string]: unknown
}

/**
 * Error thrown when provider is unavailable
 */
export class ProviderUnavailableError extends Error {
  constructor(
    public readonly providerName: string,
    message: string
  ) {
    super(`Provider '${providerName}' is unavailable: ${message}`)
    this.name = 'ProviderUnavailableError'
  }
}

/**
 * Error thrown when completion fails
 */
export class CompletionError extends Error {
  constructor(
    public readonly providerName: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`Completion failed for provider '${providerName}': ${message}`)
    this.name = 'CompletionError'
  }
}

/**
 * Error thrown when token counting fails
 */
export class TokenCountError extends Error {
  constructor(message: string) {
    super(`Token count error: ${message}`)
    this.name = 'TokenCountError'
  }
}

/**
 * Estimate tokens by character count
 *
 * Fallback method when no tokenizer is available.
 * Rough estimate: ~4 characters per token for English text.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokensByCharacter('Hello, world!')
 * console.log(`Estimated tokens: ${tokens}`)
 * ```
 */
export function estimateTokensByCharacter(text: string): number {
  // Rough estimate: ~4 characters per token
  // Works reasonably for English text
  return Math.ceil(text.length / 4)
}

/**
 * Estimate tokens by word count
 *
 * Alternative estimation method.
 * Rough estimate: ~0.75 words per token.
 *
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 *
 * @example
 * ```typescript
 * const tokens = estimateTokensByWord('Hello world how are you?')
 * console.log(`Estimated tokens: ${tokens}`)
 * ```
 */
export function estimateTokensByWord(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0)
  // Rough estimate: ~0.75 words per token
  return Math.ceil(words.length / 0.75)
}

/**
 * Calculate token cost
 *
 * Calculate the approximate cost of a completion based on token usage.
 *
 * @param providerType - Type of provider
 * @param model - Model identifier
 * @param promptTokens - Number of prompt tokens
 * @param completionTokens - Number of completion tokens
 * @returns Cost in USD
 *
 * @example
 * ```typescript
 * const cost = calculateTokenCost('openai', 'gpt-4-turbo', 1000, 500)
 * console.log(`Cost: $${cost.toFixed(4)}`)
 * ```
 */
export function calculateTokenCost(
  _providerType: ProviderType,
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  // Pricing as of 2025 (will need updates)
  const pricing: Record<string, { prompt: number; completion: number }> = {
    // OpenAI pricing (per 1M tokens)
    'gpt-4-turbo': { prompt: 10, completion: 30 },
    'gpt-4': { prompt: 30, completion: 60 },
    'gpt-3.5-turbo': { prompt: 0.5, completion: 1.5 },

    // Anthropic pricing (per 1M tokens)
    'claude-3-opus-20240229': { prompt: 15, completion: 75 },
    'claude-3-sonnet-20240229': { prompt: 3, completion: 15 },
    'claude-3-haiku-20240307': { prompt: 0.25, completion: 1.25 },

    // Default pricing
    'default': { prompt: 1, completion: 2 }
  }

  const modelPricing = pricing[model] || pricing['default']

  const promptCost = (promptTokens / 1_000_000) * modelPricing.prompt
  const completionCost = (completionTokens / 1_000_000) * modelPricing.completion

  return promptCost + completionCost
}
