"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorRecovery = exports.CircuitBreaker = exports.JiraOAuthError = exports.JiraValidationError = exports.JiraConnectionError = exports.JiraNotFoundError = exports.JiraPermissionError = exports.JiraRateLimitError = exports.JiraAuthenticationError = exports.JiraError = void 0;
const pino_1 = __importDefault(require("pino"));
const logger = (0, pino_1.default)({ name: 'jira-errors' });
/**
 * Base Jira error class
 */
class JiraError extends Error {
    statusCode;
    errorMessages;
    errors;
    retryable;
    constructor(message, statusCode, errorMessages, errors, retryable = false) {
        super(message);
        this.name = 'JiraError';
        this.statusCode = statusCode;
        this.errorMessages = errorMessages;
        this.errors = errors;
        this.retryable = retryable;
    }
}
exports.JiraError = JiraError;
/**
 * Authentication error
 */
class JiraAuthenticationError extends JiraError {
    constructor(message = 'Jira authentication failed') {
        super(message, 401, undefined, undefined, false);
        this.name = 'JiraAuthenticationError';
    }
}
exports.JiraAuthenticationError = JiraAuthenticationError;
/**
 * Rate limit error
 */
class JiraRateLimitError extends JiraError {
    retryAfter;
    constructor(message = 'Jira API rate limit exceeded', retryAfter) {
        super(message, 429, undefined, undefined, true);
        this.name = 'JiraRateLimitError';
        this.retryAfter = retryAfter;
    }
}
exports.JiraRateLimitError = JiraRateLimitError;
/**
 * Permission error
 */
class JiraPermissionError extends JiraError {
    constructor(message = 'Insufficient permissions for Jira operation') {
        super(message, 403, undefined, undefined, false);
        this.name = 'JiraPermissionError';
    }
}
exports.JiraPermissionError = JiraPermissionError;
/**
 * Not found error
 */
class JiraNotFoundError extends JiraError {
    constructor(resource) {
        super(`Jira resource not found: ${resource}`, 404, undefined, undefined, false);
        this.name = 'JiraNotFoundError';
    }
}
exports.JiraNotFoundError = JiraNotFoundError;
/**
 * Connection error
 */
class JiraConnectionError extends JiraError {
    constructor(message = 'Failed to connect to Jira') {
        super(message, undefined, undefined, undefined, true);
        this.name = 'JiraConnectionError';
    }
}
exports.JiraConnectionError = JiraConnectionError;
/**
 * Validation error
 */
class JiraValidationError extends JiraError {
    constructor(message, errors) {
        super(message, 400, undefined, errors, false);
        this.name = 'JiraValidationError';
    }
}
exports.JiraValidationError = JiraValidationError;
/**
 * OAuth error
 */
class JiraOAuthError extends JiraError {
    constructor(message, errorCode) {
        super(message, 400, [errorCode || 'oauth_error'], undefined, false);
        this.name = 'JiraOAuthError';
    }
}
exports.JiraOAuthError = JiraOAuthError;
/**
 * Circuit breaker for Jira API calls
 */
class CircuitBreaker {
    failureCount = 0;
    lastFailureTime;
    state = 'CLOSED';
    failureThreshold;
    recoveryTimeout;
    halfOpenMaxAttempts;
    halfOpenAttempts = 0;
    constructor(failureThreshold = 5, recoveryTimeout = 60000, // 1 minute
    halfOpenMaxAttempts = 3) {
        this.failureThreshold = failureThreshold;
        this.recoveryTimeout = recoveryTimeout;
        this.halfOpenMaxAttempts = halfOpenMaxAttempts;
    }
    /**
     * Execute a function with circuit breaker protection
     */
    async execute(fn, operationName) {
        if (this.state === 'OPEN') {
            if (this.shouldAttemptReset()) {
                this.state = 'HALF_OPEN';
                this.halfOpenAttempts = 0;
                logger.info(`Circuit breaker entering HALF_OPEN state for ${operationName}`);
            }
            else {
                throw new JiraConnectionError('Circuit breaker is OPEN - Jira API temporarily unavailable');
            }
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure(error);
            throw error;
        }
    }
    /**
     * Handle successful operation
     */
    onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.halfOpenAttempts++;
            if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
                this.reset();
                logger.info('Circuit breaker reset to CLOSED state');
            }
        }
        else {
            this.failureCount = 0;
        }
    }
    /**
     * Handle failed operation
     */
    onFailure(error) {
        this.lastFailureTime = new Date();
        // Only count failures that should trip the breaker
        if (this.shouldCountFailure(error)) {
            this.failureCount++;
            if (this.state === 'HALF_OPEN') {
                this.trip();
                logger.warn('Circuit breaker tripped from HALF_OPEN to OPEN');
            }
            else if (this.failureCount >= this.failureThreshold) {
                this.trip();
                logger.warn('Circuit breaker tripped to OPEN state', {
                    failureCount: this.failureCount,
                    threshold: this.failureThreshold,
                });
            }
        }
    }
    /**
     * Check if failure should count toward circuit breaker
     */
    shouldCountFailure(error) {
        // Don't count client errors (4xx except 429) toward circuit breaker
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
            return error.statusCode === 429; // Only count rate limits
        }
        // Count server errors and connection errors
        return true;
    }
    /**
     * Check if enough time has passed to attempt reset
     */
    shouldAttemptReset() {
        if (!this.lastFailureTime) {
            return true;
        }
        const timeSinceLastFailure = Date.now() - this.lastFailureTime.getTime();
        return timeSinceLastFailure >= this.recoveryTimeout;
    }
    /**
     * Trip the circuit breaker
     */
    trip() {
        this.state = 'OPEN';
        this.lastFailureTime = new Date();
    }
    /**
     * Reset the circuit breaker
     */
    reset() {
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.halfOpenAttempts = 0;
        this.lastFailureTime = undefined;
    }
    /**
     * Get current state
     */
    getState() {
        return this.state;
    }
    /**
     * Get metrics
     */
    getMetrics() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            lastFailureTime: this.lastFailureTime,
        };
    }
}
exports.CircuitBreaker = CircuitBreaker;
/**
 * Error recovery strategies
 */
class ErrorRecovery {
    /**
     * Determine if error is recoverable
     */
    static isRecoverable(error) {
        if (error instanceof JiraError) {
            return error.retryable;
        }
        // Connection errors are usually recoverable
        if (error.code === 'ECONNREFUSED' ||
            error.code === 'ENOTFOUND' ||
            error.code === 'ETIMEDOUT' ||
            error.code === 'ECONNRESET') {
            return true;
        }
        // Rate limits are recoverable
        if (error.statusCode === 429) {
            return true;
        }
        // Server errors might be recoverable
        if (error.statusCode >= 500) {
            return true;
        }
        return false;
    }
    /**
     * Get retry delay based on error type
     */
    static getRetryDelay(error, attemptNumber) {
        // Rate limit error with retry-after header
        if (error instanceof JiraRateLimitError && error.retryAfter) {
            return error.retryAfter * 1000;
        }
        // Rate limit without retry-after
        if (error.statusCode === 429) {
            return Math.min(60000, 1000 * Math.pow(2, attemptNumber));
        }
        // Exponential backoff for other errors
        return Math.min(30000, 1000 * Math.pow(2, attemptNumber));
    }
    /**
     * Log error with appropriate level
     */
    static logError(error, context) {
        const errorInfo = {
            ...context,
            errorName: error.name,
            errorMessage: error.message,
            statusCode: error.statusCode,
            errorCode: error.code,
        };
        if (error instanceof JiraAuthenticationError || error instanceof JiraPermissionError) {
            logger.error('Jira authorization error', errorInfo);
        }
        else if (error instanceof JiraRateLimitError) {
            logger.warn('Jira rate limit hit', errorInfo);
        }
        else if (error instanceof JiraConnectionError) {
            logger.error('Jira connection error', errorInfo);
        }
        else if (error instanceof JiraValidationError) {
            logger.warn('Jira validation error', { ...errorInfo, errors: error.errors });
        }
        else {
            logger.error('Unexpected Jira error', errorInfo);
        }
    }
}
exports.ErrorRecovery = ErrorRecovery;
//# sourceMappingURL=errors.js.map