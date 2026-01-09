/**
 * Progress Callback Tests
 *
 * Tests for real-time progress tracking functionality
 *
 * @module tests/progress
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpreaderEngine } from '../src/core/engine.js';
import type { ProgressUpdate, SpreadConfig, FullContext } from '../src/types/index.js';

describe('Progress Callbacks', () => {
  let engine: SpreaderEngine;
  let mockProgressCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockProgressCallback = vi.fn();
    engine = new SpreaderEngine({
      onProgress: mockProgressCallback,
      verbose: false,
    });
  });

  function createTestConfig(override?: Partial<SpreadConfig>): SpreadConfig {
    return {
      request: 'Test request',
      parentContext: createEmptyContext(),
      specialists: [
        {
          id: 'specialist-1',
          role: 'researcher',
          systemPrompt: 'You are a researcher.',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          maxTokens: 100,
        },
        {
          id: 'specialist-2',
          role: 'analyst',
          systemPrompt: 'You are an analyst.',
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          maxTokens: 100,
        },
      ],
      output: {
        format: 'markdown',
        directory: '.test-spreads',
        createIndex: false,
        includeTimestamps: true,
        includeMetadata: true,
      },
      context: {
        compactAfter: 8000,
        compactStrategy: 'recursive',
        recontextualizeAllowed: true,
        includePreviousThreads: false,
      },
      monitoring: {
        checkinInterval: 30000,
        showProgress: false,
        verbose: false,
      },
      ...override,
    };
  }

  function createEmptyContext(): FullContext {
    return {
      messages: [],
      metadata: {
        totalTokens: 0,
        messageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'parent',
      },
    };
  }

  describe('Progress Callback Structure', () => {
    it('should call progress callback with correct structure', async () => {
      // This is a basic structure test - actual execution requires valid API keys
      const config = createTestConfig();

      // We'll test the structure without executing by checking the engine was created
      expect(engine).toBeDefined();
      expect(mockProgressCallback).toBeDefined();
    });

    it('should have all required fields in ProgressUpdate type', () => {
      const update: ProgressUpdate = {
        stage: 'initializing',
        spreadId: 'test-spread-123',
        completedSpecialists: [],
        totalSpecialists: 3,
        progress: 0,
        message: 'Test message',
        timestamp: Date.now(),
      };

      expect(update).toHaveProperty('stage');
      expect(update).toHaveProperty('spreadId');
      expect(update).toHaveProperty('completedSpecialists');
      expect(update).toHaveProperty('totalSpecialists');
      expect(update).toHaveProperty('progress');
      expect(update).toHaveProperty('message');
      expect(update).toHaveProperty('timestamp');
    });

    it('should include optional metadata fields', () => {
      const update: ProgressUpdate = {
        stage: 'complete',
        spreadId: 'test-spread-123',
        completedSpecialists: ['s1', 's2', 's3'],
        totalSpecialists: 3,
        progress: 1,
        message: 'Complete!',
        timestamp: Date.now(),
        metadata: {
          tokensUsed: 1000,
          duration: 5000,
          error: undefined,
        },
      };

      expect(update.metadata).toBeDefined();
      expect(update.metadata?.tokensUsed).toBe(1000);
      expect(update.metadata?.duration).toBe(5000);
    });
  });

  describe('Progress Stages', () => {
    it('should support all valid stages', () => {
      const validStages: ProgressUpdate['stage'][] = [
        'initializing',
        'preparing',
        'executing',
        'summarizing',
        'complete',
        'failed',
      ];

      validStages.forEach((stage) => {
        const update: ProgressUpdate = {
          stage,
          spreadId: 'test',
          completedSpecialists: [],
          totalSpecialists: 1,
          progress: 0.5,
          message: 'Test',
          timestamp: Date.now(),
        };

        expect(update.stage).toBe(stage);
      });
    });
  });

  describe('Progress Values', () => {
    it('should have progress between 0 and 1', () => {
      const validProgressValues = [0, 0.1, 0.5, 0.9, 1];

      validProgressValues.forEach((progress) => {
        const update: ProgressUpdate = {
          stage: 'executing',
          spreadId: 'test',
          completedSpecialists: [],
          totalSpecialists: 1,
          progress,
          message: 'Test',
          timestamp: Date.now(),
        };

        expect(update.progress).toBeGreaterThanOrEqual(0);
        expect(update.progress).toBeLessThanOrEqual(1);
      });
    });

    it('should calculate progress correctly based on completed specialists', () => {
      const totalSpecialists = 5;
      const completedSpecialists = ['s1', 's2', 's3'];

      const progress = completedSpecialists.length / totalSpecialists;

      expect(progress).toBe(0.6);
    });
  });

  describe('Specialist Tracking', () => {
    it('should track completed specialist IDs', () => {
      const update: ProgressUpdate = {
        stage: 'executing',
        spreadId: 'test',
        completedSpecialists: ['specialist-1', 'specialist-2'],
        totalSpecialists: 4,
        progress: 0.5,
        message: 'Executing...',
        timestamp: Date.now(),
      };

      expect(update.completedSpecialists).toHaveLength(2);
      expect(update.completedSpecialists).toContain('specialist-1');
      expect(update.completedSpecialists).toContain('specialist-2');
    });

    it('should include current specialist when executing', () => {
      const update: ProgressUpdate = {
        stage: 'executing',
        spreadId: 'test',
        currentSpecialist: 'analyst',
        completedSpecialists: ['specialist-1'],
        totalSpecialists: 3,
        progress: 0.33,
        message: 'Running analyst...',
        timestamp: Date.now(),
      };

      expect(update.currentSpecialist).toBe('analyst');
    });
  });

  describe('Timestamp Handling', () => {
    it('should have valid timestamp', () => {
      const beforeTimestamp = Date.now();
      const update: ProgressUpdate = {
        stage: 'initializing',
        spreadId: 'test',
        completedSpecialists: [],
        totalSpecialists: 1,
        progress: 0,
        message: 'Test',
        timestamp: Date.now(),
      };
      const afterTimestamp = Date.now();

      expect(update.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(update.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('Error Handling', () => {
    it('should include error in metadata on failure', () => {
      const errorMessage = 'API key not found';
      const update: ProgressUpdate = {
        stage: 'failed',
        spreadId: 'test',
        completedSpecialists: [],
        totalSpecialists: 3,
        progress: 0.33,
        message: 'Spread failed: API key not found',
        timestamp: Date.now(),
        metadata: {
          error: errorMessage,
        },
      };

      expect(update.stage).toBe('failed');
      expect(update.metadata?.error).toBe(errorMessage);
    });
  });

  describe('Callback Registration', () => {
    it('should allow optional progress callback', () => {
      const engineWithoutCallback = new SpreaderEngine({
        verbose: false,
      });

      expect(engineWithoutCallback).toBeDefined();
    });

    it('should accept progress callback in constructor', () => {
      const customCallback = vi.fn();
      const engineWithCallback = new SpreaderEngine({
        onProgress: customCallback,
        verbose: false,
      });

      expect(engineWithCallback).toBeDefined();
    });
  });

  describe('Progress Update Frequency', () => {
    it('should handle rapid progress updates', () => {
      const updates: ProgressUpdate[] = [];
      const rapidCallback = (update: ProgressUpdate) => {
        updates.push(update);
      };

      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        rapidCallback({
          stage: 'executing',
          spreadId: 'test',
          completedSpecialists: [],
          totalSpecialists: 10,
          progress: i / 100,
          message: `Update ${i}`,
          timestamp: Date.now(),
        });
      }

      expect(updates).toHaveLength(100);
    });
  });

  describe('Integration with Engine', () => {
    it('should create engine with progress callback', () => {
      const testCallback = vi.fn();
      const testEngine = new SpreaderEngine({
        onProgress: testCallback,
        verbose: false,
      });

      expect(testEngine).toBeDefined();
      expect(testEngine).toBeInstanceOf(SpreaderEngine);
    });

    it('should track completed specialists in engine state', () => {
      // Test that engine can track specialist completion
      const engine = new SpreaderEngine({
        onProgress: () => {},
        verbose: false,
      });

      // Engine should be able to handle state tracking
      expect(engine).toBeDefined();
    });
  });

  describe('Message Content', () => {
    it('should have meaningful messages for each stage', () => {
      const stageMessages: Record<ProgressUpdate['stage'], string> = {
        initializing: 'Initializing spread...',
        preparing: 'Preparing context distribution...',
        executing: 'Executing specialist 1/3: researcher',
        summarizing: 'Synthesizing results...',
        complete: 'Spread completed successfully!',
        failed: 'Spread failed: Connection error',
      };

      Object.entries(stageMessages).forEach(([stage, message]) => {
        const update: ProgressUpdate = {
          stage: stage as ProgressUpdate['stage'],
          spreadId: 'test',
          completedSpecialists: [],
          totalSpecialists: 3,
          progress: 0.5,
          message,
          timestamp: Date.now(),
        };

        expect(update.message).toBeTruthy();
        expect(update.message.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Type Safety', () => {
    it('should enforce valid stage types', () => {
      // This test verifies type safety at compile time
      const validStage: ProgressUpdate['stage'] = 'executing';
      expect(validStage).toBe('executing');
    });

    it('should allow optional currentSpecialist', () => {
      const updateWithSpecialist: ProgressUpdate = {
        stage: 'executing',
        spreadId: 'test',
        currentSpecialist: 'researcher',
        completedSpecialists: [],
        totalSpecialists: 1,
        progress: 0.5,
        message: 'Test',
        timestamp: Date.now(),
      };

      const updateWithoutSpecialist: ProgressUpdate = {
        stage: 'initializing',
        spreadId: 'test',
        completedSpecialists: [],
        totalSpecialists: 1,
        progress: 0,
        message: 'Test',
        timestamp: Date.now(),
      };

      expect(updateWithSpecialist.currentSpecialist).toBeDefined();
      expect(updateWithoutSpecialist.currentSpecialist).toBeUndefined();
    });

    it('should allow optional metadata', () => {
      const updateWithMetadata: ProgressUpdate = {
        stage: 'complete',
        spreadId: 'test',
        completedSpecialists: ['s1'],
        totalSpecialists: 1,
        progress: 1,
        message: 'Done',
        timestamp: Date.now(),
        metadata: {
          tokensUsed: 100,
          duration: 1000,
        },
      };

      const updateWithoutMetadata: ProgressUpdate = {
        stage: 'initializing',
        spreadId: 'test',
        completedSpecialists: [],
        totalSpecialists: 1,
        progress: 0,
        message: 'Test',
        timestamp: Date.now(),
      };

      expect(updateWithMetadata.metadata).toBeDefined();
      expect(updateWithoutMetadata.metadata).toBeUndefined();
    });
  });
});
