import { PrismaClient, SalesforceOrganization, OrgType as PrismaOrgType } from '@prisma/client';
import jsforce from 'jsforce';
import pino from 'pino';
import { SalesforceAuthService } from './auth';
import { SalesforceTokens, SalesforceIdentity, ConnectionError, OrgType } from './types';

const logger = pino({ name: 'salesforce-connection' });

export class ConnectionManager {
  private prisma: PrismaClient;
  private authService: SalesforceAuthService;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.authService = new SalesforceAuthService();
  }

  async addOrganization(
    userId: string,
    tokens: SalesforceTokens,
    identity: SalesforceIdentity,
    orgType: OrgType
  ): Promise<SalesforceOrganization> {
    try {
      const encryptedTokens = this.authService.encryptTokens(tokens);

      const organization = await this.prisma.salesforceOrganization.upsert({
        where: {
          userId_orgId: {
            userId,
            orgId: identity.organizationId,
          },
        },
        update: {
          name: identity.displayName || identity.username,
          instanceUrl: tokens.instanceUrl,
          refreshToken: encryptedTokens,
          orgType: orgType as PrismaOrgType,
          updatedAt: new Date(),
        },
        create: {
          name: identity.displayName || identity.username,
          instanceUrl: tokens.instanceUrl,
          orgId: identity.organizationId,
          orgType: orgType as PrismaOrgType,
          refreshToken: encryptedTokens,
          userId,
        },
      });

      logger.info(
        {
          orgId: organization.orgId,
          userId,
          orgName: organization.name,
        },
        'Organization connection added'
      );

      return organization;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to add organization');
      throw new ConnectionError(
        `Failed to store organization: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async listOrganizations(userId: string): Promise<SalesforceOrganization[]> {
    try {
      const organizations = await this.prisma.salesforceOrganization.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      logger.info({ userId, count: organizations.length }, 'Listed organizations');
      return organizations;
    } catch (error) {
      logger.error({ error, userId }, 'Failed to list organizations');
      throw new ConnectionError('Failed to retrieve organizations');
    }
  }

  async getOrganization(userId: string, orgId: string): Promise<SalesforceOrganization | null> {
    try {
      const organization = await this.prisma.salesforceOrganization.findUnique({
        where: {
          userId_orgId: {
            userId,
            orgId,
          },
        },
      });

      return organization;
    } catch (error) {
      logger.error({ error, userId, orgId }, 'Failed to get organization');
      throw new ConnectionError('Failed to retrieve organization', orgId);
    }
  }

  async testConnection(
    userId: string,
    orgId: string
  ): Promise<{
    success: boolean;
    message: string;
    identity?: SalesforceIdentity;
  }> {
    try {
      const organization = await this.getOrganization(userId, orgId);

      if (!organization) {
        return {
          success: false,
          message: 'Organization not found',
        };
      }

      const tokens = this.authService.decryptTokens(organization.refreshToken);

      let accessToken = tokens.accessToken;

      if (!this.authService.validateTokenExpiry(tokens.issuedAt)) {
        logger.info({ orgId }, 'Access token expired, refreshing...');
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

        accessToken = refreshedTokens.accessToken;
      }

      const conn = new jsforce.Connection({
        accessToken,
        instanceUrl: organization.instanceUrl,
      });

      const identity = await conn.identity();

      const sfIdentity: SalesforceIdentity = {
        id: identity.user_id,
        organizationId: identity.organization_id,
        url: (identity.urls as any)?.custom_domain || identity.urls?.enterprise || '',
        userId: identity.user_id,
        username: identity.username,
        displayName: identity.display_name,
        email: identity.email,
        firstName: (identity as any).first_name || '',
        lastName: (identity as any).last_name || '',
        photos: identity.photos,
      };

      await this.prisma.salesforceOrganization.update({
        where: { id: organization.id },
        data: { lastSync: new Date() },
      });

      logger.info({ orgId, username: sfIdentity.username }, 'Connection test successful');

      return {
        success: true,
        message: 'Connection successful',
        identity: sfIdentity,
      };
    } catch (error) {
      logger.error({ error, userId, orgId }, 'Connection test failed');

      return {
        success: false,
        message: error instanceof Error ? error.message : 'Connection test failed',
      };
    }
  }

  async removeOrganization(userId: string, orgId: string): Promise<boolean> {
    try {
      const organization = await this.getOrganization(userId, orgId);

      if (!organization) {
        logger.warn({ userId, orgId }, 'Organization not found for removal');
        return false;
      }

      await this.prisma.salesforceOrganization.delete({
        where: { id: organization.id },
      });

      logger.info({ userId, orgId }, 'Organization removed');
      return true;
    } catch (error) {
      logger.error({ error, userId, orgId }, 'Failed to remove organization');
      throw new ConnectionError('Failed to remove organization', orgId);
    }
  }

  async getConnection(userId: string, orgId: string): Promise<any | null> {
    // jsforce.Connection
    try {
      const organization = await this.getOrganization(userId, orgId);

      if (!organization) {
        return null;
      }

      const tokens = this.authService.decryptTokens(organization.refreshToken);

      let accessToken = tokens.accessToken;

      if (!this.authService.validateTokenExpiry(tokens.issuedAt)) {
        logger.info({ orgId }, 'Access token expired, refreshing...');
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

        accessToken = refreshedTokens.accessToken;
      }

      const conn = new jsforce.Connection({
        accessToken,
        instanceUrl: organization.instanceUrl,
        version: '59.0',
      });

      return conn;
    } catch (error) {
      logger.error({ error, userId, orgId }, 'Failed to get connection');
      throw new ConnectionError('Failed to establish connection', orgId);
    }
  }
}
