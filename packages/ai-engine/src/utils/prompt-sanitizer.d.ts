export declare class PromptSanitizer {
    /**
     * Sanitize a ticket description before sending to AI
     */
    static sanitizeTicketDescription(input: string): string;
    /**
     * Sanitize field requirements before processing
     */
    static sanitizeFieldRequirement(requirement: any): any;
    /**
     * Sanitize validation rule formulas
     */
    static sanitizeFormula(formula: string): string;
    /**
     * Sanitize general text input
     */
    static sanitizeText(input: string, maxLength?: number): string;
    /**
     * Check for injection patterns and throw if found
     */
    private static checkForInjectionPatterns;
    /**
     * Normalize text by removing dangerous characters
     */
    private static normalizeText;
    /**
     * Validate and sanitize a batch of inputs
     */
    static sanitizeBatch(inputs: Record<string, any>): Record<string, any>;
}
export declare const _testPatterns: RegExp[];
//# sourceMappingURL=prompt-sanitizer.d.ts.map