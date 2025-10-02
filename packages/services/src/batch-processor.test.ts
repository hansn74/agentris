import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchProcessor } from './batch-processor';
import { BatchRepository, TicketBatch, BatchStatus, Ticket, TicketStatus } from '@agentris/db';
import { BatchAnalyzer, BatchGroupingSuggestion } from '@agentris/ai-engine';

// Mock dependencies
vi.mock('@agentris/db', async () => {
  const actual = await vi.importActual('@agentris/db');
  return {
    ...actual,
    prisma: {}
  };
});

vi.mock('@agentris/ai-engine');

describe('BatchProcessor', () => {
  let processor: BatchProcessor;
  let mockRepository: BatchRepository;
  let mockAnalyzer: BatchAnalyzer;

  const createMockTicket = (id: string): Ticket => ({
    id,
    jiraKey: `JIRA-${id}`,
    jiraId: `jira-id-${id}`,
    summary: `Ticket ${id}`,
    description: `Description for ticket ${id}`,
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

  const createMockBatch = (id: string, ticketIds: string[]): TicketBatch => ({
    id,
    name: `Batch ${id}`,
    groupingCriteria: { changeType: 'FIELD', object: 'Account' },
    status: BatchStatus.PENDING,
    metadata: {},
    createdById: 'user-1',
    approvedById: null,
    processedAt: null,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    tickets: ticketIds.map(tid => ({
      id: `bt-${tid}`,
      batchId: id,
      ticketId: tid,
      excluded: false,
      addedAt: new Date(),
      excludedAt: null,
      ticket: createMockTicket(tid)
    }))
  });

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockRepository = {
      createBatch: vi.fn(),
      getBatchById: vi.fn(),
      updateBatchStatus: vi.fn(),
      recordProcessingResult: vi.fn(),
      getBatchResults: vi.fn(),
      getBatchStatistics: vi.fn()
    } as any;

    mockAnalyzer = {
      analyzeTicketsForBatching: vi.fn()
    } as any;

    processor = new BatchProcessor(mockRepository, mockAnalyzer, {
      minBatchSize: 2,
      maxBatchSize: 50,
      similarityThreshold: 0.7,
      autoCreateBatches: false
    });
  });

  describe('groupTickets', () => {
    it('should return ungrouped tickets when below minimum batch size', async () => {
      const tickets = [createMockTicket('1')];
      
      const result = await processor.groupTickets(tickets, 'user-1');
      
      expect(result.ungroupedTickets).toEqual(tickets);
      expect(result.batches).toEqual([]);
      expect(result.errors).toContain('Minimum 2 tickets required for batching');
    });

    it('should group tickets based on similarity analysis', async () => {
      const tickets = [
        createMockTicket('1'),
        createMockTicket('2'),
        createMockTicket('3')
      ];

      const mockSuggestions: BatchGroupingSuggestion[] = [
        {
          name: 'FIELD changes for Account',
          tickets: ['1', '2'],
          changeType: 'FIELD' as any,
          object: 'Account',
          averageSimilarity: 0.85,
          criteria: {
            changeType: 'FIELD',
            object: 'Account',
            threshold: 0.7
          }
        }
      ];

      vi.spyOn(mockAnalyzer, 'analyzeTicketsForBatching').mockResolvedValue({
        similarityScores: [],
        groupingSuggestions: mockSuggestions,
        totalAnalyzed: 3,
        analysisTime: 100
      });

      const result = await processor.groupTickets(tickets, 'user-1');
      
      expect(result.batches).toHaveLength(1);
      expect(result.batches[0].name).toBe('FIELD changes for Account');
      expect(result.batches[0].tickets).toHaveLength(2);
      expect(result.ungroupedTickets).toHaveLength(1);
      expect(result.ungroupedTickets[0].id).toBe('3');
    });

    it('should split large batches that exceed max size', async () => {
      const tickets = Array.from({ length: 60 }, (_, i) => createMockTicket(String(i + 1)));
      
      const mockSuggestion: BatchGroupingSuggestion = {
        name: 'Large batch',
        tickets: tickets.map(t => t.id),
        changeType: 'FIELD' as any,
        object: 'Account',
        averageSimilarity: 0.85,
        criteria: {
          changeType: 'FIELD',
          object: 'Account',
          threshold: 0.7
        }
      };

      vi.spyOn(mockAnalyzer, 'analyzeTicketsForBatching').mockResolvedValue({
        similarityScores: [],
        groupingSuggestions: [mockSuggestion],
        totalAnalyzed: 60,
        analysisTime: 100
      });

      const result = await processor.groupTickets(tickets, 'user-1');
      
      // Should split into 2 batches (50 + 10)
      expect(result.batches).toHaveLength(2);
      expect(result.batches[0].name).toContain('Part 1');
      expect(result.batches[0].tickets).toHaveLength(50);
      expect(result.batches[1].name).toContain('Part 2');
      expect(result.batches[1].tickets).toHaveLength(10);
    });

    it('should create persisted batches when autoCreateBatches is true', async () => {
      processor = new BatchProcessor(mockRepository, mockAnalyzer, {
        autoCreateBatches: true
      });

      const tickets = [createMockTicket('1'), createMockTicket('2')];
      const mockBatch = createMockBatch('batch-1', ['1', '2']);

      vi.spyOn(mockAnalyzer, 'analyzeTicketsForBatching').mockResolvedValue({
        similarityScores: [],
        groupingSuggestions: [{
          name: 'Test batch',
          tickets: ['1', '2'],
          changeType: 'FIELD' as any,
          object: 'Account',
          averageSimilarity: 0.85,
          criteria: { changeType: 'FIELD', threshold: 0.7 }
        }],
        totalAnalyzed: 2,
        analysisTime: 100
      });

      vi.spyOn(mockRepository, 'createBatch').mockResolvedValue(mockBatch);

      const result = await processor.groupTickets(tickets, 'user-1');
      
      expect(mockRepository.createBatch).toHaveBeenCalled();
      expect(result.batches[0].id).toBe('batch-1');
    });
  });

  describe('validateBatch', () => {
    it('should validate a valid batch', async () => {
      const mockBatch = createMockBatch('batch-1', ['1', '2']);
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);

      const result = await processor.validateBatch('batch-1');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail validation for non-existent batch', async () => {
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(null);

      const result = await processor.validateBatch('non-existent');
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Batch not found');
    });

    it('should fail validation for batch with wrong status', async () => {
      const mockBatch = createMockBatch('batch-1', ['1', '2']);
      mockBatch.status = BatchStatus.COMPLETED;
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);

      const result = await processor.validateBatch('batch-1');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('COMPLETED status');
    });

    it('should fail validation for batch below minimum size', async () => {
      const mockBatch = createMockBatch('batch-1', ['1']);
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);

      const result = await processor.validateBatch('batch-1');
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('minimum is 2');
    });

    it('should warn about batch above maximum size', async () => {
      const ticketIds = Array.from({ length: 55 }, (_, i) => String(i + 1));
      const mockBatch = createMockBatch('batch-1', ticketIds);
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);

      const result = await processor.validateBatch('batch-1');
      
      expect(result.isValid).toBe(true);
      expect(result.warnings[0]).toContain('maximum recommended is 50');
    });
  });

  describe('processBatch', () => {
    it('should process a valid batch successfully', async () => {
      const mockBatch = createMockBatch('batch-1', ['1', '2']);
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);
      vi.spyOn(mockRepository, 'updateBatchStatus').mockResolvedValue(mockBatch);
      vi.spyOn(mockRepository, 'recordProcessingResult').mockResolvedValue({} as any);
      vi.spyOn(mockRepository, 'getBatchResults').mockResolvedValue([
        { batchId: 'batch-1', ticketId: '1', success: true },
        { batchId: 'batch-1', ticketId: '2', success: true }
      ] as any);

      // Mock Math.random to always return success (> 0.1)
      vi.spyOn(Math, 'random').mockReturnValue(0.5);

      await processor.processBatch('batch-1');
      
      expect(mockRepository.updateBatchStatus).toHaveBeenCalledWith('batch-1', BatchStatus.PROCESSING);
      expect(mockRepository.updateBatchStatus).toHaveBeenCalledWith('batch-1', BatchStatus.COMPLETED);
      expect(mockRepository.recordProcessingResult).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failure', async () => {
      const mockBatch = createMockBatch('batch-1', ['1', '2']);
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(mockBatch);
      vi.spyOn(mockRepository, 'updateBatchStatus').mockResolvedValue(mockBatch);
      vi.spyOn(mockRepository, 'recordProcessingResult').mockResolvedValue({} as any);
      vi.spyOn(mockRepository, 'getBatchResults').mockResolvedValue([
        { batchId: 'batch-1', ticketId: '1', success: true },
        { batchId: 'batch-1', ticketId: '2', success: false }
      ] as any);

      // Mock Math.random to fail for one ticket
      let callCount = 0;
      vi.spyOn(Math, 'random').mockImplementation(() => {
        callCount++;
        return callCount === 2 ? 0.05 : 0.5; // Fail second ticket
      });

      await processor.processBatch('batch-1');
      
      expect(mockRepository.updateBatchStatus).toHaveBeenCalledWith('batch-1', BatchStatus.PARTIALLY_COMPLETED);
    });

    it('should throw error for invalid batch', async () => {
      vi.spyOn(mockRepository, 'getBatchById').mockResolvedValue(null);

      await expect(processor.processBatch('invalid')).rejects.toThrow('Batch validation failed');
    });
  });

  describe('getBatchStatistics', () => {
    it('should return batch statistics', async () => {
      const mockStats = {
        batchId: 'batch-1',
        status: BatchStatus.COMPLETED,
        totalTickets: 2,
        processedTickets: 2,
        successfulTickets: 2,
        failedTickets: 0,
        successRate: 100,
        createdAt: new Date(),
        processedAt: new Date(),
        completedAt: new Date()
      };

      vi.spyOn(mockRepository, 'getBatchStatistics').mockResolvedValue(mockStats);

      const stats = await processor.getBatchStatistics('batch-1');
      
      expect(stats).toEqual(mockStats);
      expect(mockRepository.getBatchStatistics).toHaveBeenCalledWith('batch-1');
    });
  });
});