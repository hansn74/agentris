import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { salesforceRouter } from './salesforce';
import { TRPCError } from '@trpc/server';
import { createInnerTRPCContext } from '../trpc';
import { z } from 'zod';

// Define OrgType directly for tests
const OrgType = {
  PRODUCTION: 'PRODUCTION' as const,
  SANDBOX: 'SANDBOX' as const
};

vi.mock('@agentris/integrations-salesforce', () => {
  const { z } = require('zod');
  return {
    OrgType: {
      PRODUCTION: 'PRODUCTION',
      SANDBOX: 'SANDBOX'
    },
    OrgTypeSchema: z.enum(['PRODUCTION', 'SANDBOX']),
    SalesforceAuthService: vi.fn().mockImplementation(() => ({
    getAuthorizationUrl: vi.fn().mockReturnValue('https://salesforce.com/auth'),
    authenticate: vi.fn().mockResolvedValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      instanceUrl: 'https://test.salesforce.com',
      issuedAt: new Date().toISOString()
    }),
    getIdentity: vi.fn().mockResolvedValue({
      username: 'test@example.com',
      email: 'test@example.com',
      displayName: 'Test User',
      organizationId: 'org-123'
    }),
    encryptTokens: vi.fn().mockReturnValue('encrypted-tokens'),
    decryptTokens: vi.fn().mockReturnValue({
      accessToken: 'access-token',
      refreshToken: 'refresh-token'
    }),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'refresh-token',
      issuedAt: new Date().toISOString()
    })
  })),
  ConnectionManager: vi.fn().mockImplementation(() => ({
    addOrganization: vi.fn().mockResolvedValue({
      id: '1',
      orgId: 'org-123',
      name: 'Test Org',
      instanceUrl: 'https://test.salesforce.com',
      type: 'PRODUCTION'
    }),
    listOrganizations: vi.fn().mockResolvedValue([]),
    getOrganization: vi.fn(),
    removeOrganization: vi.fn().mockResolvedValue(true),
    testConnection: vi.fn().mockResolvedValue({
      success: true,
      message: 'Connection successful',
      identity: {
        username: 'test@example.com',
        email: 'test@example.com',
        displayName: 'Test User',
        organizationId: 'org-123'
      }
    })
  })),
  TokenRefreshService: vi.fn().mockImplementation(() => ({
    refreshTokenForOrganization: vi.fn().mockResolvedValue(undefined),
    checkTokenExpiry: vi.fn().mockResolvedValue(false),
    refreshToken: vi.fn().mockResolvedValue(undefined)
  }))
  };
});
vi.mock('crypto', () => ({
  default: {
    randomBytes: vi.fn(() => ({
      toString: vi.fn(() => 'test-state-123')
    }))
  }
}));

vi.mock('../services/salesforce-state', () => ({
  SalesforceStateService: vi.fn().mockImplementation(() => ({
    createState: vi.fn().mockResolvedValue('test-state-123'),
    validateState: vi.fn().mockResolvedValue({ valid: true, orgType: 'PRODUCTION' }),
    cleanupExpiredStates: vi.fn().mockResolvedValue(0),
    startCleanupSchedule: vi.fn()
  }))
}));

vi.mock('../services/security-events', () => ({
  SecurityEventService: vi.fn().mockImplementation(() => ({
    logEvent: vi.fn().mockResolvedValue(undefined)
  })),
  AuthEventType: {
    AUTH_SUCCESS: 'AUTH_SUCCESS',
    AUTH_FAILURE: 'AUTH_FAILURE',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
    INVALID_STATE_TOKEN: 'INVALID_STATE_TOKEN',
    TOKEN_REFRESH_SUCCESS: 'TOKEN_REFRESH_SUCCESS',
    TOKEN_REFRESH_FAILURE: 'TOKEN_REFRESH_FAILURE',
    SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY'
  }
}));

describe('salesforceRouter', () => {
  let ctx: any;
  let caller: any;

  beforeEach(() => {
    ctx = {
      session: {
        user: {
          id: 'user-123',
          email: 'test@example.com'
        }
      },
      req: {
        headers: {
          'user-agent': 'test-agent',
          'x-forwarded-for': '127.0.0.1'
        },
        socket: {
          remoteAddress: '127.0.0.1'
        }
      },
      prisma: {
        user: {
          update: vi.fn()
        },
        salesforceOrganization: {
          findMany: vi.fn(),
          findUnique: vi.fn(),
          upsert: vi.fn(),
          update: vi.fn(),
          delete: vi.fn(),
          create: vi.fn(),
          deleteMany: vi.fn()
        },
        salesforceOAuthState: {
          create: vi.fn(),
          findUnique: vi.fn(),
          delete: vi.fn(),
          deleteMany: vi.fn()
        },
        authSecurityEvent: {
          create: vi.fn(),
          findMany: vi.fn(),
          count: vi.fn(),
          deleteMany: vi.fn()
        }
      }
    };

    const innerContext = createInnerTRPCContext({
      session: ctx.session
    });
    
    caller = salesforceRouter.createCaller({
      ...innerContext,
      prisma: ctx.prisma,
      req: ctx.req
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('connect', () => {
    it('should initiate Salesforce connection', async () => {
      ctx.prisma.user.update.mockResolvedValue({});

      const result = await caller.connect({
        orgType: OrgType.PRODUCTION
      });

      expect(result).toHaveProperty('authUrl');
      expect(result).toHaveProperty('state');
      expect(ctx.prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        data: { lastActive: expect.any(Date) }
      });
    });

    it('should handle connection initiation errors', async () => {
      ctx.prisma.user.update.mockRejectedValue(new Error('Database error'));

      await expect(
        caller.connect({ orgType: OrgType.PRODUCTION })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('listOrgs', () => {
    it('should list user organizations', async () => {
      const mockOrgs = [
        {
          id: '1',
          orgId: 'org-1',
          name: 'Org 1',
          instanceUrl: 'https://org1.salesforce.com',
          type: 'PRODUCTION',
          lastSync: null,
          createdAt: new Date()
        }
      ];

      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        listOrganizations: vi.fn().mockResolvedValue(mockOrgs)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      const result = await caller.listOrgs();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        orgId: 'org-1',
        name: 'Org 1'
      });
    });

    it('should handle list organizations errors', async () => {
      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        listOrganizations: vi.fn().mockRejectedValue(new Error('Database error'))
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      await expect(caller.listOrgs()).rejects.toThrow(TRPCError);
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Connection successful',
        identity: {
          username: 'test@example.com',
          email: 'test@example.com',
          displayName: 'Test User',
          organizationId: 'org-123'
        }
      };

      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        testConnection: vi.fn().mockResolvedValue(mockResult)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      const result = await caller.testConnection({ orgId: 'org-123' });

      expect(result.success).toBe(true);
      expect(result.identity).toBeDefined();
    });

    it('should handle connection test failures', async () => {
      const mockResult = {
        success: false,
        message: 'Connection failed'
      };

      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        testConnection: vi.fn().mockResolvedValue(mockResult)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      const result = await caller.testConnection({ orgId: 'org-123' });

      expect(result.success).toBe(false);
      expect(result.message).toBe('Connection failed');
    });
  });

  describe('disconnect', () => {
    it('should disconnect organization successfully', async () => {
      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        removeOrganization: vi.fn().mockResolvedValue(true)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      const result = await caller.disconnect({ orgId: 'org-123' });

      expect(result.success).toBe(true);
    });

    it('should handle organization not found', async () => {
      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        removeOrganization: vi.fn().mockResolvedValue(false)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      await expect(
        caller.disconnect({ orgId: 'org-123' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const MockTokenRefreshService = vi.fn().mockImplementation(() => ({
        refreshTokenForOrganization: vi.fn().mockResolvedValue(undefined)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).TokenRefreshService = MockTokenRefreshService;

      const result = await caller.refreshToken({ orgId: 'org-123' });

      expect(result.success).toBe(true);
    });

    it('should handle token refresh errors', async () => {
      const MockTokenRefreshService = vi.fn().mockImplementation(() => ({
        refreshTokenForOrganization: vi.fn().mockRejectedValue(new Error('Refresh failed'))
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).TokenRefreshService = MockTokenRefreshService;

      await expect(
        caller.refreshToken({ orgId: 'org-123' })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('getOrgDetails', () => {
    it('should get organization details', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        name: 'Test Org',
        instanceUrl: 'https://test.salesforce.com',
        type: 'PRODUCTION',
        lastSync: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const mockConnectionTest = {
        success: true,
        identity: {
          username: 'test@example.com',
          email: 'test@example.com',
          displayName: 'Test User',
          organizationId: 'org-123'
        }
      };

      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        getOrganization: vi.fn().mockResolvedValue(mockOrg),
        testConnection: vi.fn().mockResolvedValue(mockConnectionTest)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      const result = await caller.getOrgDetails({ orgId: 'org-123' });

      expect(result.orgId).toBe('org-123');
      expect(result.isConnected).toBe(true);
      expect(result.identity).toBeDefined();
    });

    it('should handle organization not found', async () => {
      const MockConnectionManager = vi.fn().mockImplementation(() => ({
        getOrganization: vi.fn().mockResolvedValue(null)
      }));

      vi.mocked(require('@agentris/integrations-salesforce')).ConnectionManager = MockConnectionManager;

      await expect(
        caller.getOrgDetails({ orgId: 'org-123' })
      ).rejects.toThrow(TRPCError);
    });
  });
});