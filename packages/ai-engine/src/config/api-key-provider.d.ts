export interface ApiKeyConfig {
    primary: string;
    secondary?: string;
    rotationDate?: Date;
}
export declare class ApiKeyProvider {
    private static instance;
    private config;
    private lastValidated;
    private readonly VALIDATION_INTERVAL_MS;
    private constructor();
    static getInstance(): ApiKeyProvider;
    /**
     * Get the current API key with validation
     * Throws if no valid API key is available
     */
    getApiKey(): string;
    /**
     * Validate configuration exists without exposing the key
     */
    hasValidConfig(): boolean;
    /**
     * Get masked API key for logging (shows only last 4 characters)
     */
    getMaskedApiKey(): string;
    /**
     * Clear cached configuration (useful for testing or key rotation)
     */
    clearCache(): void;
    private validateAndLoadConfig;
    private isValidApiKeyFormat;
}
export declare const getApiKeyProvider: () => ApiKeyProvider;
//# sourceMappingURL=api-key-provider.d.ts.map