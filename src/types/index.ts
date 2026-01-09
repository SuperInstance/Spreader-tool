/**
 * Type definitions for Spreader tool
 * @module types
 */

/**
 * Full context from parent conversation
 */
export interface FullContext {
  messages: ContextMessage[];
  metadata: ContextMetadata;
}

/**
 * Single message in the conversation context
 */
export interface ContextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  tokens?: number;
}

/**
 * Context metadata
 */
export interface ContextMetadata {
  totalTokens: number;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  source: 'parent' | 'compressed' | 'summary';
}

/**
 * Specialist configuration
 */
export interface SpecialistConfig {
  id: string;
  role: SpecialistRole;
  systemPrompt: string;
  provider: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Specialist role types
 */
export type SpecialistRole =
  | 'researcher'
  | 'coder'
  | 'architect'
  | 'world-builder'
  | 'analyst'
  | 'critic'
  | 'synthesizer'
  | 'custom';

/**
 * Specialist execution result
 */
export interface SpecialistResult {
  specialistId: string;
  role: SpecialistRole;
  content: string;
  summary: string;
  tokensUsed: number;
  duration: number;
  timestamp: Date;
  status: 'success' | 'error' | 'cancelled';
  error?: string;
}

/**
 * Spread configuration
 */
export interface SpreadConfig {
  request: string;
  parentContext: FullContext;
  specialists: SpecialistConfig[];
  output: OutputConfig;
  context: ContextConfig;
  monitoring: MonitoringConfig;
}

/**
 * Output configuration
 */
export interface OutputConfig {
  format: 'markdown' | 'json';
  directory: string;
  createIndex: boolean;
  includeTimestamps: boolean;
  includeMetadata: boolean;
}

/**
 * Context management configuration
 */
export interface ContextConfig {
  compactAfter: number;
  compactStrategy: 'recursive' | 'summary' | 'both';
  recontextualizeAllowed: boolean;
  includePreviousThreads: boolean;
}

/**
 * Progress monitoring configuration
 */
export interface MonitoringConfig {
  checkinInterval: number;
  showProgress: boolean;
  verbose: boolean;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string;
  type: 'openai' | 'anthropic' | 'ollama' | 'mcp' | 'custom';
  apiKey?: string;
  baseURL?: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  [key: string]: unknown; // Allow additional provider-specific properties
}

/**
 * Spreader configuration (from config file)
 */
export interface SpreaderConfig {
  $schema?: string;
  providers: Record<string, ProviderConfig>;
  defaults: DefaultConfig;
}

/**
 * Default configuration values
 */
export interface DefaultConfig {
  specialists: SpecialistRole[];
  provider: string;
  outputDirectory: string;
  compactAfter: number;
  checkinInterval: number;
  temperature: number;
  maxTokens: number;
  [key: string]: unknown; // Allow additional properties
}

/**
 * Spread execution status
 */
export type SpreadStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

/**
 * Spread metadata (for tracking)
 */
export interface SpreadMetadata {
  id: string;
  request: string;
  status: SpreadStatus;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  specialistCount: number;
  completedCount: number;
  totalTokens: number;
  outputDirectory: string;
}

/**
 * CLI command options
 */
export interface CommandOptions {
  specialists?: string;
  providers?: string;
  output?: string;
  config?: string;
  verbose?: boolean;
  force?: boolean;
}

/**
 * Format options for markdown output
 */
export interface MarkdownFormatOptions {
  includeTimestamps: boolean;
  includeMetadata: boolean;
  includeContext: boolean;
  includeSummary: boolean;
  pretty: boolean;
}

/**
 * Index file metadata
 */
export interface IndexMetadata {
  title: string;
  date: Date;
  request: string;
  specialistCount: number;
  status: SpreadStatus;
  totalTokens: number;
  duration: number;
}

/**
 * Progress callback function type
 */
export interface ProgressCallback {
  (update: ProgressUpdate): void;
}

/**
 * Progress update information
 */
export interface ProgressUpdate {
  /**
   * Current stage of execution
   */
  stage: 'initializing' | 'preparing' | 'executing' | 'summarizing' | 'complete' | 'failed';

  /**
   * ID of the spread
   */
  spreadId: string;

  /**
   * Current specialist being executed (if any)
   */
  currentSpecialist?: string;

  /**
   * IDs of completed specialists
   */
  completedSpecialists: string[];

  /**
   * Total number of specialists
   */
  totalSpecialists: number;

  /**
   * Progress percentage (0-1)
   */
  progress: number;

  /**
   * Human-readable status message
   */
  message: string;

  /**
   * Timestamp of the update
   */
  timestamp: number;

  /**
   * Additional metadata (optional)
   */
  metadata?: {
    tokensUsed?: number;
    duration?: number;
    error?: string;
  };
}

/**
 * Re-export communication types for convenience
 */
export type {
  AgentMessage,
  MessageHandler,
  CommunicatingAgent,
  MessageBusOptions,
  MessageDeliveryStatus,
  MessageTracking,
  MessageBusMetrics,
  RequestOptions,
  AgentCapabilities,
  MessageFilter,
  MessageSubscription,
  BroadcastOptions,
} from '../communication/index.js';

export { MessageType } from '../communication/index.js';
