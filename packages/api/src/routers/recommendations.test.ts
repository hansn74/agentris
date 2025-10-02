import { describe, it, expect, beforeEach, vi } from 'vitest';
import { recommendationsRouter } from './recommendations';
import { createCallerFactory } from '../trpc';
import { PatternAnalyzer, RecommendationEngine, ConflictDetector } from '@agentris/ai-engine';
import { FeedbackProcessor } from '@agentris/services';
import { RecommendationRepository } from '@agentris/db';

// Mock dependencies
vi.mock('@agentris/ai-engine', () => ({
  PatternAnalyzer: vi.fn(),
  RecommendationEngine: vi.fn(),
  ConflictDetector: vi.fn(),
  LLMService: vi.fn()
}));

vi.mock('@agentris/services', () => ({
  FeedbackProcessor: vi.fn(),
  ImpactAnalyzerService: vi.fn()
}));

vi.mock('@agentris/db', () => ({
  RecommendationRepository: vi.fn()
}));

vi.mock('@agentris/integrations-salesforce', () => ({
  MetadataService: vi.fn()
}));

describe('recommendationsRouter', () => {
  let caller: any;
  const mockCtx = {
    session: { user: { id: 'user123' } }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    const createCaller = createCallerFactory(recommendationsRouter);
    caller = createCaller(mockCtx);
  });

  describe('analyzeOrgContext', () => {
    it('should analyze org patterns successfully', async () => {
      const mockPatterns = {
        namingPatterns: [{ type: 'field', pattern: 'PascalCase__c', frequency: 10, examples: [], confidence: 0.9 }],
        fieldTypePatterns: [],
        relationshipPatterns: [],
        validationPatterns: [],
        automationPatterns: []
      };

      const mockAnalyzeOrgPatterns = vi.fn().mockResolvedValue(mockPatterns);
      (PatternAnalyzer as any).mockImplementation(() => ({
        analyzeOrgPatterns: mockAnalyzeOrgPatterns
      }));

      const result = await caller.analyzeOrgContext({
        ticketId: 'ticket123',
        orgId: 'org123'
      });

      expect(result.success).toBe(true);
      expect(result.patterns).toEqual(mockPatterns);
      expect(result.summary.namingPatternCount).toBe(1);
      expect(mockAnalyzeOrgPatterns).toHaveBeenCalledWith('org123', 'ticket123');
    });

    it('should handle errors gracefully', async () => {
      (PatternAnalyzer as any).mockImplementation(() => ({
        analyzeOrgPatterns: vi.fn().mockRejectedValue(new Error('Analysis failed'))
      }));

      await expect(caller.analyzeOrgContext({
        ticketId: 'ticket123',
        orgId: 'org123'
      })).rejects.toThrow('Failed to analyze org context');
    });
  });

  describe('getRecommendations', () => {
    it('should return cached recommendations if available', async () => {
      const mockRecommendations = [
        {
          id: 'rec1',
          type: 'naming',
          category: 'suggestion',
          title: 'Test',
          description: 'Test desc',
          rationale: 'Test rationale',
          confidence: 0.8
        }
      ];

      const mockGetRecommendations = vi.fn().mockResolvedValue(mockRecommendations);
      (RecommendationRepository as any).mockImplementation(() => ({
        getRecommendations: mockGetRecommendations,
        storeRecommendations: vi.fn()
      }));

      const result = await caller.getRecommendations({
        ticketId: 'ticket123',
        orgId: 'org123'
      });

      expect(result.success).toBe(true);
      expect(result.recommendations).toEqual(mockRecommendations);
      expect(result.fromCache).toBe(true);
    });

    it('should generate new recommendations when proposedChanges provided', async () => {
      const mockGeneratedRecommendations = [
        {
          id: 'rec2',
          type: 'fieldType',
          category: 'warning',
          title: 'New',
          description: 'New desc',
          rationale: 'New rationale',
          confidence: 0.9
        }
      ];

      (RecommendationRepository as any).mockImplementation(() => ({
        getRecommendations: vi.fn().mockResolvedValue([]),
        storeRecommendations: vi.fn()
      }));

      (RecommendationEngine as any).mockImplementation(() => ({
        generateRecommendations: vi.fn().mockResolvedValue(mockGeneratedRecommendations)
      }));

      const result = await caller.getRecommendations({
        ticketId: 'ticket123',
        orgId: 'org123',
        proposedChanges: { fields: [{ name: 'Test__c' }] }
      });

      expect(result.success).toBe(true);
      expect(result.recommendations).toEqual(mockGeneratedRecommendations);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('checkConflicts', () => {
    it('should detect conflicts successfully', async () => {
      const mockConflicts = [
        {
          type: 'duplicate',
          severity: 'high',
          conflictingComponent: 'Field__c',
          description: 'Duplicate field',
          resolution: 'Rename field'
        }
      ];

      (ConflictDetector as any).mockImplementation(() => ({
        detectConflicts: vi.fn().mockResolvedValue(mockConflicts)
      }));

      const result = await caller.checkConflicts({
        orgId: 'org123',
        proposedChanges: { fields: [{ name: 'Field__c' }] }
      });

      expect(result.success).toBe(true);
      expect(result.conflicts).toEqual(mockConflicts);
      expect(result.hasConflicts).toBe(true);
      expect(result.highCount).toBe(1);
    });

    it('should return no conflicts when none found', async () => {
      (ConflictDetector as any).mockImplementation(() => ({
        detectConflicts: vi.fn().mockResolvedValue([])
      }));

      const result = await caller.checkConflicts({
        orgId: 'org123',
        proposedChanges: { fields: [] }
      });

      expect(result.success).toBe(true);
      expect(result.hasConflicts).toBe(false);
      expect(result.criticalCount).toBe(0);
    });
  });

  describe('submitFeedback', () => {
    it('should process feedback successfully', async () => {
      const mockRecommendation = {
        id: 'rec123',
        type: 'naming',
        category: 'suggestion',
        title: 'Test',
        description: 'Test',
        rationale: 'Test',
        confidence: 0.8
      };

      (RecommendationRepository as any).mockImplementation(() => ({
        getRecommendations: vi.fn().mockResolvedValue([mockRecommendation]),
        updateRecommendationWithFeedback: vi.fn()
      }));

      (FeedbackProcessor as any).mockImplementation(() => ({
        processFeedback: vi.fn()
      }));

      const result = await caller.submitFeedback({
        recommendationId: 'rec123',
        action: 'accepted'
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Feedback submitted successfully');
    });

    it('should handle not found recommendation', async () => {
      (RecommendationRepository as any).mockImplementation(() => ({
        getRecommendations: vi.fn().mockResolvedValue([])
      }));

      await expect(caller.submitFeedback({
        recommendationId: 'rec123',
        action: 'accepted'
      })).rejects.toThrow('Recommendation not found');
    });
  });

  describe('getRecommendationStats', () => {
    it('should return recommendation statistics', async () => {
      const mockStats = {
        totalRecommendations: 100,
        byType: { naming: 40, fieldType: 30, conflict: 30 },
        byCategory: { suggestion: 60, warning: 30, error: 10 },
        averageConfidence: 0.75,
        acceptanceRate: 0.8
      };

      (RecommendationRepository as any).mockImplementation(() => ({
        getRecommendationStats: vi.fn().mockResolvedValue(mockStats)
      }));

      const result = await caller.getRecommendationStats({
        orgId: 'org123'
      });

      expect(result.success).toBe(true);
      expect(result.stats).toEqual(mockStats);
    });
  });
});