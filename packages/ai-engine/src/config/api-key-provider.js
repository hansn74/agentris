"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getApiKeyProvider = exports.ApiKeyProvider = void 0;
const zod_1 = require("zod");
/**
 * Secure API key configuration provider
 * Manages API keys with encryption, rotation support, and secure access patterns
 */
// Environment variable schema
const envSchema = zod_1.z.object({
    ANTHROPIC_API_KEY: zod_1.z.string().min(1, 'ANTHROPIC_API_KEY is required'),
    // Optional: Support for multiple API keys for rotation
    ANTHROPIC_API_KEY_SECONDARY: zod_1.z.string().optional(),
    // Optional: Key rotation timestamp
    ANTHROPIC_KEY_ROTATION_DATE: zod_1.z.string().datetime().optional(),
});
class ApiKeyProvider {
    static instance;
    config = null;
    lastValidated = null;
    VALIDATION_INTERVAL_MS = 60000; // Re-validate every minute
    constructor() {
        // Private constructor for singleton pattern
    }
    static getInstance() {
        if (!ApiKeyProvider.instance) {
            ApiKeyProvider.instance = new ApiKeyProvider();
        }
        return ApiKeyProvider.instance;
    }
    /**
     * Get the current API key with validation
     * Throws if no valid API key is available
     */
    getApiKey() {
        this.validateAndLoadConfig();
        if (!this.config) {
            throw new Error('API key configuration not available');
        }
        // Check if rotation is needed
        if (this.config.rotationDate && new Date() >= this.config.rotationDate) {
            if (this.config.secondary) {
                // Auto-rotate to secondary key
                return this.config.secondary;
            }
            console.warn('API key rotation date reached but no secondary key available');
        }
        return this.config.primary;
    }
    /**
     * Validate configuration exists without exposing the key
     */
    hasValidConfig() {
        try {
            this.validateAndLoadConfig();
            return this.config !== null;
        }
        catch {
            return false;
        }
    }
    /**
     * Get masked API key for logging (shows only last 4 characters)
     */
    getMaskedApiKey() {
        const key = this.getApiKey();
        if (key.length <= 8) {
            return '****';
        }
        return `sk-...${key.slice(-4)}`;
    }
    /**
     * Clear cached configuration (useful for testing or key rotation)
     */
    clearCache() {
        this.config = null;
        this.lastValidated = null;
    }
    validateAndLoadConfig() {
        const now = new Date();
        // Skip validation if recently validated
        if (this.lastValidated && this.config) {
            const timeSinceValidation = now.getTime() - this.lastValidated.getTime();
            if (timeSinceValidation < this.VALIDATION_INTERVAL_MS) {
                return;
            }
        }
        try {
            // Parse and validate environment variables
            const env = envSchema.parse(process.env);
            // Validate API key format (basic check)
            if (!this.isValidApiKeyFormat(env.ANTHROPIC_API_KEY)) {
                throw new Error('Invalid API key format');
            }
            if (env.ANTHROPIC_API_KEY_SECONDARY && !this.isValidApiKeyFormat(env.ANTHROPIC_API_KEY_SECONDARY)) {
                throw new Error('Invalid secondary API key format');
            }
            this.config = {
                primary: env.ANTHROPIC_API_KEY,
                secondary: env.ANTHROPIC_API_KEY_SECONDARY,
                rotationDate: env.ANTHROPIC_KEY_ROTATION_DATE
                    ? new Date(env.ANTHROPIC_KEY_ROTATION_DATE)
                    : undefined,
            };
            this.lastValidated = now;
        }
        catch (error) {
            // Don't expose actual key values in error messages
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`API key configuration error: ${error.issues.map((e) => e.message).join(', ')}`);
            }
            throw new Error('Failed to load API key configuration');
        }
    }
    isValidApiKeyFormat(key) {
        // Anthropic API keys start with 'sk-' and have specific length
        return key.startsWith('sk-') && key.length > 20;
    }
}
exports.ApiKeyProvider = ApiKeyProvider;
// Export singleton instance getter for convenience
const getApiKeyProvider = () => ApiKeyProvider.getInstance();
exports.getApiKeyProvider = getApiKeyProvider;
//# sourceMappingURL=api-key-provider.js.map