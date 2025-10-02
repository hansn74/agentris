import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { AmbiguityDetector } from '@agentris/ai-engine/ambiguity-detector';
import { AnalysisRepository } from '@agentris/db/repositories/AnalysisRepository';
import { prisma, AnalysisType } from '@agentris/db';
import { TRPCError } from '@trpc/server';

const ambiguityRouter = router({
  detectAmbiguity: protectedProcedure
    .input(
      z.object({
        ticketId: z.string().optional(),
        text: z.string().optional(),
      }).refine(data => data.ticketId || data.text, {
        message: 'Either ticketId or text must be provided',
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const detector = new AmbiguityDetector();
        const repository = new AnalysisRepository(prisma);
        
        let ticketText: string;
        let ticketId: string | undefined = input.ticketId;

        // Get ticket text
        if (input.ticketId) {
          const ticket = await prisma.ticket.findUnique({
            where: { id: input.ticketId },
          });

          if (!ticket) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: 'Ticket not found',
            });
          }

          ticketText = `${ticket.summary}\n\n${ticket.description}`;
          
          // Update ticket status to ANALYZING
          await prisma.ticket.update({
            where: { id: input.ticketId },
            data: { status: 'ANALYZING' },
          });
        } else {
          ticketText = input.text!;
        }

        // Perform ambiguity detection
        const result = await detector.detectAmbiguity(ticketText);

        // Store results if we have a ticketId
        if (ticketId) {
          await repository.upsert(ticketId, AnalysisType.AMBIGUITY, {
            ticketId,
            type: AnalysisType.AMBIGUITY,
            findings: {
              missingInfo: result.missingInfo,
              vagueTerms: result.vagueTerms,
              conflicts: result.conflicts,
              summary: result.summary,
            },
            confidence: result.confidence,
            score: result.score,
            patterns: result.patterns.map(p => {
              // Map string patterns to enum values
              switch (p) {
                case 'MISSING_INFO':
                  return 'MISSING_INFO';
                case 'VAGUE_TERMS':
                  return 'VAGUE_TERMS';
                case 'CONFLICTING_REQUIREMENTS':
                  return 'CONFLICTING_REQUIREMENTS';
                case 'UNCLEAR_SCOPE':
                  return 'UNCLEAR_SCOPE';
                case 'MISSING_ACCEPTANCE_CRITERIA':
                  return 'MISSING_ACCEPTANCE_CRITERIA';
                case 'UNCLEAR_DEPENDENCIES':
                  return 'UNCLEAR_DEPENDENCIES';
                case 'AMBIGUOUS_TERMINOLOGY':
                  return 'AMBIGUOUS_TERMINOLOGY';
                default:
                  return 'MISSING_INFO';
              }
            }) as any,
          });

          // Update ticket with ambiguity score
          await prisma.ticket.update({
            where: { id: ticketId },
            data: { 
              ambiguityScore: result.score,
              status: result.score > 0.5 ? 'CLARIFYING' : 'READY',
            },
          });
        }

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        console.error('Error detecting ambiguity:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to detect ambiguity',
        });
      }
    }),

  getAmbiguityDetails: protectedProcedure
    .input(z.object({
      ticketId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      const repository = new AnalysisRepository(prisma);
      
      const analysis = await repository.findByTicketAndType(
        input.ticketId,
        AnalysisType.AMBIGUITY
      );

      if (!analysis) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ambiguity analysis not found for this ticket',
        });
      }

      return {
        id: analysis.id,
        ticketId: analysis.ticketId,
        score: analysis.score,
        confidence: analysis.confidence,
        patterns: analysis.patterns,
        findings: analysis.findings,
        createdAt: analysis.createdAt,
        updatedAt: analysis.updatedAt,
      };
    }),

  updateAmbiguityScore: protectedProcedure
    .input(z.object({
      ticketId: z.string(),
      score: z.number().min(0).max(1),
      reason: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const repository = new AnalysisRepository(prisma);

      // Find existing analysis
      const analysis = await repository.findByTicketAndType(
        input.ticketId,
        AnalysisType.AMBIGUITY
      );

      if (!analysis) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ambiguity analysis not found for this ticket',
        });
      }

      // Update analysis with manual score
      const updated = await repository.update(analysis.id, {
        score: input.score,
        findings: {
          ...(analysis.findings as any),
          manualAdjustment: {
            score: input.score,
            reason: input.reason,
            adjustedBy: ctx.user.id,
            adjustedAt: new Date(),
          },
        },
      });

      // Update ticket ambiguity score
      await prisma.ticket.update({
        where: { id: input.ticketId },
        data: { 
          ambiguityScore: input.score,
          status: input.score > 0.5 ? 'CLARIFYING' : 'READY',
        },
      });

      return {
        success: true,
        data: updated,
      };
    }),

  getRecentAnalyses: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(10),
    }).optional())
    .query(async ({ input, ctx }) => {
      const repository = new AnalysisRepository(prisma);
      
      const analyses = await repository.getRecentAnalyses(input?.limit || 10);
      
      return analyses.filter(a => a.type === AnalysisType.AMBIGUITY).map(a => ({
        id: a.id,
        ticketId: a.ticketId,
        ticket: a.ticket,
        score: a.score,
        confidence: a.confidence,
        patterns: a.patterns,
        createdAt: a.createdAt,
      }));
    }),
});

export { ambiguityRouter };