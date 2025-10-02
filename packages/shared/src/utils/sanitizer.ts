import DOMPurify from 'dompurify';

/**
 * Sanitizes HTML content to prevent XSS attacks
 * @param html - The HTML string to sanitize
 * @param options - Optional DOMPurify configuration
 * @returns Sanitized HTML string safe for rendering
 */
export function sanitizeHTML(html: string, options?: DOMPurify.Config): string {
  if (typeof globalThis === 'undefined' || typeof (globalThis as any).window === 'undefined') {
    // Server-side: return escaped HTML
    return html
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Client-side: use DOMPurify
  const defaultOptions: DOMPurify.Config = {
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

  return DOMPurify.sanitize(html, { ...defaultOptions, ...options });
}

/**
 * Sanitizes Mermaid.js syntax for safe rendering
 * @param mermaidSyntax - The Mermaid diagram syntax
 * @returns Sanitized Mermaid syntax
 */
export function sanitizeMermaid(mermaidSyntax: string): string {
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
export function sanitizeCSS(css: string): string {
  // Remove dangerous CSS properties and values
  return css
    .replace(/javascript:/gi, '')
    .replace(/expression\s*\(/gi, '')
    .replace(/@import/gi, '')
    .replace(/behavior:/gi, '')
    .replace(/-moz-binding:/gi, '')
    .trim();
}