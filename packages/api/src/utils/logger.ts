import pino from 'pino';
import { randomUUID } from 'crypto';

// Configure Pino logger
export const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport:
    process.env.NODE_ENV !== 'production'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            ignore: 'pid,hostname',
            translateTime: 'HH:MM:ss.l',
          },
        }
      : undefined,
  base: {
    env: process.env.NODE_ENV,
  },
  redact: {
    paths: [
      'password',
      'token',
      'access_token',
      'refresh_token',
      'authorization',
      'cookie',
      'session',
      'secret',
      'clientSecret',
      'apiKey',
      'api_key',
      'credentials',
      '*.password',
      '*.token',
      '*.secret',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
});

// Generate correlation ID for request tracking
export function generateCorrelationId(): string {
  return randomUUID();
}

// Create child logger with correlation ID
export function createRequestLogger(correlationId: string, meta?: Record<string, any>) {
  return logger.child({
    correlationId,
    ...meta,
  });
}

// Log levels
export const LogLevel = {
  TRACE: 'trace',
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  FATAL: 'fatal',
} as const;

export type LogLevelType = (typeof LogLevel)[keyof typeof LogLevel];

// Structured logging helpers
export function logRequest(
  logger: pino.Logger,
  method: string,
  path: string,
  userId?: string,
  meta?: Record<string, any>
) {
  logger.info(
    {
      type: 'request',
      method,
      path,
      userId,
      ...meta,
    },
    `Request: ${method} ${path}`
  );
}

export function logResponse(
  logger: pino.Logger,
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  meta?: Record<string, any>
) {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger[level](
    {
      type: 'response',
      method,
      path,
      statusCode,
      duration,
      ...meta,
    },
    `Response: ${method} ${path} - ${statusCode} (${duration}ms)`
  );
}

export function logError(logger: pino.Logger, error: Error, context?: Record<string, any>) {
  logger.error(
    {
      type: 'error',
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...context,
    },
    `Error: ${error.message}`
  );
}

export function logAudit(
  logger: pino.Logger,
  action: string,
  userId: string,
  resource?: string,
  meta?: Record<string, any>
) {
  logger.info(
    {
      type: 'audit',
      action,
      userId,
      resource,
      timestamp: new Date().toISOString(),
      ...meta,
    },
    `Audit: ${action} by ${userId}${resource ? ` on ${resource}` : ''}`
  );
}

// Performance logging
export function logPerformance(
  logger: pino.Logger,
  operation: string,
  duration: number,
  meta?: Record<string, any>
) {
  const level = duration > 5000 ? 'warn' : duration > 1000 ? 'info' : 'debug';

  logger[level](
    {
      type: 'performance',
      operation,
      duration,
      ...meta,
    },
    `Performance: ${operation} took ${duration}ms`
  );
}

// Rate limit logging
export function logRateLimit(
  logger: pino.Logger,
  identifier: string,
  endpoint: string,
  remaining: number,
  limit: number
) {
  const level = remaining === 0 ? 'warn' : remaining < limit * 0.2 ? 'info' : 'debug';

  logger[level](
    {
      type: 'rateLimit',
      identifier,
      endpoint,
      remaining,
      limit,
    },
    `Rate limit: ${identifier} - ${remaining}/${limit} remaining for ${endpoint}`
  );
}

// Export default logger instance
export default logger;
