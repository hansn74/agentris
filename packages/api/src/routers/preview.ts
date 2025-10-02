import { z } from 'zod';
import { router, protectedProcedure, requireConsultant } from '../trpc';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import { PreviewRepository, PreviewItemRepository } from '@agentris/db';
import type { Preview, PreviewItem } from '@agentris/db';
import { PreviewGenerator } from '@agentris/ai-engine';
import { PreviewFormat, previewFormatSchema } from '@agentris/shared';
import { checkRateLimit } from '../middleware/rateLimit';

// Event types for preview updates
interface PreviewUpdateEvent {
  previewId: string;
  type: 'created' | 'updated' | 'deleted' | 'expired';
  preview?: Preview;
  items?: PreviewItem[];
}

// Schema for Salesforce field metadata
const fieldMetadataSchema = z.object({
  name: z.string().optional(),
  label: z.string().optional(),
  type: z.string().optional(),
  required: z.boolean().optional(),
  description: z.string().optional(),
  length: z.number().optional(),
  precision: z.number().optional(),
  scale: z.number().optional(),
  defaultValue: z.union([z.string(), z.number(), z.boolean()]).optional(),
  picklistValues: z.array(z.string()).optional(),
  referenceTo: z.string().optional(),
  formula: z.string().optional(),
});

// Schema for validation rule metadata
const validationRuleSchema = z.object({
  name: z.string().optional(),
  active: z.boolean().optional(),
  description: z.string().optional(),
  errorConditionFormula: z.string().optional(),
  errorMessage: z.string().optional(),
  errorDisplayField: z.string().optional(),
});

// Schema for preview metadata
const previewMetadataSchema = z.object({
  fields: z.array(fieldMetadataSchema).optional(),
  validationRules: z.array(validationRuleSchema).optional(),
  flows: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
    processBuilder: z.boolean().optional(),
  })).optional(),
  customObjects: z.array(z.object({
    name: z.string(),
    label: z.string().optional(),
    pluralLabel: z.string().optional(),
    description: z.string().optional(),
  })).optional(),
  apexClasses: z.array(z.object({
    name: z.string(),
    apiVersion: z.string().optional(),
    status: z.string().optional(),
  })).optional(),
  layouts: z.array(z.object({
    name: z.string(),
    sections: z.array(z.object({
      name: z.string(),
      fields: z.array(z.string()),
    })).optional(),
  })).optional(),
});

// Input schemas
const generatePreviewInput = z.object({
  ticketId: z.string(),
  runId: z.string().optional(),
  metadata: previewMetadataSchema,
  expiresIn: z.number().min(3600).max(604800).default(86400), // 1 hour to 7 days, default 24 hours
});

const getFieldPreviewInput = z.object({
  previewId: z.string(),
  fieldName: z.string(),
});

const getImpactAnalysisInput = z.object({
  previewId: z.string(),
});

const getComparisonInput = z.object({
  previewId: z.string(),
  itemId: z.string().optional(),
});

export const previewRouter = router({
  generatePreview: requireConsultant
    .input(generatePreviewInput)
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting for preview generation
      const userId = ctx.session?.user?.id || 'anonymous';
      checkRateLimit(userId, 'previewGeneration');

      const previewRepo = new PreviewRepository(ctx.prisma);
      const itemRepo = new PreviewItemRepository(ctx.prisma);

      // Calculate expiration time
      const expiresAt = new Date(Date.now() + input.expiresIn * 1000);

      // Create the preview
      const preview = await previewRepo.create({
        ticketId: input.ticketId,
        runId: input.runId,
        status: 'GENERATING',
        metadata: input.metadata,
        expiresAt,
      });

      // Parse metadata to create preview items
      const items: any[] = [];
      
      if (input.metadata && typeof input.metadata === 'object') {
        const metadata = input.metadata;
        
        // Process fields
        if (metadata.fields && Array.isArray(metadata.fields)) {
          for (const field of metadata.fields) {
            items.push({
              itemType: 'FIELD',
              name: field.name || field.label || 'Unknown Field',
              currentState: null, // Would be fetched from existing Salesforce metadata
              proposedState: field,
              impact: field.required ? 'MEDIUM' : 'LOW',
              description: `${field.type || 'Text'} field: ${field.description || 'No description'}`,
            });
          }
        }

        // Process validation rules
        if (metadata.validationRules && Array.isArray(metadata.validationRules)) {
          for (const rule of metadata.validationRules) {
            items.push({
              itemType: 'VALIDATION_RULE',
              name: rule.name || 'Unknown Rule',
              currentState: null,
              proposedState: rule,
              impact: 'HIGH', // Validation rules typically have high impact
              description: `Validation: ${rule.errorMessage || 'No error message'}`,
            });
          }
        }
      }

      // Create preview items
      if (items.length > 0) {
        await itemRepo.createMany({
          previewId: preview.id,
          items,
        });
      }

      // Mark preview as ready
      const readyPreview = await previewRepo.markAsReady(preview.id);

      // Emit update event
      ctx.ee.emit(`preview:${input.ticketId}`, {
        previewId: preview.id,
        type: 'created',
        preview: readyPreview,
        items,
      } as PreviewUpdateEvent);

      return {
        preview: readyPreview,
        itemCount: items.length,
      };
    }),

  getFieldPreview: protectedProcedure
    .input(getFieldPreviewInput)
    .query(async ({ ctx, input }) => {
      const itemRepo = new PreviewItemRepository(ctx.prisma);
      
      const items = await itemRepo.findByPreviewId(input.previewId);
      const fieldItem = items.find(
        item => item.itemType === 'FIELD' && item.name === input.fieldName
      );

      if (!fieldItem) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Field preview not found',
        });
      }

      return {
        field: fieldItem,
        metadata: fieldItem.proposedState,
        impact: fieldItem.impact,
        description: fieldItem.description,
      };
    }),

  getImpactAnalysis: protectedProcedure
    .input(getImpactAnalysisInput)
    .query(async ({ ctx, input }) => {
      const itemRepo = new PreviewItemRepository(ctx.prisma);
      
      const impactCounts = await itemRepo.countByImpact(input.previewId);
      const typeCounts = await itemRepo.countByType(input.previewId);
      const highImpactItems = await itemRepo.getHighImpactItems(input.previewId);

      return {
        summary: {
          totalChanges: Object.values(typeCounts).reduce((a, b) => a + b, 0),
          byImpact: impactCounts,
          byType: typeCounts,
        },
        highImpactItems,
        riskScore: calculateRiskScore(impactCounts),
      };
    }),

  getComparison: protectedProcedure
    .input(getComparisonInput)
    .query(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      const itemRepo = new PreviewItemRepository(ctx.prisma);

      const preview = await previewRepo.findByIdWithItems(input.previewId);
      
      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found',
        });
      }

      if (input.itemId) {
        const item = preview.items.find(i => i.id === input.itemId);
        if (!item) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Preview item not found',
          });
        }
        return {
          item,
          current: item.currentState,
          proposed: item.proposedState,
        };
      }

      return {
        preview,
        items: preview.items,
        summary: {
          total: preview.items.length,
          added: preview.items.filter(i => !i.currentState).length,
          modified: preview.items.filter(i => i.currentState).length,
        },
      };
    }),

  subscribeToPreviewUpdates: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .subscription(({ ctx, input }) => {
      return observable<PreviewUpdateEvent>((emit) => {
        const handler = (data: PreviewUpdateEvent) => {
          emit.next(data);
        };

        // Subscribe to preview events for this ticket
        ctx.ee.on(`preview:${input.ticketId}`, handler);

        // Cleanup on unsubscribe
        return () => {
          ctx.ee.off(`preview:${input.ticketId}`, handler);
        };
      });
    }),

  // Keep existing endpoints for compatibility
  list: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().optional(),
        status: z.string().optional(),
        limit: z.number().min(1).max(100).default(20),
        cursor: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      
      if (input.ticketId) {
        const previews = await previewRepo.findByTicketId(input.ticketId);
        return {
          items: previews.slice(0, input.limit),
          nextCursor: previews.length > input.limit ? previews[input.limit - 1].id : undefined,
        };
      }

      return {
        items: [],
        nextCursor: undefined,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      const preview = await previewRepo.findByIdWithItems(input.id);
      
      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found',
        });
      }

      return preview;
    }),

  delete: requireConsultant
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      await previewRepo.delete(input.id);
      
      // Emit delete event
      ctx.ee.emit(`preview:delete`, {
        previewId: input.id,
        type: 'deleted',
      } as PreviewUpdateEvent);

      return { success: true };
    }),

  extend: requireConsultant
    .input(
      z.object({
        id: z.string(),
        expiresIn: z.number().min(3600).max(604800),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      
      const newExpiresAt = new Date(Date.now() + input.expiresIn * 1000);
      const preview = await previewRepo.update(input.id, {
        expiresAt: newExpiresAt,
        status: 'READY',
      });

      return {
        id: preview.id,
        expiresAt: preview.expiresAt,
      };
    }),

  // New endpoint to expire old previews (can be called by a cron job)
  cleanupExpired: requireConsultant
    .mutation(async ({ ctx }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      
      const expiredCount = await previewRepo.expireOldPreviews();
      const deletedCount = await previewRepo.deleteExpiredPreviews(48); // Keep expired for 48 hours

      return {
        expired: expiredCount,
        deleted: deletedCount,
      };
    }),

  // Generate intelligent preview with format detection
  generateIntelligentPreview: requireConsultant
    .input(z.object({
      ticketId: z.string(),
      ticketContent: z.string(),
      format: previewFormatSchema.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting for preview generation
      const userId = ctx.session?.user?.id || 'anonymous';
      checkRateLimit(userId, 'previewGeneration');

      const previewRepo = new PreviewRepository(ctx.prisma);
      const generator = new PreviewGenerator();

      // Generate preview with AI
      const result = await generator.generatePreview({
        ticketId: input.ticketId,
        ticketContent: input.ticketContent,
        format: input.format,
      });

      // Store preview in database
      const preview = await previewRepo.createWithPreviewData({
        ticketId: input.ticketId,
        format: result.format,
        previewData: result.data,
        expiresInHours: 24,
      });

      // Emit update event
      ctx.ee.emit(`preview:${input.ticketId}`, {
        previewId: preview.id,
        type: 'created',
        preview,
      } as PreviewUpdateEvent);

      return {
        id: preview.id,
        format: result.format,
        data: result.data,
        availableFormats: result.availableFormats,
        generatedAt: preview.generatedAt,
        expiresAt: preview.expiresAt,
      };
    }),

  // Get available preview formats for a ticket
  getAvailableFormats: protectedProcedure
    .input(z.object({ ticketId: z.string() }))
    .query(async ({ ctx, input }) => {
      const previewRepo = new PreviewRepository(ctx.prisma);
      const result = await previewRepo.getPreviewWithFormats(input.ticketId);

      return {
        currentFormat: result.currentPreview ? 
          (result.currentPreview.metadata as any)?.type : null,
        availableFormats: result.availableFormats,
        previewId: result.currentPreview?.id,
      };
    }),

  // Switch preview format
  switchPreviewFormat: requireConsultant
    .input(z.object({
      ticketId: z.string(),
      ticketContent: z.string(),
      newFormat: previewFormatSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting for preview format switching
      const userId = ctx.session?.user?.id || 'anonymous';
      checkRateLimit(userId, 'previewSwitch');

      const previewRepo = new PreviewRepository(ctx.prisma);
      const generator = new PreviewGenerator();

      // Expire existing previews
      await previewRepo.expirePreviewsForTicket(input.ticketId);

      // Generate new preview in requested format
      const result = await generator.generatePreview({
        ticketId: input.ticketId,
        ticketContent: input.ticketContent,
        format: input.newFormat,
      });

      // Store new preview
      const preview = await previewRepo.createWithPreviewData({
        ticketId: input.ticketId,
        format: input.newFormat,
        previewData: result.data,
        expiresInHours: 24,
      });

      // Emit update event
      ctx.ee.emit(`preview:${input.ticketId}`, {
        previewId: preview.id,
        type: 'updated',
        preview,
      } as PreviewUpdateEvent);

      return {
        id: preview.id,
        format: input.newFormat,
        data: result.data,
        generatedAt: preview.generatedAt,
        expiresAt: preview.expiresAt,
      };
    }),
});

// Helper function to calculate risk score based on impact counts
function calculateRiskScore(impactCounts: Record<string, number>): number {
  const weights = {
    HIGH: 3,
    MEDIUM: 2,
    LOW: 1,
  };

  let score = 0;
  let total = 0;

  for (const [impact, count] of Object.entries(impactCounts)) {
    const weight = weights[impact as keyof typeof weights] || 1;
    score += weight * count;
    total += count;
  }

  if (total === 0) return 0;
  
  // Normalize to 0-100 scale
  return Math.round((score / (total * 3)) * 100);
}