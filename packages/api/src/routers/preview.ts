import { z } from 'zod';
import { router, protectedProcedure, requireConsultant } from '../trpc';
import { TRPCError } from '@trpc/server';

export const previewRouter = router({
  create: requireConsultant
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().optional(),
        projectId: z.string(),
        branchName: z.string(),
        environmentVariables: z.record(z.string()).optional(),
        expiresIn: z.number().min(3600).max(604800).default(86400),
      })
    )
    .mutation(async ({ ctx }) => {
      return {
        id: 'temp-preview-id',
        name: 'Preview',
        status: 'PENDING',
        createdById: ctx.session?.user?.id || 'unknown',
        expiresAt: new Date(Date.now() + 86400 * 1000),
      };
    }),

  list: protectedProcedure
    .input(
      z.object({
        projectId: z.string().optional(),
        status: z.enum(['PENDING', 'BUILDING', 'READY', 'ERROR', 'EXPIRED']).optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async () => {
      return {
        items: [],
        nextCursor: undefined,
      };
    }),

  getById: protectedProcedure.input(z.object({ id: z.string() })).query(async () => {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Preview not found',
    });
  }),

  getUrl: protectedProcedure.input(z.object({ id: z.string() })).query(async () => {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Preview not found',
    });
  }),

  delete: requireConsultant.input(z.object({ id: z.string() })).mutation(async () => {
    return { success: true };
  }),

  getLogs: protectedProcedure
    .input(
      z.object({
        previewId: z.string(),
        level: z.enum(['INFO', 'WARNING', 'ERROR']).optional(),
        limit: z.number().min(1).max(500).default(100),
      })
    )
    .query(async () => {
      return [];
    }),

  extend: requireConsultant
    .input(
      z.object({
        id: z.string(),
        expiresIn: z.number().min(3600).max(604800),
      })
    )
    .mutation(async () => {
      return {
        id: 'temp-preview-id',
        expiresAt: new Date(Date.now() + 86400 * 1000),
      };
    }),
});
