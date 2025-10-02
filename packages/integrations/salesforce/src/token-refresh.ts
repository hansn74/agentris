import { PrismaClient, SalesforceOrganization } from '@prisma/client';
import pino from 'pino';
import { SalesforceAuthService } from './auth';
import { TokenRefreshError } from './types';

const logger = pino({ name: 'salesforce-token-refresh' });

export class TokenRefreshService {
  private prisma: PrismaClient;
  private authService: SalesforceAuthService;
  private refreshInterval: NodeJS.Timeout | null = null;
  private checkIntervalMs: number = 30 * 60 * 1000; // 30 minutes
  private tokenExpiryThresholdMs: number = 15 * 60 * 1000; // 15 minutes before expiry

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authService = new SalesforceAuthService();
  }

  async checkTokenExpiry(organization: SalesforceOrganization): Promise<boolean> {
    try {
      const tokens = this.authService.decryptTokens(organization.refreshToken);
      const issuedAt = new Date(tokens.issuedAt).getTime();
      const now = Date.now();
      const expiryTime = issuedAt + 7200 * 1000; // 2 hours default token lifetime
      const timeUntilExpiry = expiryTime - now;

      logger.debug(
        {
          orgId: organization.orgId,
          timeUntilExpiry: Math.floor(timeUntilExpiry / 1000),
          threshold: Math.floor(this.tokenExpiryThresholdMs / 1000),
        },
        'Checking token expiry'
      );

      return timeUntilExpiry <= this.tokenExpiryThresholdMs;
    } catch (error) {
      logger.error(
        {
          error,
          orgId: organization.orgId,
        },
        'Failed to check token expiry'
      );
      return true; // Assume expired if we can't check
    }
  }

  async refreshToken(
    organization: SalesforceOrganization,
    retryAttempt: number = 0
  ): Promise<void> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    try {
      const tokens = this.authService.decryptTokens(organization.refreshToken);

      logger.info(
        {
          orgId: organization.orgId,
          orgName: organization.name,
          retryAttempt,
        },
        'Refreshing access token'
      );

      const refreshedTokens = await this.authService.refreshAccessToken(
        tokens.refreshToken,
        organization.instanceUrl
      );

      const encryptedTokens = this.authService.encryptTokens(refreshedTokens);

      await this.prisma.salesforceOrganization.update({
        where: { id: organization.id },
        data: {
          refreshToken: encryptedTokens,
          updatedAt: new Date(),
        },
      });

      logger.info(
        {
          orgId: organization.orgId,
          orgName: organization.name,
        },
        'Successfully refreshed access token'
      );
    } catch (error) {
      logger.error(
        {
          error,
          orgId: organization.orgId,
          retryAttempt,
          maxRetries,
        },
        'Failed to refresh token'
      );

      // Implement exponential backoff with jitter
      if (retryAttempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, retryAttempt) + Math.random() * 1000;

        logger.info(
          {
            orgId: organization.orgId,
            retryAttempt: retryAttempt + 1,
            delayMs: Math.round(delay),
          },
          'Retrying token refresh with exponential backoff'
        );

        await new Promise((resolve) => setTimeout(resolve, delay));
        return this.refreshToken(organization, retryAttempt + 1);
      }

      throw new TokenRefreshError(
        `Failed to refresh token after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
        organization.orgId
      );
    }
  }

  async refreshExpiredTokens(): Promise<void> {
    try {
      const organizations = await this.prisma.salesforceOrganization.findMany({
        where: {
          refreshToken: { not: { equals: '' } },
        },
      });

      logger.info({ count: organizations.length }, 'Checking tokens for refresh');

      const refreshPromises = organizations.map(async (org: SalesforceOrganization) => {
        try {
          const needsRefresh = await this.checkTokenExpiry(org);
          if (needsRefresh) {
            await this.refreshToken(org);
          }
        } catch (error) {
          logger.error(
            {
              error,
              orgId: org.orgId,
            },
            'Error in token refresh for organization'
          );
        }
      });

      await Promise.allSettled(refreshPromises);
    } catch (error) {
      logger.error({ error }, 'Failed to check and refresh tokens');
    }
  }

  startScheduledRefresh(): void {
    if (this.refreshInterval) {
      logger.warn('Scheduled refresh already running');
      return;
    }

    logger.info(
      {
        intervalMinutes: this.checkIntervalMs / 60000,
      },
      'Starting scheduled token refresh'
    );

    this.refreshInterval = setInterval(async () => {
      await this.refreshExpiredTokens();
    }, this.checkIntervalMs);

    // Run immediately on start
    this.refreshExpiredTokens().catch((error) => {
      logger.error({ error }, 'Initial token refresh failed');
    });
  }

  stopScheduledRefresh(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
      logger.info('Stopped scheduled token refresh');
    }
  }

  async refreshTokenForUser(userId: string): Promise<void> {
    try {
      const organizations = await this.prisma.salesforceOrganization.findMany({
        where: { userId },
      });

      if (organizations.length === 0) {
        logger.info({ userId }, 'No organizations found for user');
        return;
      }

      logger.info(
        {
          userId,
          count: organizations.length,
        },
        'Refreshing tokens for user organizations'
      );

      const refreshPromises = organizations.map(async (org: SalesforceOrganization) => {
        try {
          const needsRefresh = await this.checkTokenExpiry(org);
          if (needsRefresh) {
            await this.refreshToken(org);
          }
        } catch (error) {
          logger.error(
            {
              error,
              orgId: org.orgId,
              userId,
            },
            'Error refreshing token for user organization'
          );
        }
      });

      await Promise.allSettled(refreshPromises);
    } catch (error) {
      logger.error({ error, userId }, 'Failed to refresh tokens for user');
      throw new Error(
        `Failed to refresh tokens for user: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async refreshTokenForOrganization(userId: string, orgId: string): Promise<void> {
    try {
      const organization = await this.prisma.salesforceOrganization.findUnique({
        where: {
          userId_orgId: {
            userId,
            orgId,
          },
        },
      });

      if (!organization) {
        throw new TokenRefreshError('Organization not found', orgId);
      }

      const needsRefresh = await this.checkTokenExpiry(organization);

      if (needsRefresh) {
        await this.refreshToken(organization);
      } else {
        logger.info({ orgId }, 'Token does not need refresh yet');
      }
    } catch (error) {
      if (error instanceof TokenRefreshError) {
        throw error;
      }

      logger.error({ error, userId, orgId }, 'Failed to refresh token for organization');
      throw new TokenRefreshError(
        `Failed to refresh token: ${error instanceof Error ? error.message : 'Unknown error'}`,
        orgId
      );
    }
  }

  setCheckInterval(intervalMs: number): void {
    this.checkIntervalMs = intervalMs;

    if (this.refreshInterval) {
      this.stopScheduledRefresh();
      this.startScheduledRefresh();
    }
  }

  setTokenExpiryThreshold(thresholdMs: number): void {
    this.tokenExpiryThresholdMs = thresholdMs;
  }
}
