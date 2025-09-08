import { describe, it, expect } from 'vitest';
import { getCorsConfig, isOriginAllowed, getCorsHeaders, CORS_CONFIG } from '../middleware/cors';

describe('CORS Configuration', () => {
  describe('getCorsConfig', () => {
    it('should return development config by default', () => {
      const config = getCorsConfig();
      expect(config).toBe(CORS_CONFIG.development);
      expect(config.origin).toContain('http://localhost:3000');
    });

    it('should return staging config when specified', () => {
      const config = getCorsConfig('staging');
      expect(config).toBe(CORS_CONFIG.staging);
      expect(config.origin).toContain('https://staging.agentris.com');
    });

    it('should return production config when specified', () => {
      const config = getCorsConfig('production');
      expect(config).toBe(CORS_CONFIG.production);
      expect(config.origin).toContain('https://agentris.com');
    });

    it('should fallback to development for unknown environment', () => {
      const config = getCorsConfig('unknown');
      expect(config).toBe(CORS_CONFIG.development);
    });
  });

  describe('isOriginAllowed', () => {
    describe('development', () => {
      it('should allow localhost origins', () => {
        expect(isOriginAllowed('http://localhost:3000', 'development')).toBe(true);
        expect(isOriginAllowed('http://localhost:3001', 'development')).toBe(true);
        expect(isOriginAllowed('http://127.0.0.1:3000', 'development')).toBe(true);
      });

      it('should reject non-localhost origins', () => {
        expect(isOriginAllowed('https://example.com', 'development')).toBe(false);
        expect(isOriginAllowed('https://agentris.com', 'development')).toBe(false);
      });

      it('should reject undefined origin', () => {
        expect(isOriginAllowed(undefined, 'development')).toBe(false);
      });
    });

    describe('staging', () => {
      it('should allow staging origins', () => {
        expect(isOriginAllowed('https://staging.agentris.com', 'staging')).toBe(true);
        expect(isOriginAllowed('https://preview.agentris.com', 'staging')).toBe(true);
      });

      it('should reject non-staging origins', () => {
        expect(isOriginAllowed('http://localhost:3000', 'staging')).toBe(false);
        expect(isOriginAllowed('https://agentris.com', 'staging')).toBe(false);
      });
    });

    describe('production', () => {
      it('should allow production origins', () => {
        expect(isOriginAllowed('https://agentris.com', 'production')).toBe(true);
        expect(isOriginAllowed('https://www.agentris.com', 'production')).toBe(true);
        expect(isOriginAllowed('https://app.agentris.com', 'production')).toBe(true);
      });

      it('should reject non-production origins', () => {
        expect(isOriginAllowed('http://localhost:3000', 'production')).toBe(false);
        expect(isOriginAllowed('https://staging.agentris.com', 'production')).toBe(false);
      });
    });
  });

  describe('getCorsHeaders', () => {
    it('should set correct headers for allowed origin', () => {
      const headers = getCorsHeaders('http://localhost:3000', 'development');

      expect(headers['Access-Control-Allow-Origin']).toBe('http://localhost:3000');
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Headers']).toContain('Content-Type');
      expect(headers['Access-Control-Allow-Headers']).toContain('Authorization');
      expect(headers['Access-Control-Max-Age']).toBe('86400');
    });

    it('should include rate limit headers in exposed headers', () => {
      const headers = getCorsHeaders('http://localhost:3000', 'development');

      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Limit');
      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Remaining');
      expect(headers['Access-Control-Expose-Headers']).toContain('X-RateLimit-Reset');
      expect(headers['Access-Control-Expose-Headers']).toContain('X-Correlation-Id');
    });

    it('should not set origin header for disallowed origin', () => {
      const headers = getCorsHeaders('https://evil.com', 'development');

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Credentials']).toBe('true');
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    });

    it('should handle undefined origin', () => {
      const headers = getCorsHeaders(undefined, 'development');

      expect(headers['Access-Control-Allow-Origin']).toBeUndefined();
      expect(headers['Access-Control-Allow-Methods']).toBeDefined();
    });

    it('should include all required headers', () => {
      const headers = getCorsHeaders('https://agentris.com', 'production');

      expect(headers['Access-Control-Allow-Methods']).toContain('GET');
      expect(headers['Access-Control-Allow-Methods']).toContain('POST');
      expect(headers['Access-Control-Allow-Methods']).toContain('PUT');
      expect(headers['Access-Control-Allow-Methods']).toContain('DELETE');
      expect(headers['Access-Control-Allow-Methods']).toContain('OPTIONS');
    });

    it('should include security headers', () => {
      const headers = getCorsHeaders('https://agentris.com', 'production');

      expect(headers['Access-Control-Allow-Headers']).toContain('X-CSRF-Token');
      expect(headers['Access-Control-Allow-Headers']).toContain('X-Requested-With');
    });
  });

  describe('CORS_CONFIG', () => {
    it('should have correct structure for all environments', () => {
      for (const env of ['development', 'staging', 'production'] as const) {
        const config = CORS_CONFIG[env];

        expect(config.origin).toBeDefined();
        expect(config.credentials).toBe(true);
        expect(config.methods).toBeInstanceOf(Array);
        expect(config.allowedHeaders).toBeInstanceOf(Array);
        expect(config.exposedHeaders).toBeInstanceOf(Array);
        expect(config.maxAge).toBe(86400);
      }
    });

    it('should have appropriate origins for each environment', () => {
      // Development should allow localhost
      expect(CORS_CONFIG.development.origin).toContain('http://localhost:3000');

      // Staging should allow staging domains
      expect(CORS_CONFIG.staging.origin).toContain('https://staging.agentris.com');

      // Production should allow production domains
      expect(CORS_CONFIG.production.origin).toContain('https://agentris.com');
    });
  });
});
