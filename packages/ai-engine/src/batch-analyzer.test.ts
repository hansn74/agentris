import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchAnalyzer } from './batch-analyzer';
import { LLMService } from './llm-service';
import { ChangeDetector, ChangeType } from './change-detector';
import { Ticket, TicketStatus, AnalysisType } from '@agentris/db';

// Mock LLMService and ChangeDetector
vi.mock('./llm-service');
vi.mock('./change-detector');

describe('BatchAnalyzer', () => {
  let analyzer: BatchAnalyzer;
  let mockLLMService: LLMService;
  let mockChangeDetector: ChangeDetector;

  const createMockTicket = (id: string, summary: string, description: string): Ticket => ({
    id,
    jiraKey: `JIRA-${id}`,
    jiraId: `jira-id-${id}`,
    summary,
    description,
    status: TicketStatus.NEW,
    ambiguityScore: null,
    acceptanceCriteria: null,
    assignedToId: 'user-1',
    organizationId: 'org-1',
    userId: 'user-1',
    automationSuccess: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    mockLLMService = new LLMService();
    mockChangeDetector = new ChangeDetector();
    analyzer = new BatchAnalyzer(mockLLMService, mockChangeDetector, 0.7);
  });

  describe('analyzeTicketsForBatching', () => {
    it('should return empty result for less than 2 tickets', async () => {
      const tickets = [
        createMockTicket('1', 'Add field to Account', 'Add phone field')
      ];

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toEqual([]);
      expect(result.groupingSuggestions).toEqual([]);
      expect(result.totalAnalyzed).toBe(1);
    });

    it('should analyze similarity between two tickets with same change type', async () => {
      const tickets = [
        createMockTicket('1', 'Add field to Account', 'Add phone field to Account object'),
        createMockTicket('2', 'Add field to Account', 'Add email field to Account object')
      ];

      // Mock change detection
      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field', 'add'],
          patterns: ['add field'],
          objectNames: ['Account'],
          fieldNames: ['phone', 'email']
        }
      });

      // Mock LLM similarity analysis
      vi.spyOn(mockLLMService, 'analyzeText').mockResolvedValue(
        'SCORE: 0.85 | CONFIDENCE: 0.9 | REASONING: Both tickets add fields to Account object'
      );

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toHaveLength(1);
      expect(result.similarityScores[0].score).toBe(0.85);
      expect(result.similarityScores[0].changeType).toBe(ChangeType.FIELD);
      expect(result.similarityScores[0].object).toBe('Account');
      expect(result.totalAnalyzed).toBe(2);
    });

    it('should create grouping suggestions for similar tickets', async () => {
      const tickets = [
        createMockTicket('1', 'Add field to Account', 'Add phone field'),
        createMockTicket('2', 'Add field to Account', 'Add email field'),
        createMockTicket('3', 'Add field to Contact', 'Add address field')
      ];

      // Mock change detections
      const accountDetection = {
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field'],
          patterns: ['add field'],
          objectNames: ['Account'],
          fieldNames: []
        }
      };

      const contactDetection = {
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.9,
        metadata: {
          keywords: ['field'],
          patterns: ['add field'],
          objectNames: ['Contact'],
          fieldNames: []
        }
      };

      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValueOnce(accountDetection)
        .mockReturnValueOnce(accountDetection)
        .mockReturnValueOnce(contactDetection);

      // Mock high similarity for Account fields
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockReturnValueOnce('SCORE: 0.9 | CONFIDENCE: 0.95 | REASONING: Same object and change type')
        .mockReturnValueOnce('SCORE: 0.3 | CONFIDENCE: 0.7 | REASONING: Different objects')
        .mockReturnValueOnce('SCORE: 0.3 | CONFIDENCE: 0.7 | REASONING: Different objects');

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.groupingSuggestions).toHaveLength(1);
      expect(result.groupingSuggestions[0].tickets).toContain('1');
      expect(result.groupingSuggestions[0].tickets).toContain('2');
      expect(result.groupingSuggestions[0].changeType).toBe(ChangeType.FIELD);
      expect(result.groupingSuggestions[0].object).toBe('Account');
      expect(result.groupingSuggestions[0].averageSimilarity).toBeGreaterThan(0.7);
    });

    it('should handle different change types with low similarity', async () => {
      const tickets = [
        createMockTicket('1', 'Add field to Account', 'Add phone field'),
        createMockTicket('2', 'Create flow for Lead', 'Auto-assign leads')
      ];

      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValueOnce({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.9,
          metadata: {
            keywords: ['field'],
            patterns: [],
            objectNames: ['Account']
          }
        })
        .mockReturnValueOnce({
          primaryType: ChangeType.FLOW,
          detectedTypes: [ChangeType.FLOW],
          confidence: 0.9,
          metadata: {
            keywords: ['flow'],
            patterns: [],
            objectNames: ['Lead']
          }
        });

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toHaveLength(1);
      expect(result.similarityScores[0].score).toBe(0.2); // Low score for different types
      expect(result.similarityScores[0].reasoning).toContain('Different change types');
      expect(result.groupingSuggestions).toHaveLength(0); // No groups due to low similarity
    });

    it('should return low score for different objects', async () => {
      const tickets = [
        createMockTicket('1', 'Add field to Account', 'Description 1'),
        createMockTicket('2', 'Add field to Contact', 'Description 2')
      ];

      // Mock different objects for the two tickets to test different object path
      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValueOnce({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.8,
          metadata: {
            keywords: ['field'],
            patterns: [],
            objectNames: ['Account']
          }
        })
        .mockReturnValueOnce({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.8,
          metadata: {
            keywords: ['field'],
            patterns: [],
            objectNames: ['Contact'] // Different object
          }
        });

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toHaveLength(1);
      // Different objects return 0.3 score with 0.6 confidence
      expect(result.similarityScores[0].score).toBe(0.3);
      expect(result.similarityScores[0].confidence).toBe(0.6);
      expect(result.similarityScores[0].reasoning).toContain('Different objects');
    });

    it('should handle LLM service errors gracefully', async () => {
      const tickets = [
        createMockTicket('1', 'Add field', 'Description 1'),
        createMockTicket('2', 'Add field', 'Description 2')
      ];

      // Mock no object names to avoid the different objects path
      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValue({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.8,
          metadata: {
            keywords: ['field'],
            patterns: [],
            objectNames: [] // Empty array, so [0] returns undefined
          }
        });

      // Mock LLM service error
      const llmSpy = vi.spyOn(mockLLMService, 'analyzeText').mockRejectedValue(
        new Error('LLM service error')
      );

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toHaveLength(1);
      
      // Verify LLM was called (should be for same objects/types)
      expect(llmSpy).toHaveBeenCalled();
      
      // When objects are undefined and LLM fails, we get fallback score
      expect(result.similarityScores[0].score).toBe(0.5);
      expect(result.similarityScores[0].confidence).toBe(0.4);
      expect(result.similarityScores[0].reasoning).toContain('Fallback');
    });
  });

  describe('storeBatchAnalysis', () => {
    it('should format analysis results for storage', async () => {
      const analysisResult = {
        similarityScores: [
          {
            ticketId1: '1',
            ticketId2: '2',
            score: 0.85,
            changeType: ChangeType.FIELD,
            object: 'Account',
            confidence: 0.9,
            reasoning: 'Similar field additions'
          }
        ],
        groupingSuggestions: [
          {
            name: 'FIELD changes for Account',
            tickets: ['1', '2'],
            changeType: ChangeType.FIELD,
            object: 'Account',
            averageSimilarity: 0.85,
            criteria: {
              changeType: 'FIELD',
              object: 'Account',
              threshold: 0.7
            }
          }
        ],
        totalAnalyzed: 2,
        analysisTime: 1000
      };

      const result = await analyzer.storeBatchAnalysis('ticket-1', analysisResult);

      expect(result.ticketId).toBe('ticket-1');
      expect(result.type).toBe(AnalysisType.BATCH_SIMILARITY);
      expect(result.findings).toEqual({
        similarityScores: analysisResult.similarityScores,
        groupingSuggestions: analysisResult.groupingSuggestions,
        totalAnalyzed: 2
      });
      expect(result.confidence).toBe(0.9);
      expect(result.score).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty ticket array', async () => {
      const result = await analyzer.analyzeTicketsForBatching([]);

      expect(result.similarityScores).toEqual([]);
      expect(result.groupingSuggestions).toEqual([]);
      expect(result.totalAnalyzed).toBe(0);
    });

    it('should handle tickets with missing change detection', async () => {
      const tickets = [
        createMockTicket('1', 'Ticket 1', 'Description 1'),
        createMockTicket('2', 'Ticket 2', 'Description 2')
      ];

      // Return undefined for one detection
      vi.spyOn(mockChangeDetector, 'detectChangeType')
        .mockReturnValueOnce(undefined as any)
        .mockReturnValueOnce({
          primaryType: ChangeType.FIELD,
          detectedTypes: [ChangeType.FIELD],
          confidence: 0.8,
          metadata: { keywords: [], patterns: [] }
        });

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      expect(result.similarityScores).toEqual([]);
      expect(result.totalAnalyzed).toBe(2);
    });

    it('should respect similarity threshold for grouping', async () => {
      const tickets = [
        createMockTicket('1', 'Ticket 1', 'Description 1'),
        createMockTicket('2', 'Ticket 2', 'Description 2'),
        createMockTicket('3', 'Ticket 3', 'Description 3')
      ];

      const detection = {
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 0.8,
        metadata: {
          keywords: ['field'],
          patterns: [],
          objectNames: ['Account']
        }
      };

      vi.spyOn(mockChangeDetector, 'detectChangeType').mockReturnValue(detection);

      // Mock varying similarity scores
      // Ticket 1-2: 0.6 (below threshold)
      // Ticket 1-3: 0.5 (below threshold)  
      // Ticket 2-3: 0.75 (above threshold)
      vi.spyOn(mockLLMService, 'analyzeText')
        .mockReturnValueOnce('SCORE: 0.6 | CONFIDENCE: 0.7 | REASONING: Somewhat similar')
        .mockReturnValueOnce('SCORE: 0.5 | CONFIDENCE: 0.6 | REASONING: Not very similar')
        .mockReturnValueOnce('SCORE: 0.75 | CONFIDENCE: 0.8 | REASONING: Similar');

      const result = await analyzer.analyzeTicketsForBatching(tickets);

      // Only tickets 2 and 3 should be grouped (similarity >= 0.7)
      expect(result.groupingSuggestions).toHaveLength(1);
      const group = result.groupingSuggestions[0];
      expect(group.tickets).toContain('2');
      expect(group.tickets).toContain('3');
      expect(group.tickets).not.toContain('1'); // Below threshold with both others
    });
  });
});