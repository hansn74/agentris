import { z } from 'zod';

// Define the environment variables schema
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url().min(1, 'DATABASE_URL is required'),

  // Auth
  NEXTAUTH_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),

  // Jira OAuth (optional but validated if present)
  JIRA_CLIENT_ID: z.string().optional(),
  JIRA_CLIENT_SECRET: z.string().optional(),
  JIRA_REDIRECT_URI: z.string().url().optional(),
  JIRA_WEBHOOK_SECRET: z.string().optional(),
  JIRA_FIELD_ACCEPTANCE_CRITERIA: z.string().optional(),

  // Encryption
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 characters').optional(),

  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validates environment variables at startup
 * @throws {Error} if required environment variables are missing or invalid
 */
export function validateEnv(): EnvConfig {
  try {
    const env = envSchema.parse(process.env);

    // Additional validation for Jira configuration
    if (env.JIRA_CLIENT_ID || env.JIRA_CLIENT_SECRET) {
      if (!env.JIRA_CLIENT_ID || !env.JIRA_CLIENT_SECRET) {
        throw new Error('Both JIRA_CLIENT_ID and JIRA_CLIENT_SECRET must be provided together');
      }
    }

    // Warn about default encryption key
    if (
      !env.ENCRYPTION_KEY ||
      env.ENCRYPTION_KEY === 'default-encryption-key-change-in-production'
    ) {
      console.warn(
        '⚠️  WARNING: Using default encryption key. Please set ENCRYPTION_KEY in production.'
      );
    }

    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((e) => `  - ${e.path.join('.')}: ${e.message}`)
        .join('\n');
      throw new Error(`Environment validation failed:\n${missingVars}`);
    }
    throw error;
  }
}

/**
 * Get validated environment configuration
 * Caches the result after first validation
 */
let cachedEnv: EnvConfig | null = null;

export function getEnvConfig(): EnvConfig {
  if (!cachedEnv) {
    // In test environment, provide default values for optional fields
    if (process.env.NODE_ENV === 'test') {
      cachedEnv = {
        DATABASE_URL: process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test',
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || 'test-secret-for-testing-only',
        JIRA_CLIENT_ID: process.env.JIRA_CLIENT_ID || 'test-jira-client-id',
        JIRA_CLIENT_SECRET: process.env.JIRA_CLIENT_SECRET || 'test-jira-client-secret',
        JIRA_REDIRECT_URI: process.env.JIRA_REDIRECT_URI,
        JIRA_WEBHOOK_SECRET: process.env.JIRA_WEBHOOK_SECRET,
        JIRA_FIELD_ACCEPTANCE_CRITERIA: process.env.JIRA_FIELD_ACCEPTANCE_CRITERIA,
        ENCRYPTION_KEY:
          process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long-for-testing',
        NODE_ENV: 'test' as const,
      };
    } else {
      cachedEnv = validateEnv();
    }
  }
  return cachedEnv;
}

/**
 * Check if Jira integration is configured
 */
export function isJiraConfigured(): boolean {
  const env = getEnvConfig();
  return !!(env.JIRA_CLIENT_ID && env.JIRA_CLIENT_SECRET);
}
