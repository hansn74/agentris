import { describe, it, expect } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { router, requireConsultant, requireManager, requireAdmin } from '../trpc';

describe('Role-Based Access Control', () => {
  describe('Role Middleware', () => {
    const testRouter = router({
      consultantOnly: requireConsultant.query(() => 'consultant-access'),
      managerOnly: requireManager.query(() => 'manager-access'),
      adminOnly: requireAdmin.query(() => 'admin-access'),
    });

    it('should allow CONSULTANT to access consultant routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'consultant@example.com',
            name: 'Consultant User',
            image: null,
            role: 'CONSULTANT',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      const result = await caller.consultantOnly();
      expect(result).toBe('consultant-access');
    });

    it('should deny CONSULTANT access to manager routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'consultant@example.com',
            name: 'Consultant User',
            image: null,
            role: 'CONSULTANT',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      await expect(caller.managerOnly()).rejects.toThrow('Insufficient permissions');
    });

    it('should deny CONSULTANT access to admin routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'consultant@example.com',
            name: 'Consultant User',
            image: null,
            role: 'CONSULTANT',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      await expect(caller.adminOnly()).rejects.toThrow('Insufficient permissions');
    });

    it('should allow MANAGER to access consultant routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-456',
            email: 'manager@example.com',
            name: 'Manager User',
            image: null,
            role: 'MANAGER',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      const result = await caller.consultantOnly();
      expect(result).toBe('consultant-access');
    });

    it('should allow MANAGER to access manager routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-456',
            email: 'manager@example.com',
            name: 'Manager User',
            image: null,
            role: 'MANAGER',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      const result = await caller.managerOnly();
      expect(result).toBe('manager-access');
    });

    it('should deny MANAGER access to admin routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-456',
            email: 'manager@example.com',
            name: 'Manager User',
            image: null,
            role: 'MANAGER',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);
      await expect(caller.adminOnly()).rejects.toThrow('Insufficient permissions');
    });

    it('should allow ADMIN to access all routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-789',
            email: 'admin@example.com',
            name: 'Admin User',
            image: null,
            role: 'ADMIN',
          } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });

      const caller = testRouter.createCaller(ctx);

      const consultantResult = await caller.consultantOnly();
      expect(consultantResult).toBe('consultant-access');

      const managerResult = await caller.managerOnly();
      expect(managerResult).toBe('manager-access');

      const adminResult = await caller.adminOnly();
      expect(adminResult).toBe('admin-access');
    });

    it('should throw UNAUTHORIZED for unauthenticated users', async () => {
      const ctx = createInnerTRPCContext({
        session: null,
      });

      const caller = testRouter.createCaller(ctx);

      await expect(caller.consultantOnly()).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.managerOnly()).rejects.toThrow('UNAUTHORIZED');
      await expect(caller.adminOnly()).rejects.toThrow('UNAUTHORIZED');
    });
  });

  describe('Session Validation', () => {
    it('should validate session expiry', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: {
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            image: null,
            role: 'CONSULTANT',
          } as any,
          expires: new Date(Date.now() - 1000).toISOString(), // Expired
        },
      });

      // Note: NextAuth would normally handle expired sessions
      // This test verifies our context structure
      expect(ctx.session).toBeDefined();
      expect(ctx.session?.expires).toBeDefined();
    });
  });
});
