import { Version3Client } from 'jira.js';
import type { JiraOAuthTokens } from './types';
export declare class JiraClient {
    private client;
    private tokens;
    private retryCount;
    private maxRetries;
    private baseDelay;
    private circuitBreaker;
    constructor(tokens: JiraOAuthTokens);
    /**
     * Execute a request with error handling and retry logic
     */
    private executeWithRetry;
    /**
     * Calculate exponential backoff delay
     */
    private calculateBackoffDelay;
    /**
     * Sleep for specified milliseconds
     */
    private sleep;
    /**
     * Check if error is a connection error
     */
    private isConnectionError;
    /**
     * Update the access token (after refresh)
     */
    updateAccessToken(newAccessToken: string): void;
    /**
     * Get the underlying Jira.js client for direct access
     */
    getClient(): Version3Client;
    /**
     * Search for issues using JQL
     */
    searchIssues(jql: string, options?: {
        maxResults?: number;
        startAt?: number;
        fields?: string[];
        expand?: string[];
    }): Promise<import("jira.js/out/version3/models").SearchResults>;
    /**
     * Get issue details by key
     */
    getIssue(issueKey: string, options?: {
        fields?: string[];
        expand?: string[];
    }): Promise<import("jira.js/out/version3/models").Issue>;
    /**
     * Get issue comments
     */
    getComments(issueKey: string, options?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<import("jira.js/out/version3/models").PageOfComments>;
    /**
     * Add comment to issue
     */
    addComment(issueKey: string, comment: string): Promise<void>;
    /**
     * Update issue status (transition)
     */
    transitionIssue(issueKey: string, transitionId: string): Promise<void>;
    /**
     * Get available transitions for an issue
     */
    getTransitions(issueKey: string): Promise<import("jira.js/out/version3/models").Transitions>;
    /**
     * Get current user
     */
    getCurrentUser(): Promise<import("jira.js/out/version3/models").User>;
    /**
     * Get projects
     */
    getProjects(options?: {
        maxResults?: number;
        startAt?: number;
    }): Promise<import("jira.js/out/version3/models").PageProject>;
}
//# sourceMappingURL=client.d.ts.map