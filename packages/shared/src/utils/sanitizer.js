"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeHTML = sanitizeHTML;
exports.sanitizeMermaid = sanitizeMermaid;
exports.sanitizeCSS = sanitizeCSS;
const dompurify_1 = __importDefault(require("dompurify"));
/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
function sanitizeHTML(html, options) {
    if (typeof globalThis === 'undefined' || typeof globalThis.window === 'undefined') {
        // Server-side: return escaped HTML
        return html
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
    // Client-side: use DOMPurify
    const defaultOptions = {
        ALLOWED_TAGS: [
            'div', 'span', 'p', 'br', 'hr',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li',
            'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
            'strong', 'em', 'b', 'i', 'u',
            'a', 'code', 'pre',
            'form', 'input', 'label', 'select', 'option', 'textarea', 'button',
            'img', 'svg', 'path'
        ],
        ALLOWED_ATTR: [
            'class', 'id', 'style',
            'href', 'target', 'rel',
            'type', 'name', 'value', 'placeholder', 'required', 'disabled',
            'src', 'alt', 'width', 'height',
            'd', 'viewBox', 'fill', 'stroke'
        ],
        ALLOW_DATA_ATTR: false,
        KEEP_CONTENT: true,
        SAFE_FOR_TEMPLATES: true,
    };
    return dompurify_1.default.sanitize(html, { ...defaultOptions, ...options });
}
/**
 * Sanitizes Mermaid.js syntax for safe rendering
 * @param mermaidSyntax - The Mermaid diagram syntax
 * @returns Sanitized Mermaid syntax
 */
function sanitizeMermaid(mermaidSyntax) {
    // Remove any script tags or dangerous content
    return mermaidSyntax
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
}
/**
 * Sanitizes CSS for safe inline styles
 * @param css - CSS string to sanitize
 * @returns Sanitized CSS string
 */
function sanitizeCSS(css) {
    // Remove dangerous CSS properties and values
    return css
        .replace(/javascript:/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/@import/gi, '')
        .replace(/behavior:/gi, '')
        .replace(/-moz-binding:/gi, '')
        .trim();
}
//# sourceMappingURL=sanitizer.js.map