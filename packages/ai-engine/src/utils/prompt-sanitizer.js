"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._testPatterns = exports.PromptSanitizer = void 0;
const zod_1 = require("zod");
/**
 * Prompt sanitization utility to prevent injection attacks
 * Validates and sanitizes user inputs before sending to AI models
 */
// Common injection patterns to detect and block
const INJECTION_PATTERNS = [
    // Attempts to override system prompts
    /(?:ignore|forget|disregard).*(?:previous|above|prior).*(?:instructions?|prompts?)/i,
    /(?:new|updated?).*(?:instructions?|system.*prompts?)/i,
    /^(?:system|assistant|human):/im,
    // Attempts to extract system information
    /(?:what|show|reveal|display).*(?:system|initial|original).*(?:prompt|instructions?)/i,
    /(?:repeat|echo|print).*(?:exact|verbatim|full).*(?:instructions?|prompts?)/i,
    // Role playing attempts
    /(?:you are now|act as|pretend to be|roleplay as)/i,
    /(?:switch|change).*(?:mode|personality|role)/i,
    // Command injection attempts
    /(?:execute|run|eval).*(?:code|command|script)/i,
    /<script|<iframe|javascript:|onclick=/i,
    // Attempts to bypass safety
    /(?:bypass|ignore|skip).*(?:safety|filter|restriction)/i,
];
// Maximum lengths for different input types
const MAX_LENGTHS = {
    ticketDescription: 10000,
    fieldName: 255,
    formula: 5000,
    generalText: 2000,
};
class PromptSanitizer {
    /**
     * Sanitize a ticket description before sending to AI
     */
    static sanitizeTicketDescription(input) {
        // Basic validation
        if (!input || typeof input !== 'string') {
            throw new Error('Invalid input: ticket description must be a non-empty string');
        }
        // Length check
        if (input.length > MAX_LENGTHS.ticketDescription) {
            throw new Error(`Ticket description exceeds maximum length of ${MAX_LENGTHS.ticketDescription} characters`);
        }
        // Check for injection patterns
        const sanitized = this.checkForInjectionPatterns(input);
        // Remove potentially dangerous characters and normalize
        return this.normalizeText(sanitized);
    }
    /**
     * Sanitize field requirements before processing
     */
    static sanitizeFieldRequirement(requirement) {
        const schema = zod_1.z.object({
            fieldName: zod_1.z.string().max(MAX_LENGTHS.fieldName).regex(/^[a-zA-Z][a-zA-Z0-9_]*$/),
            fieldLabel: zod_1.z.string().max(MAX_LENGTHS.fieldName),
            description: zod_1.z.string().max(MAX_LENGTHS.generalText),
            formula: zod_1.z.string().max(MAX_LENGTHS.formula).optional(),
            picklistValues: zod_1.z.array(zod_1.z.string().max(255)).max(500).optional(),
        }).passthrough();
        try {
            const validated = schema.parse(requirement);
            // Additional sanitization for formula fields
            if (validated.formula) {
                validated.formula = this.sanitizeFormula(validated.formula);
            }
            // Sanitize picklist values
            if (validated.picklistValues) {
                validated.picklistValues = validated.picklistValues.map(v => this.normalizeText(v).slice(0, 255));
            }
            return validated;
        }
        catch (error) {
            if (error instanceof zod_1.z.ZodError) {
                throw new Error(`Invalid field requirement: ${error.issues.map((e) => e.message).join(', ')}`);
            }
            throw error;
        }
    }
    /**
     * Sanitize validation rule formulas
     */
    static sanitizeFormula(formula) {
        if (!formula || typeof formula !== 'string') {
            throw new Error('Invalid formula input');
        }
        // Remove comments that could contain injection attempts
        let sanitized = formula.replace(/\/\*[\s\S]*?\*\//g, '');
        sanitized = sanitized.replace(/\/\/.*/g, '');
        // Check for suspicious patterns in formulas
        const suspiciousPatterns = [
            /GETRECORDIDS/i, // Can expose sensitive data
            /GETSESSIONID/i, // Session hijacking risk
            /URLENCODE/i, // Potential for URL manipulation
        ];
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(sanitized)) {
                throw new Error(`Formula contains potentially dangerous function: ${pattern.source}`);
            }
        }
        return sanitized.trim();
    }
    /**
     * Sanitize general text input
     */
    static sanitizeText(input, maxLength = MAX_LENGTHS.generalText) {
        if (!input || typeof input !== 'string') {
            return '';
        }
        // Length check
        const truncated = input.slice(0, maxLength);
        // Check for injection patterns
        const checked = this.checkForInjectionPatterns(truncated);
        // Normalize and clean
        return this.normalizeText(checked);
    }
    /**
     * Check for injection patterns and throw if found
     */
    static checkForInjectionPatterns(input) {
        for (const pattern of INJECTION_PATTERNS) {
            if (pattern.test(input)) {
                // Log the attempt for security monitoring
                console.warn(`Potential injection attempt detected: ${pattern.source}`);
                throw new Error('Input contains potentially malicious content');
            }
        }
        return input;
    }
    /**
     * Normalize text by removing dangerous characters
     */
    static normalizeText(input) {
        // Remove null bytes and other control characters
        let normalized = input.replace(/\x00/g, '');
        // Remove Unicode direction override characters (potential security risk)
        normalized = normalized.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
        // Normalize whitespace
        normalized = normalized.replace(/\s+/g, ' ').trim();
        // Escape special characters that could be interpreted as commands
        normalized = normalized.replace(/[<>]/g, (char) => {
            return char === '<' ? '&lt;' : '&gt;';
        });
        return normalized;
    }
    /**
     * Validate and sanitize a batch of inputs
     */
    static sanitizeBatch(inputs) {
        const sanitized = {};
        for (const [key, value] of Object.entries(inputs)) {
            if (typeof value === 'string') {
                sanitized[key] = this.sanitizeText(value);
            }
            else if (Array.isArray(value)) {
                sanitized[key] = value.map(item => typeof item === 'string' ? this.sanitizeText(item) : item);
            }
            else {
                sanitized[key] = value;
            }
        }
        return sanitized;
    }
}
exports.PromptSanitizer = PromptSanitizer;
// Export for testing injection patterns
exports._testPatterns = INJECTION_PATTERNS;
//# sourceMappingURL=prompt-sanitizer.js.map