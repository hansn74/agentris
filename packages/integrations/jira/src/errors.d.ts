/**
 * Base Jira error class
 */
export declare class JiraError extends Error {
    statusCode?: number;
    errorMessages?: string[];
    errors?: Record<string, string>;
    retryable: boolean;
    constructor(message: string, statusCode?: number, errorMessages?: string[], errors?: Record<string, string>, retryable?: boolean);
}
/**
 * Authentication error
 */
export declare class JiraAuthenticationError extends JiraError {
    constructor(message?: string);
}
/**
 * Rate limit error
 */
export declare class JiraRateLimitError extends JiraError {
    retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
/**
 * Permission error
 */
export declare class JiraPermissionError extends JiraError {
    constructor(message?: string);
}
/**
 * Not found error
 */
export declare class JiraNotFoundError extends JiraError {
    constructor(resource: string);
}
/**
 * Connection error
 */
export declare class JiraConnectionError extends JiraError {
    constructor(message?: string);
}
/**
 * Validation error
 */
export declare class JiraValidationError extends JiraError {
    constructor(message: string, errors?: Record<string, string>);
}
/**
 * OAuth error
 */
export declare class JiraOAuthError extends JiraError {
    constructor(message: string, errorCode?: string);
}
/**
 * Circuit breaker for Jira API calls
 */
export declare class CircuitBreaker {
    private failureCount;
    private lastFailureTime?;
    private state;
    private readonly failureThreshold;
    private readonly recoveryTimeout;
    private readonly halfOpenMaxAttempts;
    private halfOpenAttempts;
    constructor(failureThreshold?: number, recoveryTimeout?: number, // 1 minute
    halfOpenMaxAttempts?: number);
    /**
     * Execute a function with circuit breaker protection
     */
    execute<T>(fn: () => Promise<T>, operationName: string): Promise<T>;
    /**
     * Handle successful operation
     */
    private onSuccess;
    /**
     * Handle failed operation
     */
    private onFailure;
    /**
     * Check if failure should count toward circuit breaker
     */
    private shouldCountFailure;
    /**
     * Check if enough time has passed to attempt reset
     */
    private shouldAttemptReset;
    /**
     * Trip the circuit breaker
     */
    private trip;
    /**
     * Reset the circuit breaker
     */
    private reset;
    /**
     * Get current state
     */
    getState(): string;
    /**
     * Get metrics
     */
    getMetrics(): {
        state: string;
        failureCount: number;
        lastFailureTime?: Date;
    };
}
/**
 * Error recovery strategies
 */
export declare class ErrorRecovery {
    /**
     * Determine if error is recoverable
     */
    static isRecoverable(error: any): boolean;
    /**
     * Get retry delay based on error type
     */
    static getRetryDelay(error: any, attemptNumber: number): number;
    /**
     * Log error with appropriate level
     */
    static logError(error: any, context: Record<string, any>): void;
}
//# sourceMappingURL=errors.d.ts.map