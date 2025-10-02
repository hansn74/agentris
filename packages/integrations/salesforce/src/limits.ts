import { PrismaClient } from '@prisma/client';
import pino from 'pino';
import { ConnectionManager } from './connection';
import { OrgLimits, LimitInfo, GovernorLimitError } from './types/metadata';
import { retryWithExponentialBackoff, retryOnRateLimit, CircuitBreaker } from './utils/retry';

const logger = pino({ name: 'salesforce-limits' });

export interface LimitCheckOptions {
  minApiCallsRequired?: number;
  minStorageMBRequired?: number;
  throwOnExceeded?: boolean;
}

export class LimitsManager {
  private connectionManager: ConnectionManager;
  private prisma: PrismaClient;
  private limitsCache: Map<string, CachedLimits>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private readonly cacheTTL = 300000; // 5 minutes

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.connectionManager = new ConnectionManager(prisma);
    this.limitsCache = new Map();
    this.circuitBreakers = new Map();
  }

  async checkApiLimits(
    userId: string,
    orgId: string,
    options: LimitCheckOptions = {}
  ): Promise<OrgLimits> {
    try {
      // Check cache first
      const cached = this.getCachedLimits(orgId);
      if (cached) {
        logger.debug({ orgId }, 'Using cached limits');
        return cached.limits;
      }

      const conn = await this.connectionManager.getConnection(userId, orgId);
      if (!conn) {
        throw new GovernorLimitError('No connection available', 'connection');
      }

      logger.info({ orgId }, 'Fetching org limits');

      // Use retry logic for limits API call
      const limits = await retryOnRateLimit(async () => {
        const response = await conn.request({
          url: '/services/data/v59.0/limits',
          method: 'GET',
        });
        return response as OrgLimits;
      });

      // Cache the limits
      this.setCachedLimits(orgId, limits);

      // Check if limits are exceeded based on options
      if (options.throwOnExceeded) {
        this.validateLimits(limits, options);
      }

      // Log warning if API calls are running low
      const apiLimit = limits.DailyApiRequests;
      const percentUsed = (apiLimit.Used / apiLimit.Max) * 100;

      if (percentUsed > 90) {
        logger.warn(
          {
            orgId,
            used: apiLimit.Used,
            max: apiLimit.Max,
            percentUsed: percentUsed.toFixed(2),
          },
          'API limit usage is above 90%'
        );
      } else if (percentUsed > 75) {
        logger.info(
          {
            orgId,
            used: apiLimit.Used,
            max: apiLimit.Max,
            percentUsed: percentUsed.toFixed(2),
          },
          'API limit usage is above 75%'
        );
      }

      return limits;
    } catch (error) {
      logger.error({ error, orgId }, 'Failed to check API limits');

      if (error instanceof GovernorLimitError) {
        throw error;
      }

      throw new GovernorLimitError(
        `Failed to check API limits: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'api_check'
      );
    }
  }

  async checkLimitBeforeOperation(
    userId: string,
    orgId: string,
    operation: string,
    estimatedApiCalls: number = 1
  ): Promise<boolean> {
    try {
      const limits = await this.checkApiLimits(userId, orgId);
      const apiLimit = limits.DailyApiRequests;

      if (apiLimit.Remaining < estimatedApiCalls) {
        logger.error(
          {
            orgId,
            operation,
            remaining: apiLimit.Remaining,
            required: estimatedApiCalls,
          },
          'Insufficient API calls remaining'
        );

        throw new GovernorLimitError(
          `Insufficient API calls for operation ${operation}. Required: ${estimatedApiCalls}, Remaining: ${apiLimit.Remaining}`,
          'DailyApiRequests',
          apiLimit
        );
      }

      logger.info(
        {
          orgId,
          operation,
          apiCallsRemaining: apiLimit.Remaining,
        },
        'Limit check passed'
      );

      return true;
    } catch (error) {
      if (error instanceof GovernorLimitError) {
        throw error;
      }

      // If we can't check limits, log warning but allow operation
      logger.warn(
        {
          error,
          orgId,
          operation,
        },
        'Could not verify limits, proceeding with operation'
      );

      return true;
    }
  }

  async executeWithLimitCheck<T>(
    userId: string,
    orgId: string,
    operation: string,
    fn: () => Promise<T>,
    estimatedApiCalls: number = 1
  ): Promise<T> {
    // Check limits before operation
    await this.checkLimitBeforeOperation(userId, orgId, operation, estimatedApiCalls);

    // Get or create circuit breaker for this org
    let circuitBreaker = this.circuitBreakers.get(orgId);
    if (!circuitBreaker) {
      circuitBreaker = new CircuitBreaker();
      this.circuitBreakers.set(orgId, circuitBreaker);
    }

    try {
      // Execute with circuit breaker and retry logic
      const result = await circuitBreaker.execute(async () => {
        return await retryWithExponentialBackoff(fn, {
          maxAttempts: 3,
          shouldRetry: (error) => this.shouldRetryError(error),
        });
      });

      logger.info(
        {
          orgId,
          operation,
        },
        'Operation completed successfully'
      );

      return result;
    } catch (error) {
      // Check if it's a limit error
      if (this.isLimitError(error)) {
        const limitType = this.extractLimitType(error);
        logger.error(
          {
            error,
            orgId,
            operation,
            limitType,
          },
          'Governor limit exceeded'
        );

        throw new GovernorLimitError(
          `Governor limit exceeded during ${operation}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          limitType || 'unknown'
        );
      }

      throw error;
    }
  }

  async getStorageLimits(
    userId: string,
    orgId: string
  ): Promise<{
    dataStorage: LimitInfo;
    fileStorage: LimitInfo;
  }> {
    const limits = await this.checkApiLimits(userId, orgId);

    return {
      dataStorage: limits.DataStorageMB,
      fileStorage: limits.FileStorageMB,
    };
  }

  async getApiUsagePercentage(userId: string, orgId: string): Promise<number> {
    const limits = await this.checkApiLimits(userId, orgId);
    const apiLimit = limits.DailyApiRequests;

    return (apiLimit.Used / apiLimit.Max) * 100;
  }

  async getRemainingApiCalls(userId: string, orgId: string): Promise<number> {
    const limits = await this.checkApiLimits(userId, orgId);
    return limits.DailyApiRequests.Remaining;
  }

  clearCache(orgId?: string): void {
    if (orgId) {
      this.limitsCache.delete(orgId);
      logger.info({ orgId }, 'Cleared limits cache for org');
    } else {
      this.limitsCache.clear();
      logger.info('Cleared all limits cache');
    }
  }

  getCircuitBreakerState(orgId: string): 'closed' | 'open' | 'half-open' | null {
    const breaker = this.circuitBreakers.get(orgId);
    return breaker ? breaker.getState() : null;
  }

  private getCachedLimits(orgId: string): CachedLimits | null {
    const cached = this.limitsCache.get(orgId);

    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age < this.cacheTTL) {
        return cached;
      }
      // Cache expired
      this.limitsCache.delete(orgId);
    }

    return null;
  }

  private setCachedLimits(orgId: string, limits: OrgLimits): void {
    this.limitsCache.set(orgId, {
      limits,
      timestamp: Date.now(),
    });
  }

  private validateLimits(limits: OrgLimits, options: LimitCheckOptions): void {
    const errors: string[] = [];

    if (options.minApiCallsRequired) {
      if (limits.DailyApiRequests.Remaining < options.minApiCallsRequired) {
        errors.push(
          `Insufficient API calls: ${limits.DailyApiRequests.Remaining} remaining, ${options.minApiCallsRequired} required`
        );
      }
    }

    if (options.minStorageMBRequired) {
      if (limits.DataStorageMB.Remaining < options.minStorageMBRequired) {
        errors.push(
          `Insufficient data storage: ${limits.DataStorageMB.Remaining}MB remaining, ${options.minStorageMBRequired}MB required`
        );
      }
    }

    if (errors.length > 0) {
      throw new GovernorLimitError(`Limits validation failed: ${errors.join('; ')}`, 'validation');
    }
  }

  private shouldRetryError(error: any): boolean {
    // Retry on rate limit errors
    if (this.isRateLimitError(error)) {
      return true;
    }

    // Retry on transient errors
    if (
      error.message?.includes('UNABLE_TO_LOCK_ROW') ||
      error.message?.includes('QUERY_TIMEOUT') ||
      error.message?.includes('SERVER_UNAVAILABLE')
    ) {
      return true;
    }

    // Don't retry on governor limit errors (except rate limits)
    if (this.isLimitError(error) && !this.isRateLimitError(error)) {
      return false;
    }

    // Retry on network errors
    if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
      return true;
    }

    return false;
  }

  private isLimitError(error: any): boolean {
    const limitErrors = [
      'REQUEST_LIMIT_EXCEEDED',
      'API_CURRENTLY_DISABLED',
      'API_DISABLED_FOR_ORG',
      'CONCURRENT_API_REQUESTS_LIMIT',
      'DAILY_API_REQUESTS_LIMIT',
      'STORAGE_LIMIT_EXCEEDED',
      'APEX_CPU_LIMIT',
      'APEX_HEAP_SIZE_LIMIT',
    ];

    return limitErrors.some(
      (limitError) => error.message?.includes(limitError) || error.errorCode === limitError
    );
  }

  private isRateLimitError(error: any): boolean {
    return (
      error.message?.includes('REQUEST_LIMIT_EXCEEDED') ||
      error.message?.includes('TooManyRequests') ||
      error.statusCode === 429
    );
  }

  private extractLimitType(error: any): string | null {
    const message = error.message || '';

    if (message.includes('DAILY_API_REQUESTS_LIMIT')) {
      return 'DailyApiRequests';
    }
    if (message.includes('CONCURRENT_API_REQUESTS_LIMIT')) {
      return 'ConcurrentApiRequests';
    }
    if (message.includes('STORAGE_LIMIT_EXCEEDED')) {
      return 'Storage';
    }
    if (message.includes('APEX_CPU_LIMIT')) {
      return 'ApexCPU';
    }
    if (message.includes('APEX_HEAP_SIZE_LIMIT')) {
      return 'ApexHeap';
    }

    return null;
  }
}

interface CachedLimits {
  limits: OrgLimits;
  timestamp: number;
}

// Custom error types for specific limit violations
export class ApiLimitExceededError extends GovernorLimitError {
  constructor(remaining: number, required: number) {
    super(
      `API limit exceeded. Remaining: ${remaining}, Required: ${required}`,
      'DailyApiRequests',
      { Max: 0, Remaining: remaining, Used: 0 }
    );
  }
}

export class StorageLimitExceededError extends GovernorLimitError {
  constructor(type: 'data' | 'file', remaining: number, required: number) {
    super(
      `${type === 'data' ? 'Data' : 'File'} storage limit exceeded. Remaining: ${remaining}MB, Required: ${required}MB`,
      type === 'data' ? 'DataStorageMB' : 'FileStorageMB',
      { Max: 0, Remaining: remaining, Used: 0 }
    );
  }
}

export class ConcurrentRequestLimitError extends GovernorLimitError {
  constructor(message: string = 'Concurrent request limit exceeded') {
    super(message, 'ConcurrentApiRequests');
  }
}
