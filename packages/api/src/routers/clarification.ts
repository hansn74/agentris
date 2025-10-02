import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { 
  ClarificationRepository, 
  AnalysisRepository,
  prisma 
} from '@agentris/db';
import { ClarificationGenerator, LLMService } from '@agentris/ai-engine';
import { TicketService } from '@agentris/integrations/jira';
import { TRPCError } from '@trpc/server';

const clarificationQuestionSchema = z.object({
  question: z.string(),
  ambiguityArea: z.string(),
  importanceScore: z.number().min(0).max(1),
  impactLevel: z.enum(['high', 'medium', 'low']),
  requirementDependency: z.array(z.string()),
  salesforceContext: z.object({
    objects: z.array(z.string()),
    fields: z.array(z.string()),
    features: z.array(z.string())
  }).optional()
});

const generateClarificationsInputSchema = z.object({
  ticketId: z.string(),
  analysisId: z.string().optional(),
  minQuestions: z.number().min(1).max(10).default(3),
  maxQuestions: z.number().min(1).max(10).default(5),
  includeSalesforceTerminology: z.boolean().default(true)
});

const editClarificationsInputSchema = z.object({
  questions: z.array(z.object({
    id: z.string().optional(),
    question: z.string(),
    ambiguityArea: z.string(),
    importanceScore: z.number().min(0).max(1),
    impactLevel: z.enum(['high', 'medium', 'low'])
  }))
});

const postToJiraInputSchema = z.object({
  ticketId: z.string(),
  questions: z.array(z.string()),
  includeTag: z.boolean().default(true)
});

const trackAnswersInputSchema = z.object({
  clarificationId: z.string(),
  answer: z.string()
});

export const clarificationRouter = router({
  generateClarifications: protectedProcedure
    .input(generateClarificationsInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { ticketId, analysisId, minQuestions, maxQuestions, includeSalesforceTerminology } = input;

      try {
        // Get or create analysis for the ticket
        let analysis;
        const analysisRepo = new AnalysisRepository(prisma);
        
        if (analysisId) {
          analysis = await analysisRepo.findById(analysisId);
          if (!analysis || analysis.ticketId !== ticketId) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Analysis not found or does not match ticket'
            });
          }
        } else {
          // Get the most recent analysis for the ticket
          const analyses = await analysisRepo.findByTicketId(ticketId);
          if (analyses.length === 0) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'No analysis found for this ticket. Please run ambiguity detection first.'
            });
          }
          analysis = analyses[0];
        }

        // Generate clarification questions
        const llmService = new LLMService();
        const generator = new ClarificationGenerator(llmService);
        
        const questions = await generator.generateQuestions(analysis, {
          minQuestions,
          maxQuestions,
          includeSalesforceTerminology
        });

        // Store generated questions in the database
        const clarificationRepo = new ClarificationRepository(prisma);
        const createdQuestions = await Promise.all(
          questions.map(q => 
            clarificationRepo.create({
              ticketId,
              question: q.question,
              source: 'AI',
              askedBy: ctx.session?.user?.email || 'system'
            })
          )
        );

        // Update analysis with question generation metadata
        await analysisRepo.update(analysis.id, {
          findings: JSON.stringify({
            ...JSON.parse(analysis.findings as string),
            generatedQuestions: {
              count: questions.length,
              timestamp: new Date().toISOString(),
              questions: questions.map(q => ({
                question: q.question,
                importanceScore: q.importanceScore,
                impactLevel: q.impactLevel
              }))
            }
          })
        });

        return {
          questions,
          clarificationIds: createdQuestions.map(c => c.id)
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to generate clarifications: ${error.message}`
        });
      }
    }),

  editClarifications: protectedProcedure
    .input(editClarificationsInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { questions } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        
        const updatedQuestions = await Promise.all(
          questions.map(async (q) => {
            if (q.id) {
              // Update existing question
              return clarificationRepo.update(q.id, {
                question: q.question
              });
            } else {
              // Create new question (custom addition)
              return clarificationRepo.create({
                ticketId: '', // This needs to be provided in a real implementation
                question: q.question,
                source: 'MANUAL',
                askedBy: ctx.session?.user?.email || 'user'
              });
            }
          })
        );

        return { updatedQuestions };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to edit clarifications: ${error.message}`
        });
      }
    }),

  postToJira: protectedProcedure
    .input(postToJiraInputSchema)
    .mutation(async ({ input, ctx }) => {
      const { ticketId, questions, includeTag } = input;

      try {
        // Format questions for Jira comment
        let commentBody = '';
        
        if (includeTag) {
          commentBody = '[AI-CLARIFIED] Clarification Questions:\n\n';
        }
        
        questions.forEach((question, index) => {
          commentBody += `${index + 1}. ${question}\n`;
        });
        
        commentBody += '\n---\n_Generated by Agentris AI_';

        // Post to Jira using the integration
        const ticketService = new TicketService();
        const result = await ticketService.addComment(ticketId, {
          body: commentBody
        });

        // Update clarifications to mark them as posted
        const clarificationRepo = new ClarificationRepository(prisma);
        const clarifications = await clarificationRepo.findByTicketId(ticketId);
        
        // Mark questions as posted (you might want to add a 'postedToJira' field to the model)
        for (const clarification of clarifications) {
          if (questions.includes(clarification.question)) {
            await clarificationRepo.update(clarification.id, {
              askedBy: ctx.session?.user?.email || clarification.askedBy
            });
          }
        }

        return {
          success: true,
          jiraCommentId: result.id,
          postedAt: new Date().toISOString()
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to post to Jira: ${error.message}`
        });
      }
    }),

  trackAnswers: protectedProcedure
    .input(trackAnswersInputSchema)
    .mutation(async ({ input }) => {
      const { clarificationId, answer } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        
        const updated = await clarificationRepo.addAnswer(clarificationId, answer);
        
        return {
          success: true,
          clarification: updated
        };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to track answer: ${error.message}`
        });
      }
    }),

  getClarifications: protectedProcedure
    .input(z.object({
      ticketId: z.string(),
      includeAnswered: z.boolean().default(true)
    }))
    .query(async ({ input }) => {
      const { ticketId, includeAnswered } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        
        let clarifications;
        if (includeAnswered) {
          clarifications = await clarificationRepo.findByTicketId(ticketId);
        } else {
          clarifications = await clarificationRepo.findUnanswered(ticketId);
        }

        return { clarifications };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get clarifications: ${error.message}`
        });
      }
    }),

  getStats: protectedProcedure
    .input(z.object({
      ticketId: z.string().optional()
    }))
    .query(async ({ input }) => {
      const { ticketId } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        
        if (ticketId) {
          const stats = await clarificationRepo.getStatsByTicket(ticketId);
          return { stats };
        } else {
          const overallStats = await clarificationRepo.trackAnswerRate();
          return { stats: overallStats };
        }
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get statistics: ${error.message}`
        });
      }
    }),

  getRecentlyAnswered: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(50).default(10)
    }))
    .query(async ({ input }) => {
      const { limit } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        const clarifications = await clarificationRepo.findRecentlyAnswered(limit);
        
        return { clarifications };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to get recently answered clarifications: ${error.message}`
        });
      }
    }),

  deleteClarification: protectedProcedure
    .input(z.object({
      clarificationId: z.string()
    }))
    .mutation(async ({ input }) => {
      const { clarificationId } = input;

      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        await clarificationRepo.delete(clarificationId);
        
        return { success: true };
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete clarification: ${error.message}`
        });
      }
    })
});