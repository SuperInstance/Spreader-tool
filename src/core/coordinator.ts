/**
 * Specialist Coordinator - Parallel execution coordination
 *
 * Manages parallel execution of multiple specialists with progress tracking.
 *
 * @module core/coordinator
 */

import type {
  SpecialistConfig,
  SpecialistResult,
  FullContext,
  SpreadStatus,
} from '../types/index.js';
import { Specialist } from './specialist.js';
import type { LLMProvider } from '../providers/provider.js';
import { ProviderRegistry } from '../providers/registry.js';

/**
 * Coordination options
 */
export interface CoordinationOptions {
  verbose?: boolean;
  maxParallel?: number;
  onProgress?: (update: CoordinationUpdate) => void;
}

/**
 * Coordination update
 */
export interface CoordinationUpdate {
  specialistId: string;
  status: 'started' | 'progress' | 'completed' | 'failed';
  message?: string;
  timestamp: Date;
}

/**
 * Active specialist tracking
 */
interface ActiveSpecialist {
  specialist: Specialist;
  startTime: number;
  status: 'running' | 'completed' | 'failed';
}

/**
 * Specialist Coordinator
 *
 * Coordinates parallel execution of multiple specialists.
 */
export class SpecialistCoordinator {
  private registry: ProviderRegistry;
  private options: Required<CoordinationOptions>;
  private activeSpecialists: Map<string, ActiveSpecialist>;

  constructor(options: CoordinationOptions = {}) {
    this.registry = new ProviderRegistry();
    this.options = {
      verbose: options.verbose ?? false,
      maxParallel: options.maxParallel ?? 10,
      onProgress: options.onProgress ?? (() => {}),
    };
    this.activeSpecialists = new Map();
  }

  /**
   * Execute single specialist
   *
   * @param config - Specialist configuration
   * @param request - Main request/task
   * @param context - Full context
   * @param previousSummary - Previous specialist summary
   * @param verbose - Enable verbose logging
   * @returns Specialist result
   */
  async executeSpecialist(
    config: SpecialistConfig,
    request: string,
    context: FullContext,
    previousSummary?: string,
    verbose?: boolean
  ): Promise<SpecialistResult> {
    // Get provider for specialist
    const provider = this.registry.get(config.provider);
    if (!provider) {
      throw new Error(`Provider not found: ${config.provider}`);
    }

    // Create specialist instance
    const specialist = new Specialist(config, provider);

    // Track as active
    this.activeSpecialists.set(config.id, {
      specialist,
      startTime: Date.now(),
      status: 'running',
    });

    this.emitUpdate(config.id, 'started', `Starting ${config.role} specialist`);

    try {
      // Execute specialist
      const result = await specialist.execute(request, context, previousSummary, {
        verbose: verbose ?? this.options.verbose,
      });

      // Update tracking
      const active = this.activeSpecialists.get(config.id);
      if (active) {
        active.status = result.status === 'success' ? 'completed' : 'failed';
      }

      this.emitUpdate(
        config.id,
        result.status === 'success' ? 'completed' : 'failed',
        result.status === 'success'
          ? `Completed ${config.role}: ${result.summary.substring(0, 100)}`
          : `Failed ${config.role}: ${result.error}`
      );

      return result;
    } catch (error) {
      // Update tracking on error
      const active = this.activeSpecialists.get(config.id);
      if (active) {
        active.status = 'failed';
      }

      this.emitUpdate(
        config.id,
        'failed',
        `Error in ${config.role}: ${error instanceof Error ? error.message : 'Unknown error'}`
      );

      throw error;
    } finally {
      // Remove from active tracking
      this.activeSpecialists.delete(config.id);
    }
  }

  /**
   * Execute multiple specialists in parallel
   *
   * @param configs - Specialist configurations
   * @param request - Main request/task
   * @param contexts - Context for each specialist
   * @param verbose - Enable verbose logging
   * @returns Array of specialist results
   */
  async executeSpecialistsParallel(
    configs: SpecialistConfig[],
    request: string,
    contexts: Map<string, FullContext>,
    verbose?: boolean
  ): Promise<SpecialistResult[]> {
    const maxParallel = this.options.maxParallel;
    const results: SpecialistResult[] = [];

    // Execute in batches
    for (let i = 0; i < configs.length; i += maxParallel) {
      const batch = configs.slice(i, i + maxParallel);

      const batchResults = await Promise.allSettled(
        batch.map((config) => {
          const context = contexts.get(config.id);
          if (!context) {
            throw new Error(`Context not found for specialist: ${config.id}`);
          }

          return this.executeSpecialist(config, request, context, undefined, verbose);
        })
      );

      // Process results
      for (const result of batchResults) {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          // Create error result
          results.push({
            specialistId: 'unknown',
            role: 'custom',
            content: '',
            summary: 'Execution failed',
            tokensUsed: 0,
            duration: 0,
            timestamp: new Date(),
            status: 'error',
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error',
          });
        }
      }
    }

    return results;
  }

  /**
   * Execute specialists sequentially with handoff
   *
   * @param configs - Specialist configurations
   * @param request - Main request/task
   * @param contexts - Context for each specialist
   * @param verbose - Enable verbose logging
   * @returns Array of specialist results
   */
  async executeSpecialistsSequential(
    configs: SpecialistConfig[],
    request: string,
    contexts: Map<string, FullContext>,
    verbose?: boolean
  ): Promise<SpecialistResult[]> {
    const results: SpecialistResult[] = [];
    let previousSummary: string | undefined;

    for (const config of configs) {
      const context = contexts.get(config.id);
      if (!context) {
        throw new Error(`Context not found for specialist: ${config.id}`);
      }

      const result = await this.executeSpecialist(
        config,
        request,
        context,
        previousSummary,
        verbose
      );

      results.push(result);

      // Extract summary for next specialist
      if (result.status === 'success') {
        previousSummary = this.formatHandoffSummary(result);
      }
    }

    return results;
  }

  /**
   * Format handoff summary for next specialist
   */
  private formatHandoffSummary(result: SpecialistResult): string {
    return `Previous Specialist (${result.role}) Summary:\n${result.summary}\n\nTheir work is complete. You can reference their findings as needed.`;
  }

  /**
   * Get active specialists count
   */
  getActiveCount(): number {
    return this.activeSpecialists.size;
  }

  /**
   * Get all active specialist IDs
   */
  getActiveSpecialistIds(): string[] {
    return Array.from(this.activeSpecialists.keys());
  }

  /**
   * Cancel all active specialists for a spread
   *
   * @param spreadId - Spread identifier
   */
  async cancelAll(_spreadId: string): Promise<void> {
    const activeIds = Array.from(this.activeSpecialists.keys());

    if (this.options.verbose) {
      console.log(`Cancelling ${activeIds.length} active specialists`);
    }

    // Clear active specialists
    this.activeSpecialists.clear();
  }

  /**
   * Get status of spread
   *
   * @param _spreadId - Spread identifier
   * @returns Status or null if not found
   */
  getStatus(_spreadId: string): SpreadStatus | null {
    if (this.activeSpecialists.size > 0) {
      return 'running';
    }
    return null;
  }

  /**
   * Register provider
   *
   * @param provider - LLM provider
   */
  registerProvider(provider: LLMProvider): void {
    this.registry.register(provider);
  }

  /**
   * Get provider registry
   */
  getRegistry(): ProviderRegistry {
    return this.registry;
  }

  /**
   * Emit progress update
   */
  private emitUpdate(
    specialistId: string,
    status: CoordinationUpdate['status'],
    message?: string
  ): void {
    const update: CoordinationUpdate = {
      specialistId,
      status,
      message,
      timestamp: new Date(),
    };

    this.options.onProgress(update);

    if (this.options.verbose) {
      console.log(`[${update.timestamp.toISOString()}] ${specialistId}: ${status}${message ? ` - ${message}` : ''}`);
    }
  }
}
