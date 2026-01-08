/**
 * Specialist - Individual agent executor
 *
 * Represents a single specialist agent with specific role and capabilities.
 *
 * @module core/specialist
 */

import type {
  SpecialistConfig,
  SpecialistRole,
  SpecialistResult,
  FullContext,
} from '../types/index.js';
import type { LLMProvider, CompletionOptions } from '../providers/provider.js';

/**
 * Specialist execution options
 */
export interface SpecialistExecutionOptions {
  verbose?: boolean;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Specialist agent
 *
 * Represents a single specialist with specific role and capabilities.
 */
export class Specialist {
  readonly id: string;
  readonly role: SpecialistRole;
  readonly systemPrompt: string;
  readonly provider: LLMProvider;
  readonly config: SpecialistConfig;

  constructor(config: SpecialistConfig, provider: LLMProvider) {
    this.id = config.id;
    this.role = config.role;
    this.systemPrompt = config.systemPrompt;
    this.provider = provider;
    this.config = config;
  }

  /**
   * Execute specialist task
   *
   * @param task - Task description
   * @param context - Full context from parent
   * @param previousSummary - Optional summary from previous specialist
   * @param options - Execution options
   * @returns Specialist result
   */
  async execute(
    task: string,
    context: FullContext,
    previousSummary?: string,
    options: SpecialistExecutionOptions = {}
  ): Promise<SpecialistResult> {
    const startTime = Date.now();
    const verbose = options.verbose ?? false;
    const timeout = options.timeout ?? 300000; // 5 minutes default

    if (verbose) {
      console.log(`[${this.role}] Starting task: ${task.substring(0, 100)}...`);
    }

    try {
      // Build prompt with context
      const prompt = this.buildPrompt(task, context, previousSummary);

      // Configure completion options
      const completionOptions: CompletionOptions = {
        model: this.config.model,
        temperature: this.config.temperature ?? 0.7,
        maxTokens: this.config.maxTokens ?? 4096,
        systemPrompt: this.systemPrompt,
      };

      // Execute with timeout
      const content = await this.executeWithTimeout(
        prompt,
        completionOptions,
        timeout
      );

      const duration = Date.now() - startTime;
      const tokensUsed = this.provider.countTokens(content);

      if (verbose) {
        console.log(`[${this.role}] Completed in ${duration}ms, ${tokensUsed} tokens`);
      }

      // Generate summary
      const summary = this.generateSummary(content);

      return {
        specialistId: this.id,
        role: this.role,
        content,
        summary,
        tokensUsed,
        duration,
        timestamp: new Date(),
        status: 'success',
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (verbose) {
        console.error(`[${this.role}] Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }

      return {
        specialistId: this.id,
        role: this.role,
        content: '',
        summary: 'Execution failed',
        tokensUsed: 0,
        duration,
        timestamp: new Date(),
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build prompt with context and previous summary
   */
  private buildPrompt(
    task: string,
    context: FullContext,
    previousSummary?: string
  ): string {
    const parts: string[] = [];

    // Add task
    parts.push('# Task');
    parts.push(task);
    parts.push('');

    // Add previous summary if available
    if (previousSummary) {
      parts.push('# Previous Work Summary');
      parts.push(previousSummary);
      parts.push('');
    }

    // Add context
    if (context.messages.length > 0) {
      parts.push('# Context from Parent Conversation');
      parts.push('');
      parts.push(this.formatContext(context));
      parts.push('');
    }

    // Add instructions
    parts.push('# Instructions');
    parts.push('You are a ' + this.role + ' specialist. Your job is to:');
    parts.push('1. Complete the task above to the best of your ability');
    parts.push('2. Leverage the provided context effectively');
    parts.push('3. Provide comprehensive, detailed output');
    parts.push('4. End with a clear summary of what you accomplished');
    parts.push('');

    return parts.join('\n');
  }

  /**
   * Format context for prompt
   */
  private formatContext(context: FullContext): string {
    const lines: string[] = [];

    lines.push(`Total messages: ${context.messages.length}`);
    lines.push(`Total tokens: ${context.metadata.totalTokens.toLocaleString()}`);
    lines.push(`Source: ${context.metadata.source}`);
    lines.push('');

    // Format recent messages (last 20 to avoid excessive context)
    const recentMessages = context.messages.slice(-20);

    for (const message of recentMessages) {
      lines.push(`## ${message.role.toUpperCase()} (${message.timestamp.toISOString()})`);
      lines.push(message.content);
      lines.push('');
    }

    if (context.messages.length > 20) {
      lines.push(`... (${context.messages.length - 20} earlier messages omitted for brevity)`);
    }

    return lines.join('\n');
  }

  /**
   * Execute completion with timeout
   */
  private async executeWithTimeout(
    prompt: string,
    options: CompletionOptions,
    timeout: number
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Execution timeout after ${timeout}ms`));
      }, timeout);

      this.provider
        .complete(prompt, options)
        .then((result) => {
          clearTimeout(timer);
          resolve(result.text);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Generate summary of content
   */
  private generateSummary(content: string): string {
    // Extract first and last paragraphs as summary
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);

    if (paragraphs.length === 0) {
      return 'No content generated';
    }

    if (paragraphs.length === 1) {
      return paragraphs[0].substring(0, 500) +
        (paragraphs[0].length > 500 ? '...' : '');
    }

    const first = paragraphs[0].substring(0, 300);
    const last = paragraphs[paragraphs.length - 1].substring(0, 200);

    return `${first}${paragraphs[0].length > 300 ? '...' : ''}\n\n...\n\n${last}${paragraphs[paragraphs.length - 1].length > 200 ? '...' : ''}`;
  }

  /**
   * Get specialist capabilities
   */
  getCapabilities(): string[] {
    switch (this.role) {
      case 'researcher':
        return [
          'Gather information from multiple sources',
          'Synthesize findings',
          'Identify key patterns',
          'Provide comprehensive analysis',
        ];
      case 'coder':
        return [
          'Write clean, efficient code',
          'Follow best practices',
          'Add documentation',
          'Consider edge cases',
        ];
      case 'architect':
        return [
          'Design system architecture',
          'Consider scalability',
          'Plan component interactions',
          'Identify technical constraints',
        ];
      case 'world-builder':
        return [
          'Create rich, detailed worlds',
          'Develop coherent lore',
          'Design cultures and geography',
          'Ensure internal consistency',
        ];
      case 'analyst':
        return [
          'Analyze data and patterns',
          'Identify trends',
          'Provide insights',
          'Support conclusions with evidence',
        ];
      case 'critic':
        return [
          'Review and critique',
          'Identify weaknesses',
          'Suggest improvements',
          'Provide constructive feedback',
        ];
      case 'synthesizer':
        return [
          'Combine multiple perspectives',
          'Identify patterns',
          'Create coherent synthesis',
          'Resolve contradictions',
        ];
      default:
        return ['Execute specialized tasks'];
    }
  }
}
