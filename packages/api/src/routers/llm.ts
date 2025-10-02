import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { LLMService, LLMProvider } from '@agentris/ai-engine';
import { LLMRepository } from '@agentris/db';
import { prisma } from '@agentris/db';
import { checkRateLimit } from '../middleware/rateLimit';

// Calculate ambiguity score based on analysis text
function calculateAmbiguityScore(analysis: string): number {
  const lowerAnalysis = analysis.toLowerCase();
  
  // Keywords that indicate ambiguity
  const ambiguityIndicators = [
    'unclear', 'ambiguous', 'missing', 'undefined', 'vague',
    'needs clarification', 'not specified', 'assumption',
    'could be', 'might be', 'possibly', 'uncertain',
    'needs to be defined', 'requires clarification',
    'what about', 'how should', 'which'
  ];
  
  // Count ambiguity indicators
  let ambiguityCount = 0;
  for (const indicator of ambiguityIndicators) {
    const regex = new RegExp(indicator, 'gi');
    const matches = lowerAnalysis.match(regex);
    ambiguityCount += matches ? matches.length : 0;
  }
  
  // Keywords that indicate clarity
  const clarityIndicators = [
    'clear', 'specific', 'defined', 'explicit',
    'well-defined', 'comprehensive', 'complete',
    'straightforward', 'unambiguous'
  ];
  
  // Count clarity indicators
  let clarityCount = 0;
  for (const indicator of clarityIndicators) {
    const regex = new RegExp(indicator, 'gi');
    const matches = lowerAnalysis.match(regex);
    clarityCount += matches ? matches.length : 0;
  }
  
  // Calculate score (0 = very clear, 1 = very ambiguous)
  const totalIndicators = ambiguityCount + clarityCount;
  if (totalIndicators === 0) {
    // No indicators found, assume moderate ambiguity
    return 0.5;
  }
  
  // Score based on ratio of ambiguity to total indicators
  const rawScore = ambiguityCount / totalIndicators;
  
  // Normalize to 0-1 range with some adjustment
  // Add base ambiguity if questions are present
  const hasQuestions = (lowerAnalysis.match(/\?/g) || []).length;
  const questionBonus = Math.min(hasQuestions * 0.05, 0.3);
  
  return Math.min(rawScore + questionBonus, 1.0);
}

// Input schemas
const analyzeRequirementsInput = z.object({
  ticketId: z.string(),
  text: z.string(),
  systemPrompt: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
});

const generateResponseInput = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
  model: z.string().optional(),
  temperature: z.number().min(0).max(1).optional(),
  maxTokens: z.number().positive().optional(),
  stream: z.boolean().optional(),
});

const getUsageStatsInput = z.object({
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

const clearCacheInput = z.object({
  all: z.boolean().optional(),
  expired: z.boolean().optional(),
});

export const llmRouter = router({
  // Analyze requirements from a ticket
  analyzeRequirements: protectedProcedure
    .input(analyzeRequirementsInput)
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting for requirements analysis
      checkRateLimit(ctx.user.id, 'llmAnalyze');
      
      try {
        const llmService = new LLMService({
          enableUsageTracking: true,
          enableCache: true,
        });

        // Check if user has access to the ticket
        const ticket = await prisma.ticket.findUnique({
          where: { id: input.ticketId },
        });

        if (!ticket) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Ticket not found',
          });
        }

        // Analyze the requirements
        const systemPrompt = input.systemPrompt || `You are an expert at analyzing software requirements. 
        Identify ambiguities, missing information, and potential issues in the following requirements.
        Provide specific questions that need to be answered for clear implementation.`;

        const analysis = await llmService.analyzeText(input.text, {
          systemPrompt,
          model: input.model,
          temperature: input.temperature || 0.7,
          maxTokens: input.maxTokens || 2000,
          userId: ctx.user.id,
        });

        // Calculate ambiguity score based on analysis
        const ambiguityScore = calculateAmbiguityScore(analysis);
        
        // Update ticket with ambiguity analysis
        await prisma.ticket.update({
          where: { id: input.ticketId },
          data: {
            ambiguityScore,
            status: 'ANALYZING',
          },
        });

        return {
          ticketId: input.ticketId,
          analysis,
          timestamp: new Date(),
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error analyzing requirements');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to analyze requirements',
          cause: error,
        });
      }
    }),

  // Generate a response from the LLM
  generateResponse: protectedProcedure
    .input(generateResponseInput)
    .mutation(async ({ ctx, input }) => {
      // Apply rate limiting based on stream mode
      checkRateLimit(ctx.user.id, input.stream ? 'llmStream' : 'llmGenerate');
      
      try {
        const llmService = new LLMService({
          enableUsageTracking: true,
          enableCache: !input.stream, // Don't cache streaming responses
        });

        const response = await llmService.generateResponse(input.messages, {
          model: input.model,
          temperature: input.temperature,
          maxTokens: input.maxTokens,
          stream: input.stream,
          userId: ctx.user.id,
        });

        // For streaming responses, we need to handle differently
        if (input.stream && 'stream' in response) {
          // In a real implementation, we'd set up SSE or WebSocket
          // For now, just collect the stream
          const chunks: string[] = [];
          for await (const chunk of response.stream) {
            chunks.push(chunk);
          }
          
          return {
            content: chunks.join(''),
            tokenCount: await response.getTokenCount(),
            cost: await response.getCost(),
            streamed: true,
          };
        }

        // Non-streaming response
        if ('content' in response) {
          return {
            content: response.content,
            tokenCount: response.tokenCount,
            cost: response.cost,
            model: response.model,
            provider: response.provider,
            streamed: false,
          };
        }

        throw new Error('Unexpected response format');
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error generating response');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to generate response',
          cause: error,
        });
      }
    }),

  // Get usage statistics for cost monitoring (admin only)
  getUsageStats: adminProcedure
    .input(getUsageStatsInput)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new LLMRepository(prisma);
        
        // Get usage data
        const usage = await repository.getUsageByUser(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        // Get aggregated stats for all users if admin
        const aggregated = await repository.getAggregatedUsage(
          input.startDate,
          input.endDate
        );

        // Get cache statistics
        const cacheStats = await repository.getCacheStats();

        // Format data for charts
        const chartData = usage.map(u => ({
          date: u.date.toISOString().split('T')[0],
          tokens: u.totalTokens,
          cost: u.totalCost,
          requests: u.requestCount,
          cacheHits: u.cacheHits,
          provider: u.provider,
        }));

        return {
          userUsage: chartData,
          aggregated: {
            totalTokens: aggregated._sum.totalTokens || 0,
            totalCost: aggregated._sum.totalCost || 0,
            totalRequests: aggregated._sum.requestCount || 0,
            totalCacheHits: aggregated._sum.cacheHits || 0,
          },
          cacheStats,
          period: {
            start: input.startDate?.toISOString(),
            end: input.endDate?.toISOString(),
          },
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error fetching usage stats');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch usage statistics',
          cause: error,
        });
      }
    }),

  // Get usage for current user
  getMyUsage: protectedProcedure
    .input(getUsageStatsInput)
    .query(async ({ ctx, input }) => {
      try {
        const repository = new LLMRepository(prisma);
        
        const usage = await repository.getUsageByUser(
          ctx.user.id,
          input.startDate,
          input.endDate
        );

        const chartData = usage.map(u => ({
          date: u.date.toISOString().split('T')[0],
          tokens: u.totalTokens,
          cost: u.totalCost,
          requests: u.requestCount,
          cacheHits: u.cacheHits,
          provider: u.provider,
        }));

        const totals = usage.reduce(
          (acc, u) => ({
            tokens: acc.tokens + u.totalTokens,
            cost: acc.cost + u.totalCost,
            requests: acc.requests + u.requestCount,
            cacheHits: acc.cacheHits + u.cacheHits,
          }),
          { tokens: 0, cost: 0, requests: 0, cacheHits: 0 }
        );

        return {
          usage: chartData,
          totals,
          period: {
            start: input.startDate?.toISOString(),
            end: input.endDate?.toISOString(),
          },
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error fetching user usage');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch usage data',
          cause: error,
        });
      }
    }),

  // Clear cache (admin only)
  clearCache: adminProcedure
    .input(clearCacheInput)
    .mutation(async ({ ctx, input }) => {
      try {
        const repository = new LLMRepository(prisma);
        
        let cleared = 0;
        
        if (input.all) {
          cleared = await repository.clearAllCache();
        } else if (input.expired) {
          cleared = await repository.clearExpiredCache();
        } else {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Specify either "all" or "expired" to clear cache',
          });
        }

        return {
          success: true,
          entriesCleared: cleared,
          clearedBy: ctx.user.email,
          timestamp: new Date(),
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error clearing cache');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to clear cache',
          cause: error,
        });
      }
    }),

  // Get available models
  getAvailableModels: protectedProcedure
    .query(async () => {
      try {
        const llmService = new LLMService();
        const models = llmService.getAvailableModels();

        return {
          models: models.map(model => ({
            id: model,
            name: model.replace(/-/g, ' ').replace(/^\w/, c => c.toUpperCase()),
            provider: llmService.getCurrentProvider(), // Get current provider from service
          })),
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error fetching models');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch available models',
          cause: error,
        });
      }
    }),

  // Validate LLM configuration
  validateConfiguration: adminProcedure
    .query(async () => {
      try {
        const llmService = new LLMService();
        const isValid = await llmService.validateConfiguration();

        return {
          valid: isValid,
          provider: llmService.getCurrentProvider(), // Get current provider from service
          timestamp: new Date(),
        };
      } catch (error) {
        // TODO: Replace with Pino logger
        // logger.error({ error }, 'Error validating configuration');
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to validate LLM configuration',
          cause: error,
        });
      }
    }),
});