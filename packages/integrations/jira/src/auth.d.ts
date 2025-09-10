import type { JiraConfig, JiraOAuthTokens } from './types';
export declare class JiraAuthService {
    private config;
    constructor(config: JiraConfig);
    /**
     * Generate OAuth 2.0 authorization URL for Jira
     */
    authorize(): {
        url: string;
        state: string;
    };
    /**
     * Handle OAuth callback and exchange code for tokens
     */
    callback(code: string, state: string): Promise<JiraOAuthTokens>;
    /**
     * Refresh expired access token
     */
    refreshToken(refreshToken: string): Promise<JiraOAuthTokens>;
    /**
     * Exchange authorization code for tokens
     */
    private exchangeCodeForToken;
    /**
     * Get accessible Jira resources for the authenticated user
     */
    private getAccessibleResources;
    /**
     * Revoke OAuth tokens
     */
    revokeTokens(refreshToken: string): Promise<void>;
}
//# sourceMappingURL=auth.d.ts.map