"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraClient = void 0;
const jira_js_1 = require("jira.js");
const errors_1 = require("./errors");
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'jira-client' });
class JiraClient {
    client;
    tokens;
    retryCount = 0;
    maxRetries = 3;
    baseDelay = 1000; // Base delay for exponential backoff
    circuitBreaker;
    constructor(tokens) {
        this.tokens = tokens;
        this.client = new jira_js_1.Version3Client({
            host: `https://api.atlassian.com/ex/jira/${tokens.cloudId}`,
            authentication: {
                oauth2: {
                    accessToken: tokens.accessToken,
                },
            },
            telemetry: false,
        });
        this.circuitBreaker = new errors_1.CircuitBreaker();
    }
    /**
     * Execute a request with error handling and retry logic
     */
    async executeWithRetry(operation, operationName) {
        // Use circuit breaker for the operation
        return this.circuitBreaker.execute(async () => {
            try {
                logger.debug(`Executing Jira operation: ${operationName}`);
                const result = await operation();
                this.retryCount = 0; // Reset retry count on success
                logger.debug(`Jira operation successful: ${operationName}`);
                return result;
            }
            catch (error) {
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
    calculateBackoffDelay() {
        return this.baseDelay * Math.pow(2, this.retryCount) + Math.random() * 1000;
    }
    /**
     * Sleep for specified milliseconds
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Check if error is a connection error
     */
    isConnectionError(error) {
        return (error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET' ||
            error.message?.includes('Network') ||
            error.message?.includes('fetch failed'));
    }
    /**
     * Update the access token (after refresh)
     */
    updateAccessToken(newAccessToken) {
        this.tokens.accessToken = newAccessToken;
        this.client = new jira_js_1.Version3Client({
            host: `https://api.atlassian.com/ex/jira/${this.tokens.cloudId}`,
            authentication: {
                oauth2: {
                    accessToken: newAccessToken,
                },
            },
            telemetry: false,
        });
        logger.info('Jira client access token updated');
    }
    /**
     * Get the underlying Jira.js client for direct access
     */
    getClient() {
        return this.client;
    }
    /**
     * Search for issues using JQL
     */
    async searchIssues(jql, options) {
        return this.executeWithRetry(() => this.client.issueSearch.searchForIssuesUsingJql({
            jql,
            maxResults: options?.maxResults || 50,
            startAt: options?.startAt || 0,
            fields: options?.fields,
            expand: options?.expand,
        }), `searchIssues: ${jql}`);
    }
    /**
     * Get issue details by key
     */
    async getIssue(issueKey, options) {
        return this.executeWithRetry(() => this.client.issues.getIssue({
            issueIdOrKey: issueKey,
            fields: options?.fields,
            expand: options?.expand,
        }), `getIssue: ${issueKey}`);
    }
    /**
     * Get issue comments
     */
    async getComments(issueKey, options) {
        return this.executeWithRetry(() => this.client.issueComments.getComments({
            issueIdOrKey: issueKey,
            maxResults: options?.maxResults || 50,
            startAt: options?.startAt || 0,
        }), `getComments: ${issueKey}`);
    }
    /**
     * Add comment to issue
     */
    async addComment(issueKey, comment) {
        return this.executeWithRetry(() => this.client.issueComments.addComment({
            issueIdOrKey: issueKey,
            body: {
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
            },
        }), `addComment: ${issueKey}`);
    }
    /**
     * Update issue status (transition)
     */
    async transitionIssue(issueKey, transitionId) {
        return this.executeWithRetry(() => this.client.issues.doTransition({
            issueIdOrKey: issueKey,
            transition: {
                id: transitionId,
            },
        }), `transitionIssue: ${issueKey} -> ${transitionId}`);
    }
    /**
     * Get available transitions for an issue
     */
    async getTransitions(issueKey) {
        return this.executeWithRetry(() => this.client.issues.getTransitions({
            issueIdOrKey: issueKey,
        }), `getTransitions: ${issueKey}`);
    }
    /**
     * Get current user
     */
    async getCurrentUser() {
        return this.executeWithRetry(() => this.client.myself.getCurrentUser(), 'getCurrentUser');
    }
    /**
     * Get projects
     */
    async getProjects(options) {
        return this.executeWithRetry(() => this.client.projects.searchProjects({
            maxResults: options?.maxResults || 50,
            startAt: options?.startAt || 0,
        }), 'getProjects');
    }
}
exports.JiraClient = JiraClient;
//# sourceMappingURL=client.js.map