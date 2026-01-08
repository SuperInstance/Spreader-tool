#!/usr/bin/env node
/**
 * Spreader CLI - Main entry point
 *
 * Command-line interface for the Spreader parallel multi-agent tool.
 *
 * @module cli/index
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { runCommand } from './commands/run.js';
import { statusCommand } from './commands/status.js';
import { resultsCommand } from './commands/results.js';
import { configCommand } from './commands/config.js';
import { listCommand } from './commands/list.js';

const program = new Command();

// CLI version and description
program
  .name('spreader')
  .description('Parallel multi-agent information gathering tool')
  .version('1.0.0');

// Init command
program
  .command('init [project-name]')
  .description('Initialize a new Spreader project')
  .option('-d, --directory <dir>', 'Project directory', '.')
  .option('-f, --force', 'Force initialization even if directory exists')
  .action(initCommand);

// Run command
program
  .command('run <request>')
  .description('Execute a spread with parallel specialists')
  .option('-s, --specialists <types>', 'Specialist types (comma-separated)', 'researcher,analyst,synthesizer')
  .option('-p, --providers <names>', 'LLM providers (comma-separated)', 'openai')
  .option('-o, --output <dir>', 'Output directory', './spreads')
  .option('-c, --config <file>', 'Configuration file path')
  .option('-m, --model <model>', 'Model to use')
  .option('-t, --temperature <temp>', 'Temperature (0.0-2.0)', '0.7')
  .option('--max-tokens <tokens>', 'Maximum tokens', '4096')
  .option('--sequential', 'Run specialists sequentially (with handoffs)')
  .option('--parallel', 'Run specialists in parallel (default)')
  .option('-v, --verbose', 'Enable verbose output')
  .action(runCommand);

// Status command
program
  .command('status <spread-id>')
  .description('Check the status of a running spread')
  .option('-w, --watch', 'Watch status in real-time')
  .option('-j, --json', 'Output as JSON')
  .action(statusCommand);

// Results command
program
  .command('results <spread-id>')
  .description('View results of a completed spread')
  .option('-o, --output <file>', 'Save results to file')
  .option('-j, --json', 'Output as JSON')
  .option('--pretty', 'Pretty print markdown')
  .action(resultsCommand);

// List command
program
  .command('list')
  .description('List all spreads')
  .option('-d, --directory <dir>', 'Spreads directory', './spreads')
  .option('--status <status>', 'Filter by status')
  .option('-j, --json', 'Output as JSON')
  .action(listCommand);

// Config commands
program
  .command('config')
  .description('Manage Spreader configuration')
  .addCommand(configCommand);

// Global error handling
program.configureOutput({
  writeErr: (str) => {
    if (str.includes('error')) {
      console.error(chalk.red(str));
    } else {
      console.error(chalk.yellow(str));
    }
  },
  writeOut: (str) => {
    console.log(str);
  },
});

// Parse arguments
program.parse();

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
