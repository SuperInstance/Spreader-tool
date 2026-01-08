/**
 * Status command - Check spread status
 *
 * @module cli/commands/status
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function statusCommand(
  spreadId: string,
  options: { watch?: boolean; json?: boolean } = {}
): Promise<void> {
  try {
    // In a real implementation, this would check a running process or status file
    // For now, we'll check if the output directory exists and has results

    const spreadsDir = './spreads';
    const spreadPath = path.join(spreadsDir, spreadId);

    try {
      await fs.access(spreadPath);

      const indexPath = path.join(spreadPath, 'index.md');

      try {
        await fs.access(indexPath);

        // Spread completed
        if (options.json) {
          console.log(JSON.stringify({ status: 'completed', spreadId }, null, 2));
        } else {
          console.log(chalk.green(`✅ Spread ${spreadId} completed`));
          console.log(chalk.gray(`View results: spreader results ${spreadId}`));
        }

      } catch {
        // In progress
        if (options.json) {
          console.log(JSON.stringify({ status: 'running', spreadId }, null, 2));
        } else {
          console.log(chalk.yellow(`⏳ Spread ${spreadId} is running...`));
        }
      }

    } catch {
      // Spread not found
      if (options.json) {
        console.log(JSON.stringify({ error: 'Spread not found', spreadId }, null, 2));
      } else {
        console.log(chalk.red(`❌ Spread not found: ${spreadId}`));
      }
      process.exit(1);
    }

  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
