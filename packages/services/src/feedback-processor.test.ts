import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FeedbackProcessor } from './feedback-processor';
import { prisma } from '@agentris/db';
import type { Recommendation, RecommendationFeedback } from '@agentris/shared';

vi.mock('@agentris/db', () => ({
  prisma: {
    approvalItem: {
      create: vi.fn(),
      findMany: vi.fn()
    },
    analysis: {
      findFirst: vi.fn(),
      update: vi.fn()
    }
  }
}));

describe('FeedbackProcessor', () => {
  let processor: FeedbackProcessor;

  beforeEach(() => {
    processor = new FeedbackProcessor();
    vi.clearAllMocks();
  });

  describe('processFeedback', () => {
    it('should process accepted feedback', async () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec123',
        action: 'accepted',
        timestamp: new Date()
      };

      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'naming',
        category: 'suggestion',
        title: 'Naming Convention',
        description: 'Follow naming convention',
        rationale: 'Organization standard',
        confidence: 0.85
      };

      (prisma.approvalItem.create as any).mockResolvedValue({
        id: 'approval123',
        status: 'APPROVED'
      });

      (prisma.analysis.findFirst as any).mockResolvedValue({
        id: 'analysis123',
        findings: {}
      });
      
      (prisma.approvalItem.findMany as any).mockResolvedValue([]);

      await processor.processFeedback(feedback, recommendation);

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          itemId: 'rec123',
          itemType: 'naming',
          status: 'APPROVED'
        })
      });
    });

    it('should process rejected feedback with reason', async () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec123',
        action: 'rejected',
        reason: 'Not applicable to our org',
        timestamp: new Date()
      };

      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'fieldType',
        category: 'suggestion',
        title: 'Field Type',
        description: 'Use email type',
        rationale: 'Best practice',
        confidence: 0.75
      };

      (prisma.approvalItem.findMany as any).mockResolvedValue([]);
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      await processor.processFeedback(feedback, recommendation);

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'REJECTED',
          reason: 'Not applicable to our org'
        })
      });
    });

    it('should process modified feedback', async () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec123',
        action: 'modified',
        modifiedValue: { name: 'ModifiedName__c' },
        timestamp: new Date()
      };

      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'naming',
        category: 'suggestion',
        title: 'Naming',
        description: 'Original suggestion',
        rationale: 'Standard',
        confidence: 0.8
      };

      (prisma.approvalItem.findMany as any).mockResolvedValue([]);
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      await processor.processFeedback(feedback, recommendation);

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'MODIFIED',
          modifiedData: JSON.stringify({ name: 'ModifiedName__c' })
        })
      });
    });
  });

  describe('trackApprovedRecommendation', () => {
    it('should track approved recommendations', async () => {
      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'naming',
        category: 'suggestion',
        title: 'Field Naming',
        description: 'Use PascalCase',
        rationale: 'Org standard',
        confidence: 0.9
      };

      await processor.trackApprovedRecommendation('rec123', recommendation, 'approval456');

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          approvalId: 'approval456',
          itemId: 'rec123',
          itemType: 'naming',
          status: 'APPROVED',
          modifiedData: expect.stringContaining('confidence')
        })
      });
    });
  });

  describe('trackRejectedRecommendation', () => {
    it('should track rejected recommendations with reason', async () => {
      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'conflict',
        category: 'error',
        title: 'Duplicate Field',
        description: 'Field already exists',
        rationale: 'Conflict detected',
        confidence: 1.0,
        impact: 'high'
      };

      await processor.trackRejectedRecommendation(
        'rec123',
        recommendation,
        'approval456',
        'Field is intentionally duplicated for migration'
      );

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'REJECTED',
          reason: 'Field is intentionally duplicated for migration',
          modifiedData: expect.stringContaining('rejectionContext')
        })
      });
    });
  });

  describe('trackModifiedRecommendation', () => {
    it('should track modifications with change details', async () => {
      const recommendation: Recommendation = {
        id: 'rec123',
        type: 'naming',
        category: 'suggestion',
        title: 'Original Name',
        description: 'Use CustomerEmail__c',
        rationale: 'Standard',
        confidence: 0.85
      };

      const modifiedData = {
        title: 'Modified Name',
        description: 'Use Email__c instead'
      };

      await processor.trackModifiedRecommendation(
        'rec123',
        recommendation,
        'approval456',
        modifiedData,
        'Shorter name preferred'
      );

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'MODIFIED',
          reason: 'Shorter name preferred',
          modifiedData: expect.stringContaining('changeType')
        })
      });
    });
  });

  describe('getPatternLearningData', () => {
    it('should calculate learning data for a pattern type', async () => {
      const mockFeedback = [
        { status: 'APPROVED', itemType: 'naming', modifiedData: null },
        { status: 'APPROVED', itemType: 'naming', modifiedData: null },
        { status: 'REJECTED', itemType: 'naming', modifiedData: null },
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

      (prisma.approvalItem.findMany as any).mockResolvedValue(mockFeedback);

      const learningData = await processor.getPatternLearningData('naming');

      expect(learningData.patternId).toBe('naming');
      expect(learningData.feedbackCount).toBe(4);
      expect(learningData.acceptanceRate).toBe(0.5);
      expect(learningData.modifications).toHaveLength(1);
      expect(learningData.modifications[0].reason).toBe('Prefer snake_case');
    });

    it('should handle empty feedback data', async () => {
      (prisma.approvalItem.findMany as any).mockResolvedValue([]);

      const learningData = await processor.getPatternLearningData('fieldType');

      expect(learningData.feedbackCount).toBe(0);
      expect(learningData.acceptanceRate).toBe(0);
      expect(learningData.modifications).toHaveLength(0);
    });
  });

  describe('getFeedbackMetrics', () => {
    it('should calculate comprehensive feedback metrics', async () => {
      const mockFeedback = [
        { status: 'APPROVED', itemType: 'naming', modifiedData: null },
        { status: 'APPROVED', itemType: 'naming', modifiedData: null },
        { status: 'APPROVED', itemType: 'fieldType', modifiedData: null },
        { status: 'REJECTED', itemType: 'naming', modifiedData: null },
        { status: 'REJECTED', itemType: 'conflict', modifiedData: null },
        {
          status: 'MODIFIED',
          itemType: 'naming',
          modifiedData: JSON.stringify({
            original: { name: 'Field1' },
            modified: { name: 'Field2' }
          })
        }
      ];

      (prisma.approvalItem.findMany as any).mockResolvedValue(mockFeedback);

      const metrics = await processor.getFeedbackMetrics();

      expect(metrics.totalFeedback).toBe(6);
      expect(metrics.acceptanceRate).toBeCloseTo(0.5, 2);
      expect(metrics.rejectionRate).toBeCloseTo(0.333, 2);
      expect(metrics.modificationRate).toBeCloseTo(0.167, 2);
      expect(metrics.patternAccuracy.get('naming')).toBeCloseTo(0.5, 2);
      expect(metrics.patternAccuracy.get('fieldType')).toBe(1.0);
      expect(metrics.patternAccuracy.get('conflict')).toBe(0);
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      (prisma.approvalItem.findMany as any).mockResolvedValue([]);

      await processor.getFeedbackMetrics(startDate, endDate);

      expect(prisma.approvalItem.findMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            gte: startDate,
            lte: endDate
          }
        }
      });
    });
  });

  describe('improveRecommendations', () => {
    it('should improve recommendations based on learning data', async () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Naming Convention',
          description: 'Use PascalCase',
          rationale: 'Standard',
          confidence: 0.7
        },
        {
          id: 'rec2',
          type: 'fieldType',
          category: 'suggestion',
          title: 'Field Type',
          description: 'Use email type',
          rationale: 'Best practice',
          confidence: 0.8
        }
      ];

      const highAcceptanceFeedback = new Array(8).fill({
        status: 'APPROVED',
        itemType: 'naming',
        modifiedData: null
      }).concat(new Array(2).fill({
        status: 'REJECTED',
        itemType: 'naming',
        modifiedData: null
      }));

      const lowAcceptanceFeedback = new Array(2).fill({
        status: 'APPROVED',
        itemType: 'fieldType',
        modifiedData: null
      }).concat(new Array(8).fill({
        status: 'REJECTED',
        itemType: 'fieldType',
        modifiedData: null
      }));

      (prisma.approvalItem.findMany as any).mockImplementation(({ where }: any) => {
        if (where.itemType === 'naming') {
          return Promise.resolve(highAcceptanceFeedback);
        }
        if (where.itemType === 'fieldType') {
          return Promise.resolve(lowAcceptanceFeedback);
        }
        return Promise.resolve([]);
      });

      const improved = await processor.improveRecommendations('ticket123', recommendations);

      const namingRec = improved.find(r => r.type === 'naming');
      const fieldTypeRec = improved.find(r => r.type === 'fieldType');

      expect(namingRec?.category).toBe('warning');
      expect(namingRec?.description).toContain('[Highly recommended]');
      
      expect(fieldTypeRec?.category).toBe('suggestion');
      expect(fieldTypeRec?.description).toContain('[Low acceptance rate]');
    });

    it('should not modify recommendations with insufficient feedback', async () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'automation',
          category: 'suggestion',
          title: 'Add Workflow',
          description: 'Create workflow rule',
          rationale: 'Automation',
          confidence: 0.6
        }
      ];

      (prisma.approvalItem.findMany as any).mockResolvedValue([
        { status: 'APPROVED', itemType: 'automation', modifiedData: null }
      ]);

      const improved = await processor.improveRecommendations('ticket123', recommendations);

      expect(improved[0]).toEqual(recommendations[0]);
    });

    it('should add modification notes when common patterns exist', async () => {
      const recommendations: Recommendation[] = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Field Name',
          description: 'Use FieldName__c',
          rationale: 'Convention',
          confidence: 0.75
        }
      ];

      const feedbackWithModifications = [
        ...new Array(5).fill({ status: 'APPROVED', itemType: 'naming', modifiedData: null }),
        ...new Array(3).fill({
          status: 'MODIFIED',
          itemType: 'naming',
          modifiedData: JSON.stringify({
            original: 'FieldName__c',
            modified: 'Field_Name__c'
          }),
          reason: 'Prefer snake_case'
        })
      ];

      (prisma.approvalItem.findMany as any).mockResolvedValue(feedbackWithModifications);

      const improved = await processor.improveRecommendations('ticket123', recommendations);

      expect(improved[0].description).toContain('Users often modify');
    });
  });

  describe('analyzeFeedbackTrends', () => {
    it('should detect significant trend changes', async () => {
      const feedback: RecommendationFeedback = {
        recommendationId: 'rec123',
        action: 'accepted',
        timestamp: new Date()
      };

      const recentFeedback = [
        ...new Array(30).fill({ status: 'REJECTED', createdAt: new Date('2024-01-01') }),
        ...new Array(70).fill({ status: 'APPROVED', createdAt: new Date('2024-01-15') })
      ];

      (prisma.approvalItem.findMany as any).mockResolvedValue(recentFeedback);
      (prisma.analysis.findFirst as any).mockResolvedValue(null);

      await processor.analyzeFeedbackTrends('naming', feedback);

      expect(prisma.approvalItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            itemType: 'naming'
          })
        })
      );
    });
  });
});