/**
 * Results command - View spread results
 *
 * @module cli/commands/results
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function resultsCommand(
  spreadId: string,
  options: { output?: string; json?: boolean; pretty?: boolean } = {}
): Promise<void> {
  try {
    const spreadPath = path.join('./spreads', spreadId);
    const indexPath = path.join(spreadPath, 'index.md');

    const content = await fs.readFile(indexPath, 'utf-8');

    if (options.json) {
      // Parse markdown and convert to JSON (simplified)
      const result = {
        spreadId,
        status: 'completed',
        content,
      };
      console.log(JSON.stringify(result, null, 2));
    } else if (options.output) {
      await fs.writeFile(options.output, content, 'utf-8');
      console.log(chalk.green(`Results saved to ${options.output}`));
    } else {
      // Display to console
      console.log('');
      console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
      console.log(chalk.cyan(`  Spread Results: ${spreadId}`));
      console.log(chalk.cyan('═══════════════════════════════════════════════════════════════'));
      console.log('');
      console.log(content);
      console.log('');
    }

  } catch (error) {
    console.error(chalk.red('Failed to read results'));
    console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
