/**
 * Progress Callbacks Example
 *
 * This example demonstrates how to use real-time progress callbacks
 * to track execution of multi-agent spreads.
 *
 * @module examples/progress-callbacks
 */

import type { ProgressUpdate } from '../src/types/index.js';
import { SpreaderEngine } from '../src/core/engine.js';
import type { SpreadConfig, FullContext } from '../src/types/index.js';

/**
 * Example 1: Basic progress tracking
 */
async function example1_basicProgressTracking() {
  console.log('\n=== Example 1: Basic Progress Tracking ===\n');

  const engine = new SpreaderEngine({
    onProgress: (update: ProgressUpdate) => {
      const percentage = Math.round(update.progress * 100);
      console.log(`[${percentage}%] ${update.stage}: ${update.message}`);
    },
  });

  const config: SpreadConfig = {
    request: 'What are the latest developments in quantum computing?',
    parentContext: createEmptyContext(),
    specialists: [
      {
        id: 'researcher-1',
        role: 'researcher',
        systemPrompt: 'You are a research specialist.',
        provider: 'openai',
      },
      {
        id: 'analyst-1',
        role: 'analyst',
        systemPrompt: 'You are an analyst specialist.',
        provider: 'openai',
      },
    ],
    output: {
      format: 'markdown',
      directory: '.spreads',
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
      showProgress: true,
      verbose: false,
    },
  };

  try {
    const result = await engine.executeSpread(config);
    console.log('\n✅ Spread completed successfully!');
    console.log(`   Duration: ${(result.duration / 1000).toFixed(1)}s`);
    console.log(`   Tokens: ${result.metadata.totalTokens.toLocaleString()}`);
  } catch (error) {
    console.error('\n❌ Spread failed:', error);
  }
}

/**
 * Example 2: Detailed progress with specialist tracking
 */
async function example2_detailedProgressTracking() {
  console.log('\n=== Example 2: Detailed Progress with Specialist Tracking ===\n');

  const engine = new SpreaderEngine({
    onProgress: (update: ProgressUpdate) => {
      const percentage = Math.round(update.progress * 100);
      const bar = '█'.repeat(Math.floor(percentage / 5)) + '░'.repeat(20 - Math.floor(percentage / 5));

      console.log(`\r[${bar}] ${percentage}%`);

      if (update.currentSpecialist) {
        console.log(`  🤖 Running: ${update.currentSpecialist}`);
      }

      if (update.completedSpecialists.length > 0) {
        console.log(`  ✅ Completed: ${update.completedSpecialists.length}/${update.totalSpecialists}`);
      }

      if (update.stage === 'complete') {
        console.log(`\n  🎉 ${update.message}`);
        if (update.metadata) {
          console.log(`  📊 Tokens: ${update.metadata.tokensUsed?.toLocaleString()}`);
          console.log(`  ⏱️  Duration: ${update.metadata.duration}ms`);
        }
      }
    },
  });

  const config: SpreadConfig = {
    request: 'Analyze the future of renewable energy',
    parentContext: createEmptyContext(),
    specialists: [
      {
        id: 'researcher-2',
        role: 'researcher',
        systemPrompt: 'You are a research specialist.',
        provider: 'openai',
      },
      {
        id: 'analyst-2',
        role: 'analyst',
        systemPrompt: 'You are an analyst specialist.',
        provider: 'openai',
      },
      {
        id: 'synthesizer-1',
        role: 'synthesizer',
        systemPrompt: 'You are a synthesizer specialist.',
        provider: 'openai',
      },
    ],
    output: {
      format: 'markdown',
      directory: '.spreads',
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
      showProgress: true,
      verbose: false,
    },
  };

  try {
    const result = await engine.executeSpread(config);
    console.log('\n✅ All specialists completed!');
  } catch (error) {
    console.error('\n❌ Spread failed:', error);
  }
}

/**
 * Example 3: Progress with timestamps and metrics
 */
async function example3_progressWithMetrics() {
  console.log('\n=== Example 3: Progress with Metrics ===\n');

  const startTime = Date.now();
  const stageDurations: Record<string, number> = {};
  let lastTimestamp = startTime;
  let lastStage: string | undefined;

  const engine = new SpreaderEngine({
    onProgress: (update: ProgressUpdate) => {
      // Track stage durations
      if (lastStage && lastStage !== update.stage) {
        const duration = update.timestamp - lastTimestamp;
        stageDurations[lastStage] = (stageDurations[lastStage] || 0) + duration;
      }

      lastStage = update.stage;
      lastTimestamp = update.timestamp;

      // Display progress
      const elapsed = ((update.timestamp - startTime) / 1000).toFixed(1);
      const percentage = Math.round(update.progress * 100);

      console.log(
        `[${elapsed}s] [${update.stage}] ${percentage}% - ${update.message}`
      );

      // Display specialist info
      if (update.currentSpecialist) {
        console.log(`  └─ Specialist: ${update.currentSpecialist}`);
      }

      // Display metrics when available
      if (update.metadata) {
        if (update.metadata.tokensUsed) {
          console.log(`  └─ Tokens: ${update.metadata.tokensUsed.toLocaleString()}`);
        }
        if (update.metadata.duration) {
          console.log(`  └─ Duration: ${(update.metadata.duration / 1000).toFixed(1)}s`);
        }
      }
    },
  });

  const config: SpreadConfig = {
    request: 'Explore the impact of AI on software development',
    parentContext: createEmptyContext(),
    specialists: [
      {
        id: 'researcher-3',
        role: 'researcher',
        systemPrompt: 'You are a research specialist.',
        provider: 'openai',
      },
      {
        id: 'analyst-3',
        role: 'analyst',
        systemPrompt: 'You are an analyst specialist.',
        provider: 'openai',
      },
    ],
    output: {
      format: 'markdown',
      directory: '.spreads',
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
      showProgress: true,
      verbose: false,
    },
  };

  try {
    const result = await engine.executeSpread(config);

    // Print summary
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log('\n📊 Execution Summary:');
    console.log(`   Total Duration: ${totalDuration}s`);
    console.log(`   Stage Breakdown:`);

    for (const [stage, duration] of Object.entries(stageDurations)) {
      console.log(`     - ${stage}: ${(duration / 1000).toFixed(1)}s`);
    }
  } catch (error) {
    console.error('\n❌ Spread failed:', error);
  }
}

/**
 * Example 4: Error handling with progress
 */
async function example4_errorHandling() {
  console.log('\n=== Example 4: Error Handling with Progress ===\n');

  const engine = new SpreaderEngine({
    onProgress: (update: ProgressUpdate) => {
      const percentage = Math.round(update.progress * 100);

      if (update.stage === 'failed') {
        console.log(`\n❌ Failed at ${percentage}%: ${update.message}`);
        if (update.metadata?.error) {
          console.log(`   Error: ${update.metadata.error}`);
        }
        if (update.completedSpecialists.length > 0) {
          console.log(`   Completed before failure: ${update.completedSpecialists.length}/${update.totalSpecialists}`);
        }
      } else {
        console.log(`[${percentage}%] ${update.stage}: ${update.message}`);
      }
    },
  });

  const config: SpreadConfig = {
    request: 'Test request for error handling',
    parentContext: createEmptyContext(),
    specialists: [
      {
        id: 'researcher-4',
        role: 'researcher',
        systemPrompt: 'You are a research specialist.',
        provider: 'invalid-provider', // This will cause an error
      },
    ],
    output: {
      format: 'markdown',
      directory: '.spreads',
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
      showProgress: true,
      verbose: false,
    },
  };

  try {
    await engine.executeSpread(config);
  } catch (error) {
    console.log('\n✅ Error was caught and handled correctly');
  }
}

/**
 * Example 5: Conditional progress updates
 */
async function example5_conditionalUpdates() {
  console.log('\n=== Example 5: Conditional Progress Updates ===\n');

  let updateCount = 0;
  const showDetailedProgress = true; // Toggle this to control verbosity

  const engine = new SpreaderEngine({
    onProgress: (update: ProgressUpdate) => {
      updateCount++;

      // Only show updates for specific stages
      if (showDetailedProgress) {
        // Show all updates
        console.log(`[${update.stage}] ${update.message}`);
      } else {
        // Only show major milestones
        if (
          update.stage === 'initializing' ||
          update.stage === 'executing' ||
          update.stage === 'complete' ||
          update.stage === 'failed'
        ) {
          console.log(`[${update.stage}] ${update.message}`);
        }
      }

      // Show specialist completion summary
      if (
        update.stage === 'executing' &&
        update.completedSpecialists.length > 0 &&
        update.completedSpecialists.length % 2 === 0
      ) {
        console.log(
          `  📊 Progress checkpoint: ${update.completedSpecialists.length}/${update.totalSpecialists} specialists completed`
        );
      }
    },
  });

  const config: SpreadConfig = {
    request: 'Analyze trends in web development',
    parentContext: createEmptyContext(),
    specialists: [
      {
        id: 'researcher-5',
        role: 'researcher',
        systemPrompt: 'You are a research specialist.',
        provider: 'openai',
      },
      {
        id: 'analyst-5',
        role: 'analyst',
        systemPrompt: 'You are an analyst specialist.',
        provider: 'openai',
      },
      {
        id: 'synthesizer-2',
        role: 'synthesizer',
        systemPrompt: 'You are a synthesizer specialist.',
        provider: 'openai',
      },
      {
        id: 'critic-1',
        role: 'critic',
        systemPrompt: 'You are a critic specialist.',
        provider: 'openai',
      },
    ],
    output: {
      format: 'markdown',
      directory: '.spreads',
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
      showProgress: true,
      verbose: false,
    },
  };

  try {
    await engine.executeSpread(config);
    console.log(`\n📊 Total progress updates received: ${updateCount}`);
  } catch (error) {
    console.error('\n❌ Spread failed:', error);
  }
}

/**
 * Helper function to create empty context
 */
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

/**
 * Main execution function
 */
async function main() {
  console.log('🚀 Spreader Progress Callbacks Examples\n');
  console.log('This file contains 5 examples of progress callback usage.');
  console.log('Uncomment the example you want to run:\n');

  // Uncomment the example you want to run:

  // await example1_basicProgressTracking();
  // await example2_detailedProgressTracking();
  // await example3_progressWithMetrics();
  // await example4_errorHandling();
  // await example5_conditionalUpdates();

  console.log('\n✅ All examples completed!');
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export {
  example1_basicProgressTracking,
  example2_detailedProgressTracking,
  example3_progressWithMetrics,
  example4_errorHandling,
  example5_conditionalUpdates,
};
