import { z } from 'zod';

export enum OrgType {
  SANDBOX = 'SANDBOX',
  PRODUCTION = 'PRODUCTION',
}

export const OrgTypeSchema = z.nativeEnum(OrgType);

export interface SalesforceOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  instanceUrl?: string;
  orgType: OrgType;
}

export interface SalesforceTokens {
  accessToken: string;
  refreshToken: string;
  instanceUrl: string;
  id: string;
  issuedAt: string;
  signature: string;
  scope?: string;
  idToken?: string;
  tokenType?: string;
}

export interface SalesforceIdentity {
  id: string;
  organizationId: string;
  url: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  firstName?: string;
  lastName?: string;
  photos?: {
    picture?: string;
    thumbnail?: string;
  };
}

export interface StoredConnection {
  id: string;
  userId: string;
  orgId: string;
  orgName: string;
  instanceUrl: string;
  orgType: OrgType;
  encryptedTokens: string;
  lastSync: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class SalesforceAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'SalesforceAuthError';
  }
}

export class TokenRefreshError extends Error {
  constructor(
    message: string,
    public orgId: string
  ) {
    super(message);
    this.name = 'TokenRefreshError';
  }
}

export class ConnectionError extends Error {
  constructor(
    message: string,
    public orgId?: string
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}
