import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RecommendationRepository } from './RecommendationRepository';
import { prisma } from '../index';
import type { Recommendation, RecommendationFeedback } from '@agentris/shared';

vi.mock('../index', () => ({
  prisma: {
    analysis: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn()
    },
    ticket: {
      findMany: vi.fn()
    },
    approvalItem: {
      findMany: vi.fn()
    }
  }
}));

describe('RecommendationRepository', () => {
  let repository: RecommendationRepository;

  beforeEach(() => {
    repository = new RecommendationRepository();
    vi.clearAllMocks();
  });

  describe('storeRecommendations', () => {
    const mockRecommendations: Recommendation[] = [
      {
        id: 'rec1',
        type: 'naming',
        category: 'suggestion',
        title: 'Naming Convention',
        description: 'Follow PascalCase',
        rationale: 'Organization standard',
        confidence: 0.85
      },
      {
        id: 'rec2',
        type: 'fieldType',
        category: 'warning',
        title: 'Field Type',
        description: 'Use email type',
        rationale: 'Best practice',
        confidence: 0.9
      }
    ];

    it('should create new analysis if none exists', async () => {
      (prisma.analysis.findFirst as any).mockResolvedValue(null);
      (prisma.analysis.create as any).mockResolvedValue({
        id: 'analysis123',
        ticketId: 'ticket123',
        type: 'COMPLEXITY',
        suggestions: mockRecommendations
      });

      const result = await repository.storeRecommendations('ticket123', mockRecommendations);

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ticketId: 'ticket123',
          type: 'COMPLEXITY',
          suggestions: mockRecommendations
        })
      });
      expect(result.suggestions).toEqual(mockRecommendations);
    });

    it('should update existing analysis', async () => {
      const existingAnalysis = {
        id: 'analysis123',
        ticketId: 'ticket123',
        type: 'COMPLEXITY',
        suggestions: []
      };

      (prisma.analysis.findFirst as any).mockResolvedValue(existingAnalysis);
      (prisma.analysis.update as any).mockResolvedValue({
        ...existingAnalysis,
        suggestions: mockRecommendations
      });

      const result = await repository.storeRecommendations('ticket123', mockRecommendations);

      expect(prisma.analysis.update).toHaveBeenCalledWith({
        where: { id: 'analysis123' },
        data: expect.objectContaining({
          suggestions: mockRecommendations
        })
      });
      expect(result.suggestions).toEqual(mockRecommendations);
    });

    it('should calculate appropriate score and confidence', async () => {
      (prisma.analysis.findFirst as any).mockResolvedValue(null);
      (prisma.analysis.create as any).mockResolvedValue({
        id: 'analysis123',
        ticketId: 'ticket123'
      });

      await repository.storeRecommendations('ticket123', mockRecommendations);

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          score: expect.any(Number),
          confidence: 0.875
        })
      });
    });
  });

  describe('getRecommendations', () => {
    it('should retrieve recommendations from analysis', async () => {
      const mockRecommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Test',
          description: 'Test description',
          rationale: 'Test rationale',
          confidence: 0.8
        }
      ];

      (prisma.analysis.findFirst as any).mockResolvedValue({
        id: 'analysis123',
        suggestions: mockRecommendations
      });

      const recommendations = await repository.getRecommendations('ticket123');

      expect(recommendations).toEqual(mockRecommendations);
      expect(prisma.analysis.findFirst).toHaveBeenCalledWith({
        where: expect.objectContaining({
          ticketId: 'ticket123',
          type: 'COMPLEXITY'
        }),
        orderBy: { createdAt: 'desc' }
      });
    });

    it('should return empty array if no analysis found', async () => {
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      const recommendations = await repository.getRecommendations('ticket123');

      expect(recommendations).toEqual([]);
    });

    it('should return empty array if suggestions is null', async () => {
      (prisma.analysis.findFirst as any).mockResolvedValue({
        id: 'analysis123',
        suggestions: null
      });

      const recommendations = await repository.getRecommendations('ticket123');

      expect(recommendations).toEqual([]);
    });
  });

  describe('getHistoricalRecommendations', () => {
    it('should retrieve historical recommendations for an organization', async () => {
      (prisma.ticket.findMany as any).mockResolvedValue([
        { id: 'ticket1' },
        { id: 'ticket2' }
      ]);

      const mockAnalyses = [
        {
          ticketId: 'ticket1',
          suggestions: [{ id: 'rec1', type: 'naming' }],
          createdAt: new Date('2024-01-01')
        },
        {
          ticketId: 'ticket2',
          suggestions: [{ id: 'rec2', type: 'fieldType' }],
          createdAt: new Date('2024-01-02')
        }
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(mockAnalyses);

      const historical = await repository.getHistoricalRecommendations('org123', 10);

      expect(historical).toHaveLength(2);
      expect(historical[0].ticketId).toBe('ticket1');
      expect(historical[1].ticketId).toBe('ticket2');
      expect(prisma.ticket.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org123' },
        select: { id: true },
        take: 10,
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('getRecommendationsByType', () => {
    it('should filter recommendations by type', async () => {
      const mockRecommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Naming',
          description: 'Naming desc',
          rationale: 'Naming rationale',
          confidence: 0.8
        },
        {
          id: 'rec2',
          type: 'fieldType',
          category: 'warning',
          title: 'Field',
          description: 'Field desc',
          rationale: 'Field rationale',
          confidence: 0.9
        },
        {
          id: 'rec3',
          type: 'naming',
          category: 'suggestion',
          title: 'Another Naming',
          description: 'Another desc',
          rationale: 'Another rationale',
          confidence: 0.75
        }
      ];

      (prisma.analysis.findFirst as any).mockResolvedValue({
        suggestions: mockRecommendations
      });

      const namingRecommendations = await repository.getRecommendationsByType('ticket123', 'naming');

      expect(namingRecommendations).toHaveLength(2);
      expect(namingRecommendations.every(r => r.type === 'naming')).toBe(true);
    });
  });

  describe('getLearningDataFromApprovals', () => {
    it('should calculate learning data from approval items', async () => {
      const mockApprovalItems = [
        { status: 'APPROVED', itemType: 'naming' },
        { status: 'APPROVED', itemType: 'naming' },
        { status: 'REJECTED', itemType: 'naming' },
        {
          status: 'MODIFIED',
          itemType: 'naming',
          modifiedData: JSON.stringify({
            original: 'FieldName__c',
            modified: 'Field_Name__c'
          }),
          reason: 'Prefer snake_case'
        }
      ];

      (prisma.approvalItem.findMany as any).mockResolvedValue(mockApprovalItems);

      const learningData = await repository.getLearningDataFromApprovals('naming');

      expect(learningData.patternId).toBe('naming');
      expect(learningData.feedbackCount).toBe(4);
      expect(learningData.acceptanceRate).toBe(0.5);
      expect(learningData.modifications).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (prisma.approvalItem.findMany as any).mockResolvedValue([]);

      await repository.getLearningDataFromApprovals('naming', startDate, endDate);

      expect(prisma.approvalItem.findMany).toHaveBeenCalledWith({
        where: {
          itemType: 'naming',
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    });
  });

  describe('updateRecommendationWithFeedback', () => {
    it('should update recommendation with feedback', async () => {
      const existingRecommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Original',
          description: 'Original desc',
          rationale: 'Original rationale',
          confidence: 0.8
        }
      ];

      const feedback: RecommendationFeedback = {
        recommendationId: 'rec1',
        action: 'modified',
        modifiedValue: { name: 'ModifiedName__c' },
        reason: 'Better naming',
        timestamp: new Date()
      };

      (prisma.analysis.findFirst as any).mockResolvedValue({
        suggestions: existingRecommendations
      });
      (prisma.analysis.update as any).mockResolvedValue({});

      await repository.updateRecommendationWithFeedback('ticket123', 'rec1', feedback);

      expect(prisma.analysis.update).toHaveBeenCalled();
      const updateCall = (prisma.analysis.update as any).mock.calls[0][0];
      const updatedRecommendations = updateCall.data.suggestions;
      
      expect(updatedRecommendations[0].feedback).toBeDefined();
      expect(updatedRecommendations[0].feedback.action).toBe('modified');
    });
  });

  describe('getRecommendationVersionHistory', () => {
    it('should retrieve version history', async () => {
      const mockAnalyses = [
        {
          suggestions: [{ id: 'rec1', version: 1 }],
          createdAt: new Date('2024-01-01')
        },
        {
          suggestions: [{ id: 'rec1', version: 2 }],
          createdAt: new Date('2024-01-02')
        }
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(mockAnalyses);

      const history = await repository.getRecommendationVersionHistory('ticket123');

      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(1);
      expect(history[1].version).toBe(2);
      expect(history[0].createdAt).toEqual(new Date('2024-01-01'));
    });
  });

  describe('searchRecommendations', () => {
    it('should search recommendations by criteria', async () => {
      const mockTickets = [{ id: 'ticket1' }, { id: 'ticket2' }];
      
      const mockAnalyses = [
        {
          suggestions: [
            {
              id: 'rec1',
              type: 'naming',
              category: 'suggestion',
              confidence: 0.8,
              title: 'Test',
              description: 'Test',
              rationale: 'Test'
            },
            {
              id: 'rec2',
              type: 'fieldType',
              category: 'warning',
              confidence: 0.9,
              title: 'Test2',
              description: 'Test2',
              rationale: 'Test2'
            }
          ]
        }
      ];

      (prisma.ticket.findMany as any).mockResolvedValue(mockTickets);
      (prisma.analysis.findMany as any).mockResolvedValue(mockAnalyses);

      const results = await repository.searchRecommendations({
        orgId: 'org123',
        type: 'naming',
        minConfidence: 0.7
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('rec1');
    });

    it('should return all recommendations when no criteria specified', async () => {
      const mockAnalyses = [
        {
          suggestions: [
            { id: 'rec1', type: 'naming', category: 'suggestion', confidence: 0.8 },
            { id: 'rec2', type: 'fieldType', category: 'warning', confidence: 0.9 }
          ]
        }
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(mockAnalyses);

      const results = await repository.searchRecommendations({});

      expect(results).toHaveLength(2);
    });
  });

  describe('getRecommendationStats', () => {
    it('should calculate comprehensive statistics', async () => {
      (prisma.ticket.findMany as any).mockResolvedValue([
        { id: 'ticket1' },
        { id: 'ticket2' }
      ]);

      const mockAnalyses = [
        {
          ticketId: 'ticket1',
          suggestions: [
            {
              id: 'rec1',
              type: 'naming',
              category: 'suggestion',
              confidence: 0.8,
              title: 'Test',
              description: 'Test',
              rationale: 'Test'
            },
            {
              id: 'rec2',
              type: 'fieldType',
              category: 'warning',
              confidence: 0.9,
              title: 'Test2',
              description: 'Test2',
              rationale: 'Test2'
            }
          ],
          createdAt: new Date()
        },
        {
          ticketId: 'ticket2',
          suggestions: [
            {
              id: 'rec3',
              type: 'naming',
              category: 'suggestion',
              confidence: 0.75,
              title: 'Test3',
              description: 'Test3',
              rationale: 'Test3'
            }
          ],
          createdAt: new Date()
        }
      ];

      const mockApprovalItems = [
        { status: 'APPROVED' },
        { status: 'APPROVED' },
        { status: 'REJECTED' }
      ];

      (prisma.analysis.findMany as any).mockResolvedValue(mockAnalyses);
      (prisma.approvalItem.findMany as any).mockResolvedValue(mockApprovalItems);

      const stats = await repository.getRecommendationStats('org123');

      expect(stats.totalRecommendations).toBe(3);
      expect(stats.byType.naming).toBe(2);
      expect(stats.byType.fieldType).toBe(1);
      expect(stats.byCategory.suggestion).toBe(2);
      expect(stats.byCategory.warning).toBe(1);
      expect(stats.averageConfidence).toBeCloseTo(0.817, 2);
      expect(stats.acceptanceRate).toBeCloseTo(0.667, 2);
    });
  });
});