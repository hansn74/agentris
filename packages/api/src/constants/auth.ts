/**
 * Authentication-related constants
 */

// Password hashing
export const BCRYPT_SALT_ROUNDS = 12;

// Token expiration times
export const TOKEN_EXPIRY = {
  VERIFICATION: 24 * 60 * 60 * 1000, // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000, // 1 hour
  REFRESH_TOKEN: 7 * 24 * 60 * 60 * 1000, // 7 days
  SESSION: 24 * 60 * 60 * 1000, // 24 hours
} as const;

// Token expiry strings for JWT
export const JWT_EXPIRY = {
  ACCESS: '24h',
  REFRESH: '7d',
} as const;

// Validation constraints
export const VALIDATION = {
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 1,
} as const;

// Session management
export const SESSION = {
  MAX_AGE_SECONDS: 24 * 60 * 60, // 24 hours in seconds
  CLEANUP_INTERVAL: 60 * 60 * 1000, // 1 hour in milliseconds
} as const;
