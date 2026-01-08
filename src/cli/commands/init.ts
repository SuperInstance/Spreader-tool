/**
 * Init command - Initialize new Spreader project
 *
 * @module cli/commands/init
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';
import ora from 'ora';
import type { SpreaderConfig } from '../../types/index.js';
import { DEFAULT_CONFIG, DEFAULT_PROVIDERS } from '../../config/defaults.js';

export async function initCommand(
  projectName: string = '.',
  options: { directory?: string; force?: boolean } = {}
): Promise<void> {
  const spinner = ora('Initializing Spreader project...').start();

  try {
    const projectDir = options.directory || projectName;

    // Check if directory exists
    try {
      await fs.access(projectDir);

      if (!options.force) {
        spinner.fail(`Directory already exists: ${projectDir}`);
        console.log(chalk.yellow('Use --force to overwrite'));
        return;
      }
    } catch {
      // Directory doesn't exist, which is fine
    }

    // Create directory structure
    spinner.text = 'Creating directory structure...';

    const dirs = [
      path.join(projectDir, 'spreads'),
      path.join(projectDir, 'config'),
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }

    // Create default config
    spinner.text = 'Creating configuration file...';

    const config: SpreaderConfig = {
      $schema: 'https://spreader.tool/schema/config.json',
      providers: DEFAULT_PROVIDERS,
      defaults: DEFAULT_CONFIG,
    };

    const configPath = path.join(projectDir, 'spreader.config.json');
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');

    // Create .gitignore
    spinner.text = 'Creating .gitignore...';

    const gitignore = `
# Spreader outputs
spreads/
*.md

# Node modules
node_modules/

# Environment variables
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo
`;

    await fs.writeFile(path.join(projectDir, '.gitignore'), gitignore.trim(), 'utf-8');

    // Create README
    spinner.text = 'Creating README...';

    const readme = `# Spreader Project

This project uses [Spreader](https://github.com/SuperInstance/Spreader-tool) for parallel multi-agent information gathering.

## Quick Start

\`\`\`bash
# Run a spread
spreader run "Your research question here"

# Check status
spreader status <spread-id>

# View results
spreader results <spread-id>
\`\`\`

## Configuration

Edit \`spreader.config.json\` to configure:
- LLM providers (OpenAI, Anthropic, Ollama)
- Default specialist types
- Output directories
- Token limits

## Documentation

- [Getting Started](https://github.com/SuperInstance/Spreader-tool#readme)
- [Configuration Guide](https://github.com/SuperInstance/Spreader-tool/blob/main/docs/configuration.md)
- [Specialist Reference](https://github.com/SuperInstance/Spreader-tool/blob/main/docs/specialists.md)
`;

    await fs.writeFile(path.join(projectDir, 'README.md'), readme.trim(), 'utf-8');

    spinner.succeed('Spreader project initialized!');

    console.log('');
    console.log(chalk.green('Next steps:'));
    console.log(chalk.gray('  1. Configure providers in spreader.config.json'));
    console.log(chalk.gray('  2. Set API keys as environment variables'));
    console.log(chalk.gray('  3. Run: spreader run "Your request here"'));
    console.log('');

  } catch (error) {
    spinner.fail('Initialization failed');
    console.error(chalk.red(error instanceof Error ? error.message : 'Unknown error'));
    process.exit(1);
  }
}
