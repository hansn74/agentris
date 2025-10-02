import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalysisRepository } from './AnalysisRepository';
import { PrismaClient, AnalysisType, AmbiguityPattern } from '@prisma/client';

vi.mock('@prisma/client', () => {
  const mockPrismaClient = {
    analysis: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrismaClient),
    AnalysisType: {
      AMBIGUITY: 'AMBIGUITY',
      COMPLEXITY: 'COMPLEXITY',
      FEASIBILITY: 'FEASIBILITY',
    },
    AmbiguityPattern: {
      MISSING_INFO: 'MISSING_INFO',
      VAGUE_TERMS: 'VAGUE_TERMS',
      CONFLICTING_REQUIREMENTS: 'CONFLICTING_REQUIREMENTS',
    },
  };
});

describe('AnalysisRepository', () => {
  let repository: AnalysisRepository;
  let prisma: PrismaClient;

  beforeEach(() => {
    prisma = new PrismaClient();
    repository = new AnalysisRepository(prisma);
  });

  describe('create', () => {
    it('should create a new analysis', async () => {
      const input = {
        ticketId: 'ticket-1',
        type: AnalysisType.AMBIGUITY,
        findings: { issues: ['vague requirements'] },
        confidence: 0.85,
        score: 0.7,
        patterns: [AmbiguityPattern.VAGUE_TERMS],
      };

      const expectedAnalysis = { id: 'analysis-1', ...input };
      (prisma.analysis.create as any).mockResolvedValue(expectedAnalysis);

      const result = await repository.create(input);

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: {
          ticketId: input.ticketId,
          type: input.type,
          findings: input.findings,
          confidence: input.confidence,
          score: input.score,
          patterns: input.patterns,
        },
      });
      expect(result).toEqual(expectedAnalysis);
    });
  });

  describe('findByTicketAndType', () => {
    it('should find analysis by ticket and type', async () => {
      const ticketId = 'ticket-1';
      const type = AnalysisType.AMBIGUITY;
      const expectedAnalysis = {
        id: 'analysis-1',
        ticketId,
        type,
        findings: {},
        confidence: 0.8,
      };

      (prisma.analysis.findUnique as any).mockResolvedValue(expectedAnalysis);

      const result = await repository.findByTicketAndType(ticketId, type);

      expect(prisma.analysis.findUnique).toHaveBeenCalledWith({
        where: {
          ticketId_type: {
            ticketId,
            type,
          },
        },
      });
      expect(result).toEqual(expectedAnalysis);
    });
  });

  describe('upsert', () => {
    it('should upsert an analysis', async () => {
      const ticketId = 'ticket-1';
      const type = AnalysisType.AMBIGUITY;
      const input = {
        ticketId,
        type,
        findings: { issues: ['updated findings'] },
        confidence: 0.9,
        score: 0.75,
        patterns: [AmbiguityPattern.MISSING_INFO, AmbiguityPattern.VAGUE_TERMS],
      };

      const expectedAnalysis = { id: 'analysis-1', ...input };
      (prisma.analysis.upsert as any).mockResolvedValue(expectedAnalysis);

      const result = await repository.upsert(ticketId, type, input);

      expect(prisma.analysis.upsert).toHaveBeenCalledWith({
        where: {
          ticketId_type: {
            ticketId,
            type,
          },
        },
        create: {
          ticketId: input.ticketId,
          type: input.type,
          findings: input.findings,
          confidence: input.confidence,
          score: input.score,
          patterns: input.patterns,
        },
        update: {
          findings: input.findings,
          confidence: input.confidence,
          score: input.score,
          patterns: input.patterns,
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(expectedAnalysis);
    });
  });

  describe('findByTicket', () => {
    it('should find all analyses for a ticket', async () => {
      const ticketId = 'ticket-1';
      const expectedAnalyses = [
        { id: 'analysis-1', ticketId, type: AnalysisType.AMBIGUITY },
        { id: 'analysis-2', ticketId, type: AnalysisType.COMPLEXITY },
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(expectedAnalyses);

      const result = await repository.findByTicket(ticketId);

      expect(prisma.analysis.findMany).toHaveBeenCalledWith({
        where: { ticketId },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(expectedAnalyses);
    });
  });

  describe('delete', () => {
    it('should delete an analysis by id', async () => {
      const id = 'analysis-1';
      const deletedAnalysis = { id, ticketId: 'ticket-1' };

      (prisma.analysis.delete as any).mockResolvedValue(deletedAnalysis);

      const result = await repository.delete(id);

      expect(prisma.analysis.delete).toHaveBeenCalledWith({
        where: { id },
      });
      expect(result).toEqual(deletedAnalysis);
    });
  });

  describe('getRecentAnalyses', () => {
    it('should get recent analyses with limit', async () => {
      const expectedAnalyses = [
        { id: 'analysis-1', ticket: { id: 'ticket-1' } },
        { id: 'analysis-2', ticket: { id: 'ticket-2' } },
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(expectedAnalyses);

      const result = await repository.getRecentAnalyses(5);

      expect(prisma.analysis.findMany).toHaveBeenCalledWith({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: { ticket: true },
      });
      expect(result).toEqual(expectedAnalyses);
    });
  });
});