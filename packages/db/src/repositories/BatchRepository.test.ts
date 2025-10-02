import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BatchRepository } from './BatchRepository';
import { PrismaClient, BatchStatus, ApprovalStatus } from '@prisma/client';

// Mock Prisma Client
const mockPrismaClient = {
  ticketBatch: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn()
  },
  batchTicket: {
    createMany: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn()
  },
  batchApproval: {
    create: vi.fn(),
    update: vi.fn()
  },
  batchProcessingResult: {
    upsert: vi.fn(),
    findMany: vi.fn()
  }
} as unknown as PrismaClient;

describe('BatchRepository', () => {
  let repository: BatchRepository;

  beforeEach(() => {
    repository = new BatchRepository(mockPrismaClient);
    vi.clearAllMocks();
  });

  describe('createBatch', () => {
    it('should create a new batch with tickets', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        groupingCriteria: { changeType: 'field', object: 'Account' },
        createdById: 'user-1',
        metadata: { test: true },
        tickets: [],
        createdBy: { id: 'user-1', name: 'Test User' }
      };

      (mockPrismaClient.ticketBatch.create as any).mockResolvedValue(mockBatch);

      const result = await repository.createBatch({
        name: 'Test Batch',
        groupingCriteria: { changeType: 'field', object: 'Account' },
        createdById: 'user-1',
        ticketIds: ['ticket-1', 'ticket-2'],
        metadata: { test: true }
      });

      expect(mockPrismaClient.ticketBatch.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Batch',
          groupingCriteria: { changeType: 'field', object: 'Account' },
          createdById: 'user-1',
          metadata: { test: true },
          tickets: {
            create: [
              { ticketId: 'ticket-1' },
              { ticketId: 'ticket-2' }
            ]
          }
        },
        include: {
          tickets: {
            include: {
              ticket: true
            }
          },
          createdBy: true
        }
      });

      expect(result).toEqual(mockBatch);
    });
  });

  describe('getBatchById', () => {
    it('should retrieve a batch with all relations', async () => {
      const mockBatch = {
        id: 'batch-1',
        name: 'Test Batch',
        status: 'PENDING' as BatchStatus,
        tickets: [
          {
            ticketId: 'ticket-1',
            ticket: { id: 'ticket-1', summary: 'Test Ticket' }
          }
        ],
        createdBy: { id: 'user-1', name: 'Test User' },
        approval: null,
        results: []
      };

      (mockPrismaClient.ticketBatch.findUnique as any).mockResolvedValue(mockBatch);

      const result = await repository.getBatchById('batch-1');

      expect(mockPrismaClient.ticketBatch.findUnique).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        include: {
          tickets: {
            where: { excluded: false },
            include: {
              ticket: {
                include: {
                  analyses: true
                }
              }
            }
          },
          createdBy: true,
          approvedBy: true,
          approval: true,
          results: true
        }
      });

      expect(result).toEqual(mockBatch);
    });
  });

  describe('excludeTicketFromBatch', () => {
    it('should exclude a ticket from a batch', async () => {
      const mockUpdatedTicket = {
        id: 'batch-ticket-1',
        batchId: 'batch-1',
        ticketId: 'ticket-1',
        excluded: true,
        excludedAt: new Date()
      };

      (mockPrismaClient.batchTicket.update as any).mockResolvedValue(mockUpdatedTicket);

      const result = await repository.excludeTicketFromBatch('batch-1', 'ticket-1');

      expect(mockPrismaClient.batchTicket.update).toHaveBeenCalledWith({
        where: {
          batchId_ticketId: {
            batchId: 'batch-1',
            ticketId: 'ticket-1'
          }
        },
        data: {
          excluded: true,
          excludedAt: expect.any(Date)
        }
      });

      expect(result.excluded).toBe(true);
    });
  });

  describe('updateBatchStatus', () => {
    it('should update batch status to PROCESSING with processedAt timestamp', async () => {
      const mockUpdatedBatch = {
        id: 'batch-1',
        status: 'PROCESSING' as BatchStatus,
        processedAt: new Date()
      };

      (mockPrismaClient.ticketBatch.update as any).mockResolvedValue(mockUpdatedBatch);

      const result = await repository.updateBatchStatus('batch-1', 'PROCESSING' as BatchStatus);

      expect(mockPrismaClient.ticketBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          status: 'PROCESSING',
          processedAt: expect.any(Date)
        }
      });

      expect(result.status).toBe('PROCESSING');
    });

    it('should update batch status to COMPLETED with completedAt timestamp', async () => {
      const mockUpdatedBatch = {
        id: 'batch-1',
        status: 'COMPLETED' as BatchStatus,
        completedAt: new Date()
      };

      (mockPrismaClient.ticketBatch.update as any).mockResolvedValue(mockUpdatedBatch);

      const result = await repository.updateBatchStatus('batch-1', 'COMPLETED' as BatchStatus, 'user-2');

      expect(mockPrismaClient.ticketBatch.update).toHaveBeenCalledWith({
        where: { id: 'batch-1' },
        data: {
          status: 'COMPLETED',
          completedAt: expect.any(Date),
          approvedById: 'user-2'
        }
      });

      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('recordProcessingResult', () => {
    it('should upsert a processing result for a ticket', async () => {
      const mockResult = {
        id: 'result-1',
        batchId: 'batch-1',
        ticketId: 'ticket-1',
        success: true,
        metadata: { processed: true }
      };

      (mockPrismaClient.batchProcessingResult.upsert as any).mockResolvedValue(mockResult);

      const result = await repository.recordProcessingResult({
        batchId: 'batch-1',
        ticketId: 'ticket-1',
        success: true,
        metadata: { processed: true }
      });

      expect(mockPrismaClient.batchProcessingResult.upsert).toHaveBeenCalledWith({
        where: {
          batchId_ticketId: {
            batchId: 'batch-1',
            ticketId: 'ticket-1'
          }
        },
        create: {
          batchId: 'batch-1',
          ticketId: 'ticket-1',
          success: true,
          metadata: { processed: true }
        },
        update: {
          batchId: 'batch-1',
          ticketId: 'ticket-1',
          success: true,
          metadata: { processed: true }
        }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getBatchStatistics', () => {
    it('should calculate batch statistics correctly', async () => {
      const mockBatch = {
        id: 'batch-1',
        status: 'COMPLETED' as BatchStatus,
        tickets: [
          { ticketId: 'ticket-1' },
          { ticketId: 'ticket-2' },
          { ticketId: 'ticket-3' }
        ],
        createdAt: new Date('2025-01-01'),
        processedAt: new Date('2025-01-02'),
        completedAt: new Date('2025-01-03')
      };

      const mockResults = [
        { batchId: 'batch-1', ticketId: 'ticket-1', success: true },
        { batchId: 'batch-1', ticketId: 'ticket-2', success: true },
        { batchId: 'batch-1', ticketId: 'ticket-3', success: false }
      ];

      (repository.getBatchById as any) = vi.fn().mockResolvedValue(mockBatch);
      (repository.getBatchResults as any) = vi.fn().mockResolvedValue(mockResults);

      const stats = await repository.getBatchStatistics('batch-1');

      expect(stats).toEqual({
        batchId: 'batch-1',
        status: 'COMPLETED',
        totalTickets: 3,
        processedTickets: 3,
        successfulTickets: 2,
        failedTickets: 1,
        successRate: 66.66666666666666,
        createdAt: mockBatch.createdAt,
        processedAt: mockBatch.processedAt,
        completedAt: mockBatch.completedAt
      });
    });

    it('should return null for non-existent batch', async () => {
      (repository.getBatchById as any) = vi.fn().mockResolvedValue(null);

      const stats = await repository.getBatchStatistics('non-existent');

      expect(stats).toBeNull();
    });
  });
});