/**
 * Anthropic Provider Implementation
 *
 * Integrates with Anthropic's Claude API for text generation.
 * Supports Claude 3 Opus, Sonnet, Haiku, and future models.
 *
 * @packageDocumentation
 */

import {
  LLMProvider,
  CompletionOptions,
  CompletionResult,
  ProgressCallback,
  ProviderConfig,
  ProviderCapabilities,
  CompletionError,
  estimateTokensByCharacter
} from './provider.js'

/**
 * Anthropic-specific configuration
 */
export interface AnthropicConfig extends ProviderConfig {
  /**
   * Anthropic API key
   */
  apiKey: string

  /**
   * Base URL for API requests (default: https://api.anthropic.com)
   */
  baseURL?: string

  /**
   * API version (default: 2023-06-01)
   */
  version?: string
}

/**
 * Default models for Anthropic Claude
 */
export const DEFAULT_ANTHROPIC_MODELS = {
  CLAUDE_3_OPUS: 'claude-3-opus-20240229',
  CLAUDE_3_SONNET: 'claude-3-sonnet-20240229',
  CLAUDE_3_HAIKU: 'claude-3-haiku-20240307',
} as const

/**
 * Anthropic Provider
 *
 * Implements LLM provider interface for Anthropic's Claude API.
 *
 * @example
 * ```typescript
 * const provider = new AnthropicProvider({
 *   apiKey: 'sk-ant-...',
 *   defaultModel: 'claude-3-opus-20240229'
 * })
 *
 * const result = await provider.complete(
 *   'Explain quantum computing',
 *   { temperature: 0.7 }
 * )
 * ```
 */
export class AnthropicProvider implements LLMProvider {
  readonly name = 'anthropic'
  readonly type = 'anthropic' as const
  readonly version = '1.0.0'

  private config: AnthropicConfig
  private capabilities: ProviderCapabilities

  constructor(config: AnthropicConfig) {
    this.validateConfig(config)

    this.config = {
      ...config,
      baseURL: config.baseURL || 'https://api.anthropic.com',
      version: config.version || '2023-06-01',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    }

    this.capabilities = {
      maxContextWindow: 200000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsSystemPrompt: true,
      availableModels: [
        'claude-3-opus-20240229',
        'claude-3-sonnet-20240229',
        'claude-3-haiku-20240307',
      ],
      requiresApiKey: true,
      supportsCustomBaseURL: false,
    }
  }

  /**
   * Generate a completion
   */
  async complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options.model || this.config.defaultModel || DEFAULT_ANTHROPIC_MODELS.CLAUDE_3_OPUS

    try {
      const response = await this.makeRequest({
        model,
        messages: this.buildMessages(prompt),
        system: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stop_sequences: options.stopSequences,
        top_p: options.topP,
        top_k: options.topK,
      })

      if (response.type === 'error') {
        throw new CompletionError(this.name, response.error.message)
      }

      return {
        text: response.content[0]?.text || '',
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        finishReason: response.stop_reason === 'end_turn' ? 'stop' :
                     response.stop_reason === 'max_tokens' ? 'length' :
                     'stop',
        model,
        metadata: {
          id: response.id,
          stop_reason: response.stop_reason,
        }
      }
    } catch (error) {
      if (error instanceof CompletionError) {
        throw error
      }
      throw new CompletionError(this.name, String(error), error as Error)
    }
  }

  /**
   * Generate a streaming completion
   */
  async streamComplete(
    prompt: string,
    options: CompletionOptions,
    onProgress: ProgressCallback
  ): Promise<CompletionResult> {
    const model = options.model || this.config.defaultModel || DEFAULT_ANTHROPIC_MODELS.CLAUDE_3_OPUS

    try {
      const response = await this.makeStreamingRequest({
        model,
        messages: this.buildMessages(prompt),
        system: options.systemPrompt,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stop_sequences: options.stopSequences,
        top_p: options.topP,
        top_k: options.topK,
      }, onProgress)

      return response
    } catch (error) {
      if (error instanceof CompletionError) {
        throw error
      }
      throw new CompletionError(this.name, String(error), error as Error)
    }
  }

  /**
   * Count tokens (estimate)
   *
   * Claude uses a different tokenizer than GPT.
   * This is a rough estimate.
   */
  countTokens(text: string): number {
    return estimateTokensByCharacter(text)
  }

  /**
   * Validate configuration
   */
  validateConfig(config: unknown): boolean {
    const cfg = config as AnthropicConfig

    if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
      throw new Error('Anthropic API key is required and must be a string')
    }

    if (!cfg.apiKey.startsWith('sk-ant-')) {
      throw new Error('Invalid Anthropic API key format (should start with "sk-ant-")')
    }

    if (cfg.baseURL && typeof cfg.baseURL !== 'string') {
      throw new Error('Base URL must be a string')
    }

    return true
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Anthropic doesn't have a /models endpoint, so we make a minimal request
      const response = await fetch(`${this.config.baseURL}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': this.config.version || '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'test' }],
        }),
        signal: AbortSignal.timeout(5000),
      })

      // Rate limit errors (429) mean the key is valid but rate limited
      return response.ok || response.status === 429
    } catch {
      return false
    }
  }

  /**
   * Get provider capabilities
   */
  getCapabilities(): ProviderCapabilities {
    return this.capabilities
  }

  /**
   * Build messages array for API request
   *
   * Anthropic expects messages array without system prompt.
   * System prompt is a separate parameter.
   */
  private buildMessages(
    prompt: string
  ): Array<{ role: string; content: string }> {
    return [
      { role: 'user', content: prompt }
    ]
  }

  /**
   * Make non-streaming API request
   */
  private async makeRequest(body: Record<string, unknown>): Promise<any> {
    const maxRetries = this.config.maxRetries || 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseURL}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.config.apiKey,
            'anthropic-version': this.config.version || '2023-06-01',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeout || 60000),
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(`API error (${response.status}): ${JSON.stringify(data)}`)
        }

        return data
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error
        }

        // Exponential backoff
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw new Error('Max retries exceeded')
  }

  /**
   * Make streaming API request
   */
  private async makeStreamingRequest(
    body: Record<string, unknown>,
    onProgress: ProgressCallback
  ): Promise<CompletionResult> {
    const response = await fetch(`${this.config.baseURL}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.config.apiKey,
        'anthropic-version': this.config.version || '2023-06-01',
      },
      body: JSON.stringify({
        ...body,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 60000),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`API error (${response.status}): ${error}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ''
    let promptTokens = 0
    let completionTokens = 0
    let totalTokens = 0
    let model = body.model as string
    let finishReason: 'stop' | 'length' | 'content_filter' = 'stop'

    try {
      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue

          const data = line.slice(6)

          try {
            const parsed = JSON.parse(data)

            // Handle content_block_delta events
            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              fullText += parsed.delta.text
              onProgress(parsed.delta.text, false)
            }

            // Handle message_stop event
            if (parsed.type === 'message_stop') {
              onProgress('', true)
            }

            // Handle message_start event (usage info)
            if (parsed.type === 'message_start' && parsed.message?.usage) {
              promptTokens = parsed.message.usage.input_tokens || 0
            }

            // Handle message_delta event (final usage)
            if (parsed.type === 'message_delta') {
              if (parsed.usage?.output_tokens) {
                completionTokens = parsed.usage.output_tokens
              }
              if (parsed.delta?.stop_reason) {
                finishReason = parsed.delta.stop_reason === 'end_turn' ? 'stop' :
                             parsed.delta.stop_reason === 'max_tokens' ? 'length' :
                             'stop'
              }
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    totalTokens = promptTokens + completionTokens

    return {
      text: fullText,
      tokensUsed: totalTokens,
      promptTokens,
      completionTokens,
      finishReason,
      model,
    }
  }
}

/**
 * Create Anthropic provider from environment variables
 *
 * @example
 * ```typescript
 * const provider = createAnthropicProviderFromEnv()
 * // Uses ANTHROPIC_API_KEY environment variable
 * ```
 */
export function createAnthropicProviderFromEnv(): AnthropicProvider {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is not set')
  }

  return new AnthropicProvider({
    apiKey,
    baseURL: process.env.ANTHROPIC_BASE_URL,
    version: process.env.ANTHROPIC_VERSION,
    defaultModel: process.env.ANTHROPIC_DEFAULT_MODEL,
  })
}

/**
 * Check if Anthropic is configured
 *
 * @returns True if ANTHROPIC_API_KEY is set
 */
export function isAnthropicConfigured(): boolean {
  return typeof process.env.ANTHROPIC_API_KEY === 'string' &&
         process.env.ANTHROPIC_API_KEY.length > 0
}
