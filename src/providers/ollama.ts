/**
 * Ollama Provider Implementation
 *
 * Integrates with Ollama for running local LLMs.
 * Supports Llama 2, Mistral, and other open-source models.
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
 * Ollama-specific configuration
 */
export interface OllamaConfig extends ProviderConfig {
  /**
   * Base URL for Ollama API (default: http://localhost:11434)
   */
  baseURL?: string

  /**
   * Default model to use
   */
  defaultModel?: string

  /**
   * Whether to use Mlock (keep model in memory)
   */
  mlock?: boolean

  /**
   * Number of GPU layers to use
   */
  numGPU?: number

  /**
   * Number of context tokens
   */
  numCtx?: number

  /**
   * Temperature sampling parameter
   */
  temperature?: number

  /**
   * Top-k sampling parameter
   */
  topK?: number

  /**
   * Top-p sampling parameter
   */
  topP?: number

  /**
   * Repeat penalty
   */
  repeatPenalty?: number
}

/**
 * Default models for Ollama
 */
export const DEFAULT_OLLAMA_MODELS = {
  LLAMA2: 'llama2',
  MISTRAL: 'mistral',
  MIXTRAL: 'mixtral',
  GEMMA: 'gemma',
  PHI: 'phi',
} as const

/**
 * Ollama Provider
 *
 * Implements LLM provider interface for Ollama local models.
 *
 * @example
 * ```typescript
 * const provider = new OllamaProvider({
 *   baseURL: 'http://localhost:11434',
 *   defaultModel: 'llama2'
 * })
 *
 * const result = await provider.complete(
 *   'Explain quantum computing',
 *   { temperature: 0.7 }
 * )
 * ```
 */
export class OllamaProvider implements LLMProvider {
  readonly name = 'ollama'
  readonly type = 'ollama' as const
  readonly version = '1.0.0'

  private config: OllamaConfig
  private capabilities: ProviderCapabilities

  constructor(config: OllamaConfig = {}) {
    this.validateConfig(config)

    this.config = {
      ...config,
      baseURL: config.baseURL || 'http://localhost:11434',
      defaultModel: config.defaultModel || 'llama2',
      timeout: config.timeout || 120000, // Longer timeout for local models
      maxRetries: config.maxRetries || 2,
    }

    this.capabilities = {
      maxContextWindow: this.config.numCtx || 2048,
      maxOutputTokens: 2048,
      supportsStreaming: true,
      supportsFunctionCalling: false,
      supportsSystemPrompt: false,
      availableModels: [], // Will be populated by checkAvailableModels()
      requiresApiKey: false,
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
    const model = options.model || this.config.defaultModel || 'llama2'

    try {
      const response = await this.makeRequest(model, {
        prompt: this.buildPrompt(prompt, options.systemPrompt),
        model,
        stream: false,
        options: {
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
          top_k: options.topK ?? this.config.topK,
          top_p: options.topP ?? this.config.topP,
          repeat_penalty: options.frequencyPenalty ?? this.config.repeatPenalty ?? 1.0,
          mlock: this.config.mlock,
          num_gpu: this.config.numGPU,
          num_ctx: this.config.numCtx,
        },
      })

      return {
        text: response.response,
        tokensUsed: this.estimateTokenCount(prompt, response.response),
        promptTokens: this.countTokens(prompt),
        completionTokens: this.countTokens(response.response),
        finishReason: response.done ? 'stop' : 'length',
        model,
        metadata: {
          total_duration: response.total_duration,
          load_duration: response.load_duration,
          prompt_eval_count: response.prompt_eval_count,
          eval_count: response.eval_count,
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
    const model = options.model || this.config.defaultModel || 'llama2'

    try {
      const response = await this.makeStreamingRequest(model, {
        prompt: this.buildPrompt(prompt, options.systemPrompt),
        model,
        stream: true,
        options: {
          temperature: options.temperature ?? this.config.temperature ?? 0.7,
          num_predict: options.maxTokens ?? 2048,
          top_k: options.topK ?? this.config.topK,
          top_p: options.topP ?? this.config.topP,
          repeat_penalty: options.frequencyPenalty ?? this.config.repeatPenalty ?? 1.0,
          mlock: this.config.mlock,
          num_gpu: this.config.numGPU,
          num_ctx: this.config.numCtx,
        },
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
   * Ollama doesn't provide token counting, so we estimate.
   */
  countTokens(text: string): number {
    return estimateTokensByCharacter(text)
  }

  /**
   * Validate configuration
   */
  validateConfig(config: unknown): boolean {
    const cfg = config as OllamaConfig

    if (cfg.baseURL && typeof cfg.baseURL !== 'string') {
      throw new Error('Base URL must be a string')
    }

    if (cfg.defaultModel && typeof cfg.defaultModel !== 'string') {
      throw new Error('Default model must be a string')
    }

    return true
  }

  /**
   * Check if provider is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        // Update available models
        const data = await response.json() as { models?: Array<{ name: string }> }
        this.capabilities.availableModels = data.models?.map((m) => m.name) || []
      }

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
   * List available models
   */
  async listModels(): Promise<string[]> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/tags`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      })

      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.statusText}`)
      }

      const data = await response.json() as { models?: Array<{ name: string }> }
      const models = data.models?.map((m) => m.name) || []
      this.capabilities.availableModels = models

      return models
    } catch (error) {
      throw new CompletionError(this.name, `Failed to list models: ${error}`, error as Error)
    }
  }

  /**
   * Check if a model is available locally
   */
  async hasModel(model: string): Promise<boolean> {
    const models = await this.listModels()
    return models.some((m: string) => m.startsWith(model))
  }

  /**
   * Pull a model from Ollama registry
   */
  async pullModel(model: string, onProgress?: (status: string) => void): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseURL}/api/pull`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: model, stream: true }),
      })

      if (!response.ok) {
        throw new Error(`Failed to pull model: ${response.statusText}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.trim()) continue

            try {
              const data = JSON.parse(line)
              if (onProgress && data.status) {
                onProgress(data.status)
              }

              if (data.error) {
                throw new Error(data.error)
              }

              if (data.status === 'success') {
                return
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      throw new CompletionError(this.name, `Failed to pull model: ${error}`, error as Error)
    }
  }

  /**
   * Build prompt with system prompt
   *
   * Ollama doesn't have a separate system prompt field,
   * so we prepend it to the user prompt.
   */
  private buildPrompt(userPrompt: string, systemPrompt?: string): string {
    if (systemPrompt) {
      return `${systemPrompt}\n\n${userPrompt}`
    }
    return userPrompt
  }

  /**
   * Make non-streaming API request
   */
  private async makeRequest(_model: string, body: Record<string, unknown>): Promise<any> {
    const maxRetries = this.config.maxRetries || 2

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.config.baseURL}/api/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(this.config.timeout || 120000),
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
    model: string,
    body: Record<string, unknown>,
    onProgress: ProgressCallback
  ): Promise<CompletionResult> {
    return new Promise((resolve, reject) => {
      fetch(`${this.config.baseURL}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeout || 120000),
      })
      .then(response => {
        if (!response.ok) {
          throw new Error(`API error (${response.status}): ${response.statusText}`)
        }

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let fullText = ''

        const read = (): void => {
          reader.read()
            .then(({ value, done: readDone }) => {
              if (readDone) {
                onProgress('', true)

                resolve({
                  text: fullText,
                  tokensUsed: this.estimateTokenCount(body.prompt as string, fullText),
                  promptTokens: this.countTokens(body.prompt as string),
                  completionTokens: this.countTokens(fullText),
                  finishReason: 'stop',
                  model,
                })
                return
              }

              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (!line.trim()) continue

                try {
                  const data = JSON.parse(line)
                  if (data.response) {
                    fullText += data.response
                    onProgress(data.response, false)
                  }

                  if (data.done) {
                    onProgress('', true)

                    resolve({
                      text: fullText,
                      tokensUsed: this.estimateTokenCount(body.prompt as string, fullText),
                      promptTokens: data.prompt_eval_count || this.countTokens(body.prompt as string),
                      completionTokens: data.eval_count || this.countTokens(fullText),
                      finishReason: 'stop',
                      model,
                    })
                    return
                  }
                } catch {
                  // Skip invalid JSON
                }
              }

              read()
            })
            .catch(error => {
              reject(new CompletionError(this.name, `Stream read error: ${error}`, error))
            })
        }

        read()
      })
      .catch(error => {
        reject(new CompletionError(this.name, `Request error: ${error}`, error))
      })
    })
  }

  /**
   * Estimate token count for prompt and response
   */
  private estimateTokenCount(prompt: string, response: string): number {
    return this.countTokens(prompt) + this.countTokens(response)
  }
}

/**
 * Check if Ollama is running and available
 *
 * @param baseURL - Ollama base URL (default: http://localhost:11434)
 * @returns True if Ollama is available
 *
 * @example
 * ```typescript
 * const isAvailable = await isOllamaAvailable()
 * if (isAvailable) {
 *   console.log('Ollama is ready')
 * }
 * ```
 */
export async function isOllamaAvailable(baseURL?: string): Promise<boolean> {
  try {
    const provider = new OllamaProvider({ baseURL })
    return await provider.isAvailable()
  } catch {
    return false
  }
}

/**
 * Create Ollama provider with auto-detected configuration
 *
 * @example
 * ```typescript
 * const provider = await createOllamaProvider()
 * // Auto-dectects available models
 * ```
 */
export async function createOllamaProvider(): Promise<OllamaProvider> {
  const provider = new OllamaProvider()

  // Check if Ollama is available
  const available = await provider.isAvailable()
  if (!available) {
    throw new Error('Ollama is not available. Make sure Ollama is running locally.')
  }

  // List available models
  const models = await provider.listModels()
  if (models.length === 0) {
    console.warn('No models found in Ollama. You may need to pull a model first.')
  } else {
    console.log(`Found ${models.length} model(s) in Ollama: ${models.join(', ')}`)
  }

  return provider
}
