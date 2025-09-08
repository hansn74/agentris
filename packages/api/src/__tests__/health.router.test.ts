import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { healthRouter } from '../routers/health';
import { prisma } from '@agentris/db';

// Mock Prisma
vi.mock('@agentris/db', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}));

// Mock logger
vi.mock('../utils/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

describe('Health Router', () => {
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: ReturnType<typeof healthRouter.createCaller>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createInnerTRPCContext({ session: null });
    caller = healthRouter.createCaller(ctx);
  });

  describe('check', () => {
    it('should return healthy status when database is connected', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await caller.check();

      expect(result.status).toBe('healthy');
      expect(result.checks.database.status).toBe('healthy');
      expect(result.checks.database.responseTime).toBeDefined();
      expect(result.uptime).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should return degraded status when database is down', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection failed'));

      const result = await caller.check();

      expect(result.status).toBe('degraded');
      expect(result.checks.database.status).toBe('unhealthy');
      expect(result.checks.database.error).toBe('Connection failed');
    });

    it('should include Redis check when REDIS_URL is set', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);
      const originalRedisUrl = process.env.REDIS_URL;
      process.env.REDIS_URL = 'redis://localhost:6379';

      const result = await caller.check();

      expect(result.checks.redis).toBeDefined();
      expect(result.checks.redis.status).toBe('not_implemented');

      process.env.REDIS_URL = originalRedisUrl;
    });

    it('should include version and environment info', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await caller.check();

      expect(result.environment).toBeDefined();
      expect(result.version).toBeDefined();
      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('ping', () => {
    it('should return pong', async () => {
      const result = await caller.ping();

      expect(result.pong).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('ready', () => {
    it('should return ready when database is accessible', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }]);

      const result = await caller.ready();

      expect(result.ready).toBe(true);
      expect(result.timestamp).toBeDefined();
    });

    it('should return not ready when database is down', async () => {
      vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Database offline'));

      const result = await caller.ready();

      expect(result.ready).toBe(false);
      expect(result.error).toBe('Database offline');
      expect(result.timestamp).toBeDefined();
    });
  });

  describe('live', () => {
    it('should return alive with process info', async () => {
      const result = await caller.live();

      expect(result.alive).toBe(true);
      expect(result.timestamp).toBeDefined();
      expect(result.pid).toBe(process.pid);
      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeGreaterThan(0);
    });
  });

  describe('metrics', () => {
    it('should return system metrics', async () => {
      const result = await caller.metrics();

      expect(result.timestamp).toBeDefined();
      expect(result.uptime).toBeGreaterThanOrEqual(0);

      // Memory metrics
      expect(result.memory).toBeDefined();
      expect(result.memory.heapUsed).toBeGreaterThan(0);
      expect(result.memory.heapTotal).toBeGreaterThan(0);
      expect(result.memory.rss).toBeGreaterThan(0);

      // CPU metrics
      expect(result.cpu).toBeDefined();
      expect(result.cpu.user).toBeDefined();
      expect(result.cpu.system).toBeDefined();

      // Process info
      expect(result.process).toBeDefined();
      expect(result.process.pid).toBe(process.pid);
      expect(result.process.version).toBe(process.version);
      expect(result.process.platform).toBe(process.platform);
      expect(result.process.arch).toBe(process.arch);
    });
  });
});
