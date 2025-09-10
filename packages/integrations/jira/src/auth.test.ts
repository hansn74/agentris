import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraAuthService } from './auth';
import type { JiraConfig } from './types';

// Mock fetch globally
global.fetch = vi.fn();

describe('JiraAuthService', () => {
  let authService: JiraAuthService;
  let config: JiraConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    config = {
      instanceUrl: 'https://test.atlassian.net',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/api/auth/jira/callback',
      scopes: ['read:jira-work', 'write:jira-work', 'read:jira-user'],
    };
    authService = new JiraAuthService(config);
  });

  describe('authorize', () => {
    it('should generate authorization URL with correct parameters', () => {
      const { url, state } = authService.authorize();

      expect(state).toBeTruthy();
      expect(state).toHaveLength(64); // 32 bytes hex = 64 chars

      const urlObj = new URL(url);
      expect(urlObj.hostname).toBe('auth.atlassian.com');
      expect(urlObj.pathname).toBe('/authorize');

      const params = urlObj.searchParams;
      expect(params.get('client_id')).toBe(config.clientId);
      expect(params.get('redirect_uri')).toBe(config.redirectUri);
      expect(params.get('scope')).toBe(config.scopes.join(' '));
      expect(params.get('state')).toBe(state);
      expect(params.get('response_type')).toBe('code');
      expect(params.get('audience')).toBe('api.atlassian.com');
      expect(params.get('prompt')).toBe('consent');
    });

    it('should generate unique state values', () => {
      const result1 = authService.authorize();
      const result2 = authService.authorize();

      expect(result1.state).not.toBe(result2.state);
    });
  });

  describe('callback', () => {
    it('should exchange code for tokens successfully', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
      };

      const mockResources = [
        {
          id: 'cloud-id-123',
          url: 'https://test.atlassian.net',
          name: 'Test Site',
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResources,
        });

      const tokens = await authService.callback('test-code', 'test-state');

      expect(tokens.accessToken).toBe('test-access-token');
      expect(tokens.refreshToken).toBe('test-refresh-token');
      expect(tokens.cloudId).toBe('cloud-id-123');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
      expect(tokens.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it('should handle token exchange failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid authorization code',
      });

      await expect(authService.callback('invalid-code', 'test-state')).rejects.toThrow(
        'Token exchange failed: Invalid authorization code'
      );
    });

    it('should handle no accessible resources', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [],
        });

      await expect(authService.callback('test-code', 'test-state')).rejects.toThrow(
        'No accessible Jira resources found'
      );
    });
  });

  describe('refreshToken', () => {
    it('should refresh token successfully', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_in: 3600,
      };

      const mockResources = [
        {
          id: 'cloud-id-123',
          url: 'https://test.atlassian.net',
          name: 'Test Site',
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResources,
        });

      const tokens = await authService.refreshToken('old-refresh-token');

      expect(tokens.accessToken).toBe('new-access-token');
      expect(tokens.refreshToken).toBe('new-refresh-token');
      expect(tokens.cloudId).toBe('cloud-id-123');
      expect(tokens.expiresAt).toBeInstanceOf(Date);
    });

    it('should handle refresh token failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Invalid refresh token',
      });

      await expect(authService.refreshToken('invalid-token')).rejects.toThrow(
        'Token refresh failed: Invalid refresh token'
      );
    });

    it('should use existing refresh token if new one not provided', async () => {
      const mockTokenResponse = {
        access_token: 'new-access-token',
        expires_in: 3600,
        // No refresh_token in response
      };

      const mockResources = [
        {
          id: 'cloud-id-123',
          url: 'https://test.atlassian.net',
          name: 'Test Site',
        },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockTokenResponse,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResources,
        });

      const tokens = await authService.refreshToken('existing-refresh-token');

      expect(tokens.refreshToken).toBe('existing-refresh-token');
    });
  });

  describe('revokeTokens', () => {
    it('should revoke tokens successfully', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
      });

      await expect(authService.revokeTokens('test-refresh-token')).resolves.toBeUndefined();

      expect(global.fetch).toHaveBeenCalledWith(
        'https://auth.atlassian.com/oauth/revoke',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        })
      );
    });

    it('should handle revocation failure', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        text: async () => 'Revocation failed',
      });

      await expect(authService.revokeTokens('test-refresh-token')).rejects.toThrow(
        'Token revocation failed: Revocation failed'
      );
    });
  });
});
