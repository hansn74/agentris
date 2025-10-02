import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnswerTrackerService } from './answer-tracker';
import type { TicketService } from '@agentris/integrations/jira';
import type { LLMService } from '@agentris/ai-engine';

// Mock dependencies
vi.mock('@agentris/db', () => ({
  prisma: {},
  ClarificationRepository: vi.fn().mockImplementation(() => ({
    findByTicketId: vi.fn(),
    findAnswered: vi.fn(),
    findUnanswered: vi.fn(),
    addAnswer: vi.fn(),
    getStatsByTicket: vi.fn()
  }))
}));

describe('AnswerTrackerService', () => {
  let service: AnswerTrackerService;
  let mockTicketService: any;
  let mockLLMService: any;

  beforeEach(() => {
    mockTicketService = {
      findTaggedComments: vi.fn(),
      parseAnswersFromComments: vi.fn(),
      updateTicketWithAnswerStatus: vi.fn(),
      fetchTicketDetails: vi.fn()
    };

    mockLLMService = {
      generateResponse: vi.fn()
    };

    service = new AnswerTrackerService(mockTicketService, mockLLMService);
  });

  describe('detectAnswers', () => {
    it('should detect direct answers from Jira comments', async () => {
      const mockClarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'What is the timeline?',
          answer: null,
          source: 'AI',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-2',
          ticketId: 'JIRA-123',
          question: 'Who are the users?',
          answer: null,
          source: 'AI',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const mockTaggedComments = [
        { id: 'comment-1', body: '[AI-CLARIFIED] Questions here' }
      ];

      const mockAnswers = new Map([
        ['What is the timeline?', '2 weeks'],
        ['Who are the users?', 'All authenticated users']
      ]);

      // Mock repository
      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findByTicketId.mockResolvedValue(mockClarifications);
      mockRepo.addAnswer.mockResolvedValue({});
      (service as any).clarificationRepo = mockRepo;

      // Mock ticket service
      mockTicketService.findTaggedComments.mockResolvedValue(mockTaggedComments);
      mockTicketService.parseAnswersFromComments.mockResolvedValue(mockAnswers);
      mockTicketService.updateTicketWithAnswerStatus.mockResolvedValue({});

      const result = await service.detectAnswers('JIRA-123');

      expect(result.ticketId).toBe('JIRA-123');
      expect(result.questionsFound).toBe(2);
      expect(result.answersDetected).toBe(2);
      expect(result.clarificationsUpdated).toBe(2);
      expect(result.confidence).toBe(1.0);

      expect(mockRepo.addAnswer).toHaveBeenCalledTimes(2);
      expect(mockRepo.addAnswer).toHaveBeenCalledWith('clarif-1', '2 weeks');
      expect(mockRepo.addAnswer).toHaveBeenCalledWith('clarif-2', 'All authenticated users');
    });

    it('should skip already answered questions when forceUpdate is false', async () => {
      const mockClarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Already answered?',
          answer: 'Yes',
          source: 'AI',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findByTicketId.mockResolvedValue(mockClarifications);
      mockRepo.addAnswer.mockResolvedValue({});
      (service as any).clarificationRepo = mockRepo;

      mockTicketService.findTaggedComments.mockResolvedValue([
        { id: 'comment-1', body: '[AI-CLARIFIED]' }
      ]);
      mockTicketService.parseAnswersFromComments.mockResolvedValue(new Map());

      const result = await service.detectAnswers('JIRA-123', { forceUpdate: false });

      expect(result.clarificationsUpdated).toBe(0);
      expect(mockRepo.addAnswer).not.toHaveBeenCalled();
    });

    it('should use AI to detect answers when enabled', async () => {
      const mockClarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'What about performance?',
          answer: null,
          source: 'AI',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findByTicketId.mockResolvedValue(mockClarifications);
      mockRepo.addAnswer.mockResolvedValue({});
      (service as any).clarificationRepo = mockRepo;

      mockTicketService.findTaggedComments.mockResolvedValue([
        { 
          id: 'comment-1', 
          body: 'Regarding performance, we expect under 100ms response time' 
        }
      ]);
      mockTicketService.parseAnswersFromComments.mockResolvedValue(new Map());

      mockLLMService.generateResponse.mockResolvedValue({
        content: JSON.stringify([
          {
            questionIndex: 0,
            question: 'What about performance?',
            answer: 'Expected response time under 100ms',
            confidence: 0.8,
            reasoning: 'Comment directly addresses performance'
          }
        ])
      });

      const result = await service.detectAnswers('JIRA-123', { useAI: true });

      expect(result.answersDetected).toBe(1);
      expect(result.confidence).toBe(0.8);
      expect(mockLLMService.generateResponse).toHaveBeenCalled();
    });

    it('should respect minimum confidence threshold for AI answers', async () => {
      const mockClarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Unclear question?',
          answer: null,
          source: 'AI',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findByTicketId.mockResolvedValue(mockClarifications);
      mockRepo.addAnswer.mockResolvedValue({});
      (service as any).clarificationRepo = mockRepo;

      mockTicketService.findTaggedComments.mockResolvedValue([
        { id: 'comment-1', body: 'Some vague response' }
      ]);
      mockTicketService.parseAnswersFromComments.mockResolvedValue(new Map());

      mockLLMService.generateResponse.mockResolvedValue({
        content: JSON.stringify([
          {
            questionIndex: 0,
            question: 'Unclear question?',
            answer: 'Maybe this',
            confidence: 0.4, // Below threshold
            reasoning: 'Low confidence match'
          }
        ])
      });

      const result = await service.detectAnswers('JIRA-123', { 
        useAI: true,
        minConfidence: 0.7 
      });

      expect(result.answersDetected).toBe(0);
      expect(mockRepo.addAnswer).not.toHaveBeenCalled();
    });
  });

  describe('getAnswerStats', () => {
    it('should calculate answer statistics', async () => {
      const mockStats = {
        total: 5,
        answered: 3,
        unanswered: 2,
        sources: []
      };

      const mockAnsweredClarifications = [
        {
          id: 'c1',
          answer: 'Answer 1',
          createdAt: new Date('2024-01-01T10:00:00Z'),
          updatedAt: new Date('2024-01-01T14:00:00Z')
        },
        {
          id: 'c2',
          answer: 'Answer 2',
          createdAt: new Date('2024-01-01T11:00:00Z'),
          updatedAt: new Date('2024-01-01T13:00:00Z')
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.getStatsByTicket.mockResolvedValue(mockStats);
      mockRepo.findAnswered.mockResolvedValue(mockAnsweredClarifications);
      (service as any).clarificationRepo = mockRepo;

      const result = await service.getAnswerStats('JIRA-123');

      expect(result.total).toBe(5);
      expect(result.answered).toBe(3);
      expect(result.pending).toBe(2);
      expect(result.answerRate).toBe(0.6);
      expect(result.avgResponseTime).toBeDefined();
      expect(result.avgResponseTime).toBe(3); // Average of 4 and 2 hours
    });
  });

  describe('checkUnansweredQuestions', () => {
    it('should identify tickets with old unanswered questions', async () => {
      const oldDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
      const mockUnanswered = [
        {
          id: 'c1',
          ticketId: 'JIRA-123',
          question: 'Old question?',
          answer: null,
          createdAt: oldDate,
          updatedAt: oldDate
        },
        {
          id: 'c2',
          ticketId: 'JIRA-124',
          question: 'Recent question?',
          answer: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findUnanswered.mockResolvedValue(mockUnanswered);
      (service as any).clarificationRepo = mockRepo;

      mockTicketService.fetchTicketDetails.mockResolvedValue({
        fields: { priority: { name: 'High' } }
      });

      const alerts = await service.checkUnansweredQuestions({ maxAge: 24 });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].ticketId).toBe('JIRA-123');
      expect(alerts[0].unansweredCount).toBe(1);
      expect(alerts[0].oldestQuestionAge).toBeGreaterThan(24);
      expect(alerts[0].priority).toBe('High');
    });

    it('should group multiple unanswered questions per ticket', async () => {
      const oldDate = new Date(Date.now() - 36 * 60 * 60 * 1000);
      const mockUnanswered = [
        {
          id: 'c1',
          ticketId: 'JIRA-123',
          question: 'Question 1?',
          answer: null,
          createdAt: oldDate,
          updatedAt: oldDate
        },
        {
          id: 'c2',
          ticketId: 'JIRA-123',
          question: 'Question 2?',
          answer: null,
          createdAt: oldDate,
          updatedAt: oldDate
        },
        {
          id: 'c3',
          ticketId: 'JIRA-123',
          question: 'Question 3?',
          answer: null,
          createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
          updatedAt: new Date()
        }
      ];

      const { ClarificationRepository } = await import('@agentris/db');
      const mockRepo = new (ClarificationRepository as any)();
      mockRepo.findUnanswered.mockResolvedValue(mockUnanswered);
      (service as any).clarificationRepo = mockRepo;

      mockTicketService.fetchTicketDetails.mockResolvedValue({
        fields: { priority: { name: 'Medium' } }
      });

      const alerts = await service.checkUnansweredQuestions({ maxAge: 24 });

      expect(alerts).toHaveLength(1);
      expect(alerts[0].ticketId).toBe('JIRA-123');
      expect(alerts[0].unansweredCount).toBe(3);
      expect(alerts[0].oldestQuestionAge).toBeGreaterThanOrEqual(36);
    });
  });
});