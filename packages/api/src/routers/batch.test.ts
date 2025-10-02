import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TRPCError } from '@trpc/server';

// Hoisted mocks
vi.mock('@agentris/db', () => {
  const mockBatchRepo = {
    getBatchById: vi.fn(),
    createBatch: vi.fn(),
    addTicketToBatch: vi.fn(),
    updateBatchStatus: vi.fn(),
    listBatches: vi.fn(),
    countBatches: vi.fn()
  };
  
  const mockTicketRepo = {
    getTicketsByIds: vi.fn()
  };

  return {
    prisma: {},
    BatchRepository: vi.fn(() => mockBatchRepo),
    TicketRepository: vi.fn(() => mockTicketRepo),
    BatchStatus: {
      PENDING: 'PENDING',
      APPROVED: 'APPROVED',
      PROCESSING: 'PROCESSING',
      COMPLETED: 'COMPLETED',
      PARTIALLY_COMPLETED: 'PARTIALLY_COMPLETED',
      FAILED: 'FAILED'
    }
  };
});

vi.mock('@agentris/ai-engine', () => ({
  BatchAnalyzer: vi.fn().mockImplementation(() => ({
    analyzeTicketsForBatching: vi.fn().mockResolvedValue({
      groups: [
        {
          groupId: 'group-1',
          tickets: ['ticket-1', 'ticket-2'],
          commonPattern: 'field_update',
          confidence: 0.85
        }
      ],
      similarityScores: [[1, 0.8], [0.8, 1]],
      recommendations: ['Group similar field updates together']
    })
  })),
  BatchPreviewGenerator: vi.fn().mockImplementation(() => ({
    generateBatchPreview: vi.fn().mockResolvedValue({
      format: 'TABLE',
      content: '| Ticket | Change Type | Object |\n|--------|-------------|--------|',
      summary: { totalChanges: 2, affectedObjects: ['Account'] },
      risks: [],
      generatedAt: new Date()
    })
  })),
  PreviewFormat: {
    TABLE: 'TABLE',
    TEXT: 'TEXT',
    DIAGRAM: 'DIAGRAM'
  },
  BatchGroupingStrategy: {
    SIMILAR_CHANGES: 'SIMILAR_CHANGES',
    SAME_OBJECT: 'SAME_OBJECT',
    CUSTOM: 'CUSTOM'
  }
}));

vi.mock('@agentris/services', () => ({
  BatchProcessor: vi.fn().mockImplementation(() => ({
    groupTickets: vi.fn().mockResolvedValue({
      success: true,
      groups: [{ groupId: 'group-1', ticketIds: ['ticket-1', 'ticket-2'] }]
    }),
    excludeTicketFromBatch: vi.fn().mockResolvedValue(undefined),
    includeTicketInBatch: vi.fn().mockResolvedValue(undefined),
    processBatch: vi.fn().mockResolvedValue(undefined)
  })),
  JiraBatchSyncService: vi.fn().mockImplementation(() => ({
    syncBatchWithJira: vi.fn().mockResolvedValue({
      batchId: 'batch-1',
      syncedTickets: 2,
      failedTickets: 0,
      errors: []
    }),
    getBatchSyncStatus: vi.fn().mockResolvedValue({
      batchId: 'batch-1',
      totalTickets: 2,
      activeTickets: 2,
      processedTickets: 0
    }),
    handleBatchRollback: vi.fn().mockResolvedValue({
      batchId: 'batch-1',
      syncedTickets: 2,
      failedTickets: 0,
      errors: []
    })
  })),
  BatchApprovalService: vi.fn().mockImplementation(() => ({
    approveBatch: vi.fn().mockResolvedValue({
      id: 'approval-1',
      batchId: 'batch-1',
      approvedById: 'user-1',
      createdAt: new Date()
    }),
    modifyAndApprove: vi.fn().mockResolvedValue({
      id: 'approval-1',
      batchId: 'batch-1',
      approvedById: 'user-1',
      createdAt: new Date()
    }),
    rejectBatch: vi.fn().mockResolvedValue({
      id: 'approval-1',
      batchId: 'batch-1',
      rejectedById: 'user-1',
      createdAt: new Date()
    }),
    getBatchApprovalStatus: vi.fn().mockResolvedValue({
      isApproved: false,
      isPending: true,
      approvals: []
    })
  }))
}));

// Import router after mocks
import { batchRouter } from './batch';
import { BatchRepository, TicketRepository, BatchStatus } from '@agentris/db';

describe('batchRouter', () => {
  let mockBatchRepository: any;
  let mockTicketRepository: any;

  const mockCtx = {
    session: {
      user: {
        id: 'user-1',
        email: 'test@example.com'
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Get mock instances
    mockBatchRepository = new (BatchRepository as any)();
    mockTicketRepository = new (TicketRepository as any)();
  });

  describe('analyzeSimilarity', () => {
    it('should analyze ticket similarity successfully', async () => {
      const mockTickets = [
        { id: 'ticket-1', jiraKey: 'TEST-1', title: 'Update Account field' },
        { id: 'ticket-2', jiraKey: 'TEST-2', title: 'Update Account status' }
      ];

      mockTicketRepository.getTicketsByIds.mockResolvedValue(mockTickets);

      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.analyzeSimilarity({
        ticketIds: ['ticket-1', 'ticket-2'],
        threshold: 0.7
      });

      expect(result.success).toBe(true);
      expect(result.data.groups).toHaveLength(1);
      expect(result.data.totalTickets).toBe(2);
    });

    it('should throw error for insufficient tickets', async () => {
      mockTicketRepository.getTicketsByIds.mockResolvedValue([
        { id: 'ticket-1', jiraKey: 'TEST-1' }
      ]);

      const caller = batchRouter.createCaller(mockCtx);
      
      await expect(
        caller.analyzeSimilarity({
          ticketIds: ['ticket-1'],
          threshold: 0.7
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('createBatch', () => {
    it('should create a batch successfully', async () => {
      const mockTickets = [
        { id: 'ticket-1', jiraKey: 'TEST-1' },
        { id: 'ticket-2', jiraKey: 'TEST-2' }
      ];

      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        status: BatchStatus.PENDING,
        createdAt: new Date()
      };

      mockTicketRepository.getTicketsByIds.mockResolvedValue(mockTickets);
      mockBatchRepository.createBatch.mockResolvedValue(mockBatch);
      mockBatchRepository.addTicketToBatch.mockResolvedValue(undefined);

      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.createBatch({
        name: 'Test Batch',
        ticketIds: ['ticket-1', 'ticket-2'],
        groupingStrategy: 'SIMILAR_CHANGES'
      });

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBe('batch-1');
      expect(result.data.name).toBe('Test Batch');
      expect(result.data.ticketCount).toBe(2);
    });

    it('should throw error for no valid tickets', async () => {
      mockTicketRepository.getTicketsByIds.mockResolvedValue([]);

      const caller = batchRouter.createCaller(mockCtx);
      
      await expect(
        caller.createBatch({
          name: 'Test Batch',
          ticketIds: ['invalid-ticket']
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('generateBatchPreview', () => {
    it('should generate batch preview successfully', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        tickets: [
          {
            excluded: false,
            ticket: { id: 'ticket-1', jiraKey: 'TEST-1' }
          },
          {
            excluded: false,
            ticket: { id: 'ticket-2', jiraKey: 'TEST-2' }
          }
        ]
      };

      mockBatchRepository.getBatchById.mockResolvedValue(mockBatch);

      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.generateBatchPreview({
        batchId: 'batch-1',
        format: 'TABLE',
        includeDetails: true
      });

      expect(result.success).toBe(true);
      expect(result.data.format).toBe('TABLE');
      expect(result.data.content).toContain('Ticket');
    });

    it('should throw error for batch not found', async () => {
      mockBatchRepository.getBatchById.mockResolvedValue(null);

      const caller = batchRouter.createCaller(mockCtx);
      
      await expect(
        caller.generateBatchPreview({
          batchId: 'invalid-batch'
        })
      ).rejects.toThrow(TRPCError);
    });
  });

  describe('approveBatch', () => {
    it('should approve batch successfully', async () => {
      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.approveBatch({
        batchId: 'batch-1',
        comments: 'Approved for processing'
      });

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBe('batch-1');
      expect(result.data.status).toBe('PROCESSING');
    });

    it('should approve with modifications', async () => {
      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.approveBatch({
        batchId: 'batch-1',
        comments: 'Approved with exclusions',
        modifications: {
          excludedTickets: ['ticket-3']
        }
      });

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBe('batch-1');
    });
  });

  describe('getBatchStatus', () => {
    it('should get batch status successfully', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        status: BatchStatus.PENDING,
        createdAt: new Date(),
        updatedAt: new Date(),
        tickets: [
          { excluded: false },
          { excluded: true }
        ]
      };

      mockBatchRepository.getBatchById.mockResolvedValue(mockBatch);

      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.getBatchStatus({
        batchId: 'batch-1'
      });

      expect(result.success).toBe(true);
      expect(result.data.batch.id).toBe('batch-1');
      expect(result.data.tickets.total).toBe(2);
      expect(result.data.tickets.active).toBe(1);
      expect(result.data.tickets.excluded).toBe(1);
    });
  });

  describe('listBatches', () => {
    it('should list batches successfully', async () => {
      const mockBatches = [
        {
          id: 'batch-1',
          name: 'Batch 1',
          status: BatchStatus.PENDING,
          createdAt: new Date(),
          tickets: [{}, {}]
        },
        {
          id: 'batch-2',
          name: 'Batch 2',
          status: BatchStatus.COMPLETED,
          createdAt: new Date(),
          tickets: [{}]
        }
      ];

      mockBatchRepository.listBatches.mockResolvedValue(mockBatches);
      mockBatchRepository.countBatches.mockResolvedValue(2);

      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.listBatches({
        limit: 10,
        offset: 0
      });

      expect(result.success).toBe(true);
      expect(result.data.batches).toHaveLength(2);
      expect(result.data.total).toBe(2);
    });
  });

  describe('rollbackBatch', () => {
    it('should rollback batch successfully', async () => {
      const caller = batchRouter.createCaller(mockCtx);
      const result = await caller.rollbackBatch({
        batchId: 'batch-1',
        reason: 'Failed validation'
      });

      expect(result.success).toBe(true);
      expect(result.data.batchId).toBe('batch-1');
      expect(result.data.rollbackReason).toBe('Failed validation');
      expect(mockBatchRepository.updateBatchStatus).toHaveBeenCalledWith(
        'batch-1',
        BatchStatus.FAILED
      );
    });
  });
});