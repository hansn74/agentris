import { describe, it, expect, beforeEach } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { appRouter } from '../routers';

describe('App Router Structure', () => {
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: ReturnType<typeof appRouter.createCaller>;

  beforeEach(() => {
    ctx = createInnerTRPCContext({ session: null });
    caller = appRouter.createCaller(ctx);
  });

  it('should have all required routers', () => {
    const routerKeys = Object.keys(appRouter._def.procedures);

    // Check for main routers
    expect(routerKeys.some((key) => key.startsWith('auth.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('ticket.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('salesforce.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('ai.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('preview.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('deployment.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('audit.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('integration.'))).toBe(true);
    expect(routerKeys.some((key) => key.startsWith('health.'))).toBe(true);
  });

  describe('Ticket Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('ticket.')
      );

      expect(procedures).toContain('ticket.list');
      expect(procedures).toContain('ticket.getById');
      expect(procedures).toContain('ticket.create');
      expect(procedures).toContain('ticket.update');
      expect(procedures).toContain('ticket.delete');
      expect(procedures).toContain('ticket.addComment');
    });

    it('should require authentication for ticket list', async () => {
      await expect(
        caller.ticket.list({
          limit: 20,
        })
      ).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('Salesforce Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('salesforce.')
      );

      expect(procedures).toContain('salesforce.getConnectionStatus');
      expect(procedures).toContain('salesforce.syncMetadata');
      expect(procedures).toContain('salesforce.getObjects');
      expect(procedures).toContain('salesforce.getFields');
      expect(procedures).toContain('salesforce.executeSOQL');
      expect(procedures).toContain('salesforce.disconnect');
    });
  });

  describe('AI Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('ai.')
      );

      expect(procedures).toContain('ai.generateTestCase');
      expect(procedures).toContain('ai.generateCode');
      expect(procedures).toContain('ai.analyzeCode');
      expect(procedures).toContain('ai.getRequestStatus');
      expect(procedures).toContain('ai.listRequests');
      expect(procedures).toContain('ai.getUsageStats');
      expect(procedures).toContain('ai.cancelRequest');
    });
  });

  describe('Preview Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('preview.')
      );

      expect(procedures).toContain('preview.create');
      expect(procedures).toContain('preview.list');
      expect(procedures).toContain('preview.getById');
      expect(procedures).toContain('preview.getUrl');
      expect(procedures).toContain('preview.delete');
      expect(procedures).toContain('preview.getLogs');
      expect(procedures).toContain('preview.extend');
    });
  });

  describe('Deployment Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('deployment.')
      );

      expect(procedures).toContain('deployment.create');
      expect(procedures).toContain('deployment.list');
      expect(procedures).toContain('deployment.getById');
      expect(procedures).toContain('deployment.rollback');
      expect(procedures).toContain('deployment.approve');
      expect(procedures).toContain('deployment.getLogs');
      expect(procedures).toContain('deployment.getStats');
    });
  });

  describe('Audit Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('audit.')
      );

      expect(procedures).toContain('audit.list');
      expect(procedures).toContain('audit.getById');
      expect(procedures).toContain('audit.getUserActivity');
      expect(procedures).toContain('audit.getSecurityEvents');
      expect(procedures).toContain('audit.getComplianceReport');
      expect(procedures).toContain('audit.export');
      expect(procedures).toContain('audit.getStats');
    });
  });

  describe('Integration Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('integration.')
      );

      expect(procedures).toContain('integration.list');
      expect(procedures).toContain('integration.getById');
      expect(procedures).toContain('integration.create');
      expect(procedures).toContain('integration.update');
      expect(procedures).toContain('integration.delete');
      expect(procedures).toContain('integration.connect');
      expect(procedures).toContain('integration.disconnect');
      expect(procedures).toContain('integration.listConnections');
      expect(procedures).toContain('integration.testConnection');
      expect(procedures).toContain('integration.getWebhooks');
      expect(procedures).toContain('integration.createWebhook');
      expect(procedures).toContain('integration.getWebhookDeliveries');
    });
  });

  describe('Health Router', () => {
    it('should have required procedures', () => {
      const procedures = Object.keys(appRouter._def.procedures).filter((key) =>
        key.startsWith('health.')
      );

      expect(procedures).toContain('health.check');
      expect(procedures).toContain('health.ping');
      expect(procedures).toContain('health.ready');
      expect(procedures).toContain('health.live');
      expect(procedures).toContain('health.metrics');
    });

    it('should allow public access to health endpoints', async () => {
      const result = await caller.health.ping();

      expect(result.pong).toBe(true);
      expect(result.timestamp).toBeDefined();
    });
  });
});
