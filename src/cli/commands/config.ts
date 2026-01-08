/**
 * Config command - Manage configuration
 *
 * @module cli/commands/config
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { loadOrCreateConfig, updateConfigValue } from '../../config/manager.js';

export const configCommand = new Command('config')
  .description('Manage Spreader configuration')

  .command('set <key> <value>')
  .description('Set configuration value (e.g., providers.openai.apiKey sk-...)')
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (key: string, value: string, options: any) => {
    try {
      const configPath = options.config || './spreader.config.json';

      await updateConfigValue(key, value, configPath);

      console.log(chalk.green(`✅ Configuration updated: ${key}`));
    } catch (error) {
      console.error(chalk.red('Failed to update configuration'));
      console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  })

  .command('get <key>')
  .description('Get configuration value')
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (key: string, options: any) => {
    try {
      const config = await loadOrCreateConfig(options.config);

      const parts = key.split('.');
      let value: any = config;

      for (const part of parts) {
        value = value[part];
        if (value === undefined) {
          console.log(chalk.yellow(`Configuration key not found: ${key}`));
          return;
        }
      }

      if (typeof value === 'object') {
        console.log(JSON.stringify(value, null, 2));
      } else {
        console.log(value);
      }

    } catch (error) {
      console.error(chalk.red('Failed to read configuration'));
      console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  })

  .command('list')
  .description('List all configuration values')
  .option('-c, --config <file>', 'Configuration file path')
  .action(async (options: any) => {
    try {
      const config = await loadOrCreateConfig(options.config);

      console.log('');
      console.log(chalk.cyan('Configuration:'));
      console.log('');
      console.log(JSON.stringify(config, null, 2));
      console.log('');

    } catch (error) {
      console.error(chalk.red('Failed to load configuration'));
      console.error(chalk.gray(error instanceof Error ? error.message : 'Unknown error'));
      process.exit(1);
    }
  });
