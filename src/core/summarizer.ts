/**
 * Ralph Wiggum Summarizer - Handoff summarization
 *
 * Generates efficient summaries for specialist handoffs to maintain
 * context while managing token budgets.
 *
 * @module core/summarizer
 */

import type {
  SpecialistResult,
  FullContext,
} from '../types/index.js';

/**
 * Handoff summary
 */
export interface HandoffSummary {
  specialistId: string;
  role: string;
  whatIDid: string;
  whatIFound: string;
  whatYouNeedToKnow: string;
  keyInsights: string[];
  tokensUsed: number;
  duration: number;
}

/**
 * Handoff package for next specialist
 */
export interface HandoffPackage {
  previousSummary: HandoffSummary;
  relevantContext: string;
  suggestedFocus: string[];
  avoidRedundancy: string[];
}

/**
 * Summarization options
 */
export interface SummarizationOptions {
  maxLength?: number;
  includeKeyInsights?: boolean;
  includeSuggestions?: boolean;
  verbose?: boolean;
}

/**
 * Ralph Wiggum Summarizer
 *
 * "What I did, what I found, what you need to know"
 * Efficient handoff summaries for context management.
 */
export class RalphWiggumSummarizer {
  /**
   * Summarize specialist work for handoff
   *
   * @param result - Specialist result
   * @param options - Summarization options
   * @returns Handoff summary
   */
  async summarizeSpecialistWork(
    result: SpecialistResult,
    options: SummarizationOptions = {}
  ): Promise<string> {
    const summary = await this.createHandoffSummary(result, options);

    // Format as readable text
    return this.formatHandoffSummary(summary);
  }

  /**
   * Create structured handoff summary
   *
   * @param result - Specialist result
   * @param options - Summarization options
   * @returns Handoff summary
   */
  async createHandoffSummary(
    result: SpecialistResult,
    options: SummarizationOptions = {}
  ): Promise<HandoffSummary> {
    const content = result.content;
    const maxLength = options.maxLength ?? 500;

    // Extract key information
    const whatIDid = this.extractWhatIDid(result.role, content);
    const whatIFound = this.extractWhatIFound(content, maxLength);
    const whatYouNeedToKnow = this.extractWhatYouNeedToKnow(result.role, content, maxLength);
    const keyInsights = this.extractKeyInsights(content);

    return {
      specialistId: result.specialistId,
      role: result.role,
      whatIDid,
      whatIFound,
      whatYouNeedToKnow,
      keyInsights,
      tokensUsed: result.tokensUsed,
      duration: result.duration,
    };
  }

  /**
   * Create handoff package for next specialist
   *
   * @param summary - Handoff summary
   * @param fullContext - Full context from parent
   * @returns Handoff package
   */
  async createHandoff(
    summary: HandoffSummary,
    fullContext: FullContext
  ): Promise<HandoffPackage> {
    // Extract relevant context based on role
    const relevantContext = this.extractRelevantContext(summary.role, fullContext);

    // Generate suggestions for next specialist
    const suggestedFocus = this.generateSuggestedFocus(summary);
    const avoidRedundancy = this.generateAvoidRedundancy(summary);

    return {
      previousSummary: summary,
      relevantContext,
      suggestedFocus,
      avoidRedundancy,
    };
  }

  /**
   * Extract what the specialist did
   */
  private extractWhatIDid(role: string, content: string): string {
    // Extract first paragraph or section
    const firstParagraph = content.split('\n\n')[0]?.trim() || '';

    if (firstParagraph.length > 0) {
      return firstParagraph.substring(0, 300) +
        (firstParagraph.length > 300 ? '...' : '');
    }

    return `Completed ${role} tasks`;
  }

  /**
   * Extract what the specialist found
   */
  private extractWhatIFound(content: string, maxLength: number): string {
    // Look for findings/results sections
    const patterns = [
      /## Findings?\n\n(.+?)(?=\n##|$)/s,
      /## Results?\n\n(.+?)(?=\n##|$)/s,
      /## Key Points\n\n(.+?)(?=\n##|$)/s,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const text = match[1].trim();
        return text.substring(0, maxLength) +
          (text.length > maxLength ? '...' : '');
      }
    }

    // Fallback: extract middle section
    const paragraphs = content.split('\n\n').filter(p => p.trim().length > 0);
    if (paragraphs.length > 1) {
      const middle = paragraphs[Math.floor(paragraphs.length / 2)];
      return middle.substring(0, maxLength) +
        (middle.length > maxLength ? '...' : '');
    }

    return content.substring(0, maxLength) +
      (content.length > maxLength ? '...' : '');
  }

  /**
   * Extract what the next specialist needs to know
   */
  private extractWhatYouNeedToKnow(role: string, content: string, maxLength: number): string {
    // Look for conclusions/next steps sections
    const patterns = [
      /## Conclusions?\n\n(.+?)(?=\n##|$)/s,
      /## Next Steps?\n\n(.+?)(?=\n##|$)/s,
      /## Recommendations?\n\n(.+?)(?=\n##|$)/s,
      /## Summary\n\n(.+?)(?=\n##|$)/s,
    ];

    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match && match[1]) {
        const text = match[1].trim();
        return text.substring(0, maxLength) +
          (text.length > maxLength ? '...' : '');
      }
    }

    // Role-specific defaults
    const roleDefaults: Record<string, string> = {
      researcher: 'Review research findings and identify key themes for further exploration',
      coder: 'Review implemented code and proceed with next development phase',
      architect: 'Review architecture design and validate technical decisions',
      'world-builder': 'Review world elements and ensure consistency with established lore',
      analyst: 'Review analysis and consider implications for recommendations',
      critic: 'Review critique findings and address identified issues',
      synthesizer: 'Review synthesized content and prepare final integration',
    };

    return roleDefaults[role] || 'Review previous work and continue from established foundation';
  }

  /**
   * Extract key insights from content
   */
  private extractKeyInsights(content: string): string[] {
    const insights: string[] = [];

    // Look for bullet points, numbered lists, or key phrases
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Bullet points
      if (trimmed.match(/^[-*•]\s+/)) {
        const insight = trimmed.replace(/^[-*•]\s+/, '').trim();
        if (insight.length > 20 && insight.length < 200) {
          insights.push(insight);
        }
      }

      // Numbered points
      if (trimmed.match(/^\d+\.\s+/)) {
        const insight = trimmed.replace(/^\d+\.\s+/, '').trim();
        if (insight.length > 20 && insight.length < 200) {
          insights.push(insight);
        }
      }

      // Key phrases
      if (trimmed.match(/^(Key|Important|Note):/i)) {
        insights.push(trimmed);
      }

      // Limit insights
      if (insights.length >= 5) {
        break;
      }
    }

    return insights;
  }

  /**
   * Extract relevant context based on role
   */
  private extractRelevantContext(_role: string, fullContext: FullContext): string {
    // Get recent messages
    const recent = fullContext.messages.slice(-10);

    // Filter by relevance to role
    const relevant = recent.filter(m => {
      const content = m.content.toLowerCase();
      return content.length > 50; // Skip very short messages
    });

    return relevant
      .map(m => `${m.role.toUpperCase()}: ${m.content.substring(0, 200)}...`)
      .join('\n\n');
  }

  /**
   * Generate suggested focus areas for next specialist
   */
  private generateSuggestedFocus(summary: HandoffSummary): string[] {
    const focus: string[] = [];

    // Based on role
    switch (summary.role) {
      case 'researcher':
        focus.push('Validate research findings', 'Identify gaps in knowledge');
        break;
      case 'coder':
        focus.push('Review code quality', 'Test implementation');
        break;
      case 'architect':
        focus.push('Validate architecture decisions', 'Consider scalability');
        break;
      case 'world-builder':
        focus.push('Maintain world consistency', 'Expand on established elements');
        break;
      default:
        focus.push('Build upon previous work', 'Ensure coherence');
    }

    // Based on key insights
    if (summary.keyInsights.length > 0) {
      focus.push('Address key insights from previous work');
    }

    return focus;
  }

  /**
   * Generate redundancy avoidance suggestions
   */
  private generateAvoidRedundancy(summary: HandoffSummary): string[] {
    const avoid: string[] = [];

    avoid.push(`Do not repeat: ${summary.whatIDid.substring(0, 100)}...`);
    avoid.push('Build upon existing findings instead of reiterating');

    if (summary.keyInsights.length > 0) {
      avoid.push('Do not duplicate already identified insights');
    }

    return avoid;
  }

  /**
   * Format handoff summary as text
   */
  private formatHandoffSummary(summary: HandoffSummary): string {
    const lines: string[] = [];

    lines.push(`## Handoff from ${summary.role}`);
    lines.push('');
    lines.push('### What I Did');
    lines.push(summary.whatIDid);
    lines.push('');
    lines.push('### What I Found');
    lines.push(summary.whatIFound);
    lines.push('');

    if (summary.keyInsights.length > 0) {
      lines.push('### Key Insights');
      summary.keyInsights.forEach(insight => {
        lines.push(`- ${insight}`);
      });
      lines.push('');
    }

    lines.push('### What You Need to Know');
    lines.push(summary.whatYouNeedToKnow);
    lines.push('');
    lines.push(`*Tokens: ${summary.tokensUsed.toLocaleString()}, Duration: ${summary.duration / 1000}s*`);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Create comprehensive summary of all specialists
   *
   * @param results - All specialist results
   * @returns Comprehensive summary
   */
  async createComprehensiveSummary(results: SpecialistResult[]): Promise<string> {
    const lines: string[] = [];

    lines.push('# Comprehensive Spread Summary');
    lines.push('');

    // Overall statistics
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const successCount = results.filter(r => r.status === 'success').length;

    lines.push('## Overview');
    lines.push(`- Total specialists: ${results.length}`);
    lines.push(`- Successful: ${successCount}`);
    lines.push(`- Total tokens: ${totalTokens.toLocaleString()}`);
    lines.push(`- Total duration: ${(totalDuration / 1000).toFixed(1)}s`);
    lines.push('');

    // Individual summaries
    lines.push('## Individual Specialist Results');
    lines.push('');

    for (const result of results) {
      lines.push(`### ${result.role}`);
      lines.push(`**Status:** ${result.status}`);
      lines.push(`**Tokens:** ${result.tokensUsed.toLocaleString()}`);
      lines.push(`**Duration:** ${(result.duration / 1000).toFixed(1)}s`);
      lines.push('');
      lines.push(result.summary);
      lines.push('');
    }

    // Collective insights
    lines.push('## Collective Insights');
    lines.push('');

    const allInsights = results
      .filter(r => r.status === 'success')
      .flatMap(r => this.extractKeyInsights(r.content));

    if (allInsights.length > 0) {
      allInsights.slice(0, 10).forEach(insight => {
        lines.push(`- ${insight}`);
      });
      lines.push('');
    }

    return lines.join('\n');
  }
}
