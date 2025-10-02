import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { approvalRouter } from './approval';
import { ApprovalService } from '@agentris/services';
import { TRPCError } from '@trpc/server';

vi.mock('@agentris/services', () => ({
  ApprovalService: vi.fn().mockImplementation(() => ({
    approveChanges: vi.fn(),
    rejectChanges: vi.fn(),
    modifyAndApprove: vi.fn(),
    bulkApprove: vi.fn(),
    getApprovalHistory: vi.fn(),
    getApprovalById: vi.fn(),
    getApprovalsByPreview: vi.fn(),
    getPendingApprovals: vi.fn(),
    applyModifiedItems: vi.fn(),
  })),
}));

vi.mock('@agentris/db', () => ({
  prisma: {
    preview: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    previewItem: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    approval: {
      findUnique: vi.fn(),
    },
  },
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    MODIFIED: 'MODIFIED',
  },
  ApprovalItemStatus: {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    MODIFIED: 'MODIFIED',
  },
  ApprovalRepository: vi.fn(),
  ApprovalItemRepository: vi.fn(),
}));

describe('approvalRouter', () => {
  let ctx: any;
  let caller: any;
  let mockService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    ctx = createInnerTRPCContext({
      session: {
        user: {
          id: 'user-1',
          email: 'test@example.com',
          role: 'CONSULTANT',
        },
        expires: new Date(Date.now() + 86400000).toISOString(),
      },
    });

    caller = approvalRouter.createCaller(ctx);
    mockService = new ApprovalService({} as any);
  });

  describe('getApprovalQueue', () => {
    it('should return pending approval items', async () => {
      const mockPreviews = [
        {
          id: 'preview-1',
          status: 'READY',
          expiresAt: new Date(Date.now() + 3600000),
          ticket: { id: 'ticket-1', summary: 'Test Ticket' },
          items: [
            { id: 'item-1', name: 'Field 1', impact: 'LOW' },
            { id: 'item-2', name: 'Field 2', impact: 'HIGH' },
          ],
          approvals: [],
        },
      ];

      const { prisma } = require('@agentris/db');
      prisma.preview.findMany.mockResolvedValue(mockPreviews);

      const result = await caller.getApprovalQueue();

      expect(result).toEqual({
        previews: mockPreviews,
        items: mockPreviews[0].items,
        totalPending: 2,
      });
    });

    it('should filter out already approved items', async () => {
      const mockPreviews = [
        {
          id: 'preview-1',
          status: 'READY',
          expiresAt: new Date(Date.now() + 3600000),
          ticket: { id: 'ticket-1', summary: 'Test Ticket' },
          items: [
            { id: 'item-1', name: 'Field 1', impact: 'LOW' },
            { id: 'item-2', name: 'Field 2', impact: 'HIGH' },
          ],
          approvals: [
            {
              id: 'approval-1',
              items: [
                { previewItemId: 'item-1' },
              ],
            },
          ],
        },
      ];

      const { prisma } = require('@agentris/db');
      prisma.preview.findMany.mockResolvedValue(mockPreviews);

      const result = await caller.getApprovalQueue();

      expect(result.items).toEqual([
        { id: 'item-2', name: 'Field 2', impact: 'HIGH' },
      ]);
      expect(result.totalPending).toBe(1);
    });
  });

  describe('approveItems', () => {
    it('should approve selected items', async () => {
      const mockPreview = {
        id: 'preview-1',
        ticket: {
          id: 'ticket-1',
          assigneeId: 'user-1',
        },
      };
      
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: 'APPROVED',
        items: [],
      };

      const { prisma } = require('@agentris/db');
      prisma.preview.findUnique.mockResolvedValue(mockPreview);
      mockService.approveChanges.mockResolvedValue(mockApproval);

      const result = await caller.approveItems({
        previewId: 'preview-1',
        itemIds: ['item-1', 'item-2'],
        comments: 'Looks good',
      });

      expect(mockService.approveChanges).toHaveBeenCalledWith({
        previewId: 'preview-1',
        userId: 'user-1',
        itemIds: ['item-1', 'item-2'],
        comments: 'Looks good',
      });
      expect(result).toEqual(mockApproval);
    });
  });

  describe('rejectItems', () => {
    it('should reject selected items with reason', async () => {
      const mockPreview = {
        id: 'preview-1',
        ticket: {
          id: 'ticket-1',
          assigneeId: 'user-1',
        },
      };
      
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: 'REJECTED',
        items: [],
      };

      const { prisma } = require('@agentris/db');
      prisma.preview.findUnique.mockResolvedValue(mockPreview);
      mockService.rejectChanges.mockResolvedValue(mockApproval);

      const result = await caller.rejectItems({
        previewId: 'preview-1',
        itemIds: ['item-1'],
        reason: 'Not compliant',
      });

      expect(mockService.rejectChanges).toHaveBeenCalledWith({
        previewId: 'preview-1',
        userId: 'user-1',
        itemIds: ['item-1'],
        reason: 'Not compliant',
      });
      expect(result).toEqual(mockApproval);
    });
  });

  describe('modifyItem', () => {
    it('should modify an item', async () => {
      const mockPreviewItem = {
        id: 'item-1',
        previewId: 'preview-1',
        name: 'Test Field',
        itemType: 'FIELD',
        preview: { 
          id: 'preview-1',
          ticket: {
            id: 'ticket-1',
            assigneeId: 'user-1',
          },
        },
      };

      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: 'MODIFIED',
        items: [],
      };

      const { prisma } = require('@agentris/db');
      prisma.previewItem.findUnique.mockResolvedValue(mockPreviewItem);
      mockService.modifyAndApprove.mockResolvedValue(mockApproval);

      const result = await caller.modifyItem({
        itemId: 'item-1',
        modifiedData: { type: 'Text', label: 'Updated Field' },
        reason: 'Correction needed',
      });

      expect(mockService.modifyAndApprove).toHaveBeenCalledWith({
        previewId: 'preview-1',
        userId: 'user-1',
        modifications: [{
          itemId: 'item-1',
          modifiedData: { type: 'Text', label: 'Updated Field' },
          reason: 'Correction needed',
        }],
        comments: 'Modified Test Field',
      });
      expect(result).toEqual(mockApproval);
    });

    it('should throw error if preview item not found', async () => {
      const { prisma } = require('@agentris/db');
      prisma.previewItem.findUnique.mockResolvedValue(null);

      await expect(
        caller.modifyItem({
          itemId: 'non-existent',
          modifiedData: { type: 'Text' },
        })
      ).rejects.toThrow('Preview item not found');
    });
  });

  describe('bulkApprove', () => {
    it('should bulk approve items by pattern', async () => {
      const mockPreview = {
        id: 'preview-1',
        ticket: {
          id: 'ticket-1',
          assigneeId: 'user-1',
        },
        items: [
          { id: 'item-1', itemType: 'FIELD', impact: 'LOW' },
          { id: 'item-2', itemType: 'FIELD', impact: 'HIGH' },
        ],
      };
      
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: 'APPROVED',
        items: [
          { id: 'item-1' },
          { id: 'item-2' },
        ],
      };

      const { prisma } = require('@agentris/db');
      prisma.preview.findUnique.mockResolvedValue(mockPreview);
      mockService.bulkApprove.mockResolvedValue(mockApproval);

      const result = await caller.bulkApprove({
        previewId: 'preview-1',
        pattern: { itemType: 'FIELD' },
        comments: 'Bulk approved fields',
      });

      expect(mockService.bulkApprove).toHaveBeenCalledWith({
        previewId: 'preview-1',
        userId: 'user-1',
        pattern: { itemType: 'FIELD' },
        comments: 'Bulk approved fields',
      });
      expect(result.itemCount).toBe(2);
    });
  });

  describe('getApprovalHistory', () => {
    it('should return paginated approval history', async () => {
      const mockHistory = {
        approvals: [
          { id: 'approval-1', status: 'APPROVED' },
          { id: 'approval-2', status: 'REJECTED' },
        ],
        total: 15,
        page: 1,
        pageSize: 10,
        totalPages: 2,
      };

      mockService.getApprovalHistory.mockResolvedValue(mockHistory);

      const result = await caller.getApprovalHistory({
        page: 1,
        pageSize: 10,
      });

      expect(mockService.getApprovalHistory).toHaveBeenCalledWith({
        filters: {
          userId: 'user-1',
        },
        pagination: {
          page: 1,
          pageSize: 10,
        },
      });
      expect(result).toEqual(mockHistory);
    });
  });

  describe('applyModifiedItems', () => {
    it('should apply modified items', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'MODIFIED',
      };

      mockService.getApprovalById.mockResolvedValue(mockApproval);
      mockService.applyModifiedItems.mockResolvedValue(undefined);

      const result = await caller.applyModifiedItems({
        approvalId: 'approval-1',
      });

      expect(mockService.applyModifiedItems).toHaveBeenCalledWith('approval-1');
      expect(result).toEqual({ success: true });
    });

    it('should throw error if approval not found', async () => {
      mockService.getApprovalById.mockResolvedValue(null);

      await expect(
        caller.applyModifiedItems({
          approvalId: 'non-existent',
        })
      ).rejects.toThrow('Approval not found');
    });

    it('should throw error if approval not modified', async () => {
      const mockApproval = {
        id: 'approval-1',
        status: 'APPROVED',
      };

      mockService.getApprovalById.mockResolvedValue(mockApproval);

      await expect(
        caller.applyModifiedItems({
          approvalId: 'approval-1',
        })
      ).rejects.toThrow('Only modified approvals can be applied');
    });
  });
});