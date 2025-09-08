import { z } from 'zod';
import { router, protectedProcedure, requireConsultant, requireManager } from '../trpc';

export const salesforceRouter = router({
  getConnectionStatus: protectedProcedure.query(async () => {
    return {
      connected: false,
      lastSync: null,
      orgId: null,
    };
  }),

  syncMetadata: requireConsultant
    .input(
      z.object({
        objectTypes: z.array(z.string()).min(1),
        includeFields: z.boolean().default(true),
        includeRelationships: z.boolean().default(true),
      })
    )
    .mutation(async () => {
      return {
        jobId: 'temp-job-id',
        status: 'PENDING',
      };
    }),

  getObjects: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async () => {
      return [];
    }),

  getFields: protectedProcedure
    .input(
      z.object({
        objectName: z.string(),
      })
    )
    .query(async () => {
      return [];
    }),

  executeSOQL: requireConsultant
    .input(
      z.object({
        query: z.string().min(1),
        maxRecords: z.number().min(1).max(2000).default(200),
      })
    )
    .mutation(async () => {
      return {
        queryId: 'temp-query-id',
        message: 'Query submitted for execution',
      };
    }),

  disconnect: requireManager.mutation(async () => {
    return { success: true };
  }),
});
