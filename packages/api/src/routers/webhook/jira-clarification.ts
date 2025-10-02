import { z } from 'zod';
import { router, publicProcedure } from '../../trpc';
import { ClarificationRepository, prisma } from '@agentris/db';
import { TicketService } from '@agentris/integrations/jira';
import pino from 'pino';

const logger = pino({ name: 'jira-clarification-webhook' });

// Jira webhook event schemas
const jiraCommentWebhookSchema = z.object({
  webhookEvent: z.enum(['comment_created', 'comment_updated', 'comment_deleted']),
  timestamp: z.number(),
  issue: z.object({
    key: z.string(),
    fields: z.object({
      summary: z.string().optional(),
      description: z.any().optional()
    }).optional()
  }),
  comment: z.object({
    id: z.string(),
    author: z.object({
      accountId: z.string().optional(),
      displayName: z.string().optional(),
      emailAddress: z.string().optional()
    }).optional(),
    body: z.any(), // Can be string or ADF
    created: z.string(),
    updated: z.string()
  }).optional()
});

export const jiraClarificationWebhookRouter = router({
  /**
   * Handle Jira comment webhook events to track answers
   */
  handleCommentWebhook: publicProcedure
    .input(jiraCommentWebhookSchema)
    .mutation(async ({ input }) => {
      const { webhookEvent, issue, comment } = input;

      if (!comment) {
        logger.warn({ webhookEvent }, 'No comment in webhook payload');
        return { processed: false };
      }

      try {
        const ticketKey = issue.key;
        logger.info({ 
          ticketKey, 
          webhookEvent, 
          commentId: comment.id 
        }, 'Processing Jira comment webhook');

        // Only process comment_created and comment_updated events
        if (webhookEvent === 'comment_deleted') {
          return { processed: false };
        }

        // Check if this ticket has clarifications in our system
        const clarificationRepo = new ClarificationRepository(prisma);
        const clarifications = await clarificationRepo.findByTicketId(ticketKey);

        if (clarifications.length === 0) {
          logger.info({ ticketKey }, 'No clarifications found for ticket');
          return { processed: false };
        }

        // Check if this comment contains answers to our clarifications
        const ticketService = new TicketService();
        
        // Find the most recent AI-CLARIFIED comment
        const aiClarifiedComments = await ticketService.findTaggedComments(
          ticketKey, 
          'AI-CLARIFIED'
        );

        if (aiClarifiedComments.length === 0) {
          logger.info({ ticketKey }, 'No AI-CLARIFIED comments found');
          return { processed: false };
        }

        // Get the most recent clarification comment
        const latestClarificationComment = aiClarifiedComments[aiClarifiedComments.length - 1];
        
        // Parse answers from all comments after the clarification
        const answers = await ticketService.parseAnswersFromComments(
          ticketKey,
          (latestClarificationComment as any).id
        );

        if (answers.size === 0) {
          logger.info({ ticketKey }, 'No answers found in comments');
          return { processed: false };
        }

        // Update clarifications with found answers
        let updatedCount = 0;
        for (const clarification of clarifications) {
          const answer = answers.get(clarification.question);
          if (answer && !clarification.answer) {
            await clarificationRepo.addAnswer(clarification.id, answer);
            updatedCount++;
            
            logger.info({ 
              ticketKey, 
              clarificationId: clarification.id,
              question: clarification.question.substring(0, 50) 
            }, 'Answer tracked for clarification');
          }
        }

        // Update ticket labels based on answer status
        const unansweredCount = clarifications.filter(c => !c.answer).length - updatedCount;
        const totalCount = clarifications.length;
        
        if (unansweredCount === 0 || unansweredCount < totalCount) {
          await ticketService.updateTicketWithAnswerStatus(
            ticketKey,
            totalCount - unansweredCount,
            totalCount
          );
        }

        logger.info({ 
          ticketKey, 
          updatedCount,
          totalAnswers: answers.size 
        }, 'Webhook processing complete');

        return { 
          processed: true,
          updatedCount,
          totalAnswers: answers.size
        };
      } catch (error) {
        logger.error({ 
          error,
          ticketKey: issue.key 
        }, 'Error processing webhook');
        
        // Don't throw - we don't want to fail the webhook
        return { 
          processed: false,
          error: (error as Error).message 
        };
      }
    }),

  /**
   * Manually trigger answer detection for a ticket
   */
  detectAnswers: publicProcedure
    .input(z.object({
      ticketId: z.string(),
      forceUpdate: z.boolean().default(false)
    }))
    .mutation(async ({ input }) => {
      const { ticketId, forceUpdate } = input;

      try {
        logger.info({ ticketId }, 'Manually detecting answers');

        const clarificationRepo = new ClarificationRepository(prisma);
        const ticketService = new TicketService();

        // Get all clarifications for the ticket
        const clarifications = await clarificationRepo.findByTicketId(ticketId);
        
        if (clarifications.length === 0) {
          return { 
            success: false,
            message: 'No clarifications found for ticket'
          };
        }

        // Find AI-CLARIFIED comments
        const aiClarifiedComments = await ticketService.findTaggedComments(
          ticketId,
          'AI-CLARIFIED'
        );

        if (aiClarifiedComments.length === 0) {
          return {
            success: false,
            message: 'No AI-CLARIFIED comments found in Jira'
          };
        }

        // Process each clarification comment
        let totalUpdated = 0;
        let totalFound = 0;

        for (const clarificationComment of aiClarifiedComments) {
          const answers = await ticketService.parseAnswersFromComments(
            ticketId,
            (clarificationComment as any).id
          );

          totalFound += answers.size;

          // Update clarifications with answers
          for (const clarification of clarifications) {
            const answer = answers.get(clarification.question);
            if (answer && (!clarification.answer || forceUpdate)) {
              await clarificationRepo.addAnswer(clarification.id, answer);
              totalUpdated++;
            }
          }
        }

        // Update ticket status
        const finalClarifications = await clarificationRepo.findByTicketId(ticketId);
        const answeredCount = finalClarifications.filter(c => c.answer).length;
        
        await ticketService.updateTicketWithAnswerStatus(
          ticketId,
          answeredCount,
          finalClarifications.length
        );

        logger.info({ 
          ticketId,
          totalFound,
          totalUpdated 
        }, 'Answer detection complete');

        return {
          success: true,
          answersFound: totalFound,
          clarificationsUpdated: totalUpdated,
          totalClarifications: finalClarifications.length,
          answeredClarifications: answeredCount
        };
      } catch (error) {
        logger.error({ 
          error,
          ticketId 
        }, 'Error detecting answers');
        
        return {
          success: false,
          message: (error as Error).message
        };
      }
    }),

  /**
   * Get webhook status and statistics
   */
  getWebhookStatus: publicProcedure
    .query(async () => {
      try {
        const clarificationRepo = new ClarificationRepository(prisma);
        
        // Get overall answer rate
        const stats = await clarificationRepo.trackAnswerRate();
        
        // Get recently answered clarifications
        const recentlyAnswered = await clarificationRepo.findRecentlyAnswered(5);
        
        return {
          webhookActive: true, // Could check actual webhook config
          statistics: {
            totalQuestions: stats.totalQuestions,
            answeredQuestions: stats.answeredQuestions,
            answerRate: stats.answerRate,
            bySource: stats.bySource
          },
          recentActivity: recentlyAnswered.map(c => ({
            id: c.id,
            ticketId: c.ticketId,
            question: c.question.substring(0, 100),
            answeredAt: c.updatedAt
          }))
        };
      } catch (error) {
        logger.error({ error }, 'Error getting webhook status');
        
        return {
          webhookActive: false,
          error: (error as Error).message
        };
      }
    })
});