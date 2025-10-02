import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../trpc';
import {
  BatchAnalyzer,
  BatchPreviewGenerator,
  PreviewFormat,
  BatchGroupingStrategy
} from '@agentris/ai-engine';
import {
  BatchProcessor,
  JiraBatchSyncService,
  BatchApprovalService
} from '@agentris/services';
import {
  prisma,
  BatchRepository,
  TicketRepository,
  BatchStatus
} from '@agentris/db';
import { TRPCError } from '@trpc/server';
import { batchRateLimit } from '../middleware/batchRateLimit';

const batchRepository = new BatchRepository(prisma);
const ticketRepository = new TicketRepository(prisma);
const batchAnalyzer = new BatchAnalyzer();
const batchPreviewGenerator = new BatchPreviewGenerator();
const batchProcessor = new BatchProcessor();
const jiraBatchSync = new JiraBatchSyncService();
const batchApproval = new BatchApprovalService();

export const batchRouter = router({
  analyzeSimilarity: protectedProcedure
    .input(z.object({
      ticketIds: z.array(z.string()).min(2).max(100),
      threshold: z.number().min(0).max(1).optional().default(0.7)
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting
      await batchRateLimit(ctx.session.user.id, 'analyzeSimilarity');
      
      try {
        const tickets = await ticketRepository.getTicketsByIds(input.ticketIds);
        
        if (tickets.length < 2) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'At least 2 tickets are required for batch analysis'
          });
        }

        const analysisResult = await batchAnalyzer.analyzeTicketsForBatching(tickets);
        
        return {
          success: true,
          data: {
            groups: analysisResult.groups,
            similarityMatrix: analysisResult.similarityScores,
            recommendations: analysisResult.recommendations,
            totalTickets: tickets.length,
            groupCount: analysisResult.groups.length
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to analyze ticket similarity: ${(error as Error).message}`
        });
      }
    }),

  createBatch: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(200),
      ticketIds: z.array(z.string()).min(1).max(50),
      groupingStrategy: z.enum(['SIMILAR_CHANGES', 'SAME_OBJECT', 'CUSTOM']).optional(),
      metadata: z.record(z.any()).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      // Apply rate limiting
      await batchRateLimit(ctx.session.user.id, 'createBatch');
      
      try {
        const tickets = await ticketRepository.getTicketsByIds(input.ticketIds);
        
        if (tickets.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No valid tickets found'
          });
        }

        const strategy = (input.groupingStrategy || 'SIMILAR_CHANGES') as BatchGroupingStrategy;
        const groupingResult = await batchProcessor.groupTickets(
          tickets,
          ctx.session.user.id
        );

        if (!groupingResult.success) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: groupingResult.error || 'Failed to group tickets'
          });
        }

        const batch = await batchRepository.createBatch({
          name: input.name,
          groupingCriteria: {
            strategy,
            ticketIds: input.ticketIds,
            metadata: input.metadata
          },
          status: BatchStatus.PENDING,
          createdById: ctx.session.user.id
        });

        for (const ticketId of input.ticketIds) {
          await batchRepository.addTicketToBatch(batch.id, ticketId);
        }

        return {
          success: true,
          data: {
            batchId: batch.id,
            name: batch.name,
            ticketCount: input.ticketIds.length,
            status: batch.status,
            createdAt: batch.createdAt
          }
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create batch: ${(error as Error).message}`
        });
      }
    }),

  generateBatchPreview: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      format: z.enum(['TABLE', 'TEXT', 'DIAGRAM']).optional().default('TABLE'),
      includeDetails: z.boolean().optional().default(true),
      includeRisks: z.boolean().optional().default(true)
    }))
    .query(async ({ input, ctx }) => {
      // Apply rate limiting
      await batchRateLimit(ctx.session.user.id, 'generateBatchPreview');
      
      try {
        const batch = await batchRepository.getBatchById(input.batchId);
        
        if (!batch) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          });
        }

        const activeTickets = batch.tickets
          ?.filter(t => !t.excluded)
          .map(t => t.ticket) || [];

        if (activeTickets.length === 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'No active tickets in batch'
          });
        }

        const preview = await batchPreviewGenerator.generateBatchPreview(
          batch,
          activeTickets,
          {
            format: input.format as PreviewFormat,
            includeDetails: input.includeDetails,
            includeRisks: input.includeRisks
          }
        );

        return {
          success: true,
          data: {
            batchId: batch.id,
            format: preview.format,
            content: preview.content,
            summary: preview.summary,
            risks: preview.risks,
            generatedAt: preview.generatedAt
          }
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate preview: ${(error as Error).message}`
        });
      }
    }),

  excludeFromBatch: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      ticketId: z.string(),
      reason: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await batchProcessor.excludeTicketFromBatch(
          input.batchId,
          input.ticketId,
          input.reason
        );

        const updatedBatch = await batchRepository.getBatchById(input.batchId);
        
        return {
          success: true,
          data: {
            batchId: input.batchId,
            excludedTicketId: input.ticketId,
            remainingTickets: updatedBatch?.tickets?.filter(t => !t.excluded).length || 0
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to exclude ticket: ${(error as Error).message}`
        });
      }
    }),

  includeInBatch: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      ticketId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        await batchProcessor.includeTicketInBatch(
          input.batchId,
          input.ticketId
        );

        const updatedBatch = await batchRepository.getBatchById(input.batchId);
        
        return {
          success: true,
          data: {
            batchId: input.batchId,
            includedTicketId: input.ticketId,
            activeTickets: updatedBatch?.tickets?.filter(t => !t.excluded).length || 0
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to include ticket: ${(error as Error).message}`
        });
      }
    }),

  approveBatch: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      comments: z.string().optional(),
      modifications: z.object({
        excludedTickets: z.array(z.string()).optional(),
        metadata: z.record(z.any()).optional()
      }).optional()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        let approval;
        
        if (input.modifications && 
            (input.modifications.excludedTickets?.length || 
             input.modifications.metadata)) {
          approval = await batchApproval.modifyAndApprove(
            input.batchId,
            ctx.session.user.id,
            input.modifications,
            input.comments
          );
        } else {
          approval = await batchApproval.approveBatch(
            input.batchId,
            ctx.session.user.id,
            input.comments
          );
        }

        await jiraBatchSync.syncBatchWithJira(input.batchId, 'started');

        await batchProcessor.processBatch(input.batchId);

        return {
          success: true,
          data: {
            batchId: input.batchId,
            approvalId: approval.id,
            approvedBy: ctx.session.user.id,
            status: 'PROCESSING',
            approvedAt: approval.createdAt
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve batch: ${(error as Error).message}`
        });
      }
    }),

  rejectBatch: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const approval = await batchApproval.rejectBatch(
          input.batchId,
          ctx.session.user.id,
          input.reason
        );

        await batchRepository.updateBatchStatus(input.batchId, BatchStatus.FAILED);

        return {
          success: true,
          data: {
            batchId: input.batchId,
            rejectedBy: ctx.session.user.id,
            reason: input.reason,
            rejectedAt: approval.createdAt
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reject batch: ${(error as Error).message}`
        });
      }
    }),

  getBatchStatus: protectedProcedure
    .input(z.object({
      batchId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      try {
        const batch = await batchRepository.getBatchById(input.batchId);
        
        if (!batch) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Batch not found'
          });
        }

        const syncStatus = await jiraBatchSync.getBatchSyncStatus(input.batchId);
        const approvalStatus = await batchApproval.getBatchApprovalStatus(input.batchId);

        return {
          success: true,
          data: {
            batch: {
              id: batch.id,
              name: batch.name,
              status: batch.status,
              createdAt: batch.createdAt,
              updatedAt: batch.updatedAt
            },
            tickets: {
              total: batch.tickets?.length || 0,
              active: batch.tickets?.filter(t => !t.excluded).length || 0,
              excluded: batch.tickets?.filter(t => t.excluded).length || 0
            },
            approval: approvalStatus,
            sync: syncStatus
          }
        };
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get batch status: ${(error as Error).message}`
        });
      }
    }),

  listBatches: protectedProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'APPROVED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED']).optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0)
    }))
    .query(async ({ input, ctx }) => {
      try {
        const batches = await batchRepository.listBatches({
          status: input.status as BatchStatus | undefined,
          limit: input.limit,
          offset: input.offset,
          createdById: ctx.session.user.id
        });

        return {
          success: true,
          data: {
            batches: batches.map(b => ({
              id: b.id,
              name: b.name,
              status: b.status,
              ticketCount: b.tickets?.length || 0,
              createdAt: b.createdAt
            })),
            total: await batchRepository.countBatches({
              status: input.status as BatchStatus | undefined,
              createdById: ctx.session.user.id
            })
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to list batches: ${(error as Error).message}`
        });
      }
    }),

  rollbackBatch: protectedProcedure
    .input(z.object({
      batchId: z.string(),
      reason: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        const syncResult = await jiraBatchSync.handleBatchRollback(
          input.batchId,
          input.reason
        );

        await batchRepository.updateBatchStatus(input.batchId, BatchStatus.FAILED);

        return {
          success: true,
          data: {
            batchId: input.batchId,
            rollbackReason: input.reason,
            syncResult
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to rollback batch: ${(error as Error).message}`
        });
      }
    })
});