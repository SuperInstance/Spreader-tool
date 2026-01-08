/**
 * Configuration file management
 * @module config/manager
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { validateConfig, safeValidateConfig } from './schema.js';
import {
  DEFAULT_CONFIG,
  DEFAULT_PROVIDERS,
  CONFIG_PATHS,
  API_KEY_ENV_VARS,
} from './defaults.js';
import type {
  SpreaderConfig,
  ProviderConfig,
  DefaultConfig,
} from '../types/index.js';

/**
 * Expand home directory in file path
 *
 * @param filepath - File path to expand
 * @returns Expanded absolute path
 */
function expandHome(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  return filepath;
}

/**
 * Find configuration file in standard locations
 *
 * @param startDir - Directory to start searching from
 * @returns Path to config file or null if not found
 */
export async function findConfigFile(
  startDir: string = process.cwd()
): Promise<string | null> {
  for (const configPath of CONFIG_PATHS) {
    const fullPath = path.resolve(startDir, expandHome(configPath));

    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      // File doesn't exist, continue searching
      continue;
    }
  }

  return null;
}

/**
 * Load configuration from file
 *
 * @param configPath - Path to configuration file
 * @returns Parsed configuration object
 * @throws Error if file cannot be read or parsed
 */
export async function loadConfigFile(
  configPath: string
): Promise<SpreaderConfig> {
  try {
    const expandedPath = expandHome(configPath);
    const content = await fs.readFile(expandedPath, 'utf-8');
    const rawConfig = JSON.parse(content);

    // Validate configuration
    const validatedConfig = validateConfig(rawConfig);

    // Inject environment variables for API keys
    const configWithEnv = injectEnvironmentVariables(validatedConfig);

    return configWithEnv;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load configuration from file or use defaults
 *
 * @param configPath - Optional path to configuration file
 * @returns Configuration object
 */
export async function loadOrCreateConfig(
  configPath?: string
): Promise<SpreaderConfig> {
  let actualConfigPath: string | undefined = configPath;

  // If no path provided, search for config file
  if (!actualConfigPath) {
    actualConfigPath = await findConfigFile() || undefined;

    // If no config file found, return defaults
    if (!actualConfigPath) {
      return {
        providers: DEFAULT_PROVIDERS,
        defaults: DEFAULT_CONFIG,
      };
    }
  }

  // Load and validate configuration
  try {
    return await loadConfigFile(actualConfigPath);
  } catch (error) {
    // If loading fails, return defaults
    return {
      providers: DEFAULT_PROVIDERS,
      defaults: DEFAULT_CONFIG,
    };
  }
}

/**
 * Save configuration to file
 *
 * @param config - Configuration to save
 * @param configPath - Path to save configuration to
 * @throws Error if file cannot be written
 */
export async function saveConfigFile(
  config: SpreaderConfig,
  configPath: string
): Promise<void> {
  try {
    const expandedPath = expandHome(configPath);
    const dir = path.dirname(expandedPath);

    // Create directory if it doesn't exist
    await fs.mkdir(dir, { recursive: true });

    // Write configuration with pretty formatting
    const content = JSON.stringify(config, null, 2);
    await fs.writeFile(expandedPath, content, 'utf-8');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to save config to ${configPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Create new configuration file
 *
 * @param configPath - Path to create configuration at
 * @param config - Optional custom configuration (uses defaults if not provided)
 * @returns Created configuration
 */
export async function createConfigFile(
  configPath: string,
  config?: Partial<SpreaderConfig>
): Promise<SpreaderConfig> {
  const newConfig: SpreaderConfig = {
    $schema: 'https://spreader.tool/schema/config.json',
    providers: config?.providers || DEFAULT_PROVIDERS,
    defaults: {
      ...DEFAULT_CONFIG,
      ...config?.defaults,
    },
  };

  await saveConfigFile(newConfig, configPath);
  return newConfig;
}

/**
 * Inject environment variables into configuration
 *
 * @param config - Configuration to inject into
 * @returns Configuration with environment variables applied
 */
export function injectEnvironmentVariables(
  config: SpreaderConfig
): SpreaderConfig {
  const updatedProviders: Record<string, ProviderConfig> = {};

  for (const [key, provider] of Object.entries(config.providers)) {
    const envVar = API_KEY_ENV_VARS[provider.type as keyof typeof API_KEY_ENV_VARS];

    if (envVar && process.env[envVar]) {
      updatedProviders[key] = {
        ...provider,
        apiKey: process.env[envVar],
      };
    } else {
      updatedProviders[key] = provider;
    }
  }

  return {
    ...config,
    providers: updatedProviders,
  };
}

/**
 * Update a specific configuration value
 *
 * @param key - Configuration key (dot notation, e.g., 'providers.openai.apiKey')
 * @param value - New value to set
 * @param configPath - Path to configuration file
 * @throws Error if key is invalid or file cannot be written
 */
export async function updateConfigValue(
  key: string,
  value: unknown,
  configPath: string
): Promise<void> {
  const config = await loadOrCreateConfig(configPath);

  // Parse dot notation key
  const parts = key.split('.');

  if (parts.length < 2) {
    throw new Error('Invalid configuration key. Use format: section.key (e.g., providers.openai.apiKey)');
  }

  const section = parts[0];
  const rest = parts.slice(1);

  if (section === 'providers') {
    const providerName = rest[0];
    const providerKey = rest[1];

    if (!config.providers[providerName]) {
      config.providers[providerName] = {
        name: providerName,
        type: 'custom',
      };
    }

    (config.providers[providerName] as Record<string, unknown>)[providerKey] = value;
  } else if (section === 'defaults') {
    const defaultKey = rest[0];

    (config.defaults as Record<string, unknown>)[defaultKey] = value;
  } else {
    throw new Error(`Invalid configuration section: ${section}`);
  }

  // Validate updated config
  const validation = safeValidateConfig(config);
  if (!validation.success) {
    throw new Error(`Invalid configuration: ${validation.error.message}`);
  }

  await saveConfigFile(config, configPath);
}

/**
 * Get provider configuration
 *
 * @param providerName - Name of provider
 * @param configPath - Optional path to configuration file
 * @returns Provider configuration or null if not found
 */
export async function getProvider(
  providerName: string,
  configPath?: string
): Promise<ProviderConfig | null> {
  const config = await loadOrCreateConfig(configPath);
  return config.providers[providerName] || null;
}

/**
 * Get default configuration values
 *
 * @param configPath - Optional path to configuration file
 * @returns Default configuration
 */
export async function getDefaults(
  configPath?: string
): Promise<DefaultConfig> {
  const config = await loadOrCreateConfig(configPath);
  return config.defaults;
}

/**
 * Validate configuration file exists and is valid
 *
 * @param configPath - Path to configuration file
 * @returns True if valid, false otherwise
 */
export async function validateConfigFile(
  configPath: string
): Promise<boolean> {
  try {
    await loadConfigFile(configPath);
    return true;
  } catch {
    return false;
  }
}

/**
 * List all available providers from configuration
 *
 * @param configPath - Optional path to configuration file
 * @returns Array of provider names
 */
export async function listProviders(
  configPath?: string
): Promise<string[]> {
  const config = await loadOrCreateConfig(configPath);
  return Object.keys(config.providers);
}

/**
 * Check if provider is configured (has API key or valid setup)
 *
 * @param providerName - Name of provider
 * @param configPath - Optional path to configuration file
 * @returns True if provider is configured
 */
export async function isProviderConfigured(
  providerName: string,
  configPath?: string
): Promise<boolean> {
  const provider = await getProvider(providerName, configPath);

  if (!provider) {
    return false;
  }

  // Check if provider has required configuration
  switch (provider.type) {
    case 'openai':
    case 'anthropic':
      return !!provider.apiKey;
    case 'ollama':
      return !!provider.baseURL;
    case 'mcp':
      return !!provider.baseURL;
    default:
      return false;
  }
}
