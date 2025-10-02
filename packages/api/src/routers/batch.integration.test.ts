import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { prisma } from '@agentris/db';
import { batchRouter } from './batch';
import { BatchAnalyzer, BatchPreviewGenerator } from '@agentris/ai-engine';
import { BatchProcessor, JiraBatchSyncService, BatchApprovalService } from '@agentris/services';

describe('Batch Processing Integration Tests', () => {
  let testUserId: string;
  let testTicketIds: string[];
  let testBatchId: string;

  beforeEach(async () => {
    // Create test user
    const user = await prisma.user.create({
      data: {
        email: 'test-batch@example.com',
        name: 'Test User',
      },
    });
    testUserId = user.id;

    // Create test tickets
    const tickets = await Promise.all([
      prisma.ticket.create({
        data: {
          jiraKey: 'TEST-1001',
          title: 'Update Account validation rules',
          description: 'Add new validation for Account fields',
          status: 'OPEN',
          priority: 'MEDIUM',
          createdById: testUserId,
        },
      }),
      prisma.ticket.create({
        data: {
          jiraKey: 'TEST-1002',
          title: 'Update Account status field',
          description: 'Modify Account status picklist values',
          status: 'OPEN',
          priority: 'MEDIUM',
          createdById: testUserId,
        },
      }),
      prisma.ticket.create({
        data: {
          jiraKey: 'TEST-1003',
          title: 'Add Contact email validation',
          description: 'Implement email format validation for Contact',
          status: 'OPEN',
          priority: 'HIGH',
          createdById: testUserId,
        },
      }),
    ]);

    testTicketIds = tickets.map(t => t.id);
  });

  afterEach(async () => {
    // Clean up test data
    if (testBatchId) {
      await prisma.batchProcessingResult.deleteMany({
        where: { batchId: testBatchId },
      });
      await prisma.batchApproval.deleteMany({
        where: { batchId: testBatchId },
      });
      await prisma.batchTicket.deleteMany({
        where: { batchId: testBatchId },
      });
      await prisma.ticketBatch.delete({
        where: { id: testBatchId },
      });
    }

    await prisma.ticket.deleteMany({
      where: { id: { in: testTicketIds } },
    });

    await prisma.user.delete({
      where: { id: testUserId },
    });
  });

  describe('End-to-end batch processing workflow', () => {
    it('should complete full batch processing cycle', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      // Step 1: Analyze similarity
      const analysisResult = await caller.analyzeSimilarity({
        ticketIds: testTicketIds.slice(0, 2), // Use first two tickets
        threshold: 0.6,
      });

      expect(analysisResult.success).toBe(true);
      expect(analysisResult.data.totalTickets).toBe(2);
      expect(analysisResult.data.groups).toBeDefined();

      // Step 2: Create batch
      const createResult = await caller.createBatch({
        name: 'Account Updates Batch',
        ticketIds: testTicketIds.slice(0, 2),
        groupingStrategy: 'SIMILAR_CHANGES',
      });

      expect(createResult.success).toBe(true);
      expect(createResult.data.batchId).toBeDefined();
      testBatchId = createResult.data.batchId;

      // Step 3: Generate preview
      const previewResult = await caller.generateBatchPreview({
        batchId: testBatchId,
        format: 'TABLE',
        includeDetails: true,
        includeRisks: true,
      });

      expect(previewResult.success).toBe(true);
      expect(previewResult.data.content).toBeDefined();
      expect(previewResult.data.format).toBe('TABLE');

      // Step 4: Exclude a ticket
      const excludeResult = await caller.excludeFromBatch({
        batchId: testBatchId,
        ticketId: testTicketIds[1],
        reason: 'Needs separate handling',
      });

      expect(excludeResult.success).toBe(true);
      expect(excludeResult.data.remainingTickets).toBe(1);

      // Step 5: Include ticket back
      const includeResult = await caller.includeInBatch({
        batchId: testBatchId,
        ticketId: testTicketIds[1],
      });

      expect(includeResult.success).toBe(true);
      expect(includeResult.data.activeTickets).toBe(2);

      // Step 6: Get batch status
      const statusResult = await caller.getBatchStatus({
        batchId: testBatchId,
      });

      expect(statusResult.success).toBe(true);
      expect(statusResult.data.batch.id).toBe(testBatchId);
      expect(statusResult.data.tickets.total).toBe(2);
      expect(statusResult.data.tickets.active).toBe(2);

      // Step 7: Approve batch
      const approvalResult = await caller.approveBatch({
        batchId: testBatchId,
        comments: 'Approved for testing',
      });

      expect(approvalResult.success).toBe(true);
      expect(approvalResult.data.status).toBe('PROCESSING');

      // Step 8: List batches
      const listResult = await caller.listBatches({
        status: 'PROCESSING',
        limit: 10,
        offset: 0,
      });

      expect(listResult.success).toBe(true);
      expect(listResult.data.batches.length).toBeGreaterThan(0);
      expect(listResult.data.batches.some(b => b.id === testBatchId)).toBe(true);
    });

    it('should handle batch rejection flow', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      // Create batch
      const createResult = await caller.createBatch({
        name: 'Rejection Test Batch',
        ticketIds: [testTicketIds[0]],
      });

      testBatchId = createResult.data.batchId;

      // Reject batch
      const rejectResult = await caller.rejectBatch({
        batchId: testBatchId,
        reason: 'Requirements not clear',
      });

      expect(rejectResult.success).toBe(true);
      expect(rejectResult.data.reason).toBe('Requirements not clear');

      // Verify status is updated
      const statusResult = await caller.getBatchStatus({
        batchId: testBatchId,
      });

      expect(statusResult.data.batch.status).toBe('FAILED');
    });

    it('should handle batch with modifications during approval', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      // Create batch with all tickets
      const createResult = await caller.createBatch({
        name: 'Modification Test Batch',
        ticketIds: testTicketIds,
      });

      testBatchId = createResult.data.batchId;

      // Approve with modifications
      const approvalResult = await caller.approveBatch({
        batchId: testBatchId,
        comments: 'Approved with exclusions',
        modifications: {
          excludedTickets: [testTicketIds[2]], // Exclude third ticket
          metadata: { modifiedBy: 'approver' },
        },
      });

      expect(approvalResult.success).toBe(true);

      // Verify the modifications were applied
      const statusResult = await caller.getBatchStatus({
        batchId: testBatchId,
      });

      expect(statusResult.data.tickets.active).toBe(2);
      expect(statusResult.data.tickets.excluded).toBe(1);
    });
  });

  describe('Performance tests', () => {
    it('should handle large batch efficiently', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      // Create many tickets
      const largeTicketSet = await Promise.all(
        Array.from({ length: 20 }, (_, i) => 
          prisma.ticket.create({
            data: {
              jiraKey: `PERF-${1000 + i}`,
              title: `Performance test ticket ${i}`,
              description: `Description for ticket ${i}`,
              status: 'OPEN',
              priority: 'MEDIUM',
              createdById: testUserId,
            },
          })
        )
      );

      const largeTicketIds = largeTicketSet.map(t => t.id);

      const caller = batchRouter.createCaller(ctx);

      const startTime = Date.now();

      // Analyze similarity for large set
      const analysisResult = await caller.analyzeSimilarity({
        ticketIds: largeTicketIds,
        threshold: 0.5,
      });

      const analysisTime = Date.now() - startTime;

      expect(analysisResult.success).toBe(true);
      expect(analysisTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Create batch
      const createResult = await caller.createBatch({
        name: 'Large Batch Performance Test',
        ticketIds: largeTicketIds,
      });

      testBatchId = createResult.data.batchId;

      const previewStartTime = Date.now();

      // Generate preview
      const previewResult = await caller.generateBatchPreview({
        batchId: testBatchId,
        format: 'TABLE',
      });

      const previewTime = Date.now() - previewStartTime;

      expect(previewResult.success).toBe(true);
      expect(previewTime).toBeLessThan(3000); // Should complete within 3 seconds

      // Clean up
      await prisma.ticket.deleteMany({
        where: { id: { in: largeTicketIds } },
      });
    });
  });

  describe('Error handling', () => {
    it('should handle invalid batch ID gracefully', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      await expect(
        caller.getBatchStatus({
          batchId: 'invalid-batch-id',
        })
      ).rejects.toThrow('NOT_FOUND');
    });

    it('should prevent creating batch with no tickets', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      await expect(
        caller.createBatch({
          name: 'Empty Batch',
          ticketIds: [],
        })
      ).rejects.toThrow();
    });

    it('should handle concurrent modifications safely', async () => {
      const ctx = {
        session: {
          user: { id: testUserId, email: 'test-batch@example.com' },
        },
      };

      const caller = batchRouter.createCaller(ctx);

      // Create batch
      const createResult = await caller.createBatch({
        name: 'Concurrent Test Batch',
        ticketIds: testTicketIds,
      });

      testBatchId = createResult.data.batchId;

      // Attempt concurrent exclusions
      const exclusions = testTicketIds.map(ticketId => 
        caller.excludeFromBatch({
          batchId: testBatchId,
          ticketId,
          reason: 'Concurrent exclusion',
        })
      );

      const results = await Promise.allSettled(exclusions);
      const successCount = results.filter(r => r.status === 'fulfilled').length;

      expect(successCount).toBeGreaterThan(0);
    });
  });
});