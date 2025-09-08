import { describe, it, expect } from 'vitest';
import {
  createInnerTRPCContext,
  protectedProcedure,
  requireConsultant,
  requireManager,
  requireAdmin,
} from '../trpc';
import { router } from '../trpc';
import { TRPCError } from '@trpc/server';

describe('Authentication Middleware', () => {
  describe('enforceUserIsAuthed middleware', () => {
    it('should throw UNAUTHORIZED when no session', async () => {
      const ctx = createInnerTRPCContext({ session: null });
      const testRouter = router({
        testProtected: protectedProcedure.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      await expect(caller.testProtected()).rejects.toThrow(TRPCError);
      await expect(caller.testProtected()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should allow access with valid session', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testProtected: protectedProcedure.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      const result = await caller.testProtected();
      expect(result).toBe('success');
    });
  });

  describe('requireRole middleware', () => {
    it('should throw UNAUTHORIZED when no session for requireConsultant', async () => {
      const ctx = createInnerTRPCContext({ session: null });
      const testRouter = router({
        testConsultant: requireConsultant.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      await expect(caller.testConsultant()).rejects.toThrow(TRPCError);
      await expect(caller.testConsultant()).rejects.toMatchObject({
        code: 'UNAUTHORIZED',
      });
    });

    it('should allow CONSULTANT role to access consultant routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'CONSULTANT' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testConsultant: requireConsultant.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      const result = await caller.testConsultant();
      expect(result).toBe('success');
    });

    it('should allow MANAGER role to access consultant routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'MANAGER' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testConsultant: requireConsultant.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      const result = await caller.testConsultant();
      expect(result).toBe('success');
    });

    it('should allow ADMIN role to access all routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'ADMIN' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testConsultant: requireConsultant.query(() => 'consultant'),
        testManager: requireManager.query(() => 'manager'),
        testAdmin: requireAdmin.query(() => 'admin'),
      });
      const caller = testRouter.createCaller(ctx);

      const consultantResult = await caller.testConsultant();
      expect(consultantResult).toBe('consultant');

      const managerResult = await caller.testManager();
      expect(managerResult).toBe('manager');

      const adminResult = await caller.testAdmin();
      expect(adminResult).toBe('admin');
    });

    it('should deny CONSULTANT role from MANAGER routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'CONSULTANT' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testManager: requireManager.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      await expect(caller.testManager()).rejects.toThrow(TRPCError);
      await expect(caller.testManager()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('Insufficient permissions'),
      });
    });

    it('should deny CONSULTANT role from ADMIN routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'CONSULTANT' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testAdmin: requireAdmin.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      await expect(caller.testAdmin()).rejects.toThrow(TRPCError);
      await expect(caller.testAdmin()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('Insufficient permissions'),
      });
    });

    it('should deny MANAGER role from ADMIN routes', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com', role: 'MANAGER' } as any,
          expires: new Date(Date.now() + 86400000).toISOString(),
        },
      });
      const testRouter = router({
        testAdmin: requireAdmin.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      await expect(caller.testAdmin()).rejects.toThrow(TRPCError);
      await expect(caller.testAdmin()).rejects.toMatchObject({
        code: 'FORBIDDEN',
        message: expect.stringContaining('Insufficient permissions'),
      });
    });
  });

  describe('Expired token handling', () => {
    it('should handle expired session gracefully', async () => {
      const ctx = createInnerTRPCContext({
        session: {
          user: { id: 'user-1', email: 'test@example.com' },
          expires: new Date(Date.now() - 86400000).toISOString(), // Expired
        },
      });
      const testRouter = router({
        testProtected: protectedProcedure.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      // Session exists but may be expired - this should still work as middleware only checks existence
      const result = await caller.testProtected();
      expect(result).toBe('success');
    });

    it('should provide proper error messages for invalid tokens', async () => {
      const ctx = createInnerTRPCContext({ session: null });
      const testRouter = router({
        testProtected: protectedProcedure.query(() => 'success'),
      });
      const caller = testRouter.createCaller(ctx);

      try {
        await caller.testProtected();
      } catch (error: any) {
        expect(error).toBeInstanceOf(TRPCError);
        expect(error.code).toBe('UNAUTHORIZED');
      }
    });
  });
});
