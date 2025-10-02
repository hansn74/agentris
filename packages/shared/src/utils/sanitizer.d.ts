import DOMPurify from 'dompurify';
/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
export declare function sanitizeHTML(html: string, options?: DOMPurify.Config): string;
/**
 * Sanitizes Mermaid.js syntax for safe rendering
 * @param mermaidSyntax - The Mermaid diagram syntax
 * @returns Sanitized Mermaid syntax
 */
export declare function sanitizeMermaid(mermaidSyntax: string): string;
/**
 * Sanitizes CSS for safe inline styles
 * @param css - CSS string to sanitize
 * @returns Sanitized CSS string
 */
export declare function sanitizeCSS(css: string): string;
//# sourceMappingURL=sanitizer.d.ts.map