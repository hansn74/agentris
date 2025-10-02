import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { TokenRefreshService } from './token-refresh';
import { TokenRefreshError } from './types';
import { PrismaClient } from '@prisma/client';

vi.mock('./auth');
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('TokenRefreshService', () => {
  let tokenRefreshService: TokenRefreshService;
  let mockPrisma: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    mockPrisma = {
      salesforceOrganization: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.SALESFORCE_CLIENT_ID = 'test-client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'test-client-secret';
    process.env.SALESFORCE_REDIRECT_URI = 'http://localhost:3000/callback';

    tokenRefreshService = new TokenRefreshService(mockPrisma as PrismaClient);
  });

  afterEach(() => {
    vi.useRealTimers();
    tokenRefreshService.stopScheduledRefresh();
  });

  describe('checkTokenExpiry', () => {
    it('should return true if token is expiring soon', async () => {
      const oldIssuedAt = new Date(Date.now() - 6600000).toISOString(); // 1h 50min ago
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        refreshToken: 'encrypted-token',
        instanceUrl: 'https://test.salesforce.com',
      };

      const mockAuthService = {
        decryptTokens: vi.fn().mockReturnValue({
          issuedAt: oldIssuedAt,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      };

      (tokenRefreshService as any).authService = mockAuthService;

      const result = await tokenRefreshService.checkTokenExpiry(mockOrg as any);

      expect(result).toBe(true);
    });

    it('should return false if token is not expiring soon', async () => {
      const recentIssuedAt = new Date().toISOString();
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        refreshToken: 'encrypted-token',
      };

      const mockAuthService = {
        decryptTokens: vi.fn().mockReturnValue({
          issuedAt: recentIssuedAt,
          accessToken: 'access-token',
          refreshToken: 'refresh-token',
        }),
      };

      (tokenRefreshService as any).authService = mockAuthService;

      const result = await tokenRefreshService.checkTokenExpiry(mockOrg as any);

      expect(result).toBe(false);
    });

    it('should return true if decryption fails', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        refreshToken: 'encrypted-token',
      };

      const mockAuthService = {
        decryptTokens: vi.fn().mockImplementation(() => {
          throw new Error('Decryption failed');
        }),
      };

      (tokenRefreshService as any).authService = mockAuthService;

      const result = await tokenRefreshService.checkTokenExpiry(mockOrg as any);

      expect(result).toBe(true);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        name: 'Test Org',
        instanceUrl: 'https://test.salesforce.com',
        refreshToken: 'encrypted-old-token',
      };

      const mockTokens = {
        accessToken: 'old-access-token',
        refreshToken: 'refresh-token',
        instanceUrl: 'https://test.salesforce.com',
      };

      const mockRefreshedTokens = {
        accessToken: 'new-access-token',
        refreshToken: 'refresh-token',
        instanceUrl: 'https://test.salesforce.com',
        issuedAt: new Date().toISOString(),
      };

      const mockAuthService = {
        decryptTokens: vi.fn().mockReturnValue(mockTokens),
        refreshAccessToken: vi.fn().mockResolvedValue(mockRefreshedTokens),
        encryptTokens: vi.fn().mockReturnValue('encrypted-new-token'),
      };

      (tokenRefreshService as any).authService = mockAuthService;
      mockPrisma.salesforceOrganization.update.mockResolvedValue(mockOrg);

      await tokenRefreshService.refreshToken(mockOrg as any);

      expect(mockAuthService.refreshAccessToken).toHaveBeenCalledWith(
        'refresh-token',
        'https://test.salesforce.com'
      );

      expect(mockPrisma.salesforceOrganization.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: {
          refreshToken: 'encrypted-new-token',
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should throw TokenRefreshError on failure after retries', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        refreshToken: 'encrypted-token',
        instanceUrl: 'https://test.salesforce.com',
        name: 'Test Org',
      };

      const mockAuthService = {
        decryptTokens: vi.fn().mockReturnValue({
          refreshToken: 'refresh-token',
        }),
        refreshAccessToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
        encryptTokens: vi.fn(),
      };

      (tokenRefreshService as any).authService = mockAuthService;

      // Run the test with real timers to avoid async issues
      vi.useRealTimers();

      // Mock setTimeout to make it instant
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = ((fn: any) => fn()) as any;

      try {
        await expect(tokenRefreshService.refreshToken(mockOrg as any)).rejects.toThrow(
          TokenRefreshError
        );

        // Verify it was called 4 times (initial + 3 retries)
        expect(mockAuthService.refreshAccessToken).toHaveBeenCalledTimes(4);
      } finally {
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
        vi.useFakeTimers();
      }
    });
  });

  describe('refreshExpiredTokens', () => {
    it('should refresh all expired tokens', async () => {
      const mockOrgs = [
        {
          id: '1',
          orgId: 'org-1',
          refreshToken: 'encrypted-1',
        },
        {
          id: '2',
          orgId: 'org-2',
          refreshToken: 'encrypted-2',
        },
      ];

      mockPrisma.salesforceOrganization.findMany.mockResolvedValue(mockOrgs);

      const checkTokenExpirySpy = vi
        .spyOn(tokenRefreshService, 'checkTokenExpiry')
        .mockResolvedValue(true);

      const refreshTokenSpy = vi
        .spyOn(tokenRefreshService, 'refreshToken')
        .mockResolvedValue(undefined);

      await tokenRefreshService.refreshExpiredTokens();

      expect(mockPrisma.salesforceOrganization.findMany).toHaveBeenCalledWith({
        where: { refreshToken: { not: { equals: '' } } },
      });

      expect(checkTokenExpirySpy).toHaveBeenCalledTimes(2);
      expect(refreshTokenSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle errors for individual organizations', async () => {
      const mockOrgs = [
        {
          id: '1',
          orgId: 'org-1',
          refreshToken: 'encrypted-1',
        },
      ];

      mockPrisma.salesforceOrganization.findMany.mockResolvedValue(mockOrgs);

      const checkTokenExpirySpy = vi
        .spyOn(tokenRefreshService, 'checkTokenExpiry')
        .mockRejectedValue(new Error('Check failed'));

      await tokenRefreshService.refreshExpiredTokens();

      expect(checkTokenExpirySpy).toHaveBeenCalled();
    });
  });

  describe('startScheduledRefresh', () => {
    it('should start scheduled refresh', () => {
      const refreshExpiredTokensSpy = vi
        .spyOn(tokenRefreshService, 'refreshExpiredTokens')
        .mockResolvedValue(undefined);

      tokenRefreshService.startScheduledRefresh();

      expect(refreshExpiredTokensSpy).toHaveBeenCalled();

      vi.advanceTimersByTime(30 * 60 * 1000);

      expect(refreshExpiredTokensSpy).toHaveBeenCalledTimes(2);
    });

    it('should not start if already running', () => {
      tokenRefreshService.startScheduledRefresh();

      const initialInterval = (tokenRefreshService as any).refreshInterval;

      tokenRefreshService.startScheduledRefresh();

      expect((tokenRefreshService as any).refreshInterval).toBe(initialInterval);
    });
  });

  describe('stopScheduledRefresh', () => {
    it('should stop scheduled refresh', () => {
      tokenRefreshService.startScheduledRefresh();

      expect((tokenRefreshService as any).refreshInterval).not.toBeNull();

      tokenRefreshService.stopScheduledRefresh();

      expect((tokenRefreshService as any).refreshInterval).toBeNull();
    });
  });

  describe('refreshTokenForUser', () => {
    it('should refresh tokens for all user organizations', async () => {
      const userId = 'user-123';
      const mockOrgs = [
        {
          id: '1',
          orgId: 'org-1',
          userId,
          refreshToken: 'encrypted-1',
        },
        {
          id: '2',
          orgId: 'org-2',
          userId,
          refreshToken: 'encrypted-2',
        },
      ];

      mockPrisma.salesforceOrganization.findMany.mockResolvedValue(mockOrgs);

      const checkTokenExpirySpy = vi
        .spyOn(tokenRefreshService, 'checkTokenExpiry')
        .mockResolvedValue(true);

      const refreshTokenSpy = vi
        .spyOn(tokenRefreshService, 'refreshToken')
        .mockResolvedValue(undefined);

      await tokenRefreshService.refreshTokenForUser(userId);

      expect(mockPrisma.salesforceOrganization.findMany).toHaveBeenCalledWith({
        where: { userId },
      });

      expect(checkTokenExpirySpy).toHaveBeenCalledTimes(2);
      expect(refreshTokenSpy).toHaveBeenCalledTimes(2);
    });

    it('should handle no organizations found', async () => {
      const userId = 'user-123';

      mockPrisma.salesforceOrganization.findMany.mockResolvedValue([]);

      await tokenRefreshService.refreshTokenForUser(userId);

      expect(mockPrisma.salesforceOrganization.findMany).toHaveBeenCalledWith({
        where: { userId },
      });
    });
  });

  describe('refreshTokenForOrganization', () => {
    it('should refresh token for specific organization', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockOrg = {
        id: '1',
        orgId,
        userId,
        refreshToken: 'encrypted-token',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);

      const checkTokenExpirySpy = vi
        .spyOn(tokenRefreshService, 'checkTokenExpiry')
        .mockResolvedValue(true);

      const refreshTokenSpy = vi
        .spyOn(tokenRefreshService, 'refreshToken')
        .mockResolvedValue(undefined);

      await tokenRefreshService.refreshTokenForOrganization(userId, orgId);

      expect(mockPrisma.salesforceOrganization.findUnique).toHaveBeenCalledWith({
        where: {
          userId_orgId: {
            userId,
            orgId,
          },
        },
      });

      expect(checkTokenExpirySpy).toHaveBeenCalledWith(mockOrg);
      expect(refreshTokenSpy).toHaveBeenCalledWith(mockOrg);
    });

    it('should throw error if organization not found', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(null);

      await expect(tokenRefreshService.refreshTokenForOrganization(userId, orgId)).rejects.toThrow(
        TokenRefreshError
      );
    });

    it('should not refresh if token is not expiring', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockOrg = {
        id: '1',
        orgId,
        userId,
        refreshToken: 'encrypted-token',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);

      const checkTokenExpirySpy = vi
        .spyOn(tokenRefreshService, 'checkTokenExpiry')
        .mockResolvedValue(false);

      const refreshTokenSpy = vi
        .spyOn(tokenRefreshService, 'refreshToken')
        .mockResolvedValue(undefined);

      await tokenRefreshService.refreshTokenForOrganization(userId, orgId);

      expect(checkTokenExpirySpy).toHaveBeenCalledWith(mockOrg);
      expect(refreshTokenSpy).not.toHaveBeenCalled();
    });
  });

  describe('setCheckInterval', () => {
    it('should update check interval', () => {
      const newInterval = 60 * 60 * 1000; // 1 hour

      tokenRefreshService.setCheckInterval(newInterval);

      expect((tokenRefreshService as any).checkIntervalMs).toBe(newInterval);
    });

    it('should restart scheduled refresh if running', () => {
      tokenRefreshService.startScheduledRefresh();

      const stopSpy = vi.spyOn(tokenRefreshService, 'stopScheduledRefresh');
      const startSpy = vi.spyOn(tokenRefreshService, 'startScheduledRefresh');

      tokenRefreshService.setCheckInterval(60 * 60 * 1000);

      expect(stopSpy).toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalled();
    });
  });

  describe('setTokenExpiryThreshold', () => {
    it('should update token expiry threshold', () => {
      const newThreshold = 30 * 60 * 1000; // 30 minutes

      tokenRefreshService.setTokenExpiryThreshold(newThreshold);

      expect((tokenRefreshService as any).tokenExpiryThresholdMs).toBe(newThreshold);
    });
  });
});
