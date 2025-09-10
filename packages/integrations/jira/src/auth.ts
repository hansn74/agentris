import { randomBytes } from 'crypto';
import type { JiraConfig, JiraOAuthTokens } from './types';
import pino from 'pino';

const logger = pino({ name: 'jira-auth' });

export class JiraAuthService {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  /**
   * Generate OAuth 2.0 authorization URL for Jira
   */
  public authorize(): { url: string; state: string } {
    const state = randomBytes(32).toString('hex');

    const params = new URLSearchParams({
      audience: 'api.atlassian.com',
      client_id: this.config.clientId,
      scope: this.config.scopes.join(' '),
      redirect_uri: this.config.redirectUri,
      state,
      response_type: 'code',
      prompt: 'consent',
    });

    const url = `https://auth.atlassian.com/authorize?${params.toString()}`;

    logger.info('Generated OAuth authorization URL', {
      instanceUrl: this.config.instanceUrl,
      scopes: this.config.scopes,
    });

    return { url, state };
  }

  /**
   * Handle OAuth callback and exchange code for tokens
   */
  public async callback(code: string, state: string): Promise<JiraOAuthTokens> {
    logger.info('Processing OAuth callback', { state });

    try {
      const tokenResponse = await this.exchangeCodeForToken(code);
      const accessibleResources = await this.getAccessibleResources(tokenResponse.access_token);

      if (!accessibleResources || accessibleResources.length === 0) {
        throw new Error('No accessible Jira resources found');
      }

      // Find the matching cloud instance
      const cloudInstance =
        accessibleResources.find((resource) => resource.url === this.config.instanceUrl) ||
        accessibleResources[0];

      const tokens: JiraOAuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        cloudId: cloudInstance.id,
      };

      logger.info('OAuth tokens obtained successfully', {
        cloudId: cloudInstance.id,
        expiresAt: tokens.expiresAt,
      });

      return tokens;
    } catch (error) {
      logger.error('OAuth callback failed', error);
      throw error;
    }
  }

  /**
   * Refresh expired access token
   */
  public async refreshToken(refreshToken: string): Promise<JiraOAuthTokens> {
    logger.info('Refreshing access token');

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await fetch('https://auth.atlassian.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token refresh failed: ${error}`);
      }

      const tokenResponse = await response.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      };

      // Get cloud ID from accessible resources
      const accessibleResources = await this.getAccessibleResources(tokenResponse.access_token) as any[];
      const cloudInstance = accessibleResources[0];

      const tokens: JiraOAuthTokens = {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token || refreshToken,
        expiresAt: new Date(Date.now() + tokenResponse.expires_in * 1000),
        cloudId: cloudInstance.id,
      };

      logger.info('Access token refreshed successfully', {
        expiresAt: tokens.expiresAt,
      });

      return tokens;
    } catch (error) {
      logger.error('Token refresh failed', error);
      throw error;
    }
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForToken(code: string): Promise<any> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code,
      redirect_uri: this.config.redirectUri,
    });

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Get accessible Jira resources for the authenticated user
   */
  private async getAccessibleResources(accessToken: string): Promise<any[]> {
    const response = await fetch('https://api.atlassian.com/oauth/token/accessible-resources', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to get accessible resources: ${error}`);
    }

    return response.json() as Promise<any[]>;
  }

  /**
   * Revoke OAuth tokens
   */
  public async revokeTokens(refreshToken: string): Promise<void> {
    logger.info('Revoking OAuth tokens');

    try {
      const params = new URLSearchParams({
        token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      });

      const response = await fetch('https://auth.atlassian.com/oauth/revoke', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Token revocation failed: ${error}`);
      }

      logger.info('OAuth tokens revoked successfully');
    } catch (error) {
      logger.error('Token revocation failed', error);
      throw error;
    }
  }
}
