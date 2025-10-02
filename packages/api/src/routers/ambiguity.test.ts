import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ambiguityRouter } from './ambiguity';
import { createInnerTRPCContext } from '../trpc';
import { prisma } from '@agentris/db';

// Mock dependencies
vi.mock('@agentris/db', () => ({
  prisma: {
    ticket: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    analysis: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
  AnalysisType: {
    AMBIGUITY: 'AMBIGUITY',
    COMPLEXITY: 'COMPLEXITY',
    FEASIBILITY: 'FEASIBILITY',
  },
}));

vi.mock('@agentris/ai-engine/ambiguity-detector', () => ({
  AmbiguityDetector: vi.fn().mockImplementation(() => ({
    detectAmbiguity: vi.fn().mockResolvedValue({
      score: 0.7,
      confidence: 0.85,
      missingInfo: [
        { pattern: 'MISSING_INFO', text: 'No acceptance criteria', severity: 'high' },
      ],
      vagueTerms: [
        { term: 'fast', context: 'The system should be fast', suggestion: 'Define response time' },
      ],
      conflicts: [],
      patterns: ['MISSING_INFO', 'VAGUE_TERMS'],
      summary: 'High ambiguity detected due to missing criteria and vague terms.',
    }),
  })),
}));

vi.mock('@agentris/db/repositories/AnalysisRepository', () => ({
  AnalysisRepository: vi.fn().mockImplementation(() => ({
    upsert: vi.fn().mockResolvedValue({ id: 'analysis-1' }),
    findByTicketAndType: vi.fn(),
    update: vi.fn(),
    getRecentAnalyses: vi.fn(),
  })),
}));

describe('ambiguityRouter', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    role: 'CONSULTANT',
  };

  const createCaller = () => {
    const ctx = createInnerTRPCContext({
      session: {
        user: mockUser,
        expires: new Date(Date.now() + 3600000).toISOString(),
      },
    });
    return ambiguityRouter.createCaller(ctx);
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detectAmbiguity', () => {
    it('should detect ambiguity for a ticket', async () => {
      const caller = createCaller();
      const mockTicket = {
        id: 'ticket-1',
        summary: 'Implement fast search',
        description: 'The search should be fast and user-friendly',
        status: 'NEW',
      };

      (prisma.ticket.findUnique as any).mockResolvedValue(mockTicket);
      (prisma.ticket.update as any).mockResolvedValue({
        ...mockTicket,
        ambiguityScore: 0.7,
        status: 'CLARIFYING',
      });

      const result = await caller.detectAmbiguity({ ticketId: 'ticket-1' });

      expect(result.success).toBe(true);
      expect(result.data.score).toBe(0.7);
      expect(result.data.confidence).toBe(0.85);
      expect(result.data.missingInfo).toHaveLength(1);
      expect(result.data.vagueTerms).toHaveLength(1);
      
      // Verify ticket was updated
      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { 
          ambiguityScore: 0.7,
          status: 'CLARIFYING',
        },
      });
    });

    it('should detect ambiguity for raw text', async () => {
      const caller = createCaller();
      const text = 'Build a fast system with good performance';

      const result = await caller.detectAmbiguity({ text });

      expect(result.success).toBe(true);
      expect(result.data.score).toBe(0.7);
      expect(prisma.ticket.findUnique).not.toHaveBeenCalled();
      expect(prisma.ticket.update).not.toHaveBeenCalled();
    });

    it('should throw error if neither ticketId nor text provided', async () => {
      const caller = createCaller();

      await expect(caller.detectAmbiguity({})).rejects.toThrow();
    });

    it('should throw error if ticket not found', async () => {
      const caller = createCaller();
      (prisma.ticket.findUnique as any).mockResolvedValue(null);

      await expect(
        caller.detectAmbiguity({ ticketId: 'non-existent' })
      ).rejects.toThrow('Ticket not found');
    });

    it('should set status to READY for low ambiguity score', async () => {
      const caller = createCaller();
      const mockTicket = {
        id: 'ticket-1',
        summary: 'Clear requirements',
        description: 'Add button that increments counter',
        status: 'NEW',
      };

      (prisma.ticket.findUnique as any).mockResolvedValue(mockTicket);
      
      // Mock low ambiguity score
      const { AmbiguityDetector } = await import('@agentris/ai-engine/ambiguity-detector');
      const mockDetector = new (AmbiguityDetector as any)();
      mockDetector.detectAmbiguity.mockResolvedValueOnce({
        score: 0.2,
        confidence: 0.9,
        missingInfo: [],
        vagueTerms: [],
        conflicts: [],
        patterns: [],
        summary: 'Low ambiguity detected.',
      });

      await caller.detectAmbiguity({ ticketId: 'ticket-1' });

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { 
          ambiguityScore: 0.2,
          status: 'READY',
        },
      });
    });
  });

  describe('getAmbiguityDetails', () => {
    it('should retrieve ambiguity analysis for a ticket', async () => {
      const caller = createCaller();
      const mockAnalysis = {
        id: 'analysis-1',
        ticketId: 'ticket-1',
        type: 'AMBIGUITY',
        score: 0.7,
        confidence: 0.85,
        patterns: ['MISSING_INFO', 'VAGUE_TERMS'],
        findings: {
          missingInfo: [],
          vagueTerms: [],
          conflicts: [],
          summary: 'Test summary',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.findByTicketAndType.mockResolvedValue(mockAnalysis);

      const result = await caller.getAmbiguityDetails({ ticketId: 'ticket-1' });

      expect(result.id).toBe('analysis-1');
      expect(result.score).toBe(0.7);
      expect(result.confidence).toBe(0.85);
      expect(result.patterns).toEqual(['MISSING_INFO', 'VAGUE_TERMS']);
    });

    it('should throw error if analysis not found', async () => {
      const caller = createCaller();
      
      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.findByTicketAndType.mockResolvedValue(null);

      await expect(
        caller.getAmbiguityDetails({ ticketId: 'ticket-1' })
      ).rejects.toThrow('Ambiguity analysis not found');
    });
  });

  describe('updateAmbiguityScore', () => {
    it('should update ambiguity score manually', async () => {
      const caller = createCaller();
      const mockAnalysis = {
        id: 'analysis-1',
        ticketId: 'ticket-1',
        findings: { summary: 'Original findings' },
      };

      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.findByTicketAndType.mockResolvedValue(mockAnalysis);
      mockRepo.update.mockResolvedValue({
        ...mockAnalysis,
        score: 0.3,
      });

      (prisma.ticket.update as any).mockResolvedValue({ id: 'ticket-1' });

      const result = await caller.updateAmbiguityScore({
        ticketId: 'ticket-1',
        score: 0.3,
        reason: 'Manual review found requirements clear',
      });

      expect(result.success).toBe(true);
      expect(mockRepo.update).toHaveBeenCalledWith('analysis-1', expect.objectContaining({
        score: 0.3,
        findings: expect.objectContaining({
          manualAdjustment: expect.objectContaining({
            score: 0.3,
            reason: 'Manual review found requirements clear',
            adjustedBy: 'user-1',
          }),
        }),
      }));

      expect(prisma.ticket.update).toHaveBeenCalledWith({
        where: { id: 'ticket-1' },
        data: { 
          ambiguityScore: 0.3,
          status: 'READY',
        },
      });
    });

    it('should throw error if analysis not found', async () => {
      const caller = createCaller();
      
      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.findByTicketAndType.mockResolvedValue(null);

      await expect(
        caller.updateAmbiguityScore({ ticketId: 'ticket-1', score: 0.5 })
      ).rejects.toThrow('Ambiguity analysis not found');
    });
  });

  describe('getRecentAnalyses', () => {
    it('should retrieve recent ambiguity analyses', async () => {
      const caller = createCaller();
      const mockAnalyses = [
        {
          id: 'analysis-1',
          ticketId: 'ticket-1',
          type: 'AMBIGUITY',
          score: 0.7,
          confidence: 0.85,
          patterns: ['MISSING_INFO'],
          ticket: { id: 'ticket-1', summary: 'Test ticket' },
          createdAt: new Date(),
        },
        {
          id: 'analysis-2',
          ticketId: 'ticket-2',
          type: 'COMPLEXITY',
          score: 0.5,
          confidence: 0.8,
          patterns: [],
          ticket: { id: 'ticket-2', summary: 'Another ticket' },
          createdAt: new Date(),
        },
      ];

      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.getRecentAnalyses.mockResolvedValue(mockAnalyses);

      const result = await caller.getRecentAnalyses({ limit: 10 });

      // Should filter to only AMBIGUITY type
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('analysis-1');
      expect(result[0].ticket.summary).toBe('Test ticket');
    });

    it('should use default limit if not provided', async () => {
      const caller = createCaller();
      
      const { AnalysisRepository } = await import('@agentris/db/repositories/AnalysisRepository');
      const mockRepo = new (AnalysisRepository as any)();
      mockRepo.getRecentAnalyses.mockResolvedValue([]);

      await caller.getRecentAnalyses();

      expect(mockRepo.getRecentAnalyses).toHaveBeenCalledWith(10);
    });
  });
});