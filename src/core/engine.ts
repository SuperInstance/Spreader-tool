/**
 * Spreader Engine - Main orchestration logic
 *
 * Coordinates parallel specialist execution, manages context distribution,
 * and aggregates results into comprehensive output.
 *
 * @module core/engine
 */

import type {
  SpreadConfig,
  SpecialistResult,
  FullContext,
  SpreadMetadata,
  SpreadStatus,
  ProgressUpdate,
  ProgressCallback,
} from '../types/index.js';
import { ContextManager } from './context-manager.js';
import { SpecialistCoordinator } from './coordinator.js';
import { RalphWiggumSummarizer } from './summarizer.js';

/**
 * Spreader Engine Options
 */
export interface EngineOptions {
  /**
   * Maximum parallel specialists
   * @default 10
   */
  maxParallel?: number;

  /**
   * Check-in interval in milliseconds
   * @default 30000 (30 seconds)
   */
  checkinInterval?: number;

  /**
   * Enable verbose logging
   * @default false
   */
  verbose?: boolean;

  /**
   * Progress callback for real-time updates
   */
  onProgress?: ProgressCallback;
}

/**
 * Engine result
 */
export interface EngineResult {
  metadata: SpreadMetadata;
  results: SpecialistResult[];
  summary: string;
  outputDirectory: string;
  duration: number;
}

/**
 * Spreader Engine
 *
 * Main orchestration engine for parallel multi-agent information gathering.
 */
export class SpreaderEngine {
  private contextManager: ContextManager;
  private coordinator: SpecialistCoordinator;
  private summarizer: RalphWiggumSummarizer;
  private options: Required<Omit<EngineOptions, 'onProgress'>> & { onProgress?: ProgressCallback };
  private completedSpecialistIds: string[] = [];

  constructor(options: EngineOptions = {}) {
    this.options = {
      maxParallel: options.maxParallel ?? 10,
      checkinInterval: options.checkinInterval ?? 30000,
      verbose: options.verbose ?? false,
      onProgress: options.onProgress,
    };

    this.contextManager = new ContextManager({
      verbose: this.options.verbose,
    });
    this.coordinator = new SpecialistCoordinator({
      verbose: this.options.verbose,
      maxParallel: this.options.maxParallel,
      onProgress: (update) => this.handleCoordinatorProgress(update),
    });
    this.summarizer = new RalphWiggumSummarizer();
  }

  /**
   * Execute a spread
   *
   * @param config - Spread configuration
   * @returns Engine result with all specialist outputs
   */
  async executeSpread(config: SpreadConfig): Promise<EngineResult> {
    const startTime = Date.now();
    const spreadId = this.generateSpreadId(config);

    // Reset tracking state
    this.completedSpecialistIds = [];

    // Initialize metadata
    const metadata: SpreadMetadata = {
      id: spreadId,
      request: config.request,
      status: 'running',
      createdAt: new Date(),
      startedAt: new Date(),
      specialistCount: config.specialists.length,
      completedCount: 0,
      totalTokens: 0,
      outputDirectory: config.output.directory,
    };

    this.emitProgress({
      stage: 'initializing',
      spreadId,
      completedSpecialists: [],
      totalSpecialists: config.specialists.length,
      progress: 0,
      message: 'Initializing spread...',
      timestamp: Date.now(),
    });

    try {
      // Prepare context for all specialists
      this.emitProgress({
        stage: 'preparing',
        spreadId,
        completedSpecialists: [],
        totalSpecialists: config.specialists.length,
        progress: 0.1,
        message: 'Preparing context distribution...',
        timestamp: Date.now(),
      });

      const contextPackages = await this.prepareContextPackages(config);

      // Execute specialists in parallel
      this.emitProgress({
        stage: 'executing',
        spreadId,
        completedSpecialists: [],
        totalSpecialists: config.specialists.length,
        progress: 0.2,
        message: `Launching ${config.specialists.length} specialists...`,
        timestamp: Date.now(),
      });

      const results = await this.executeSpecialists(
        config,
        contextPackages,
        metadata
      );

      // Generate summary
      this.emitProgress({
        stage: 'summarizing',
        spreadId,
        completedSpecialists: this.completedSpecialistIds,
        totalSpecialists: config.specialists.length,
        progress: 0.9,
        message: 'Synthesizing results...',
        timestamp: Date.now(),
      });

      const summary = await this.synthesizeResults(config, results);

      // Update metadata
      metadata.status = 'completed';
      metadata.completedAt = new Date();
      metadata.completedCount = results.length;
      metadata.totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

      const duration = Date.now() - startTime;

      this.emitProgress({
        stage: 'complete',
        spreadId,
        completedSpecialists: this.completedSpecialistIds,
        totalSpecialists: config.specialists.length,
        progress: 1,
        message: 'Spread completed successfully!',
        timestamp: Date.now(),
        metadata: {
          tokensUsed: metadata.totalTokens,
          duration,
        },
      });

      return {
        metadata,
        results,
        summary,
        outputDirectory: config.output.directory,
        duration,
      };
    } catch (error) {
      metadata.status = 'failed';
      metadata.completedAt = new Date();

      this.emitProgress({
        stage: 'failed',
        spreadId,
        completedSpecialists: this.completedSpecialistIds,
        totalSpecialists: config.specialists.length,
        progress: this.completedSpecialistIds.length / config.specialists.length,
        message: `Spread failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now(),
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Prepare context packages for all specialists
   */
  private async prepareContextPackages(
    config: SpreadConfig
  ): Promise<Map<string, FullContext>> {
    const packages = new Map<string, FullContext>();

    for (const specialist of config.specialists) {
      // Check if context compaction is needed
      const contextSize = this.contextManager.estimateContextSize(config.parentContext);

      let specialistContext: FullContext;
      if (contextSize > config.context.compactAfter) {
        if (this.options.verbose) {
          console.log(`Compacting context for ${specialist.id} (${contextSize} tokens)`);
        }

        specialistContext = await this.contextManager.compactContext(
          config.parentContext,
          {
            maxTokens: config.context.compactAfter * 0.8,
            strategy: config.context.compactStrategy,
          }
        );
      } else {
        specialistContext = config.parentContext;
      }

      packages.set(specialist.id, specialistContext);
    }

    return packages;
  }

  /**
   * Execute specialists with Ralph Wiggum summarization
   */
  private async executeSpecialists(
    config: SpreadConfig,
    contextPackages: Map<string, FullContext>,
    metadata: SpreadMetadata
  ): Promise<SpecialistResult[]> {
    const results: SpecialistResult[] = [];
    let previousSummary: string | undefined;

    for (let i = 0; i < config.specialists.length; i++) {
      const specialist = config.specialists[i];
      const context = contextPackages.get(specialist.id)!;

      this.emitProgress({
        stage: 'executing',
        spreadId: metadata.id,
        currentSpecialist: specialist.role,
        completedSpecialists: this.completedSpecialistIds,
        totalSpecialists: config.specialists.length,
        progress: 0.2 + (i / config.specialists.length) * 0.7,
        message: `Executing specialist ${i + 1}/${config.specialists.length}: ${specialist.role}`,
        timestamp: Date.now(),
      });

      // Execute specialist with context and previous summary
      const result = await this.coordinator.executeSpecialist(
        specialist,
        config.request,
        context,
        previousSummary,
        config.monitoring.verbose
      );

      results.push(result);
      metadata.completedCount++;
      this.completedSpecialistIds.push(specialist.id);

      // Generate summary for next specialist (Ralph Wiggum mode)
      if (i < config.specialists.length - 1) {
        previousSummary = await this.summarizer.summarizeSpecialistWork(result);

        if (this.options.verbose) {
          console.log(`\n--- Handoff Summary from ${specialist.role} ---`);
          console.log(previousSummary);
          console.log('---\n');
        }
      }

      // Emit progress
      this.emitProgress({
        stage: 'executing',
        spreadId: metadata.id,
        currentSpecialist: specialist.role,
        completedSpecialists: this.completedSpecialistIds,
        totalSpecialists: config.specialists.length,
        progress: 0.2 + ((i + 1) / config.specialists.length) * 0.7,
        message: `Completed ${specialist.role}: ${result.summary.substring(0, 100)}...`,
        timestamp: Date.now(),
        metadata: {
          tokensUsed: result.tokensUsed,
          duration: result.duration,
        },
      });
    }

    return results;
  }

  /**
   * Synthesize results from all specialists
   */
  private async synthesizeResults(
    config: SpreadConfig,
    results: SpecialistResult[]
  ): Promise<string> {
    const lines: string[] = [];

    lines.push('# Spread Summary');
    lines.push('');
    lines.push(`**Request:** ${config.request}`);
    lines.push(`**Specialists:** ${results.length}`);
    lines.push(`**Total Tokens:** ${results.reduce((sum, r) => sum + r.tokensUsed, 0).toLocaleString()}`);
    lines.push('');

    lines.push('## Specialist Results');
    lines.push('');

    for (const result of results) {
      lines.push(`### ${result.role}`);
      lines.push('');
      lines.push(`**Status:** ${result.status}`);
      lines.push(`**Tokens:** ${result.tokensUsed.toLocaleString()}`);
      lines.push(`**Duration:** ${result.duration / 1000} seconds`);
      lines.push('');
      lines.push('**Summary:**');
      lines.push(result.summary);
      lines.push('');
    }

    lines.push('## Key Insights');
    lines.push('');
    lines.push('The specialists have completed their work. Review individual outputs for detailed findings.');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Generate unique spread ID
   */
  private generateSpreadId(config: SpreadConfig): string {
    const timestamp = Date.now().toString(36);
    const hash = Math.random().toString(36).substring(2, 8);
    const topic = config.request.substring(0, 20).toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `${topic}-${timestamp}-${hash}`;
  }

  /**
   * Emit progress event
   */
  private emitProgress(update: ProgressUpdate): void {
    if (this.options.onProgress) {
      this.options.onProgress(update);
    }

    if (this.options.verbose) {
      console.log(`[${new Date(update.timestamp).toISOString()}] [${update.stage}] ${update.message}`);
    }
  }

  /**
   * Handle coordinator progress updates
   */
  private handleCoordinatorProgress(update: any): void {
    // Coordinator updates are already handled through executeSpecialists
    // This is a placeholder for more granular tracking if needed
    if (this.options.verbose && update.message) {
      console.log(`  └─ ${update.message}`);
    }
  }

  /**
   * Cancel running spread
   */
  async cancelSpread(spreadId: string): Promise<void> {
    await this.coordinator.cancelAll(spreadId);
  }

  /**
   * Get spread status
   */
  getSpreadStatus(spreadId: string): SpreadStatus | null {
    return this.coordinator.getStatus(spreadId);
  }
}
