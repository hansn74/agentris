// CORS configuration for tRPC endpoints
// This is used in Next.js API routes

export const CORS_CONFIG = {
  development: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-Id',
    ],
    maxAge: 86400, // 24 hours
  },
  staging: {
    origin: ['https://staging.agentris.com', 'https://preview.agentris.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-Id',
    ],
    maxAge: 86400,
  },
  production: {
    origin: ['https://agentris.com', 'https://www.agentris.com', 'https://app.agentris.com'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Correlation-Id',
    ],
    maxAge: 86400,
  },
} as const;

export type Environment = keyof typeof CORS_CONFIG;

// Get CORS config based on environment
export function getCorsConfig(env?: string): (typeof CORS_CONFIG)[Environment] {
  const environment = (env || process.env.NODE_ENV || 'development') as Environment;
  return CORS_CONFIG[environment] || CORS_CONFIG.development;
}

// Helper to check if origin is allowed
export function isOriginAllowed(origin: string | undefined, env?: string): boolean {
  if (!origin) return false;

  const config = getCorsConfig(env);
  const allowedOrigins = Array.isArray(config.origin) ? config.origin : [config.origin];

  return allowedOrigins.some((allowed) => {
    if (typeof allowed === 'string') {
      return allowed === origin;
    }
    return false;
  });
}

// CORS headers for Next.js API routes
export function getCorsHeaders(origin: string | undefined, env?: string): Record<string, string> {
  const config = getCorsConfig(env);
  const headers: Record<string, string> = {};

  if (origin && isOriginAllowed(origin, env)) {
    headers['Access-Control-Allow-Origin'] = origin;
  } else if (!Array.isArray(config.origin)) {
    headers['Access-Control-Allow-Origin'] = config.origin as string;
  }

  if (config.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
  headers['Access-Control-Allow-Headers'] = config.allowedHeaders.join(', ');
  headers['Access-Control-Expose-Headers'] = config.exposedHeaders.join(', ');
  headers['Access-Control-Max-Age'] = String(config.maxAge);

  return headers;
}

// Middleware function for Next.js API routes
export function withCors(handler: any) {
  return async (req: any, res: any) => {
    const origin = req.headers.origin;
    const corsHeaders = getCorsHeaders(origin);

    // Set CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      res.setHeader(key, value);
    });

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.status(200).end();
      return;
    }

    return handler(req, res);
  };
}
