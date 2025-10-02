import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationRecalculator } from './recommendation-recalculator';
import type { Recommendation, OrgPatterns } from '@agentris/shared';

// Mock dependencies
vi.mock('@agentris/ai-engine', () => ({
  PatternAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeOrgPatterns: vi.fn()
  })),
  RecommendationEngine: vi.fn().mockImplementation(() => ({
    generateRecommendations: vi.fn()
  })),
  ConflictDetector: vi.fn().mockImplementation(() => ({
    detectConflicts: vi.fn()
  })),
  LLMService: vi.fn()
}));

vi.mock('@agentris/integrations-salesforce', () => ({
  MetadataService: vi.fn()
}));

vi.mock('./impact-analyzer', () => ({
  ImpactAnalyzerService: vi.fn()
}));

vi.mock('@agentris/db', () => ({
  RecommendationRepository: vi.fn().mockImplementation(() => ({
    storeRecommendations: vi.fn(),
    getLatestAnalysis: vi.fn(),
    addRecalculationHistory: vi.fn()
  }))
}));

describe('RecommendationRecalculator', () => {
  let recalculator: RecommendationRecalculator;

  const mockPatterns: OrgPatterns = {
    namingPatterns: [
      { pattern: 'PascalCase__c', count: 10, confidence: 0.85, examples: [] }
    ],
    fieldTypePatterns: [
      { fieldType: 'Text', commonNames: ['Name', 'Status'], confidence: 0.75 }
    ],
    relationshipPatterns: [],
    validationPatterns: [],
    automationPatterns: []
  };

  const mockRecommendations: Recommendation[] = [
    {
      id: 'rec-1',
      type: 'naming',
      category: 'suggestion',
      title: 'Update field naming',
      description: 'Follow org conventions',
      rationale: 'Consistency',
      confidence: 0.85
    },
    {
      id: 'rec-2',
      type: 'fieldType',
      category: 'warning',
      title: 'Change field type',
      description: 'Use TextArea',
      rationale: 'Better for long text',
      confidence: 0.75
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    recalculator = new RecommendationRecalculator();
  });

  describe('queueRecalculation', () => {
    it('should queue a recalculation request', async () => {
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: { fields: [{ name: 'Test__c' }] },
        triggerType: 'manual' as const
      };

      await recalculator.queueRecalculation(context);
      
      // Verify internal state (queue should have the context)
      expect(recalculator['recalculationQueue'].has('ticket-123')).toBe(true);
    });

    it('should process queue automatically', async () => {
      const processSpy = vi.spyOn(recalculator as any, 'processQueue');
      
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {},
        triggerType: 'auto' as const
      };

      await recalculator.queueRecalculation(context);
      
      expect(processSpy).toHaveBeenCalled();
    });
  });

  describe('recalculateRecommendations', () => {
    it('should recalculate recommendations with new context', async () => {
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: { fields: [{ name: 'NewField__c' }] },
        triggerType: 'context_change' as const,
        previousRecommendations: mockRecommendations
      };

      // Mock internal methods
      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      const result = await recalculator.recalculateRecommendations(context);

      expect(result).toHaveProperty('recommendations');
      expect(result).toHaveProperty('changes');
      expect(result).toHaveProperty('confidence');
      expect(result.recommendations).toHaveLength(2);
    });

    it('should detect changes between recommendations', async () => {
      const previousRecs = [mockRecommendations[0]];
      const newRecs = [
        mockRecommendations[0],
        mockRecommendations[1] // Added
      ];

      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {},
        triggerType: 'manual' as const,
        previousRecommendations: previousRecs
      };

      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(newRecs);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      const result = await recalculator.recalculateRecommendations(context);

      expect(result.changes.added).toHaveLength(1);
      expect(result.changes.removed).toHaveLength(0);
      expect(result.changes.added[0].id).toBe('rec-2');
    });

    it('should convert conflicts to recommendations', async () => {
      const conflicts = [
        {
          id: 'conflict-1',
          severity: 'critical',
          message: 'Duplicate field',
          details: 'Field already exists',
          resolution: 'Rename field'
        }
      ];

      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {},
        triggerType: 'auto' as const
      };

      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue([]);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue(conflicts);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      const result = await recalculator.recalculateRecommendations(context);

      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].type).toBe('conflict');
      expect(result.recommendations[0].category).toBe('error');
    });

    it('should calculate confidence scores', async () => {
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: { fields: [] },
        triggerType: 'manual' as const
      };

      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      const result = await recalculator.recalculateRecommendations(context);

      expect(result.confidence.overall).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThanOrEqual(1);
      expect(result.confidence.factors).toBeInstanceOf(Array);
      expect(result.confidence.factors.length).toBeGreaterThan(0);
    });
  });

  describe('event emissions', () => {
    it('should emit recalculated event after processing', async () => {
      const eventSpy = vi.fn();
      recalculator.on('recalculated', eventSpy);

      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {},
        triggerType: 'manual' as const
      };

      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      await recalculator.queueRecalculation(context);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(eventSpy).toHaveBeenCalled();
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'ticket-123',
          result: expect.any(Object),
          context: expect.any(Object)
        })
      );
    });
  });

  describe('pattern analysis optimization', () => {
    it('should re-analyze patterns for significant changes', async () => {
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {
          objects: [{ action: 'create', name: 'NewObject__c' }]
        },
        triggerType: 'context_change' as const
      };

      const analyzePatternsSpy = vi.fn().mockResolvedValue(mockPatterns);
      recalculator['patternAnalyzer'].analyzeOrgPatterns = analyzePatternsSpy;
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      await recalculator.recalculateRecommendations(context);

      expect(analyzePatternsSpy).toHaveBeenCalledWith('org-456', 'ticket-123');
    });

    it('should use cached patterns for minor changes', async () => {
      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {
          fields: [{ action: 'modify', name: 'ExistingField__c', changes: { label: 'New Label' } }]
        },
        triggerType: 'context_change' as const
      };

      const analyzePatternsSpy = vi.fn().mockResolvedValue(mockPatterns);
      recalculator['patternAnalyzer'].analyzeOrgPatterns = analyzePatternsSpy;
      recalculator['repository'].getLatestAnalysis = vi.fn().mockResolvedValue({
        findings: mockPatterns
      });
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();
      recalculator['repository'].addRecalculationHistory = vi.fn();

      await recalculator.recalculateRecommendations(context);

      expect(analyzePatternsSpy).not.toHaveBeenCalled();
    });
  });

  describe('history tracking', () => {
    it('should track recalculation history', async () => {
      const addHistorySpy = vi.fn();
      recalculator['repository'].addRecalculationHistory = addHistorySpy;

      const context = {
        ticketId: 'ticket-123',
        orgId: 'org-456',
        proposedChanges: {},
        triggerType: 'manual' as const
      };

      recalculator['patternAnalyzer'].analyzeOrgPatterns = vi.fn()
        .mockResolvedValue(mockPatterns);
      recalculator['recommendationEngine'].generateRecommendations = vi.fn()
        .mockResolvedValue(mockRecommendations);
      recalculator['conflictDetector'].detectConflicts = vi.fn()
        .mockResolvedValue([]);
      recalculator['repository'].storeRecommendations = vi.fn();

      await recalculator.recalculateRecommendations(context);

      expect(addHistorySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 'ticket-123',
          triggerType: 'manual',
          changesCount: expect.any(Object),
          timestamp: expect.any(Date)
        })
      );
    });
  });
});