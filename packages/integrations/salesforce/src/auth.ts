import jsforce from 'jsforce';
import crypto from 'crypto';
import pino from 'pino';
import {
  SalesforceOAuthConfig,
  SalesforceTokens,
  SalesforceIdentity,
  SalesforceAuthError,
  OrgType,
} from './types';

const logger = pino({ name: 'salesforce-auth' });

export class SalesforceAuthService {
  private oauth2: any; // jsforce.OAuth2
  private encryptionKey: string;

  constructor(config: Partial<SalesforceOAuthConfig> = {}) {
    const clientId = config.clientId || process.env.SALESFORCE_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.SALESFORCE_CLIENT_SECRET;
    const redirectUri = config.redirectUri || process.env.SALESFORCE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new SalesforceAuthError(
        'Missing required Salesforce OAuth configuration',
        'CONFIG_ERROR'
      );
    }

    this.encryptionKey = process.env.ENCRYPTION_KEY || '';
    if (!this.encryptionKey || this.encryptionKey.length !== 32) {
      throw new SalesforceAuthError(
        'ENCRYPTION_KEY must be exactly 32 characters',
        'ENCRYPTION_KEY_ERROR'
      );
    }

    const loginUrl =
      config.orgType === OrgType.SANDBOX
        ? 'https://test.salesforce.com'
        : 'https://login.salesforce.com';

    this.oauth2 = new jsforce.OAuth2({
      clientId,
      clientSecret,
      redirectUri,
      loginUrl,
    });
  }

  getAuthorizationUrl(state: string, orgType: OrgType = OrgType.PRODUCTION): string {
    const loginUrl =
      orgType === OrgType.SANDBOX ? 'https://test.salesforce.com' : 'https://login.salesforce.com';

    this.oauth2 = new jsforce.OAuth2({
      ...this.oauth2,
      loginUrl,
    });

    const authUrl = this.oauth2.getAuthorizationUrl({
      scope: 'api refresh_token offline_access',
      state,
      prompt: 'consent',
    });

    logger.info({ orgType }, 'Generated authorization URL'); // Removed state from logs for security
    return authUrl;
  }

  async authenticate(
    code: string,
    orgType: OrgType = OrgType.PRODUCTION
  ): Promise<SalesforceTokens> {
    // Validate code format to prevent injection
    if (!code || typeof code !== 'string' || code.length > 500) {
      throw new SalesforceAuthError('Invalid authorization code format', 'INVALID_CODE');
    }

    try {
      const loginUrl =
        orgType === OrgType.SANDBOX
          ? 'https://test.salesforce.com'
          : 'https://login.salesforce.com';

      this.oauth2 = new jsforce.OAuth2({
        ...this.oauth2,
        loginUrl,
      });

      const conn = new jsforce.Connection({ oauth2: this.oauth2 });

      const userInfo = await conn.authorize(code);

      if (!conn.accessToken || !conn.refreshToken) {
        throw new SalesforceAuthError('Failed to obtain tokens from Salesforce', 'TOKEN_ERROR');
      }

      const tokens: SalesforceTokens = {
        accessToken: conn.accessToken,
        refreshToken: conn.refreshToken,
        instanceUrl: conn.instanceUrl,
        id: userInfo.id,
        issuedAt: new Date().toISOString(),
        signature: this.generateSignature(conn.accessToken),
        scope: 'api refresh_token offline_access',
      };

      logger.info(
        {
          instanceUrl: tokens.instanceUrl,
        },
        'Successfully authenticated with Salesforce'
      ); // Removed userId from logs for security

      return tokens;
    } catch (error) {
      logger.error({ error }, 'Authentication failed');

      if (error instanceof SalesforceAuthError) {
        throw error;
      }

      throw new SalesforceAuthError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'AUTH_FAILED',
        401
      );
    }
  }

  async getIdentity(accessToken: string, instanceUrl: string): Promise<SalesforceIdentity> {
    // Validate instance URL is a valid Salesforce domain
    const validDomains = ['salesforce.com', 'force.com', 'cloudforce.com', 'database.com'];

    try {
      const url = new URL(instanceUrl);
      const isValidDomain = validDomains.some((domain) => url.hostname.endsWith(domain));

      if (!isValidDomain) {
        throw new SalesforceAuthError('Invalid Salesforce instance URL', 'INVALID_INSTANCE_URL');
      }
    } catch (error) {
      throw new SalesforceAuthError('Invalid instance URL format', 'INVALID_URL_FORMAT');
    }
    try {
      const conn = new jsforce.Connection({
        accessToken,
        instanceUrl,
      });

      const identity = await conn.identity();

      return {
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
    } catch (error) {
      logger.error({ error }, 'Failed to get identity');
      throw new SalesforceAuthError('Failed to retrieve user identity', 'IDENTITY_ERROR', 500);
    }
  }

  encryptTokens(tokens: SalesforceTokens): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);

    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  decryptTokens(encryptedData: string): SalesforceTokens {
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      if (!ivHex || !encrypted) {
        throw new Error('Invalid encrypted data format');
      }
      const iv = Buffer.from(ivHex, 'hex');

      if (!this.encryptionKey) {
        throw new Error('Encryption key not configured');
      }

      const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);

      let decrypted: string = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return JSON.parse(decrypted) as SalesforceTokens;
    } catch (error) {
      logger.error({ error }, 'Failed to decrypt tokens');
      throw new SalesforceAuthError('Failed to decrypt stored tokens', 'DECRYPT_ERROR');
    }
  }

  async refreshAccessToken(refreshToken: string, instanceUrl: string): Promise<SalesforceTokens> {
    try {
      const conn = new jsforce.Connection({
        oauth2: this.oauth2,
        instanceUrl,
        refreshToken,
      });

      const refreshResult = await conn.oauth2.refreshToken(refreshToken);
      if (refreshResult && refreshResult.access_token) {
        conn.accessToken = refreshResult.access_token;
      } else {
        throw new Error('Failed to get access token from refresh');
      }

      if (!conn.accessToken) {
        throw new Error('Failed to refresh access token');
      }

      const userInfo = await conn.identity();

      const tokens: SalesforceTokens = {
        accessToken: conn.accessToken,
        refreshToken,
        instanceUrl,
        id: userInfo.user_id,
        issuedAt: new Date().toISOString(),
        signature: this.generateSignature(conn.accessToken),
        scope: 'api refresh_token offline_access',
      };

      logger.info({ instanceUrl }, 'Successfully refreshed access token');
      return tokens;
    } catch (error) {
      logger.error({ error }, 'Token refresh failed');
      throw new SalesforceAuthError(
        `Token refresh failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'REFRESH_FAILED',
        401
      );
    }
  }

  private generateSignature(token: string): string {
    return crypto.createHmac('sha256', this.encryptionKey).update(token).digest('hex');
  }

  validateTokenExpiry(issuedAt: string, expiresIn: number = 7200): boolean {
    const issued = new Date(issuedAt).getTime();
    const now = Date.now();
    const expiryTime = issued + expiresIn * 1000;

    return now < expiryTime;
  }
}
