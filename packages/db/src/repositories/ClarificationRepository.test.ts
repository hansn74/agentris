import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ClarificationRepository } from './ClarificationRepository';
import type { PrismaClient } from '@prisma/client';

const mockPrisma = {
  clarification: {
    create: vi.fn(),
    createMany: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn()
  }
} as unknown as PrismaClient;

describe('ClarificationRepository', () => {
  let repository: ClarificationRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repository = new ClarificationRepository(mockPrisma);
  });

  describe('create', () => {
    it('should create a new clarification', async () => {
      const input = {
        ticketId: 'JIRA-123',
        question: 'What is the expected behavior?',
        source: 'AI',
        askedBy: 'system'
      };

      const expected = {
        id: 'clarif-1',
        ...input,
        answer: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clarification.create.mockResolvedValueOnce(expected);

      const result = await repository.create(input);
      
      expect(mockPrisma.clarification.create).toHaveBeenCalledWith({
        data: input
      });
      expect(result).toEqual(expected);
    });
  });

  describe('createMany', () => {
    it('should create multiple clarifications', async () => {
      const inputs = [
        {
          ticketId: 'JIRA-123',
          question: 'Question 1?',
          source: 'AI'
        },
        {
          ticketId: 'JIRA-123',
          question: 'Question 2?',
          source: 'AI'
        }
      ];

      mockPrisma.clarification.createMany.mockResolvedValueOnce({ count: 2 });

      const result = await repository.createMany(inputs);
      
      expect(mockPrisma.clarification.createMany).toHaveBeenCalledWith({
        data: inputs,
        skipDuplicates: true
      });
      expect(result).toBe(2);
    });
  });

  describe('findById', () => {
    it('should find a clarification by id', async () => {
      const expected = {
        id: 'clarif-1',
        ticketId: 'JIRA-123',
        question: 'Test question?',
        answer: null,
        source: 'AI',
        askedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ticket: { jiraKey: 'JIRA-123' }
      };

      mockPrisma.clarification.findUnique.mockResolvedValueOnce(expected);

      const result = await repository.findById('clarif-1');
      
      expect(mockPrisma.clarification.findUnique).toHaveBeenCalledWith({
        where: { id: 'clarif-1' },
        include: { ticket: true }
      });
      expect(result).toEqual(expected);
    });
  });

  describe('findByTicketId', () => {
    it('should find all clarifications for a ticket', async () => {
      const clarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Question 1?',
          answer: null,
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-2',
          ticketId: 'JIRA-123',
          question: 'Question 2?',
          answer: 'Answer 2',
          source: 'MANUAL',
          askedBy: 'user@example.com',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(clarifications);

      const result = await repository.findByTicketId('JIRA-123');
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: { ticketId: 'JIRA-123' },
        orderBy: { createdAt: 'desc' }
      });
      expect(result).toEqual(clarifications);
    });
  });

  describe('findUnanswered', () => {
    it('should find unanswered clarifications', async () => {
      const unanswered = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Unanswered question?',
          answer: null,
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ticket: {}
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(unanswered);

      const result = await repository.findUnanswered('JIRA-123');
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: { 
          answer: null,
          ticketId: 'JIRA-123'
        },
        orderBy: { createdAt: 'desc' },
        include: { ticket: true }
      });
      expect(result).toEqual(unanswered);
    });

    it('should find all unanswered when no ticketId provided', async () => {
      mockPrisma.clarification.findMany.mockResolvedValueOnce([]);

      await repository.findUnanswered();
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: { answer: null },
        orderBy: { createdAt: 'desc' },
        include: { ticket: true }
      });
    });
  });

  describe('findAnswered', () => {
    it('should find answered clarifications', async () => {
      const answered = [
        {
          id: 'clarif-2',
          ticketId: 'JIRA-123',
          question: 'Answered question?',
          answer: 'Here is the answer',
          source: 'MANUAL',
          askedBy: 'user@example.com',
          createdAt: new Date(),
          updatedAt: new Date(),
          ticket: {}
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(answered);

      const result = await repository.findAnswered('JIRA-123');
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: { 
          answer: { not: null },
          ticketId: 'JIRA-123'
        },
        orderBy: { updatedAt: 'desc' },
        include: { ticket: true }
      });
      expect(result).toEqual(answered);
    });
  });

  describe('findWithFilter', () => {
    it('should apply multiple filters', async () => {
      const filter = {
        ticketId: 'JIRA-123',
        source: 'AI',
        answered: false,
        askedBy: 'system'
      };

      mockPrisma.clarification.findMany.mockResolvedValueOnce([]);

      await repository.findWithFilter(filter);
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: {
          ticketId: 'JIRA-123',
          source: 'AI',
          answer: null,
          askedBy: 'system'
        },
        orderBy: { createdAt: 'desc' },
        include: { ticket: true }
      });
    });
  });

  describe('update', () => {
    it('should update a clarification', async () => {
      const input = {
        question: 'Updated question?',
        answer: 'New answer'
      };

      const updated = {
        id: 'clarif-1',
        ticketId: 'JIRA-123',
        question: 'Updated question?',
        answer: 'New answer',
        source: 'AI',
        askedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clarification.update.mockResolvedValueOnce(updated);

      const result = await repository.update('clarif-1', input);
      
      expect(mockPrisma.clarification.update).toHaveBeenCalledWith({
        where: { id: 'clarif-1' },
        data: input
      });
      expect(result).toEqual(updated);
    });
  });

  describe('addAnswer', () => {
    it('should add an answer to a clarification', async () => {
      const answer = 'This is the answer';
      
      const updated = {
        id: 'clarif-1',
        ticketId: 'JIRA-123',
        question: 'Question?',
        answer,
        source: 'AI',
        askedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clarification.update.mockResolvedValueOnce(updated);

      const result = await repository.addAnswer('clarif-1', answer);
      
      expect(mockPrisma.clarification.update).toHaveBeenCalledWith({
        where: { id: 'clarif-1' },
        data: { answer }
      });
      expect(result).toEqual(updated);
    });
  });

  describe('delete', () => {
    it('should delete a clarification', async () => {
      const deleted = {
        id: 'clarif-1',
        ticketId: 'JIRA-123',
        question: 'Question?',
        answer: null,
        source: 'AI',
        askedBy: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockPrisma.clarification.delete.mockResolvedValueOnce(deleted);

      const result = await repository.delete('clarif-1');
      
      expect(mockPrisma.clarification.delete).toHaveBeenCalledWith({
        where: { id: 'clarif-1' }
      });
      expect(result).toEqual(deleted);
    });
  });

  describe('deleteByTicketId', () => {
    it('should delete all clarifications for a ticket', async () => {
      mockPrisma.clarification.deleteMany.mockResolvedValueOnce({ count: 3 });

      const result = await repository.deleteByTicketId('JIRA-123');
      
      expect(mockPrisma.clarification.deleteMany).toHaveBeenCalledWith({
        where: { ticketId: 'JIRA-123' }
      });
      expect(result).toBe(3);
    });
  });

  describe('getStatsByTicket', () => {
    it('should calculate statistics for a ticket', async () => {
      const clarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Q1?',
          answer: null,
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-2',
          ticketId: 'JIRA-123',
          question: 'Q2?',
          answer: 'A2',
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-3',
          ticketId: 'JIRA-123',
          question: 'Q3?',
          answer: 'A3',
          source: 'MANUAL',
          askedBy: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(clarifications);

      const result = await repository.getStatsByTicket('JIRA-123');
      
      expect(result).toEqual({
        total: 3,
        answered: 2,
        unanswered: 1,
        sources: [
          { source: 'AI', count: 2 },
          { source: 'MANUAL', count: 1 }
        ]
      });
    });
  });

  describe('trackAnswerRate', () => {
    it('should track overall answer rates', async () => {
      const allClarifications = [
        {
          id: 'clarif-1',
          ticketId: 'JIRA-123',
          question: 'Q1?',
          answer: null,
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-2',
          ticketId: 'JIRA-124',
          question: 'Q2?',
          answer: 'A2',
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-3',
          ticketId: 'JIRA-125',
          question: 'Q3?',
          answer: 'A3',
          source: 'MANUAL',
          askedBy: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'clarif-4',
          ticketId: 'JIRA-126',
          question: 'Q4?',
          answer: null,
          source: 'MANUAL',
          askedBy: 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(allClarifications);

      const result = await repository.trackAnswerRate();
      
      expect(result).toEqual({
        totalQuestions: 4,
        answeredQuestions: 2,
        answerRate: 0.5,
        bySource: [
          { source: 'AI', total: 2, answered: 1, rate: 0.5 },
          { source: 'MANUAL', total: 2, answered: 1, rate: 0.5 }
        ]
      });
    });
  });

  describe('findRecentlyAnswered', () => {
    it('should find recently answered clarifications', async () => {
      const recent = [
        {
          id: 'clarif-2',
          ticketId: 'JIRA-124',
          question: 'Recent Q?',
          answer: 'Recent A',
          source: 'AI',
          askedBy: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          ticket: {}
        }
      ];

      mockPrisma.clarification.findMany.mockResolvedValueOnce(recent);

      const result = await repository.findRecentlyAnswered(5);
      
      expect(mockPrisma.clarification.findMany).toHaveBeenCalledWith({
        where: { answer: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        include: { ticket: true }
      });
      expect(result).toEqual(recent);
    });
  });
});