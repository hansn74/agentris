import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, ApprovalStatus, ApprovalItemStatus } from '@agentris/db';
import { ApprovalService } from './approval';

vi.mock('@agentris/db', () => ({
  PrismaClient: vi.fn(),
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
  ApprovalRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn(),
    findById: vi.fn(),
    findByPreviewId: vi.fn(),
    findByUserId: vi.fn(),
    findPending: vi.fn(),
    updateStatus: vi.fn(),
    getApprovalHistory: vi.fn(),
  })),
  ApprovalItemRepository: vi.fn().mockImplementation(() => ({
    createMany: vi.fn(),
    findModifiedItems: vi.fn(),
  })),
}));

describe('ApprovalService', () => {
  let prisma: any;
  let service: ApprovalService;

  beforeEach(() => {
    prisma = {
      preview: {
        findUnique: vi.fn(),
      },
      previewItem: {
        update: vi.fn(),
        findMany: vi.fn(),
      },
    };
    service = new ApprovalService(prisma as PrismaClient);
  });

  describe('approveChanges', () => {
    it('should approve selected changes', async () => {
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.APPROVED,
        comments: 'Looks good',
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.APPROVED,
            previewItem: { id: 'preview-item-1', name: 'Field1' },
          },
        ],
        preview: {
          id: 'preview-1',
          items: [],
        },
        user: {
          id: 'user-1',
          email: 'test@example.com',
        },
      };

      const approvalRepo = (service as any).approvalRepository;
      const approvalItemRepo = (service as any).approvalItemRepository;

      approvalRepo.create.mockResolvedValue({ id: 'approval-1' });
      approvalRepo.findById.mockResolvedValue(mockApproval);
      approvalItemRepo.createMany.mockResolvedValue({ count: 1 });

      const result = await service.approveChanges({
        previewId: 'preview-1',
        userId: 'user-1',
        itemIds: ['preview-item-1'],
        comments: 'Looks good',
      });

      expect(approvalRepo.create).toHaveBeenCalledWith({
        preview: { connect: { id: 'preview-1' } },
        user: { connect: { id: 'user-1' } },
        status: ApprovalStatus.APPROVED,
        comments: 'Looks good',
      });

      expect(approvalItemRepo.createMany).toHaveBeenCalledWith([
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-1',
          status: ApprovalItemStatus.APPROVED,
        },
      ]);

      expect(result).toEqual(mockApproval);
    });
  });

  describe('rejectChanges', () => {
    it('should reject changes with reason', async () => {
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.REJECTED,
        comments: 'Not compliant',
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.REJECTED,
            reason: 'Not compliant',
            previewItem: { id: 'preview-item-1', name: 'Field1' },
          },
        ],
        preview: {
          id: 'preview-1',
          items: [],
        },
        user: {
          id: 'user-1',
          email: 'test@example.com',
        },
      };

      const approvalRepo = (service as any).approvalRepository;
      const approvalItemRepo = (service as any).approvalItemRepository;

      approvalRepo.create.mockResolvedValue({ id: 'approval-1' });
      approvalRepo.findById.mockResolvedValue(mockApproval);
      approvalItemRepo.createMany.mockResolvedValue({ count: 1 });

      const result = await service.rejectChanges({
        previewId: 'preview-1',
        userId: 'user-1',
        itemIds: ['preview-item-1'],
        reason: 'Not compliant',
      });

      expect(approvalRepo.create).toHaveBeenCalledWith({
        preview: { connect: { id: 'preview-1' } },
        user: { connect: { id: 'user-1' } },
        status: ApprovalStatus.REJECTED,
        comments: 'Not compliant',
      });

      expect(approvalItemRepo.createMany).toHaveBeenCalledWith([
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-1',
          status: ApprovalItemStatus.REJECTED,
          reason: 'Not compliant',
        },
      ]);

      expect(result).toEqual(mockApproval);
    });
  });

  describe('modifyAndApprove', () => {
    it('should modify and approve changes', async () => {
      const mockPreviewItems = [
        {
          id: 'preview-item-1',
          previewId: 'preview-1',
          itemType: 'FIELD',
          name: 'Field1',
        },
      ];
      
      // Mock previewItem.findMany for validation
      prisma.previewItem = {
        ...prisma.previewItem,
        findMany: vi.fn().mockResolvedValue(mockPreviewItems),
      };
      
      const service = new ApprovalService(prisma);
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.MODIFIED,
        comments: 'Modified fields',
        items: [
          {
            id: 'item-1',
            status: ApprovalItemStatus.MODIFIED,
            modifiedData: { type: 'Text', label: 'UpdatedValue' },
            reason: 'Corrected value',
            previewItem: { id: 'preview-item-1', name: 'Field1' },
          },
        ],
        preview: {
          id: 'preview-1',
          items: [],
        },
        user: {
          id: 'user-1',
          email: 'test@example.com',
        },
      };

      const approvalRepo = (service as any).approvalRepository;
      const approvalItemRepo = (service as any).approvalItemRepository;

      approvalRepo.create.mockResolvedValue({ id: 'approval-1' });
      approvalRepo.findById.mockResolvedValue(mockApproval);
      approvalItemRepo.createMany.mockResolvedValue({ count: 1 });

      const result = await service.modifyAndApprove({
        previewId: 'preview-1',
        userId: 'user-1',
        modifications: [
          {
            itemId: 'preview-item-1',
            modifiedData: { type: 'Text', label: 'UpdatedValue' },
            reason: 'Corrected value',
          },
        ],
        comments: 'Modified fields',
      });

      expect(approvalRepo.create).toHaveBeenCalledWith({
        preview: { connect: { id: 'preview-1' } },
        user: { connect: { id: 'user-1' } },
        status: ApprovalStatus.MODIFIED,
        comments: 'Modified fields',
      });

      expect(approvalItemRepo.createMany).toHaveBeenCalledWith([
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-1',
          status: ApprovalItemStatus.MODIFIED,
          modifiedData: { type: 'Text', label: 'UpdatedValue' },
          reason: 'Corrected value',
        },
      ]);

      expect(result).toEqual(mockApproval);
    });
  });

  describe('bulkApprove', () => {
    it('should bulk approve items matching pattern', async () => {
      const mockPreview = {
        id: 'preview-1',
        items: [
          { id: 'item-1', itemType: 'FIELD', impact: 'LOW' },
          { id: 'item-2', itemType: 'FIELD', impact: 'HIGH' },
          { id: 'item-3', itemType: 'VALIDATION_RULE', impact: 'LOW' },
        ],
      };

      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.APPROVED,
        comments: 'Bulk approved 2 items',
        items: [],
        preview: mockPreview,
        user: { id: 'user-1', email: 'test@example.com' },
      };

      prisma.preview.findUnique.mockResolvedValue(mockPreview);

      const approvalRepo = (service as any).approvalRepository;
      const approvalItemRepo = (service as any).approvalItemRepository;

      approvalRepo.create.mockResolvedValue({ id: 'approval-1' });
      approvalRepo.findById.mockResolvedValue(mockApproval);
      approvalItemRepo.createMany.mockResolvedValue({ count: 2 });

      const result = await service.bulkApprove({
        previewId: 'preview-1',
        userId: 'user-1',
        pattern: {
          itemType: 'FIELD',
        },
      });

      expect(approvalItemRepo.createMany).toHaveBeenCalledWith([
        {
          approvalId: 'approval-1',
          previewItemId: 'item-1',
          status: ApprovalItemStatus.APPROVED,
        },
        {
          approvalId: 'approval-1',
          previewItemId: 'item-2',
          status: ApprovalItemStatus.APPROVED,
        },
      ]);

      expect(result).toEqual(mockApproval);
    });

    it('should throw error if no items match pattern', async () => {
      const mockPreview = {
        id: 'preview-1',
        items: [
          { id: 'item-1', itemType: 'FIELD', impact: 'LOW' },
        ],
      };

      prisma.preview.findUnique.mockResolvedValue(mockPreview);

      await expect(
        service.bulkApprove({
          previewId: 'preview-1',
          userId: 'user-1',
          pattern: {
            itemType: 'VALIDATION_RULE',
          },
        })
      ).rejects.toThrow('No items match the specified pattern');
    });
  });

  describe('getApprovalHistory', () => {
    it('should return paginated approval history', async () => {
      const mockApprovals = [
        { id: 'approval-1', status: ApprovalStatus.APPROVED },
        { id: 'approval-2', status: ApprovalStatus.REJECTED },
      ];

      const approvalRepo = (service as any).approvalRepository;
      approvalRepo.getApprovalHistory.mockResolvedValue({
        approvals: mockApprovals,
        total: 15,
      });

      const result = await service.getApprovalHistory({
        filters: { userId: 'user-1' },
        pagination: { page: 2, pageSize: 10 },
      });

      expect(approvalRepo.getApprovalHistory).toHaveBeenCalledWith(
        { userId: 'user-1' },
        { skip: 10, take: 10 }
      );

      expect(result).toEqual({
        approvals: mockApprovals,
        total: 15,
        page: 2,
        pageSize: 10,
        totalPages: 2,
      });
    });
  });

  describe('applyModifiedItems', () => {
    it('should apply modified data to preview items', async () => {
      const mockModifiedItems = [
        {
          id: 'item-1',
          previewItemId: 'preview-item-1',
          modifiedData: { field: 'UpdatedValue' },
        },
        {
          id: 'item-2',
          previewItemId: 'preview-item-2',
          modifiedData: { field: 'AnotherValue' },
        },
      ];

      const approvalItemRepo = (service as any).approvalItemRepository;
      approvalItemRepo.findModifiedItems.mockResolvedValue(mockModifiedItems);

      await service.applyModifiedItems('approval-1');

      expect(approvalItemRepo.findModifiedItems).toHaveBeenCalledWith('approval-1');

      expect(prisma.previewItem.update).toHaveBeenCalledTimes(2);
      expect(prisma.previewItem.update).toHaveBeenCalledWith({
        where: { id: 'preview-item-1' },
        data: {
          proposedState: { field: 'UpdatedValue' },
        },
      });
      expect(prisma.previewItem.update).toHaveBeenCalledWith({
        where: { id: 'preview-item-2' },
        data: {
          proposedState: { field: 'AnotherValue' },
        },
      });
    });
  });

  describe('getPendingApprovals', () => {
    it('should return all pending approvals', async () => {
      const mockPendingApprovals = [
        { id: 'approval-1', status: ApprovalStatus.PENDING },
        { id: 'approval-2', status: ApprovalStatus.PENDING },
      ];

      const approvalRepo = (service as any).approvalRepository;
      approvalRepo.findPending.mockResolvedValue(mockPendingApprovals);

      const result = await service.getPendingApprovals();

      expect(approvalRepo.findPending).toHaveBeenCalled();
      expect(result).toEqual(mockPendingApprovals);
    });
  });
});