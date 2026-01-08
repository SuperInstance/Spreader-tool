/**
 * Markdown formatting utilities
 * @module output/formatter
 */

import type {
  SpecialistResult,
  SpecialistConfig,
  FullContext,
  MarkdownFormatOptions,
} from '../types/index.js';

/**
 * Default format options
 */
export const DEFAULT_FORMAT_OPTIONS: MarkdownFormatOptions = {
  includeTimestamps: true,
  includeMetadata: true,
  includeContext: true,
  includeSummary: true,
  pretty: true,
};

/**
 * Format a timestamp for display
 *
 * @param date - Date to format
 * @returns Formatted timestamp string
 */
export function formatTimestamp(date: Date): string {
  return date.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

/**
 * Format duration in human-readable form
 *
 * @param milliseconds - Duration in milliseconds
 * @returns Formatted duration string
 */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

/**
 * Format token count with thousands separator
 *
 * @param tokens - Number of tokens
 * @returns Formatted token string
 */
export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Create a markdown header with appropriate level
 *
 * @param text - Header text
 * @param level - Header level (1-6)
 * @returns Markdown header string
 */
export function header(text: string, level: number = 1): string {
  const hashes = '#'.repeat(Math.max(1, Math.min(6, level)));
  return `${hashes} ${text}\n`;
}

/**
 * Create a bold markdown string
 *
 * @param text - Text to make bold
 * @returns Bold markdown string
 */
export function bold(text: string): string {
  return `**${text}**`;
}

/**
 * Create an italic markdown string
 *
 * @param text - Text to italicize
 * @returns Italic markdown string
 */
export function italic(text: string): string {
  return `*${text}*`;
}

/**
 * Create a code block with syntax highlighting
 *
 * @param code - Code content
 * @param language - Language for syntax highlighting
 * @returns Markdown code block
 */
export function codeBlock(code: string, language: string = ''): string {
  return `\`\`\`${language}\n${code}\n\`\`\`\n`;
}

/**
 * Create a horizontal rule
 *
 * @returns Markdown horizontal rule
 */
export function hr(): string {
  return '---\n';
}

/**
 * Create a bulleted list item
 *
 * @param text - List item text
 * @param level - Nesting level (default: 0)
 * @returns Markdown list item
 */
export function bullet(text: string, level: number = 0): string {
  const indent = '  '.repeat(level);
  return `${indent}- ${text}\n`;
}

/**
 * Create a numbered list item
 *
 * @param text - List item text
 * @param number - Item number
 * @param level - Nesting level (default: 0)
 * @returns Markdown numbered list item
 */
export function numbered(text: string, number: number, level: number = 0): string {
  const indent = '  '.repeat(level);
  return `${indent}${number}. ${text}\n`;
}

/**
 * Create a markdown link
 *
 * @param text - Link text
 * @param url - Link URL
 * @returns Markdown link
 */
export function link(text: string, url: string): string {
  return `[${text}](${url})`;
}

/**
 * Create a blockquote
 *
 * @param text - Quote text
 * @returns Markdown blockquote
 */
export function blockquote(text: string): string {
  return `> ${text}\n`;
}

/**
 * Create a key-value pair line
 *
 * @param key - Key label
 * @param value - Value
 * @returns Markdown key-value line
 */
export function keyValue(key: string, value: string): string {
  return `**${key}:** ${value}\n`;
}

/**
 * Format metadata section for specialist output
 *
 * @param specialist - Specialist configuration
 * @param result - Specialist execution result
 * @param options - Format options
 * @returns Formatted metadata section
 */
export function formatSpecialistMetadata(
  specialist: SpecialistConfig,
  result: SpecialistResult,
  options: MarkdownFormatOptions
): string {
  let output = '';

  if (!options.includeMetadata) {
    return output;
  }

  output += keyValue('Role', specialist.role);
  output += keyValue('Provider', specialist.provider);
  output += keyValue('Model', specialist.model || 'default');

  if (options.includeTimestamps) {
    output += keyValue('Timestamp', formatTimestamp(result.timestamp));
    output += keyValue('Duration', formatDuration(result.duration));
  }

  output += keyValue('Tokens Used', formatTokens(result.tokensUsed));
  output += keyValue('Status', result.status === 'success' ? '✅ Success' : `❌ ${result.status}`);

  if (result.error) {
    output += keyValue('Error', result.error);
  }

  output += '\n';
  return output;
}

/**
 * Format context section for specialist output
 *
 * @param context - Full conversation context
 * @param options - Format options
 * @returns Formatted context section
 */
export function formatContextSection(
  context: FullContext,
  options: MarkdownFormatOptions
): string {
  if (!options.includeContext) {
    return '';
  }

  let output = header('Context from Parent', 3);

  // Add metadata about context
  output += keyValue('Messages', String(context.metadata.messageCount));
  output += keyValue('Total Tokens', formatTokens(context.metadata.totalTokens));
  output += keyValue('Created', formatTimestamp(context.metadata.createdAt));
  output += '\n';

  // Add message summary
  output += '### Message Summary\n\n';

  for (const message of context.messages) {
    const roleLabel =
      message.role === 'user' ? '👤 User' :
      message.role === 'assistant' ? '🤖 Assistant' :
      '⚙️ System';

    const contentPreview =
      message.content.length > 200
        ? message.content.slice(0, 200) + '...'
        : message.content;

    output += bullet(`${roleLabel}: ${contentPreview}`);
  }

  output += '\n';
  return output;
}

/**
 * Format handoff summary section
 *
 * @param result - Specialist result with summary
 * @returns Formatted handoff summary
 */
export function formatHandoffSummary(result: SpecialistResult): string {
  let output = header('Handoff Summary', 3);

  // Parse summary into sections (if it follows the standard format)
  const summaryLines = result.summary.split('\n').filter(line => line.trim());

  for (const line of summaryLines) {
    output += `${line}\n`;
  }

  output += '\n';
  return output;
}

/**
 * Format specialist result as complete markdown document
 *
 * @param specialist - Specialist configuration
 * @param result - Specialist execution result
 * @param context - Full conversation context
 * @param previousSummary - Summary from previous specialist
 * @param options - Format options
 * @returns Complete markdown document
 */
export function formatSpecialistMarkdown(
  specialist: SpecialistConfig,
  result: SpecialistResult,
  context: FullContext,
  previousSummary?: string,
  options: MarkdownFormatOptions = DEFAULT_FORMAT_OPTIONS
): string {
  let output = '';

  // Title
  output += header(`Specialist: ${specialist.role}`, 1);
  output += '\n';

  // Metadata section
  output += formatSpecialistMetadata(specialist, result, options);

  // Task section
  output += header('Task', 2);
  output += result.summary.match(/\*\*What I Did:\*\*/s)
    ? result.summary.split('**What I Found:**')[0].replace('**What I Did:**', '').trim()
    : 'Specialist task execution';
  output += '\n\n';

  // Context section
  output += formatContextSection(context, options);

  // Previous work summary
  if (previousSummary && options.includeSummary) {
    output += header('Summary of Previous Work', 2);
    output += previousSummary;
    output += '\n';
  }

  // Main content
  output += header('My Work', 2);
  output += '\n';
  output += result.content;
  output += '\n\n';

  // Handoff summary
  if (options.includeSummary) {
    output += formatHandoffSummary(result);
  }

  return output;
}

/**
 * Format status badge
 *
 * @param status - Status string
 * @returns Formatted status badge
 */
export function statusBadge(status: string): string {
  const emoji =
    status === 'success' || status === 'completed' ? '✅' :
    status === 'failed' || status === 'error' ? '❌' :
    status === 'running' ? '🔄' :
    status === 'pending' ? '⏳' :
    status === 'cancelled' ? '🛑' :
    '❓';

  return `${emoji} ${status}`;
}

/**
 * Truncate text to specified length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) {
    return text;
  }
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Escape markdown special characters
 *
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|])/g, '\\$1');
}
