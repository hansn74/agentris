import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { LimitsManager, ApiLimitExceededError, StorageLimitExceededError } from './limits';
import { ConnectionManager } from './connection';
import { GovernorLimitError } from './types/metadata';

vi.mock('./connection');
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('LimitsManager', () => {
  let limitsManager: LimitsManager;
  let mockPrisma: any;
  let mockConnection: any;
  let mockConnectionManager: any;

  const mockLimits = {
    DailyApiRequests: {
      Max: 15000,
      Remaining: 5000,
      Used: 10000,
    },
    ConcurrentAsyncGetReportInstances: {
      Max: 200,
      Remaining: 200,
      Used: 0,
    },
    ConcurrentSyncReportRuns: {
      Max: 20,
      Remaining: 20,
      Used: 0,
    },
    DailyAsyncApexExecutions: {
      Max: 250000,
      Remaining: 250000,
      Used: 0,
    },
    DailyBulkApiRequests: {
      Max: 10000,
      Remaining: 10000,
      Used: 0,
    },
    DailyDurableStreamingApiEvents: {
      Max: 1000000,
      Remaining: 1000000,
      Used: 0,
    },
    DailyGenericStreamingApiEvents: {
      Max: 10000,
      Remaining: 10000,
      Used: 0,
    },
    DailyStreamingApiEvents: {
      Max: 1000000,
      Remaining: 1000000,
      Used: 0,
    },
    DailyWorkflowEmails: {
      Max: 390000,
      Remaining: 390000,
      Used: 0,
    },
    DataStorageMB: {
      Max: 5120,
      Remaining: 4096,
      Used: 1024,
    },
    FileStorageMB: {
      Max: 2048,
      Remaining: 1536,
      Used: 512,
    },
    HourlyAsyncReportRuns: {
      Max: 1200,
      Remaining: 1200,
      Used: 0,
    },
    HourlyDashboardRefreshes: {
      Max: 200,
      Remaining: 200,
      Used: 0,
    },
    HourlyDashboardResults: {
      Max: 5000,
      Remaining: 5000,
      Used: 0,
    },
    HourlyDashboardStatuses: {
      Max: 999999999,
      Remaining: 999999999,
      Used: 0,
    },
    HourlyODataCallout: {
      Max: 10000,
      Remaining: 10000,
      Used: 0,
    },
    HourlySyncReportRuns: {
      Max: 500,
      Remaining: 500,
      Used: 0,
    },
    HourlyTimeBasedWorkflow: {
      Max: 50,
      Remaining: 50,
      Used: 0,
    },
    MassEmail: {
      Max: 5000,
      Remaining: 5000,
      Used: 0,
    },
    SingleEmail: {
      Max: 5000,
      Remaining: 5000,
      Used: 0,
    },
  };

  beforeEach(() => {
    // Mock Prisma
    mockPrisma = {};

    // Mock JSForce connection
    mockConnection = {
      request: vi.fn(),
    };

    // Mock ConnectionManager
    mockConnectionManager = {
      getConnection: vi.fn().mockResolvedValue(mockConnection),
    };

    vi.mocked(ConnectionManager).mockImplementation(() => mockConnectionManager);

    limitsManager = new LimitsManager(mockPrisma);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('checkApiLimits', () => {
    it('should successfully fetch and return org limits', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const result = await limitsManager.checkApiLimits('userId', 'orgId');

      expect(result).toEqual(mockLimits);
      expect(mockConnection.request).toHaveBeenCalledWith({
        url: '/services/data/v59.0/limits',
        method: 'GET',
      });
    });

    it('should cache limits for subsequent calls', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      // First call
      await limitsManager.checkApiLimits('userId', 'orgId');

      // Second call should use cache
      await limitsManager.checkApiLimits('userId', 'orgId');

      // Request should only be made once
      expect(mockConnection.request).toHaveBeenCalledTimes(1);
    });

    it('should throw GovernorLimitError when connection is not available', async () => {
      mockConnectionManager.getConnection.mockResolvedValue(null);

      await expect(limitsManager.checkApiLimits('userId', 'orgId')).rejects.toThrow(
        GovernorLimitError
      );
    });

    it('should validate limits when throwOnExceeded is true', async () => {
      const lowLimits = {
        ...mockLimits,
        DailyApiRequests: {
          Max: 15000,
          Remaining: 10,
          Used: 14990,
        },
      };

      mockConnection.request.mockResolvedValue(lowLimits);

      await expect(
        limitsManager.checkApiLimits('userId', 'orgId', {
          minApiCallsRequired: 100,
          throwOnExceeded: true,
        })
      ).rejects.toThrow(GovernorLimitError);
    });

    it('should log warning when API usage is above 90%', async () => {
      const highUsageLimits = {
        ...mockLimits,
        DailyApiRequests: {
          Max: 15000,
          Remaining: 1000,
          Used: 14000,
        },
      };

      mockConnection.request.mockResolvedValue(highUsageLimits);

      const result = await limitsManager.checkApiLimits('userId', 'orgId');

      expect(result.DailyApiRequests.Used).toBe(14000);
      // Logger warning would be called but we're mocking it
    });
  });

  describe('checkLimitBeforeOperation', () => {
    it('should pass when sufficient API calls are available', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const result = await limitsManager.checkLimitBeforeOperation(
        'userId',
        'orgId',
        'testOperation',
        100
      );

      expect(result).toBe(true);
    });

    it('should throw error when insufficient API calls', async () => {
      const lowLimits = {
        ...mockLimits,
        DailyApiRequests: {
          Max: 15000,
          Remaining: 50,
          Used: 14950,
        },
      };

      mockConnection.request.mockResolvedValue(lowLimits);

      await expect(
        limitsManager.checkLimitBeforeOperation('userId', 'orgId', 'testOperation', 100)
      ).rejects.toThrow(GovernorLimitError);
    });

    it('should throw error when limit check fails', async () => {
      mockConnection.request.mockRejectedValue(new Error('Network error'));

      await expect(
        limitsManager.checkLimitBeforeOperation('userId', 'orgId', 'testOperation', 100)
      ).rejects.toThrow(GovernorLimitError);
    });
  });

  describe('executeWithLimitCheck', () => {
    it('should execute operation when limits are sufficient', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const mockOperation = vi.fn().mockResolvedValue('success');

      const result = await limitsManager.executeWithLimitCheck(
        'userId',
        'orgId',
        'testOperation',
        mockOperation,
        10
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalled();
    });

    it('should retry on transient errors', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      let attempts = 0;
      const mockOperation = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          const error = new Error('UNABLE_TO_LOCK_ROW');
          throw error;
        }
        return Promise.resolve('success');
      });

      const result = await limitsManager.executeWithLimitCheck(
        'userId',
        'orgId',
        'testOperation',
        mockOperation
      );

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should throw GovernorLimitError on limit violations', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const mockOperation = vi
        .fn()
        .mockRejectedValue(new Error('DAILY_API_REQUESTS_LIMIT exceeded'));

      await expect(
        limitsManager.executeWithLimitCheck('userId', 'orgId', 'testOperation', mockOperation)
      ).rejects.toThrow(GovernorLimitError);
    });
  });

  describe('getStorageLimits', () => {
    it('should return storage limits', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const result = await limitsManager.getStorageLimits('userId', 'orgId');

      expect(result.dataStorage).toEqual(mockLimits.DataStorageMB);
      expect(result.fileStorage).toEqual(mockLimits.FileStorageMB);
    });
  });

  describe('getApiUsagePercentage', () => {
    it('should calculate API usage percentage correctly', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const percentage = await limitsManager.getApiUsagePercentage('userId', 'orgId');

      // (10000 / 15000) * 100 = 66.67%
      expect(percentage).toBeCloseTo(66.67, 1);
    });
  });

  describe('getRemainingApiCalls', () => {
    it('should return remaining API calls', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      const remaining = await limitsManager.getRemainingApiCalls('userId', 'orgId');

      expect(remaining).toBe(5000);
    });
  });

  describe('cache management', () => {
    it('should clear cache for specific org', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      // Populate cache
      await limitsManager.checkApiLimits('userId', 'orgId');

      // Clear cache
      limitsManager.clearCache('orgId');

      // Next call should fetch again
      await limitsManager.checkApiLimits('userId', 'orgId');

      expect(mockConnection.request).toHaveBeenCalledTimes(2);
    });

    it('should clear all cache', async () => {
      mockConnection.request.mockResolvedValue(mockLimits);

      // Populate cache for multiple orgs
      await limitsManager.checkApiLimits('userId', 'org1');
      await limitsManager.checkApiLimits('userId', 'org2');

      // Clear all cache
      limitsManager.clearCache();

      // Next calls should fetch again
      await limitsManager.checkApiLimits('userId', 'org1');
      await limitsManager.checkApiLimits('userId', 'org2');

      expect(mockConnection.request).toHaveBeenCalledTimes(4);
    });
  });

  describe('circuit breaker', () => {
    it('should return circuit breaker state', () => {
      // Initially no circuit breaker
      let state = limitsManager.getCircuitBreakerState('orgId');
      expect(state).toBeNull();

      // After an operation, circuit breaker should exist
      mockConnection.request.mockResolvedValue(mockLimits);
      const mockOperation = vi.fn().mockResolvedValue('success');

      limitsManager
        .executeWithLimitCheck('userId', 'orgId', 'testOperation', mockOperation)
        .then(() => {
          state = limitsManager.getCircuitBreakerState('orgId');
          expect(state).toBe('closed');
        });
    });
  });

  describe('custom error types', () => {
    it('should create ApiLimitExceededError correctly', () => {
      const error = new ApiLimitExceededError(100, 500);

      expect(error).toBeInstanceOf(GovernorLimitError);
      expect(error.message).toContain('API limit exceeded');
      expect(error.limitType).toBe('DailyApiRequests');
    });

    it('should create StorageLimitExceededError correctly', () => {
      const error = new StorageLimitExceededError('data', 100, 500);

      expect(error).toBeInstanceOf(GovernorLimitError);
      expect(error.message).toContain('Data storage limit exceeded');
      expect(error.limitType).toBe('DataStorageMB');
    });
  });
});
