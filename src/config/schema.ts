/**
 * Configuration schema validation using Zod
 * @module config/schema
 */

import { z } from 'zod';

/**
 * Specialist role enum
 */
const SpecialistRoleSchema = z.enum([
  'researcher',
  'coder',
  'architect',
  'world-builder',
  'analyst',
  'critic',
  'synthesizer',
  'custom',
]);

/**
 * Provider type enum
 */
const ProviderTypeSchema = z.enum([
  'openai',
  'anthropic',
  'ollama',
  'mcp',
  'custom',
]);

/**
 * Provider configuration schema
 */
const ProviderConfigSchema = z.object({
  name: z.string().min(1),
  type: ProviderTypeSchema,
  apiKey: z.string().optional(),
  baseURL: z.string().url().optional(),
  defaultModel: z.string().optional(),
});

/**
 * Default configuration schema
 */
const DefaultConfigSchema = z.object({
  specialists: z.array(SpecialistRoleSchema).min(1),
  provider: z.string().min(1),
  outputDirectory: z.string().min(1),
  compactAfter: z.number().int().positive().default(8000),
  checkinInterval: z.number().int().positive().default(30),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().default(4096),
});

/**
 * Full Spreader configuration schema
 */
export const SpreaderConfigSchema = z.object({
  $schema: z.string().optional(),
  providers: z.record(z.string(), ProviderConfigSchema),
  defaults: DefaultConfigSchema,
});

/**
 * Validate configuration object
 *
 * @param config - Configuration to validate
 * @returns Validated configuration or throws error
 */
export function validateConfig(config: unknown) {
  return SpreaderConfigSchema.parse(config);
}

/**
 * Safely validate configuration object
 *
 * @param config - Configuration to validate
 * @returns Result with success flag and data or error
 */
export function safeValidateConfig(config: unknown) {
  return SpreaderConfigSchema.safeParse(config);
}

/**
 * Validate provider configuration
 *
 * @param provider - Provider configuration to validate
 * @returns Validated provider or throws error
 */
export function validateProvider(provider: unknown) {
  return ProviderConfigSchema.parse(provider);
}

/**
 * Validate default configuration
 *
 * @param defaults - Default configuration to validate
 * @returns Validated defaults or throws error
 */
export function validateDefaults(defaults: unknown) {
  return DefaultConfigSchema.parse(defaults);
}

/**
 * Validate specialist roles
 *
 * @param roles - Array of specialist roles to validate
 * @returns Validated roles or throws error
 */
export function validateSpecialistRoles(roles: unknown) {
  return z.array(SpecialistRoleSchema).min(1).parse(roles);
}

/**
 * Type exports
 */
export type SpreaderConfig = z.infer<typeof SpreaderConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type DefaultConfig = z.infer<typeof DefaultConfigSchema>;
export type SpecialistRole = z.infer<typeof SpecialistRoleSchema>;
export type ProviderType = z.infer<typeof ProviderTypeSchema>;
