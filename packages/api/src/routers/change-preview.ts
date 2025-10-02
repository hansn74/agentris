import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { observable } from '@trpc/server/observable';
import { EventEmitter } from 'events';
import {
  ChangePreviewService,
  ImpactAnalyzerService,
  MetadataComparatorService,
  type DiffRepresentation
} from '@agentris/services';
import {
  type GeneratedMetadata,
  type PreviewMetadata,
  sanitizeMetadata,
  GeneratedMetadataSchema
} from '@agentris/shared';

// Event emitter for real-time updates
const previewEvents = new EventEmitter();

// In-memory store for preview data (TODO: migrate to Redis for production)
const previewStore = new Map<string, PreviewMetadata>();

export const changePreviewRouter = router({
  generatePreview: protectedProcedure
    .input(z.object({
      ticketId: z.string(),
      runId: z.string().optional()
    }))
    .mutation(async ({ input, ctx }) => {
      const { ticketId, runId } = input;
      
      // Generate a unique preview ID
      const previewId = `preview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Fetch ticket data from database
        const ticket = await ctx.db.ticket.findUnique({
          where: { id: ticketId },
          include: {
            automationRuns: {
              where: runId ? { id: runId } : undefined,
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        });
        
        if (!ticket) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Ticket not found'
          });
        }
        
        // Get the latest automation run if not specified
        const automationRun = ticket.automationRuns[0];
        
        if (!automationRun) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No automation run found for this ticket'
          });
        }
        
        // Initialize services
        const changePreviewService = new ChangePreviewService();
        const impactAnalyzer = new ImpactAnalyzerService();
        const comparator = new MetadataComparatorService();
        
        // Parse and sanitize the generated metadata from the automation run
        let generatedMetadata: GeneratedMetadata;
        try {
          generatedMetadata = sanitizeMetadata(automationRun.metadata);
        } catch (error) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Invalid metadata format in automation run'
          });
        }
        const proposedFields = generatedMetadata.fields;
        const proposedRules = generatedMetadata.validationRules;
        
        // Get current state (mock for now - in production, fetch from Salesforce)
        const currentState = {
          fields: [],
          validationRules: [],
          objectName: generatedMetadata.objectName || 'CustomObject__c'
        };
        
        // Generate diff representation
        const diffData = comparator.generateDiff(
          currentState,
          proposedFields,
          proposedRules
        );
        
        // Analyze impacts
        const fieldImpacts = proposedFields.map((field) => 
          impactAnalyzer.analyzeFieldImpacts(field, currentState.fields)
        ).flat();
        
        const ruleConflicts = proposedRules.map((rule) =>
          impactAnalyzer.checkValidationRuleConflicts(rule, currentState.validationRules)
        ).flat();
        
        // Calculate risk assessment
        const allChanges = [
          ...proposedFields.map((f) => ({ type: 'field' as const, operation: 'create' as const, ...f })),
          ...proposedRules.map((r) => ({ type: 'validationRule' as const, operation: 'create' as const, ...r }))
        ];
        const riskAssessment = impactAnalyzer.getRiskScore(allChanges);
        
        // Generate human-readable descriptions
        const fieldDescriptions = proposedFields.map((field) => ({
          name: field.name,
          description: changePreviewService.generateFieldDescription(field),
          properties: changePreviewService.formatFieldProperties(field)
        }));
        
        const ruleDescriptions = proposedRules.map((rule) => ({
          name: rule.name,
          description: changePreviewService.generateValidationRuleDescription(rule)
        }));
        
        // Create preview record in database
        const preview = await ctx.db.preview.create({
          data: {
            id: previewId,
            ticketId,
            runId: automationRun.id,
            status: 'READY',
            metadata: {
              diffData,
              fieldDescriptions,
              ruleDescriptions,
              fieldImpacts,
              ruleConflicts,
              riskAssessment
            },
            expiresAt: new Date(Date.now() + 3600000) // Expires in 1 hour
          }
        });
        
        // Store in memory for quick access (with type safety)
        const previewData: PreviewMetadata = {
          diffData,
          fieldDescriptions,
          ruleDescriptions,
          fieldImpacts,
          ruleConflicts,
          riskAssessment
        };
        previewStore.set(previewId, previewData);
        
        // Emit event for real-time subscribers
        previewEvents.emit(`preview:${previewId}`, {
          status: 'ready',
          diffData
        });
        
        return {
          id: previewId,
          status: 'ready',
          summary: changePreviewService.getChangesSummary(allChanges),
          riskLevel: riskAssessment.level
        };
      } catch (error) {
        console.error('Error generating preview:', error);
        
        // Clean up any partial data
        if (previewId && previewStore.has(previewId)) {
          previewStore.delete(previewId);
        }
        
        // Provide more specific error messages
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  getFieldPreview: protectedProcedure
    .input(z.object({
      previewId: z.string(),
      fieldName: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const { previewId, fieldName } = input;
      
      // Get preview from database
      const preview = await ctx.db.preview.findUnique({
        where: { id: previewId }
      });
      
      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found or expired'
        });
      }
      
      const metadata = preview.metadata as any;
      const fieldDescription = metadata.fieldDescriptions?.find(
        (f: any) => f.name === fieldName
      );
      
      if (!fieldDescription) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Field not found in preview'
        });
      }
      
      return fieldDescription;
    }),

  getImpactAnalysis: protectedProcedure
    .input(z.object({
      previewId: z.string()
    }))
    .query(async ({ input, ctx }) => {
      const { previewId } = input;
      
      // Get preview from database
      const preview = await ctx.db.preview.findUnique({
        where: { id: previewId }
      });
      
      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found or expired'
        });
      }
      
      const metadata = preview.metadata as any;
      
      return {
        fieldImpacts: metadata.fieldImpacts || [],
        ruleConflicts: metadata.ruleConflicts || [],
        riskAssessment: metadata.riskAssessment || {
          score: 0,
          level: 'low',
          factors: [],
          recommendations: []
        }
      };
    }),

  getComparison: protectedProcedure
    .input(z.object({
      previewId: z.string(),
      orgId: z.string().optional()
    }))
    .query(async ({ input, ctx }) => {
      const { previewId } = input;
      
      // Get preview from database or memory store
      const previewData = previewStore.get(previewId);
      
      if (previewData) {
        return previewData.diffData as DiffRepresentation;
      }
      
      const preview = await ctx.db.preview.findUnique({
        where: { id: previewId }
      });
      
      if (!preview) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Preview not found or expired'
        });
      }
      
      const metadata = preview.metadata as any;
      return metadata.diffData as DiffRepresentation;
    }),

  subscribeToPreviewUpdates: protectedProcedure
    .input(z.object({
      previewId: z.string()
    }))
    .subscription(({ input }) => {
      const { previewId } = input;
      
      return observable<{ status: string; diffData?: DiffRepresentation }>((emit) => {
        const onUpdate = (data: { status: string; diffData?: DiffRepresentation }) => {
          emit.next(data);
        };
        
        // Subscribe to preview events
        previewEvents.on(`preview:${previewId}`, onUpdate);
        
        // Set max listeners to prevent memory leaks
        previewEvents.setMaxListeners(100);
        
        // Send initial data if available
        const previewData = previewStore.get(previewId);
        if (previewData) {
          emit.next({
            status: 'ready',
            diffData: previewData.diffData
          });
        }
        
        // Cleanup on unsubscribe
        return () => {
          previewEvents.removeListener(`preview:${previewId}`, onUpdate);
          
          // Clean up old preview data (older than 1 hour)
          const now = Date.now();
          for (const [id, data] of previewStore.entries()) {
            // Remove old entries (assuming they have a timestamp)
            if (id.startsWith('preview_')) {
              const timestamp = parseInt(id.split('_')[1]);
              if (now - timestamp > 3600000) {
                previewStore.delete(id);
                previewEvents.removeAllListeners(`preview:${id}`);
              }
            }
          }
        };
      });
    }),

  listPreviews: protectedProcedure
    .input(z.object({
      ticketId: z.string().optional(),
      limit: z.number().min(1).max(100).default(10)
    }))
    .query(async ({ input, ctx }) => {
      const { ticketId, limit } = input;
      
      const previews = await ctx.db.preview.findMany({
        where: {
          ticketId: ticketId || undefined,
          expiresAt: { gt: new Date() }
        },
        orderBy: { generatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          ticketId: true,
          runId: true,
          status: true,
          generatedAt: true,
          expiresAt: true
        }
      });
      
      return previews;
    }),

  deletePreview: protectedProcedure
    .input(z.object({
      previewId: z.string()
    }))
    .mutation(async ({ input, ctx }) => {
      const { previewId } = input;
      
      // Remove from memory store
      previewStore.delete(previewId);
      
      // Delete from database
      await ctx.db.preview.delete({
        where: { id: previewId }
      });
      
      // Emit deletion event
      previewEvents.emit(`preview:${previewId}`, {
        status: 'deleted'
      });
      
      return { success: true };
    })
});