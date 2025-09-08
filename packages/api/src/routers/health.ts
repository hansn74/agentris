import { router, publicProcedure } from '../trpc';
import { prisma } from '@agentris/db';
import { logger } from '../utils/logger';

export const healthRouter = router({
  check: publicProcedure.query(async () => {
    const startTime = Date.now();
    const checks: Record<string, any> = {};

    // Check database connectivity
    try {
      const dbStart = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      checks.database = {
        status: 'healthy',
        responseTime: Date.now() - dbStart,
      };
    } catch (error) {
      logger.error('Database health check failed', error);
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check Redis connectivity (if configured)
    if (process.env.REDIS_URL) {
      try {
        // Redis check would go here
        checks.redis = {
          status: 'not_implemented',
          message: 'Redis health check not yet implemented',
        };
      } catch (error) {
        logger.error('Redis health check failed', error);
        checks.redis = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Overall status
    const allHealthy = Object.values(checks).every(
      (check) => check.status === 'healthy' || check.status === 'not_implemented'
    );

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || 'unknown',
      environment: process.env.NODE_ENV || 'development',
      checks,
      responseTime: Date.now() - startTime,
    };
  }),

  ping: publicProcedure.query(() => {
    return {
      pong: true,
      timestamp: new Date().toISOString(),
    };
  }),

  ready: publicProcedure.query(async () => {
    // Check if the service is ready to accept traffic
    try {
      // Check database
      await prisma.$queryRaw`SELECT 1`;

      return {
        ready: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Readiness check failed', error);
      return {
        ready: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }),

  live: publicProcedure.query(() => {
    // Simple liveness check - if the service can respond, it's alive
    return {
      alive: true,
      timestamp: new Date().toISOString(),
      pid: process.pid,
      memory: process.memoryUsage(),
    };
  }),

  metrics: publicProcedure.query(() => {
    // Basic metrics endpoint
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    };
  }),
});
