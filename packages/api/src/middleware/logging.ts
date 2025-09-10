import { middleware } from '../trpc';
import {
  createRequestLogger,
  generateCorrelationId,
  logRequest,
  logResponse,
  logError,
} from '../utils/logger';

export const loggingMiddleware = middleware(async ({ path, type, next, ctx, input }: any) => {
  const correlationId = generateCorrelationId();
  const requestLogger = createRequestLogger(correlationId, {
    path,
    type,
    userId: ctx.session?.user?.id,
  });

  const startTime = Date.now();

  // Log request
  logRequest(requestLogger, type.toUpperCase(), path, ctx.session?.user?.id, {
    hasInput: !!input,
    inputSize: input ? JSON.stringify(input).length : 0,
  });

  try {
    // Add logger to context for use in procedures
    const result = await next({
      ctx: {
        ...ctx,
        logger: requestLogger,
        correlationId,
      },
    });

    const duration = Date.now() - startTime;

    // Log successful response
    logResponse(requestLogger, type.toUpperCase(), path, 200, duration, {
      hasOutput: !!result,
      outputSize: result ? JSON.stringify(result).length : 0,
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log error response
    if (error instanceof Error) {
      logError(requestLogger, error, {
        path,
        type,
        duration,
      });

      // Map error to HTTP status code
      const statusCode = getStatusCodeFromError(error);
      logResponse(requestLogger, type.toUpperCase(), path, statusCode, duration, {
        error: error.message,
      });
    }

    throw error;
  }
});

// Helper function to map errors to status codes
function getStatusCodeFromError(error: any): number {
  if (error.code === 'UNAUTHORIZED') return 401;
  if (error.code === 'FORBIDDEN') return 403;
  if (error.code === 'NOT_FOUND') return 404;
  if (error.code === 'TOO_MANY_REQUESTS') return 429;
  if (error.code === 'PRECONDITION_FAILED') return 412;
  if (error.code === 'BAD_REQUEST') return 400;
  if (error.code === 'INTERNAL_SERVER_ERROR') return 500;
  return 500;
}
