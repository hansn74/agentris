import { Version3Client } from 'jira.js';
import type { JiraOAuthTokens } from './types';
import { CircuitBreaker, ErrorRecovery, JiraConnectionError } from './errors';
import pino from 'pino';

const logger = pino({ name: 'jira-client' });

export class JiraClient {
  private client: Version3Client;
  private tokens: JiraOAuthTokens;
  private retryCount = 0;
  private maxRetries = 3;
  private baseDelay = 1000; // Base delay for exponential backoff
  private circuitBreaker: CircuitBreaker;

  constructor(tokens: JiraOAuthTokens) {
    this.tokens = tokens;
    this.client = new Version3Client({
      host: `https://api.atlassian.com/ex/jira/${tokens.cloudId}`,
      authentication: {
        oauth2: {
          accessToken: tokens.accessToken,
        },
      },
    });
    this.circuitBreaker = new CircuitBreaker();
  }

  /**
   * Execute a request with error handling and retry logic
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Use circuit breaker for the operation
    return this.circuitBreaker.execute(async () => {
      try {
        logger.debug(`Executing Jira operation: ${operationName}`);
        const result = await operation();
        this.retryCount = 0; // Reset retry count on success
        logger.debug(`Jira operation successful: ${operationName}`);
        return result;
      } catch (error: any) {
        logger.error(`Jira operation failed: ${operationName}`, {
          error: error.message,
          statusCode: error.status,
          attempt: this.retryCount + 1,
        });

        // Handle rate limiting (429)
        if (error.status === 429) {
          if (this.retryCount < this.maxRetries) {
            const delay = this.calculateBackoffDelay();
            logger.info(`Rate limited. Retrying in ${delay}ms...`, {
              attempt: this.retryCount + 1,
              maxRetries: this.maxRetries,
            });

            await this.sleep(delay);
            this.retryCount++;
            return this.executeWithRetry(operation, operationName);
          }
          throw new Error(`Rate limit exceeded after ${this.maxRetries} retries`);
        }

        // Handle connection errors with retry
        if (this.isConnectionError(error)) {
          if (this.retryCount < this.maxRetries) {
            const delay = this.calculateBackoffDelay();
            logger.info(`Connection error. Retrying in ${delay}ms...`, {
              attempt: this.retryCount + 1,
              maxRetries: this.maxRetries,
            });

            await this.sleep(delay);
            this.retryCount++;
            return this.executeWithRetry(operation, operationName);
          }
          throw new Error(`Connection failed after ${this.maxRetries} retries: ${error.message}`);
        }

        // Handle authentication errors (401)
        if (error.status === 401) {
          throw new Error('Authentication failed. Token may be expired or invalid.');
        }

        // Throw other errors as-is
        throw error;
      }
    }, operationName);
  }

  /**
   * Calculate exponential backoff delay
   */
  private calculateBackoffDelay(): number {
    return this.baseDelay * Math.pow(2, this.retryCount) + Math.random() * 1000;
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if error is a connection error
   */
  private isConnectionError(error: any): boolean {
    return (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ENOTFOUND' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNRESET' ||
      error.message?.includes('Network') ||
      error.message?.includes('fetch failed')
    );
  }

  /**
   * Update the access token (after refresh)
   */
  public updateAccessToken(newAccessToken: string): void {
    this.tokens.accessToken = newAccessToken;
    this.client = new Version3Client({
      host: `https://api.atlassian.com/ex/jira/${this.tokens.cloudId}`,
      authentication: {
        oauth2: {
          accessToken: newAccessToken,
        },
      },
    });
    logger.info('Jira client access token updated');
  }

  /**
   * Get the underlying Jira.js client for direct access
   */
  public getClient(): Version3Client {
    return this.client;
  }

  /**
   * Search for issues using JQL
   */
  public async searchIssues(
    jql: string,
    options?: {
      maxResults?: number;
      startAt?: number;
      fields?: string[];
      expand?: string[];
    }
  ) {
    return this.executeWithRetry(
      () =>
        this.client.issueSearch.searchForIssuesUsingJql({
          jql,
          maxResults: options?.maxResults || 50,
          startAt: options?.startAt || 0,
          fields: options?.fields,
          expand: options?.expand,
        }),
      `searchIssues: ${jql}`
    );
  }

  /**
   * Get issue details by key
   */
  public async getIssue(
    issueKey: string,
    options?: {
      fields?: string[];
      expand?: string[];
    }
  ) {
    return this.executeWithRetry(
      () =>
        this.client.issues.getIssue({
          issueIdOrKey: issueKey,
          fields: options?.fields,
          expand: options?.expand,
        }),
      `getIssue: ${issueKey}`
    );
  }

  /**
   * Get issue comments
   */
  public async getComments(
    issueKey: string,
    options?: {
      maxResults?: number;
      startAt?: number;
    }
  ) {
    return this.executeWithRetry(
      () =>
        this.client.issueComments.getComments({
          issueIdOrKey: issueKey,
          maxResults: options?.maxResults || 50,
          startAt: options?.startAt || 0,
        }),
      `getComments: ${issueKey}`
    );
  }

  /**
   * Add comment to issue
   */
  public async addComment(issueKey: string, comment: string) {
    return this.executeWithRetry(
      () =>
        this.client.issueComments.addComment({
          issueIdOrKey: issueKey,
          body: {
            type: 'doc',
            version: 1,
            content: [
              {
                type: 'paragraph',
                content: [
                  {
                    type: 'text',
                    text: comment,
                  },
                ],
              },
            ],
          },
        } as any),
      `addComment: ${issueKey}`
    );
  }

  /**
   * Update issue status (transition)
   */
  public async transitionIssue(issueKey: string, transitionId: string) {
    return this.executeWithRetry(
      () =>
        this.client.issues.doTransition({
          issueIdOrKey: issueKey,
          transition: {
            id: transitionId,
          },
        }),
      `transitionIssue: ${issueKey} -> ${transitionId}`
    );
  }

  /**
   * Get available transitions for an issue
   */
  public async getTransitions(issueKey: string) {
    return this.executeWithRetry(
      () =>
        this.client.issues.getTransitions({
          issueIdOrKey: issueKey,
        }),
      `getTransitions: ${issueKey}`
    );
  }

  /**
   * Get current user
   */
  public async getCurrentUser() {
    return this.executeWithRetry(() => this.client.myself.getCurrentUser(), 'getCurrentUser');
  }

  /**
   * Get projects
   */
  public async getProjects(options?: { maxResults?: number; startAt?: number }) {
    return this.executeWithRetry(
      () =>
        this.client.projects.searchProjects({
          maxResults: options?.maxResults || 50,
          startAt: options?.startAt || 0,
        }),
      'getProjects'
    );
  }
}
