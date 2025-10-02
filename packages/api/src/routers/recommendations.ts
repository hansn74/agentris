import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import {
  PatternAnalyzer,
  RecommendationEngine,
  ConflictDetector
} from '@agentris/ai-engine';
import { FeedbackProcessor } from '@agentris/services';
import { RecommendationRepository } from '@agentris/db';
import { MetadataService } from '@agentris/integrations-salesforce';
import { LLMService } from '@agentris/ai-engine';
import { ImpactAnalyzerService } from '@agentris/services';
import type {
  Recommendation,
  RecommendationFeedback,
  OrgPatterns,
  ExtendedConflict
} from '@agentris/shared';

const recommendationSchema = z.object({
  id: z.string(),
  type: z.enum(['naming', 'fieldType', 'relationship', 'validation', 'automation', 'conflict']),
  category: z.enum(['suggestion', 'warning', 'error']),
  title: z.string(),
  description: z.string(),
  rationale: z.string(),
  confidence: z.number().min(0).max(1),
  examples: z.array(z.string()).optional(),
  impact: z.enum(['low', 'medium', 'high']).optional(),
  relatedChanges: z.array(z.any()).optional()
});

const feedbackSchema = z.object({
  recommendationId: z.string(),
  action: z.enum(['accepted', 'rejected', 'modified']),
  modifiedValue: z.any().optional(),
  reason: z.string().optional(),
  timestamp: z.date().default(() => new Date())
});

export const recommendationsRouter = router({
  analyzeOrgContext: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        orgId: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const metadataService = new MetadataService();
        const patternAnalyzer = new PatternAnalyzer(metadataService);
        
        const patterns = await patternAnalyzer.analyzeOrgPatterns(
          input.orgId,
          input.ticketId
        );

        return {
          success: true,
          patterns,
          summary: {
            namingPatternCount: patterns.namingPatterns.length,
            fieldTypePatternCount: patterns.fieldTypePatterns.length,
            relationshipCount: patterns.relationshipPatterns.length,
            validationPatternCount: patterns.validationPatterns.length,
            automationTypes: patterns.automationPatterns.map(p => p.type)
          }
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to analyze org context: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  getRecommendations: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        orgId: z.string(),
        proposedChanges: z.any().optional()
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const repository = new RecommendationRepository();
        
        // Try to get cached recommendations first
        const cached = await repository.getRecommendations(input.ticketId);
        if (cached.length > 0 && !input.proposedChanges) {
          return {
            success: true,
            recommendations: cached,
            fromCache: true
          };
        }

        // Generate new recommendations
        const metadataService = new MetadataService();
        const patternAnalyzer = new PatternAnalyzer(metadataService);
        const llmService = new LLMService({
          apiKey: process.env.ANTHROPIC_API_KEY!,
          model: 'claude-3-opus-20240229'
        });
        
        const recommendationEngine = new RecommendationEngine({
          llmService,
          patternAnalyzer,
          metadataService
        });

        const recommendations = await recommendationEngine.generateRecommendations({
          ticketId: input.ticketId,
          orgId: input.orgId,
          proposedChanges: input.proposedChanges
        });

        // Store recommendations
        await repository.storeRecommendations(input.ticketId, recommendations);

        return {
          success: true,
          recommendations,
          fromCache: false
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  checkConflicts: protectedProcedure
    .input(
      z.object({
        orgId: z.string(),
        proposedChanges: z.any(),
        existingMetadata: z.any().optional()
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const metadataService = new MetadataService();
        const impactAnalyzer = new ImpactAnalyzerService();
        
        const conflictDetector = new ConflictDetector({
          metadataService,
          impactAnalyzer
        });

        const conflicts = await conflictDetector.detectConflicts(
          input.orgId,
          input.proposedChanges,
          input.existingMetadata
        );

        return {
          success: true,
          conflicts,
          hasConflicts: conflicts.length > 0,
          criticalCount: conflicts.filter(c => c.severity === 'critical').length,
          highCount: conflicts.filter(c => c.severity === 'high').length,
          mediumCount: conflicts.filter(c => c.severity === 'medium').length,
          lowCount: conflicts.filter(c => c.severity === 'low').length
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to check conflicts: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  submitFeedback: protectedProcedure
    .input(feedbackSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const repository = new RecommendationRepository();
        const feedbackProcessor = new FeedbackProcessor();
        
        // Get the recommendation
        const ticketId = input.recommendationId.split('-')[0];
        const recommendations = await repository.getRecommendations(ticketId);
        const recommendation = recommendations.find(r => r.id === input.recommendationId);
        
        if (!recommendation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Recommendation not found'
          });
        }

        // Process feedback
        await feedbackProcessor.processFeedback(input, recommendation);
        
        // Update recommendation with feedback
        await repository.updateRecommendationWithFeedback(
          ticketId,
          input.recommendationId,
          input
        );

        return {
          success: true,
          message: 'Feedback submitted successfully'
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to submit feedback: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  getRecommendationStats: protectedProcedure
    .input(
      z.object({
        orgId: z.string()
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const repository = new RecommendationRepository();
        const stats = await repository.getRecommendationStats(input.orgId);

        return {
          success: true,
          stats
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get recommendation stats: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  improveRecommendations: protectedProcedure
    .input(
      z.object({
        ticketId: z.string(),
        applyLearning: z.boolean().default(true)
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const repository = new RecommendationRepository();
        const feedbackProcessor = new FeedbackProcessor();
        
        // Get current recommendations
        const currentRecommendations = await repository.getRecommendations(input.ticketId);
        
        if (currentRecommendations.length === 0) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'No recommendations found for this ticket'
          });
        }

        // Apply learning if requested
        let improvedRecommendations = currentRecommendations;
        if (input.applyLearning) {
          improvedRecommendations = await feedbackProcessor.improveRecommendations(
            input.ticketId,
            currentRecommendations
          );
        }

        // Store improved recommendations
        await repository.storeRecommendations(input.ticketId, improvedRecommendations);

        return {
          success: true,
          recommendations: improvedRecommendations,
          improved: input.applyLearning
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to improve recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    }),

  searchRecommendations: protectedProcedure
    .input(
      z.object({
        orgId: z.string().optional(),
        type: z.string().optional(),
        category: z.string().optional(),
        minConfidence: z.number().min(0).max(1).optional(),
        startDate: z.date().optional(),
        endDate: z.date().optional()
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const repository = new RecommendationRepository();
        const recommendations = await repository.searchRecommendations(input);

        return {
          success: true,
          recommendations,
          count: recommendations.length
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to search recommendations: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
      }
    })
});