/**
 * Context Manager - Full context distribution and management
 *
 * Handles context distribution to specialists, compaction for long threads,
 * and recontextualization when needed.
 *
 * @module core/context-manager
 */

import type {
  FullContext,
  ContextMessage,
} from '../types/index.js';

/**
 * Context compaction options
 */
export interface CompactionOptions {
  maxTokens: number;
  strategy: 'recursive' | 'summary' | 'both';
  preserveStructure?: boolean;
  keepRecentCount?: number;
}

/**
 * Context package for specialist
 */
export interface ContextPackage {
  context: FullContext;
  compacted: boolean;
  originalSize: number;
  compactedSize: number;
  strategyUsed?: string;
}

/**
 * Recontextualization options
 */
export interface RecontextualizeOptions {
  includeFullHistory?: boolean;
  includeMetadata?: boolean;
  format?: 'structured' | 'flat';
}

/**
 * Search results from previous threads
 */
export interface SearchResults {
  query: string;
  results: Array<{
    threadId: string;
    relevance: number;
    excerpt: string;
    timestamp: Date;
  }>;
}

/**
 * Engine options
 */
export interface EngineOptions {
  maxParallel?: number;
  checkinInterval?: number;
  verbose?: boolean;
  onProgress?: (progress: unknown) => void;
}

/**
 * Context Manager
 *
 * Manages distribution of full parent context to specialists,
 * with compaction and recontextualization support.
 */
export class ContextManager {
  private options: EngineOptions;

  constructor(options: EngineOptions) {
    this.options = options;
  }

  /**
   * Distribute complete parent context to specialist
   *
   * @param parent - Full parent context
   * @param specialistId - Specialist identifier
   * @returns Context package for specialist
   */
  distributeContext(
    parent: FullContext,
    _specialistId: string
  ): ContextPackage {
    return {
      context: parent,
      compacted: false,
      originalSize: parent.metadata.totalTokens,
      compactedSize: parent.metadata.totalTokens,
    };
  }

  /**
   * Compact context for long threads
   *
   * @param context - Full context to compact
   * @param options - Compaction options
   * @returns Compacted context
   */
  async compactContext(
    context: FullContext,
    options: CompactionOptions
  ): Promise<FullContext> {
    const originalSize = this.estimateContextSize(context);

    if (originalSize <= options.maxTokens) {
      return context;
    }

    let compactedMessages: ContextMessage[];

    switch (options.strategy) {
      case 'recursive':
        compactedMessages = await this.recursiveCompaction(context.messages, options);
        break;

      case 'summary':
        compactedMessages = await this.summaryCompaction(context.messages, options);
        break;

      case 'both':
        // Try recursive first, fall back to summary if still too large
        compactedMessages = await this.recursiveCompaction(context.messages, options);
        const recursiveSize = this.estimateMessageTokens(compactedMessages);

        if (recursiveSize > options.maxTokens) {
          compactedMessages = await this.summaryCompaction(context.messages, options);
        }
        break;

      default:
        compactedMessages = context.messages;
    }

    const compactedContext: FullContext = {
      messages: compactedMessages,
      metadata: {
        ...context.metadata,
        totalTokens: this.estimateMessageTokens(compactedMessages),
        messageCount: compactedMessages.length,
        source: 'compressed',
        updatedAt: new Date(),
      },
    };

    if (this.options.verbose) {
      console.log(
        `Compacted context: ${originalSize} -> ${compactedContext.metadata.totalTokens} tokens ` +
        `(${Math.round((1 - compactedContext.metadata.totalTokens / originalSize) * 100)}% reduction)`
      );
    }

    return compactedContext;
  }

  /**
   * Recursive compaction - preserves recent messages in full
   */
  private async recursiveCompaction(
    messages: ContextMessage[],
    options: CompactionOptions
  ): Promise<ContextMessage[]> {
    const keepRecent = options.keepRecentCount || 10;
    const totalTokens = this.estimateMessageTokens(messages);

    if (totalTokens <= options.maxTokens) {
      return messages;
    }

    // Keep recent messages
    const recent = messages.slice(-keepRecent);
    const older = messages.slice(0, -keepRecent);

    // Summarize older messages in chunks
    const summary = await this.summarizeMessages(older);

    const compacted: ContextMessage[] = [
      {
        role: 'system',
        content: `[Earlier conversation summarized]:\n${summary}`,
        timestamp: new Date(),
        tokens: this.estimateTokens(summary),
      },
      ...recent.slice(-(options.keepRecentCount || 5)),
    ];

    return compacted;
  }

  /**
   * Summary compaction - create comprehensive summary
   */
  private async summaryCompaction(
    messages: ContextMessage[],
    options: CompactionOptions
  ): Promise<ContextMessage[]> {
    // Create a comprehensive summary of the entire conversation
    const summary = await this.createComprehensiveSummary(messages);

    // Keep structure if requested
    if (options.preserveStructure) {
      return [
        {
          role: 'system',
          content: `Conversation Summary:\n${summary}`,
          timestamp: new Date(),
          tokens: this.estimateTokens(summary),
        },
        ...messages.slice(-(options.keepRecentCount || 5)),
      ];
    }

    return [
      {
        role: 'system',
        content: `Full Conversation Summary:\n${summary}\n\nThis is a compressed summary of the previous conversation. Key context and decisions are preserved.`,
        timestamp: new Date(),
        tokens: this.estimateTokens(summary),
      },
    ];
  }

  /**
   * Summarize array of messages
   */
  private async summarizeMessages(messages: ContextMessage[]): Promise<string> {
    if (messages.length === 0) return '';

    const summaries: string[] = [];

    // Group messages by role for better summarization
    const byRole = this.groupByRole(messages);

    for (const [role, msgs] of Object.entries(byRole)) {
      const content = msgs.map(m => m.content).join('\n\n');
      const summary = this.createSimpleSummary(content, role);
      summaries.push(summary);
    }

    return summaries.join('\n\n');
  }

  /**
   * Create comprehensive summary
   */
  private async createComprehensiveSummary(messages: ContextMessage[]): Promise<string> {
    const lines: string[] = [];

    lines.push('## Conversation Overview');
    lines.push(`Total messages: ${messages.length}`);
    lines.push(`Time span: ${messages[0]?.timestamp.toISOString()} to ${messages[messages.length - 1]?.timestamp.toISOString()}`);
    lines.push('');

    // Extract key points from user messages
    const userMessages = messages.filter(m => m.role === 'user');
    if (userMessages.length > 0) {
      lines.push('## User Requests:');
      userMessages.forEach((m, i) => {
        lines.push(`${i + 1}. ${m.content.substring(0, 200)}${m.content.length > 200 ? '...' : ''}`);
      });
      lines.push('');
    }

    // Extract key points from assistant messages
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length > 0) {
      lines.push('## Assistant Responses:');
      lines.push(`Total responses: ${assistantMessages.length}`);
      // Count tokens in responses
      const totalResponseTokens = assistantMessages.reduce((sum, m) => sum + (m.tokens || 0), 0);
      lines.push(`Total response tokens: ${totalResponseTokens.toLocaleString()}`);
      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * Create simple summary of content
   */
  private createSimpleSummary(content: string, role: string): string {
    const maxLength = 500;
    const truncated = content.length > maxLength
      ? content.substring(0, maxLength) + '...'
      : content;

    return `## ${role.toUpperCase()} Messages\n\n${truncated}`;
  }

  /**
   * Group messages by role
   */
  private groupByRole(messages: ContextMessage[]): Record<string, ContextMessage[]> {
    return messages.reduce((acc, message) => {
      if (!acc[message.role]) {
        acc[message.role] = [];
      }
      acc[message.role].push(message);
      return acc;
    }, {} as Record<string, ContextMessage[]>);
  }

  /**
   * Recontextualize - provide full context when needed
   *
   * @param specialistId - Specialist requesting recontextualization
   * @param reason - Reason for recontextualization
   * @param fullContext - Full parent context
   * @returns Full context
   */
  async recontextualize(
    specialistId: string,
    reason: string,
    fullContext: FullContext
  ): Promise<FullContext> {
    if (this.options.verbose) {
      console.log(`Recontextualizing for ${specialistId}: ${reason}`);
    }

    return fullContext;
  }

  /**
   * Search across previous threads
   *
   * @param query - Search query
   * @param threads - Previous threads to search
   * @returns Search results
   */
  async searchPreviousThreads(
    query: string,
    threads: FullContext[]
  ): Promise<SearchResults> {
    const results: SearchResults = {
      query,
      results: [],
    };

    // Simple keyword search
    const queryLower = query.toLowerCase();

    for (const thread of threads) {
      for (const message of thread.messages) {
        const content = message.content.toLowerCase();
        if (content.includes(queryLower)) {
          const excerpt = message.content.substring(0, 300);
          const index = results.results.findIndex(r => r.threadId === thread.metadata.source);

          if (index >= 0) {
            results.results[index].relevance++;
          } else {
            results.results.push({
              threadId: thread.metadata.source,
              relevance: 1,
              excerpt,
              timestamp: message.timestamp,
            });
          }
        }
      }
    }

    // Sort by relevance
    results.results.sort((a, b) => b.relevance - a.relevance);

    return results;
  }

  /**
   * Estimate context size in tokens
   */
  estimateContextSize(context: FullContext): number {
    return context.metadata.totalTokens;
  }

  /**
   * Estimate tokens for array of messages
   */
  private estimateMessageTokens(messages: ContextMessage[]): number {
    return messages.reduce((sum, m) => sum + (m.tokens || this.estimateTokens(m.content)), 0);
  }

  /**
   * Estimate token count for text
   * Rough estimate: ~4 characters per token
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}
