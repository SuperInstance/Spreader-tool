/**
 * OpenAI Provider Implementation
 *
 * Integrates with OpenAI's API for text generation.
 * Supports GPT-4, GPT-3.5, and future models.
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
 * OpenAI-specific configuration
 */
export interface OpenAIConfig extends ProviderConfig {
  /**
   * OpenAI API key
   */
  apiKey: string

  /**
   * Base URL for API requests (default: https://api.openai.com/v1)
   */
  baseURL?: string

  /**
   * Organization ID (optional)
   */
  organization?: string

  /**
   * Project ID (optional)
   */
  project?: string
}

/**
 * Default models for OpenAI
 */
export const DEFAULT_OPENAI_MODELS = {
  GPT_4_TURBO: 'gpt-4-turbo',
  GPT_4: 'gpt-4',
  GPT_3_5_TURBO: 'gpt-3.5-turbo',
} as const

/**
 * OpenAI Provider
 *
 * Implements LLM provider interface for OpenAI's API.
 *
 * @example
 * ```typescript
 * const provider = new OpenAIProvider({
 *   apiKey: 'sk-...',
 *   defaultModel: 'gpt-4-turbo'
 * })
 *
 * const result = await provider.complete(
 *   'Explain quantum computing',
 *   { temperature: 0.7 }
 * )
 * ```
 */
export class OpenAIProvider implements LLMProvider {
  readonly name = 'openai'
  readonly type = 'openai' as const
  readonly version = '1.0.0'

  private config: OpenAIConfig
  private capabilities: ProviderCapabilities

  constructor(config: OpenAIConfig) {
    this.validateConfig(config)

    this.config = {
      ...config,
      baseURL: config.baseURL || 'https://api.openai.com/v1',
      timeout: config.timeout || 60000,
      maxRetries: config.maxRetries || 3,
    }

    this.capabilities = {
      maxContextWindow: 128000,
      maxOutputTokens: 4096,
      supportsStreaming: true,
      supportsFunctionCalling: true,
      supportsSystemPrompt: true,
      availableModels: [
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
      ],
      requiresApiKey: true,
      supportsCustomBaseURL: true,
    }
  }

  /**
   * Generate a completion
   */
  async complete(
    prompt: string,
    options: CompletionOptions
  ): Promise<CompletionResult> {
    const model = options.model || this.config.defaultModel || DEFAULT_OPENAI_MODELS.GPT_4_TURBO

    try {
      const response = await this.makeRequest({
        model,
        messages: this.buildMessages(prompt, options.systemPrompt),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stop: options.stopSequences,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
      })

      const choice = response.choices[0]
      if (!choice) {
        throw new CompletionError(this.name, 'No choices returned from API')
      }

      return {
        text: choice.message.content,
        tokensUsed: response.usage.total_tokens,
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        finishReason: choice.finish_reason === 'length' ? 'length' :
                     choice.finish_reason === 'content_filter' ? 'content_filter' :
                     'stop',
        model: response.model,
        metadata: {
          id: response.id,
          created: response.created,
          system_fingerprint: response.system_fingerprint,
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
    const model = options.model || this.config.defaultModel || DEFAULT_OPENAI_MODELS.GPT_4_TURBO

    try {
      const response = await this.makeStreamingRequest({
        model,
        messages: this.buildMessages(prompt, options.systemPrompt),
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens ?? 4096,
        stop: options.stopSequences,
        top_p: options.topP,
        frequency_penalty: options.frequencyPenalty,
        presence_penalty: options.presencePenalty,
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
   * For accurate counting, would need tiktoken library.
   * This is a rough estimate.
   */
  countTokens(text: string): number {
    return estimateTokensByCharacter(text)
  }

  /**
   * Validate configuration
   */
  validateConfig(config: unknown): boolean {
    const cfg = config as OpenAIConfig

    if (!cfg.apiKey || typeof cfg.apiKey !== 'string') {
      throw new Error('OpenAI API key is required and must be a string')
    }

    if (!cfg.apiKey.startsWith('sk-')) {
      throw new Error('Invalid OpenAI API key format (should start with "sk-")')
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
      const response = await fetch(`${this.config.baseURL}/models`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      })

      return response.ok
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
   */
  private buildMessages(
    prompt: string,
    systemPrompt?: string
  ): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push({ role: 'user', content: prompt })

    return messages
  }

  /**
   * Make non-streaming API request
   */
  private async makeRequest(body: Record<string, unknown>): Promise<any> {
    const maxRetries = this.config.maxRetries || 3

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.config.apiKey}`,
            ...(this.config.organization && { 'OpenAI-Organization': this.config.organization }),
            ...(this.config.project && { 'OpenAI-Project': this.config.project }),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeout || 60000),
        })

        if (!response.ok) {
          const error = await response.text()
          throw new Error(`API error (${response.status}): ${error}`)
        }

        return await response.json()
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
    const response = await fetch(`${this.config.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
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

          if (data === '[DONE]') {
            onProgress('', true)
            break
          }

          try {
            const parsed = JSON.parse(data)
            const delta = parsed.choices[0]?.delta?.content

            if (delta) {
              fullText += delta
              onProgress(delta, false)
            }

            if (parsed.choices[0]?.finish_reason) {
              finishReason = parsed.choices[0].finish_reason === 'length' ? 'length' :
                           parsed.choices[0].finish_reason === 'content_filter' ? 'content_filter' :
                           'stop'
            }

            if (parsed.usage) {
              promptTokens = parsed.usage.prompt_tokens || 0
              completionTokens = parsed.usage.completion_tokens || 0
              totalTokens = parsed.usage.total_tokens || 0
            }

            if (parsed.model) {
              model = parsed.model
            }
          } catch {
            // Skip invalid JSON
          }
        }
      }
    } finally {
      reader.releaseLock()
    }

    // Estimate tokens if not provided
    if (totalTokens === 0) {
      promptTokens = this.countTokens(JSON.stringify(body.messages))
      completionTokens = this.countTokens(fullText)
      totalTokens = promptTokens + completionTokens
    }

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
 * Create OpenAI provider from environment variables
 *
 * @example
 * ```typescript
 * const provider = createOpenAIProviderFromEnv()
 * // Uses OPENAI_API_KEY environment variable
 * ```
 */
export function createOpenAIProviderFromEnv(): OpenAIProvider {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  return new OpenAIProvider({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT,
    defaultModel: process.env.OPENAI_DEFAULT_MODEL,
  })
}

/**
 * Check if OpenAI is configured
 *
 * @returns True if OPENAI_API_KEY is set
 */
export function isOpenAIConfigured(): boolean {
  return typeof process.env.OPENAI_API_KEY === 'string' &&
         process.env.OPENAI_API_KEY.length > 0
}
