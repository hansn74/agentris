import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SalesforceAuthService } from './auth';
import { OrgType, SalesforceAuthError } from './types';
import jsforce from 'jsforce';

vi.mock('jsforce', () => ({
  default: {
    OAuth2: vi.fn().mockImplementation(() => ({
      getAuthorizationUrl: vi
        .fn()
        .mockReturnValue(
          'https://login.salesforce.com/services/oauth2/authorize?response_type=code&client_id=test&redirect_uri=http://localhost:3000/callback&state=test-state'
        ),
      refreshToken: vi.fn(),
    })),
    Connection: vi.fn(),
  },
}));
vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('SalesforceAuthService', () => {
  let authService: SalesforceAuthService;
  const mockConfig = {
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    redirectUri: 'http://localhost:3000/callback',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_KEY = '12345678901234567890123456789012';
    process.env.SALESFORCE_CLIENT_ID = mockConfig.clientId;
    process.env.SALESFORCE_CLIENT_SECRET = mockConfig.clientSecret;
    process.env.SALESFORCE_REDIRECT_URI = mockConfig.redirectUri;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      expect(() => new SalesforceAuthService()).not.toThrow();
    });

    it('should throw error if required config is missing', () => {
      delete process.env.SALESFORCE_CLIENT_ID;
      expect(() => new SalesforceAuthService()).toThrow(SalesforceAuthError);
    });

    it('should throw error if encryption key is invalid', () => {
      process.env.ENCRYPTION_KEY = 'short';
      expect(() => new SalesforceAuthService()).toThrow(
        'ENCRYPTION_KEY must be exactly 32 characters'
      );
    });
  });

  describe('getAuthorizationUrl', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should generate authorization URL for production', () => {
      const state = 'test-state-123';
      const url = authService.getAuthorizationUrl(state, OrgType.PRODUCTION);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain('https://login.salesforce.com');
    });

    it('should generate authorization URL for sandbox', () => {
      const state = 'test-state-456';
      const url = authService.getAuthorizationUrl(state, OrgType.SANDBOX);

      expect(url).toBeDefined();
      expect(typeof url).toBe('string');
      expect(url).toContain('salesforce.com');
    });
  });

  describe('authenticate', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should successfully authenticate and return tokens', async () => {
      const mockUserInfo = {
        id: 'user-id-123',
        organizationId: 'org-123',
        url: 'https://test.salesforce.com',
      };

      const mockConnection = {
        authorize: vi.fn().mockResolvedValue(mockUserInfo),
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        instanceUrl: 'https://test.salesforce.com',
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const tokens = await authService.authenticate('auth-code-123');

      expect(tokens).toMatchObject({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-123',
        instanceUrl: 'https://test.salesforce.com',
        id: 'user-id-123',
      });
    });

    it('should throw error if tokens are not obtained', async () => {
      const mockConnection = {
        authorize: vi.fn().mockResolvedValue({}),
        accessToken: null,
        refreshToken: null,
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      await expect(authService.authenticate('invalid-code')).rejects.toThrow(SalesforceAuthError);
    });
  });

  describe('encryptTokens and decryptTokens', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should encrypt and decrypt tokens correctly', () => {
      const tokens = {
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        instanceUrl: 'https://test.salesforce.com',
        id: 'user-123',
        issuedAt: new Date().toISOString(),
        signature: 'test-signature',
      };

      const encrypted = authService.encryptTokens(tokens);
      expect(typeof encrypted).toBe('string');
      expect(encrypted).toContain(':');

      const decrypted = authService.decryptTokens(encrypted);
      expect(decrypted).toEqual(tokens);
    });

    it('should throw error for invalid encrypted data', () => {
      expect(() => authService.decryptTokens('invalid-data')).toThrow(SalesforceAuthError);
    });
  });

  describe('validateTokenExpiry', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should return true for non-expired token', () => {
      const issuedAt = new Date().toISOString();
      const isValid = authService.validateTokenExpiry(issuedAt, 7200);
      expect(isValid).toBe(true);
    });

    it('should return false for expired token', () => {
      const issuedAt = new Date(Date.now() - 8000000).toISOString();
      const isValid = authService.validateTokenExpiry(issuedAt, 7200);
      expect(isValid).toBe(false);
    });
  });

  describe('getIdentity', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should retrieve user identity', async () => {
      const mockIdentity = {
        user_id: 'user-123',
        organization_id: 'org-123',
        url: 'https://test.salesforce.com',
        username: 'test@example.com',
        display_name: 'Test User',
        email: 'test@example.com',
        first_name: 'Test',
        last_name: 'User',
        photos: {},
      };

      const mockConnection = {
        identity: vi.fn().mockResolvedValue(mockIdentity),
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const identity = await authService.getIdentity('access-token', 'https://test.salesforce.com');

      expect(identity).toMatchObject({
        id: 'user-123',
        organizationId: 'org-123',
        username: 'test@example.com',
        email: 'test@example.com',
      });
    });

    it('should throw error if identity retrieval fails', async () => {
      const mockConnection = {
        identity: vi.fn().mockRejectedValue(new Error('Identity error')),
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      await expect(
        authService.getIdentity('invalid-token', 'https://test.salesforce.com')
      ).rejects.toThrow(SalesforceAuthError);
    });
  });

  describe('refreshAccessToken', () => {
    beforeEach(() => {
      authService = new SalesforceAuthService(mockConfig);
    });

    it('should refresh access token successfully', async () => {
      const mockUserInfo = {
        user_id: 'user-123',
        organization_id: 'org-123',
      };

      const mockConnection = {
        oauth2: {
          refreshToken: vi.fn().mockResolvedValue({ access_token: 'new-access-token' }),
        },
        accessToken: 'new-access-token',
        identity: vi.fn().mockResolvedValue(mockUserInfo),
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      const tokens = await authService.refreshAccessToken(
        'refresh-token-123',
        'https://test.salesforce.com'
      );

      expect(tokens).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'refresh-token-123',
        instanceUrl: 'https://test.salesforce.com',
      });
    });

    it('should throw error if refresh fails', async () => {
      const mockConnection = {
        oauth2: {
          refreshToken: vi.fn().mockRejectedValue(new Error('Refresh failed')),
        },
      };

      vi.spyOn(jsforce, 'Connection').mockImplementation(() => mockConnection as any);

      await expect(
        authService.refreshAccessToken('invalid-refresh-token', 'https://test.salesforce.com')
      ).rejects.toThrow(SalesforceAuthError);
    });
  });
});
