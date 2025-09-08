import { z } from 'zod';
import { router, protectedProcedure, requireConsultant, requireManager } from '../trpc';
import { TRPCError } from '@trpc/server';

export const ticketRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        assignedToId: z.string().optional(),
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
      message: 'Ticket not found',
    });
  }),

  create: requireConsultant
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().min(1),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        type: z.enum(['BUG', 'FEATURE', 'SUPPORT', 'TASK']),
        assignedToId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return {
        id: 'temp-id',
        ...input,
        status: 'OPEN',
        createdById: ctx.session?.user?.id || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }),

  update: requireConsultant
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().min(1).optional(),
        status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        assignedToId: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;

      return {
        id,
        ...data,
        updatedAt: new Date(),
      };
    }),

  delete: requireManager.input(z.object({ id: z.string() })).mutation(async () => {
    return { success: true };
  }),

  addComment: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return {
        id: 'temp-comment-id',
        content: input.content,
        ticketId: input.ticketId,
        authorId: ctx.session?.user?.id || 'unknown',
        author: {
          id: ctx.session?.user?.id || 'unknown',
          name: ctx.session?.user?.name || 'User',
          email: ctx.session?.user?.email || '',
        },
        createdAt: new Date(),
      };
    }),
});
