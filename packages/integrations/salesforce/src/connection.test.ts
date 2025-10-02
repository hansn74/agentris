import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ConnectionManager } from './connection';
import { OrgType } from './types';
import { PrismaClient } from '@prisma/client';
import jsforce from 'jsforce';

vi.mock('jsforce', () => ({
  default: {
    Connection: vi.fn(),
  },
}));

vi.mock('./auth', () => ({
  SalesforceAuthService: vi.fn().mockImplementation(() => ({
    encryptTokens: vi.fn().mockReturnValue('encrypted-token-data'),
    decryptTokens: vi.fn().mockReturnValue({
      accessToken: 'decrypted-access-token',
      refreshToken: 'decrypted-refresh-token',
      instanceUrl: 'https://test.salesforce.com',
      id: 'user-id',
      issuedAt: new Date().toISOString(),
      signature: 'signature',
      scope: 'api refresh_token',
    }),
    validateTokenExpiry: vi.fn().mockReturnValue(true),
    refreshAccessToken: vi.fn().mockResolvedValue({
      accessToken: 'refreshed-access-token',
      refreshToken: 'refresh-token',
      instanceUrl: 'https://test.salesforce.com',
      id: 'user-id',
      issuedAt: new Date().toISOString(),
      signature: 'signature',
      scope: 'api refresh_token',
    }),
  })),
}));
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      salesforceOrganization: {
        upsert: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
    };

    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.SALESFORCE_CLIENT_ID = 'test-client-id';
    process.env.SALESFORCE_CLIENT_SECRET = 'test-client-secret';
    process.env.SALESFORCE_REDIRECT_URI = 'http://localhost:3000/callback';

    connectionManager = new ConnectionManager(mockPrisma as PrismaClient);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('addOrganization', () => {
    it('should add a new organization', async () => {
      const userId = 'user-123';
      const tokens = {
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        instanceUrl: 'https://test.salesforce.com',
        id: 'id-123',
        issuedAt: new Date().toISOString(),
        signature: 'signature',
      };
      const identity = {
        id: 'user-id',
        organizationId: 'org-123',
        url: 'https://test.salesforce.com',
        userId: 'user-id',
        username: 'test@example.com',
        displayName: 'Test User',
        email: 'test@example.com',
      };

      const mockOrg = {
        id: 'org-record-123',
        orgId: 'org-123',
        name: 'Test User',
        instanceUrl: 'https://test.salesforce.com',
        type: 'PRODUCTION',
        userId,
      };

      mockPrisma.salesforceOrganization.upsert.mockResolvedValue(mockOrg);

      const result = await connectionManager.addOrganization(
        userId,
        tokens,
        identity,
        OrgType.PRODUCTION
      );

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.salesforceOrganization.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_orgId: {
              userId,
              orgId: 'org-123',
            },
          },
        })
      );
    });

    it('should handle errors when adding organization', async () => {
      mockPrisma.salesforceOrganization.upsert.mockRejectedValue(new Error('Database error'));

      await expect(
        connectionManager.addOrganization('user-123', {} as any, {} as any, OrgType.PRODUCTION)
      ).rejects.toThrow('Failed to store organization');
    });
  });

  describe('listOrganizations', () => {
    it('should list all organizations for a user', async () => {
      const userId = 'user-123';
      const mockOrgs = [
        { id: '1', orgId: 'org-1', name: 'Org 1' },
        { id: '2', orgId: 'org-2', name: 'Org 2' },
      ];

      mockPrisma.salesforceOrganization.findMany.mockResolvedValue(mockOrgs);

      const result = await connectionManager.listOrganizations(userId);

      expect(result).toEqual(mockOrgs);
      expect(mockPrisma.salesforceOrganization.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should handle errors when listing organizations', async () => {
      mockPrisma.salesforceOrganization.findMany.mockRejectedValue(new Error('Database error'));

      await expect(connectionManager.listOrganizations('user-123')).rejects.toThrow(
        'Failed to retrieve organizations'
      );
    });
  });

  describe('getOrganization', () => {
    it('should get a specific organization', async () => {
      const userId = 'user-123';
      const orgId = 'org-123';
      const mockOrg = {
        id: '1',
        orgId,
        name: 'Test Org',
        userId,
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);

      const result = await connectionManager.getOrganization(userId, orgId);

      expect(result).toEqual(mockOrg);
      expect(mockPrisma.salesforceOrganization.findUnique).toHaveBeenCalledWith({
        where: {
          userId_orgId: {
            userId,
            orgId,
          },
        },
      });
    });

    it('should return null if organization not found', async () => {
      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(null);

      const result = await connectionManager.getOrganization('user-123', 'org-123');

      expect(result).toBeNull();
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        name: 'Test Org',
        instanceUrl: 'https://test.salesforce.com',
        refreshToken: 'encrypted-token',
        userId: 'user-123',
      };

      const mockIdentity = {
        user_id: 'user-id',
        organization_id: 'org-123',
        url: 'https://test.salesforce.com',
        username: 'test@example.com',
        display_name: 'Test User',
        email: 'test@example.com',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.salesforceOrganization.update.mockResolvedValue(mockOrg);

      const mockConnection = {
        identity: vi.fn().mockResolvedValue(mockIdentity),
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const result = await connectionManager.testConnection('user-123', 'org-123');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Connection successful');
      expect(result.identity).toBeDefined();
    });

    it('should return failure if organization not found', async () => {
      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(null);

      const result = await connectionManager.testConnection('user-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Organization not found');
    });

    it('should handle connection errors', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        refreshToken: 'encrypted-token',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);

      const mockConnection = {
        identity: vi.fn().mockRejectedValue(new Error('Connection failed')),
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const result = await connectionManager.testConnection('user-123', 'org-123');

      expect(result.success).toBe(false);
      expect(result.message).toContain('Connection failed');
    });
  });

  describe('removeOrganization', () => {
    it('should remove an organization', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        userId: 'user-123',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.salesforceOrganization.delete.mockResolvedValue(mockOrg);

      const result = await connectionManager.removeOrganization('user-123', 'org-123');

      expect(result).toBe(true);
      expect(mockPrisma.salesforceOrganization.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should return false if organization not found', async () => {
      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(null);

      const result = await connectionManager.removeOrganization('user-123', 'org-123');

      expect(result).toBe(false);
      expect(mockPrisma.salesforceOrganization.delete).not.toHaveBeenCalled();
    });

    it('should handle errors when removing organization', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.salesforceOrganization.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(connectionManager.removeOrganization('user-123', 'org-123')).rejects.toThrow(
        'Failed to remove organization'
      );
    });
  });

  describe('getConnection', () => {
    it('should get a JSForce connection', async () => {
      const mockOrg = {
        id: '1',
        orgId: 'org-123',
        instanceUrl: 'https://test.salesforce.com',
        refreshToken: 'encrypted-token',
      };

      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(mockOrg);

      const mockConnection = {};
      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const result = await connectionManager.getConnection('user-123', 'org-123');

      expect(result).toBeDefined();
      expect(jsforce.Connection).toHaveBeenCalledWith(
        expect.objectContaining({
          instanceUrl: 'https://test.salesforce.com',
          version: '59.0',
        })
      );
    });

    it('should return null if organization not found', async () => {
      mockPrisma.salesforceOrganization.findUnique.mockResolvedValue(null);

      const result = await connectionManager.getConnection('user-123', 'org-123');

      expect(result).toBeNull();
    });
  });
});
