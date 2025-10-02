import { ClarificationRepository, prisma } from '@agentris/db';
import { TicketService } from '@agentris/integrations/jira';
import { ClarificationGenerator, LLMService } from '@agentris/ai-engine';
import pino from 'pino';

const logger = pino({ name: 'answer-tracker-service' });

export interface AnswerDetectionResult {
  ticketId: string;
  questionsFound: number;
  answersDetected: number;
  clarificationsUpdated: number;
  confidence: number;
}

export interface AnswerAnalysis {
  question: string;
  potentialAnswer: string;
  confidence: number;
  source: 'direct' | 'inferred' | 'ai';
  metadata?: {
    commentId?: string;
    author?: string;
    timestamp?: string;
  };
}

export class AnswerTrackerService {
  private clarificationRepo: ClarificationRepository;
  private ticketService: TicketService;
  private llmService?: LLMService;

  constructor(
    ticketService?: TicketService,
    llmService?: LLMService
  ) {
    this.clarificationRepo = new ClarificationRepository(prisma);
    this.ticketService = ticketService || new TicketService();
    this.llmService = llmService;
  }

  /**
   * Detect and track answers for a ticket's clarifications
   */
  async detectAnswers(
    ticketId: string,
    options: {
      useAI?: boolean;
      forceUpdate?: boolean;
      minConfidence?: number;
    } = {}
  ): Promise<AnswerDetectionResult> {
    const { 
      useAI = false, 
      forceUpdate = false,
      minConfidence = 0.7
    } = options;

    logger.info({ ticketId, options }, 'Starting answer detection');

    // Get clarifications for the ticket
    const clarifications = await this.clarificationRepo.findByTicketId(ticketId);
    
    if (clarifications.length === 0) {
      logger.info({ ticketId }, 'No clarifications to process');
      return {
        ticketId,
        questionsFound: 0,
        answersDetected: 0,
        clarificationsUpdated: 0,
        confidence: 1.0
      };
    }

    // Find tagged comments in Jira
    const taggedComments = await this.ticketService.findTaggedComments(
      ticketId,
      'AI-CLARIFIED'
    );

    if (taggedComments.length === 0) {
      logger.warn({ ticketId }, 'No AI-CLARIFIED comments found');
      return {
        ticketId,
        questionsFound: clarifications.length,
        answersDetected: 0,
        clarificationsUpdated: 0,
        confidence: 1.0
      };
    }

    let totalAnswersDetected = 0;
    let totalClarificationsUpdated = 0;
    let overallConfidence = 0;

    // Process each tagged comment
    for (const taggedComment of taggedComments) {
      const commentId = (taggedComment as any).id;
      
      // Parse direct answers from comments
      const directAnswers = await this.ticketService.parseAnswersFromComments(
        ticketId,
        commentId
      );

      // If AI is enabled, use it to find inferred answers
      let aiAnswers = new Map<string, AnswerAnalysis>();
      if (useAI && this.llmService) {
        aiAnswers = await this.detectAnswersWithAI(
          ticketId,
          clarifications.filter(c => !c.answer || forceUpdate).map(c => c.question),
          taggedComment
        );
      }

      // Combine and apply answers
      for (const clarification of clarifications) {
        // Skip if already answered and not forcing update
        if (clarification.answer && !forceUpdate) {
          continue;
        }

        let answer: string | null = null;
        let confidence = 0;

        // Check for direct answer
        if (directAnswers.has(clarification.question)) {
          answer = directAnswers.get(clarification.question)!;
          confidence = 1.0;
        }
        // Check for AI-detected answer
        else if (aiAnswers.has(clarification.question)) {
          const aiAnalysis = aiAnswers.get(clarification.question)!;
          if (aiAnalysis.confidence >= minConfidence) {
            answer = aiAnalysis.potentialAnswer;
            confidence = aiAnalysis.confidence;
          }
        }

        // Update clarification if answer found
        if (answer) {
          await this.clarificationRepo.addAnswer(clarification.id, answer);
          totalClarificationsUpdated++;
          totalAnswersDetected++;
          overallConfidence += confidence;

          logger.info({
            ticketId,
            clarificationId: clarification.id,
            confidence,
            source: confidence === 1.0 ? 'direct' : 'ai'
          }, 'Answer tracked');
        }
      }
    }

    // Calculate average confidence
    const avgConfidence = totalAnswersDetected > 0 
      ? overallConfidence / totalAnswersDetected 
      : 0;

    // Update ticket status in Jira
    const finalClarifications = await this.clarificationRepo.findByTicketId(ticketId);
    const answeredCount = finalClarifications.filter(c => c.answer).length;
    
    await this.ticketService.updateTicketWithAnswerStatus(
      ticketId,
      answeredCount,
      finalClarifications.length
    );

    logger.info({
      ticketId,
      questionsFound: clarifications.length,
      answersDetected: totalAnswersDetected,
      clarificationsUpdated: totalClarificationsUpdated,
      confidence: avgConfidence
    }, 'Answer detection complete');

    return {
      ticketId,
      questionsFound: clarifications.length,
      answersDetected: totalAnswersDetected,
      clarificationsUpdated: totalClarificationsUpdated,
      confidence: avgConfidence
    };
  }

  /**
   * Use AI to detect potential answers from comment context
   */
  private async detectAnswersWithAI(
    ticketId: string,
    questions: string[],
    comment: any
  ): Promise<Map<string, AnswerAnalysis>> {
    if (!this.llmService) {
      return new Map();
    }

    try {
      const commentBody = typeof comment.body === 'string'
        ? comment.body
        : this.ticketService['parseADF'](comment.body);

      const prompt = `
You are analyzing a Jira comment to find potential answers to clarification questions.

CLARIFICATION QUESTIONS:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

COMMENT TO ANALYZE:
${commentBody}

For each question, determine if the comment contains an answer or relevant information.
Return a JSON array with the following structure for each question that has a potential answer:
[
  {
    "questionIndex": <0-based index>,
    "question": "<the original question>",
    "answer": "<extracted answer from the comment>",
    "confidence": <0.0 to 1.0>,
    "reasoning": "<brief explanation of why this is the answer>"
  }
]

Only include questions where you find a potential answer with confidence > 0.5.
Be conservative - only extract clear, relevant answers.
`;

      const response = await this.llmService.generateResponse(
        [{ role: 'user', content: prompt }],
        {
          temperature: 0.3,
          maxTokens: 2000
        }
      ) as any;

      const results = new Map<string, AnswerAnalysis>();

      try {
        const parsed = JSON.parse(response.content);
        if (Array.isArray(parsed)) {
          for (const item of parsed) {
            if (item.questionIndex >= 0 && item.questionIndex < questions.length) {
              results.set(questions[item.questionIndex], {
                question: questions[item.questionIndex],
                potentialAnswer: item.answer,
                confidence: item.confidence,
                source: 'ai',
                metadata: {
                  commentId: comment.id,
                  author: comment.author?.displayName,
                  timestamp: comment.created
                }
              });
            }
          }
        }
      } catch (parseError) {
        logger.error({ 
          parseError, 
          ticketId 
        }, 'Failed to parse AI response');
      }

      return results;
    } catch (error) {
      logger.error({ 
        error, 
        ticketId 
      }, 'AI answer detection failed');
      return new Map();
    }
  }

  /**
   * Get answer tracking statistics for a ticket
   */
  async getAnswerStats(ticketId: string): Promise<{
    total: number;
    answered: number;
    pending: number;
    answerRate: number;
    avgResponseTime?: number;
  }> {
    const stats = await this.clarificationRepo.getStatsByTicket(ticketId);
    
    // Calculate average response time if we have answered questions
    let avgResponseTime: number | undefined;
    if (stats.answered > 0) {
      const clarifications = await this.clarificationRepo.findAnswered(ticketId);
      const responseTimes = clarifications
        .filter(c => c.answer && c.createdAt && c.updatedAt)
        .map(c => {
          const created = new Date(c.createdAt).getTime();
          const updated = new Date(c.updatedAt).getTime();
          return updated - created;
        });
      
      if (responseTimes.length > 0) {
        avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        avgResponseTime = Math.round(avgResponseTime / (1000 * 60 * 60)); // Convert to hours
      }
    }

    return {
      total: stats.total,
      answered: stats.answered,
      pending: stats.unanswered,
      answerRate: stats.total > 0 ? stats.answered / stats.total : 0,
      avgResponseTime
    };
  }

  /**
   * Monitor and alert on unanswered questions
   */
  async checkUnansweredQuestions(options: {
    maxAge?: number; // Hours
    minPriority?: string;
  } = {}): Promise<Array<{
    ticketId: string;
    unansweredCount: number;
    oldestQuestionAge: number;
    priority: string;
  }>> {
    const { maxAge = 24 } = options;
    
    // Get all tickets with unanswered questions
    const unansweredClarifications = await this.clarificationRepo.findUnanswered();
    
    // Group by ticket
    const ticketMap = new Map<string, any[]>();
    for (const clarification of unansweredClarifications) {
      const existing = ticketMap.get(clarification.ticketId) || [];
      existing.push(clarification);
      ticketMap.set(clarification.ticketId, existing);
    }

    const alerts: Array<{
      ticketId: string;
      unansweredCount: number;
      oldestQuestionAge: number;
      priority: string;
    }> = [];

    const now = Date.now();
    const maxAgeMs = maxAge * 60 * 60 * 1000;

    for (const [ticketId, clarifications] of ticketMap.entries()) {
      // Find oldest unanswered question
      const oldestDate = Math.min(
        ...clarifications.map(c => new Date(c.createdAt).getTime())
      );
      const ageMs = now - oldestDate;

      if (ageMs > maxAgeMs) {
        // Get ticket priority from Jira
        let priority = 'Medium';
        try {
          const ticket = await this.ticketService.fetchTicketDetails(ticketId);
          priority = ticket.fields.priority?.name || 'Medium';
        } catch (error) {
          logger.error({ error, ticketId }, 'Failed to fetch ticket priority');
        }

        alerts.push({
          ticketId,
          unansweredCount: clarifications.length,
          oldestQuestionAge: Math.round(ageMs / (1000 * 60 * 60)), // Hours
          priority
        });
      }
    }

    return alerts.sort((a, b) => b.oldestQuestionAge - a.oldestQuestionAge);
  }
}