/**
 * List command - List all spreads
 *
 * @module cli/commands/list
 */

import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';

export async function listCommand(
  options: { directory?: string; status?: string; json?: boolean } = {}
): Promise<void> {
  try {
    const spreadsDir = options.directory || './spreads';

    try {
      await fs.access(spreadsDir);
    } catch {
      if (options.json) {
        console.log(JSON.stringify({ spreads: [] }, null, 2));
      } else {
        console.log(chalk.yellow('No spreads found'));
      }
      return;
    }

    const entries = await fs.readdir(spreadsDir, { withFileTypes: true });
    const spreads = entries.filter(e => e.isDirectory());

    if (spreads.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ spreads: [] }, null, 2));
      } else {
        console.log(chalk.yellow('No spreads found'));
      }
      return;
    }

    if (options.json) {
      const spreadData = await Promise.all(
        spreads.map(async (spread) => {
          const indexPath = path.join(spreadsDir, spread.name, 'index.md');
          try {
            await fs.access(indexPath);
            return { id: spread.name, status: 'completed' };
          } catch {
            return { id: spread.name, status: 'incomplete' };
          }
        })
      );

      console.log(JSON.stringify({ spreads: spreadData }, null, 2));
    } else {
      console.log('');
      console.log(chalk.cyan('Spreads:'));
      console.log('');

      for (const spread of spreads) {
        const indexPath = path.join(spreadsDir, spread.name, 'index.md');
        try {
          await fs.access(indexPath);
          console.log(chalk.green(`  ✅ ${spread.name}`));
        } catch {
          console.log(chalk.yellow(`  ⏳ ${spread.name}`));
        }
      }

      console.log('');
      console.log(chalk.gray(`Total: ${spreads.length} spread(s)`));
      console.log('');
    }

  } catch (error) {
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
