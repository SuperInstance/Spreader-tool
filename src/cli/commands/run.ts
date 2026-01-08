/**
 * Run command - Execute a spread
 *
 * @module cli/commands/run
 */

import chalk from 'chalk';
import ora from 'ora';
import cliProgress from 'cli-progress';
import { SpreaderEngine } from '../../core/engine.js';
import { MarkdownWriter } from '../../output/markdown-writer.js';
import { IndexGenerator } from '../../output/index-generator.js';
import { loadOrCreateConfig } from '../../config/manager.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { OpenAIProvider } from '../../providers/openai.js';
import { AnthropicProvider } from '../../providers/anthropic.js';
import { OllamaProvider } from '../../providers/ollama.js';
import type { SpreadConfig, FullContext } from '../../types/index.js';

export async function runCommand(
  request: string,
  options: any
): Promise<void> {
  const spinner = ora('Initializing Spreader...').start();

  try {
    // Load configuration
    spinner.text = 'Loading configuration...';
    const config = await loadOrCreateConfig(options.config);

    // Setup providers
    spinner.text = 'Setting up providers...';
    const registry = new ProviderRegistry();

    // Register available providers
    if (config.providers.openai?.apiKey) {
      registry.register(new OpenAIProvider({
        ...config.providers.openai,
        apiKey: config.providers.openai.apiKey, // Ensure required field
      }));
    }

    if (config.providers.anthropic?.apiKey) {
      registry.register(new AnthropicProvider({
        ...config.providers.anthropic,
        apiKey: config.providers.anthropic.apiKey, // Ensure required field
      }));
    }

    if (config.providers.ollama?.baseURL) {
      registry.register(new OllamaProvider({
        ...config.providers.ollama,
        baseURL: config.providers.ollama.baseURL || 'http://localhost:11434',
      }));
    }

    if (registry.count === 0) {
      spinner.fail('No providers configured');
      console.error(chalk.red('Please configure at least one provider in spreader.config.json'));
      process.exit(1);
    }

    // Parse specialist types
    const specialistTypes = options.specialists.split(',').map((s: string) => s.trim());

    // Create spread config
    const outputDir = options.output;
    const spreadConfig: SpreadConfig = {
      request,
      parentContext: createEmptyContext(),
      specialists: specialistTypes.map((role: string, index: number) => ({
        id: `specialist-${index + 1}`,
        role: role as any,
        systemPrompt: getSystemPrompt(role),
        provider: options.providers.split(',')[0] || 'openai',
        model: options.model,
        temperature: parseFloat(options.temperature),
        maxTokens: parseInt(options.maxTokens),
      })),
      output: {
        format: 'markdown',
        directory: outputDir,
        createIndex: true,
        includeTimestamps: true,
        includeMetadata: true,
      },
      context: {
        compactAfter: config.defaults.compactAfter,
        compactStrategy: 'recursive',
        recontextualizeAllowed: true,
        includePreviousThreads: false,
      },
      monitoring: {
        checkinInterval: config.defaults.checkinInterval,
        showProgress: true,
        verbose: options.verbose || false,
      },
    };

    // Create engine
    const engine = new SpreaderEngine({
      verbose: options.verbose || false,
      onProgress: (progress) => {
        spinner.text = progress.message;
      },
    });

    // Execute spread
    spinner.text = `Executing ${specialistTypes.length} specialists...`;

    const progressBar = new cliProgress.SingleBar({
      format: '{bar} {percentage}% | {value}/{total} specialists',
    }, cliProgress.Presets.shades_classic);

    progressBar.start(specialistTypes.length, 0);

    // Update progress bar
    engine['options'].onProgress = (progress: any) => {
      progressBar.update(progress.completedCount);
      if (options.verbose) {
        console.log(chalk.gray(`[${progress.timestamp.toISOString()}] ${progress.message}`));
      }
    };

    const result = await engine.executeSpread(spreadConfig);

    progressBar.stop();

    // Write outputs
    spinner.text = 'Writing results...';

    const writer = new MarkdownWriter();
    const indexGen = new IndexGenerator();

    await writer.writeAllSpecialistResults(result.results, outputDir);
    await indexGen.writeIndex(spreadConfig, result.results, outputDir, result.summary);

    spinner.succeed(`Spread complete! ${result.results.length} specialists executed`);

    // Display summary
    console.log('');
    console.log(chalk.green('Summary:'));
    console.log(chalk.gray(`  Total tokens: ${result.metadata.totalTokens.toLocaleString()}`));
    console.log(chalk.gray(`  Duration: ${(result.duration / 1000).toFixed(1)}s`));
    console.log(chalk.gray(`  Output: ${outputDir}/index.md`));
    console.log('');

  } catch (error) {
    spinner.fail('Spread execution failed');
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
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

function getSystemPrompt(role: string): string {
  const prompts: Record<string, string> = {
    researcher: 'You are a research specialist. Your job is to gather comprehensive information from multiple sources, synthesize key findings, and provide detailed analysis.',
    analyst: 'You are an analyst specialist. Your job is to analyze information, identify patterns and trends, and provide data-driven insights.',
    synthesizer: 'You are a synthesis specialist. Your job is to combine multiple perspectives into coherent insights and identify overarching patterns.',
    coder: 'You are a coding specialist. Your job is to write clean, efficient, well-documented code following best practices.',
    architect: 'You are an architecture specialist. Your job is to design system architectures that are scalable, maintainable, and aligned with requirements.',
    critic: 'You are a critical reviewer. Your job is to identify weaknesses, potential issues, and areas for improvement.',
    'world-builder': 'You are a world-building specialist. Your job is to create rich, detailed, coherent worlds with consistent lore and engaging elements.',
  };

  return prompts[role] || 'You are a specialist. Your job is to complete the assigned task to the best of your ability.';
}
