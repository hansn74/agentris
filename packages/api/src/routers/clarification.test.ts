import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { clarificationRouter } from './clarification';
import { createInnerTRPCContext } from '../trpc';
import type { Session } from '@agentris/auth';
import { TRPCError } from '@trpc/server';

// Mock dependencies
vi.mock('@agentris/db', () => ({
  prisma: {},
  ClarificationRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    findByTicketId: vi.fn(),
    findUnanswered: vi.fn(),
    update: vi.fn(),
    addAnswer: vi.fn(),
    delete: vi.fn(),
    getStatsByTicket: vi.fn(),
    trackAnswerRate: vi.fn(),
    findRecentlyAnswered: vi.fn()
  })),
  AnalysisRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    findByTicketId: vi.fn(),
    update: vi.fn()
  }))
}));

vi.mock('@agentris/ai-engine', () => ({
  LLMService: vi.fn(),
  ClarificationGenerator: vi.fn().mockImplementation(() => ({
    generateQuestions: vi.fn()
  }))
}));

vi.mock('@agentris/integrations/jira', () => ({
  TicketService: vi.fn().mockImplementation(() => ({
    addComment: vi.fn()
  }))
}));

describe('clarificationRouter', () => {
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: ReturnType<typeof clarificationRouter.createCaller>;

  const mockSession: Session = {
    user: {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      image: null
    },
    expires: '2024-12-31T23:59:59.999Z'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createInnerTRPCContext({ session: mockSession });
    caller = clarificationRouter.createCaller(ctx);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('generateClarifications', () => {
    it('should generate clarification questions for a ticket', async () => {
      const mockAnalysis = {
        id: 'analysis-1',
        ticketId: 'JIRA-123',
        findings: JSON.stringify({
          vagueTerms: [{ term: 'soon', reason: 'No timeline' }]
        })
      };

      const mockQuestions = [
        {
          question: 'What is the specific timeline?',
          ambiguityArea: 'Timeline',
          importanceScore: 0.9,
          impactLevel: 'high' as const,
          requirementDependency: []
        }
      ];

      const { AnalysisRepository, ClarificationRepository } = await import('@agentris/db');
      const { ClarificationGenerator } = await import('@agentris/ai-engine');
      const analysisRepo = new (AnalysisRepository as any)();
      const generator = new (ClarificationGenerator as any)();
      const clarificationRepo = new (ClarificationRepository as any)();

      analysisRepo.findByTicketId.mockResolvedValueOnce([mockAnalysis]);
      generator.generateQuestions.mockResolvedValueOnce(mockQuestions);
      clarificationRepo.create.mockResolvedValueOnce({
        id: 'clarif-1',
        question: mockQuestions[0].question,
        ticketId: 'JIRA-123'
      });
      analysisRepo.update.mockResolvedValueOnce(mockAnalysis);

      const result = await caller.generateClarifications({
        ticketId: 'JIRA-123',
        minQuestions: 1,
        maxQuestions: 3
      });

      expect(result.questions).toHaveLength(1);
      expect(result.questions[0].question).toBe('What is the specific timeline?');
      expect(result.clarificationIds).toHaveLength(1);
    });

    it('should throw error if no analysis exists', async () => {
      const { AnalysisRepository } = await import('@agentris/db');
      const analysisRepo = new (AnalysisRepository as any)();
      analysisRepo.findByTicketId.mockResolvedValueOnce([]);

      await expect(
        caller.generateClarifications({
          ticketId: 'JIRA-999',
          minQuestions: 3,
          maxQuestions: 5
        })
      ).rejects.toThrow('No analysis found for this ticket');
    });
  });

  describe('postToJira', () => {
    it('should post questions to Jira with AI-CLARIFIED tag', async () => {
      const questions = [
        'What is the expected behavior?',
        'Which users are affected?'
      ];

      const { TicketService } = await import('@agentris/integrations/jira');
      const { ClarificationRepository } = await import('@agentris/db');
      const ticketService = new (TicketService as any)();
      const clarificationRepo = new (ClarificationRepository as any)();

      ticketService.addComment.mockResolvedValueOnce({
        id: 'comment-123'
      });

      clarificationRepo.findByTicketId.mockResolvedValueOnce([
        {
          id: 'clarif-1',
          question: questions[0],
          ticketId: 'JIRA-123'
        },
        {
          id: 'clarif-2',
          question: questions[1],
          ticketId: 'JIRA-123'
        }
      ]);

      clarificationRepo.update.mockResolvedValue({});

      const result = await caller.postToJira({
        ticketId: 'JIRA-123',
        questions,
        includeTag: true
      });

      expect(result.success).toBe(true);
      expect(result.jiraCommentId).toBe('comment-123');
      expect(ticketService.addComment).toHaveBeenCalledWith(
        'JIRA-123',
        expect.objectContaining({
          body: expect.stringContaining('[AI-CLARIFIED]')
        })
      );
    });
  });

  describe('trackAnswers', () => {
    it('should add answer to a clarification', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const updatedClarification = {
        id: 'clarif-1',
        question: 'What is the timeline?',
        answer: '2 weeks from approval',
        ticketId: 'JIRA-123'
      };

      clarificationRepo.addAnswer.mockResolvedValueOnce(updatedClarification);

      const result = await caller.trackAnswers({
        clarificationId: 'clarif-1',
        answer: '2 weeks from approval'
      });

      expect(result.success).toBe(true);
      expect(result.clarification.answer).toBe('2 weeks from approval');
    });
  });

  describe('getClarifications', () => {
    it('should get all clarifications for a ticket', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const mockClarifications = [
        {
          id: 'clarif-1',
          question: 'Question 1?',
          answer: null,
          ticketId: 'JIRA-123'
        },
        {
          id: 'clarif-2',
          question: 'Question 2?',
          answer: 'Answer 2',
          ticketId: 'JIRA-123'
        }
      ];

      clarificationRepo.findByTicketId.mockResolvedValueOnce(mockClarifications);

      const result = await caller.getClarifications({
        ticketId: 'JIRA-123',
        includeAnswered: true
      });

      expect(result.clarifications).toHaveLength(2);
    });

    it('should get only unanswered clarifications', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const mockClarifications = [
        {
          id: 'clarif-1',
          question: 'Unanswered question?',
          answer: null,
          ticketId: 'JIRA-123'
        }
      ];

      clarificationRepo.findUnanswered.mockResolvedValueOnce(mockClarifications);

      const result = await caller.getClarifications({
        ticketId: 'JIRA-123',
        includeAnswered: false
      });

      expect(result.clarifications).toHaveLength(1);
      expect(result.clarifications[0].answer).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should get statistics for a specific ticket', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const mockStats = {
        total: 5,
        answered: 3,
        unanswered: 2,
        sources: [
          { source: 'AI', count: 4 },
          { source: 'MANUAL', count: 1 }
        ]
      };

      clarificationRepo.getStatsByTicket.mockResolvedValueOnce(mockStats);

      const result = await caller.getStats({
        ticketId: 'JIRA-123'
      });

      expect(result.stats.total).toBe(5);
      expect(result.stats.answered).toBe(3);
    });

    it('should get overall statistics when no ticketId', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const mockStats = {
        totalQuestions: 100,
        answeredQuestions: 75,
        answerRate: 0.75,
        bySource: [
          { source: 'AI', total: 80, answered: 60, rate: 0.75 },
          { source: 'MANUAL', total: 20, answered: 15, rate: 0.75 }
        ]
      };

      clarificationRepo.trackAnswerRate.mockResolvedValueOnce(mockStats);

      const result = await caller.getStats({});

      expect(result.stats.answerRate).toBe(0.75);
    });
  });

  describe('getRecentlyAnswered', () => {
    it('should get recently answered clarifications', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      const mockClarifications = [
        {
          id: 'clarif-1',
          question: 'Recent question?',
          answer: 'Recent answer',
          ticketId: 'JIRA-123',
          updatedAt: new Date()
        }
      ];

      clarificationRepo.findRecentlyAnswered.mockResolvedValueOnce(mockClarifications);

      const result = await caller.getRecentlyAnswered({
        limit: 5
      });

      expect(result.clarifications).toHaveLength(1);
      expect(result.clarifications[0].answer).toBe('Recent answer');
    });
  });

  describe('deleteClarification', () => {
    it('should delete a clarification', async () => {
      const { ClarificationRepository } = await import('@agentris/db');
      const clarificationRepo = new (ClarificationRepository as any)();

      clarificationRepo.delete.mockResolvedValueOnce({});

      const result = await caller.deleteClarification({
        clarificationId: 'clarif-1'
      });

      expect(result.success).toBe(true);
      expect(clarificationRepo.delete).toHaveBeenCalledWith('clarif-1');
    });
  });
});