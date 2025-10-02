import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, ApprovalItemStatus, Prisma } from '@prisma/client';
import { ApprovalItemRepository } from './ApprovalItemRepository';

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  ApprovalItemStatus: {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    MODIFIED: 'MODIFIED',
  },
  Prisma: {
    JsonNull: Symbol('JsonNull'),
  },
}));

describe('ApprovalItemRepository', () => {
  let prisma: any;
  let repository: ApprovalItemRepository;

  beforeEach(() => {
    prisma = {
      approvalItem: {
        create: vi.fn(),
        createMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
      },
    };
    repository = new ApprovalItemRepository(prisma as PrismaClient);
  });

  describe('create', () => {
    it('should create an approval item with relations', async () => {
      const mockItem = {
        id: 'item-1',
        approvalId: 'approval-1',
        previewItemId: 'preview-item-1',
        status: ApprovalItemStatus.APPROVED,
        modifiedData: null,
        reason: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.approvalItem.create.mockResolvedValue(mockItem);

      const result = await repository.create({
        approval: { connect: { id: 'approval-1' } },
        previewItem: { connect: { id: 'preview-item-1' } },
        status: ApprovalItemStatus.APPROVED,
      });

      expect(prisma.approvalItem.create).toHaveBeenCalledWith({
        data: {
          approval: { connect: { id: 'approval-1' } },
          previewItem: { connect: { id: 'preview-item-1' } },
          status: ApprovalItemStatus.APPROVED,
        },
        include: {
          approval: true,
          previewItem: true,
        },
      });
      expect(result).toEqual(mockItem);
    });
  });

  describe('createMany', () => {
    it('should create multiple approval items', async () => {
      const mockBatchPayload = { count: 3 };
      const items = [
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-1',
          status: ApprovalItemStatus.APPROVED,
        },
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-2',
          status: ApprovalItemStatus.REJECTED,
          reason: 'Not compliant',
        },
        {
          approvalId: 'approval-1',
          previewItemId: 'preview-item-3',
          status: ApprovalItemStatus.MODIFIED,
          modifiedData: { field: 'updated' },
        },
      ];

      prisma.approvalItem.createMany.mockResolvedValue(mockBatchPayload);

      const result = await repository.createMany(items);

      expect(prisma.approvalItem.createMany).toHaveBeenCalledWith({
        data: items,
      });
      expect(result).toEqual(mockBatchPayload);
    });
  });

  describe('findByPreviewItemId', () => {
    it('should find approval item by preview item id', async () => {
      const mockItem = {
        id: 'item-1',
        previewItemId: 'preview-item-1',
        status: ApprovalItemStatus.APPROVED,
        approval: {
          id: 'approval-1',
          user: { id: 'user-1', email: 'test@example.com' },
        },
      };

      prisma.approvalItem.findUnique.mockResolvedValue(mockItem);

      const result = await repository.findByPreviewItemId('preview-item-1');

      expect(prisma.approvalItem.findUnique).toHaveBeenCalledWith({
        where: { previewItemId: 'preview-item-1' },
        include: {
          approval: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockItem);
    });
  });

  describe('updateStatus', () => {
    it('should update item status with reason and modified data', async () => {
      const mockUpdatedItem = {
        id: 'item-1',
        status: ApprovalItemStatus.MODIFIED,
        reason: 'Updated field name',
        modifiedData: { fieldName: 'UpdatedName' },
      };

      prisma.approvalItem.update.mockResolvedValue(mockUpdatedItem);

      const result = await repository.updateStatus(
        'item-1',
        ApprovalItemStatus.MODIFIED,
        'Updated field name',
        { fieldName: 'UpdatedName' }
      );

      expect(prisma.approvalItem.update).toHaveBeenCalledWith({
        where: { id: 'item-1' },
        data: {
          status: ApprovalItemStatus.MODIFIED,
          reason: 'Updated field name',
          modifiedData: { fieldName: 'UpdatedName' },
          updatedAt: expect.any(Date),
        },
        include: {
          approval: true,
          previewItem: true,
        },
      });
      expect(result).toEqual(mockUpdatedItem);
    });
  });

  describe('bulkUpdateStatus', () => {
    it('should bulk update status for multiple items', async () => {
      const mockBatchPayload = { count: 5 };
      const ids = ['item-1', 'item-2', 'item-3', 'item-4', 'item-5'];

      prisma.approvalItem.updateMany.mockResolvedValue(mockBatchPayload);

      const result = await repository.bulkUpdateStatus(
        ids,
        ApprovalItemStatus.APPROVED,
        'Bulk approved'
      );

      expect(prisma.approvalItem.updateMany).toHaveBeenCalledWith({
        where: {
          id: {
            in: ids,
          },
        },
        data: {
          status: ApprovalItemStatus.APPROVED,
          reason: 'Bulk approved',
          updatedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(mockBatchPayload);
    });
  });

  describe('findByStatus', () => {
    it('should find items by status', async () => {
      const mockItems = [
        { id: 'item-1', status: ApprovalItemStatus.REJECTED },
        { id: 'item-2', status: ApprovalItemStatus.REJECTED },
      ];

      prisma.approvalItem.findMany.mockResolvedValue(mockItems);

      const result = await repository.findByStatus(
        ApprovalItemStatus.REJECTED,
        'approval-1'
      );

      expect(prisma.approvalItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ApprovalItemStatus.REJECTED,
          approvalId: 'approval-1',
        },
        include: {
          approval: {
            include: {
              user: true,
              preview: true,
            },
          },
          previewItem: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      expect(result).toEqual(mockItems);
    });
  });

  describe('findModifiedItems', () => {
    it('should find all modified items with data', async () => {
      const mockItems = [
        {
          id: 'item-1',
          status: ApprovalItemStatus.MODIFIED,
          modifiedData: { field: 'updated' },
        },
      ];

      prisma.approvalItem.findMany.mockResolvedValue(mockItems);

      const result = await repository.findModifiedItems('approval-1');

      expect(prisma.approvalItem.findMany).toHaveBeenCalledWith({
        where: {
          status: ApprovalItemStatus.MODIFIED,
          modifiedData: {
            not: Prisma.JsonNull,
          },
          approvalId: 'approval-1',
        },
        include: {
          approval: {
            include: {
              user: true,
              preview: true,
            },
          },
          previewItem: true,
        },
        orderBy: { updatedAt: 'desc' },
      });
      expect(result).toEqual(mockItems);
    });
  });

  describe('delete', () => {
    it('should delete an approval item', async () => {
      prisma.approvalItem.delete.mockResolvedValue({ id: 'item-1' });

      await repository.delete('item-1');

      expect(prisma.approvalItem.delete).toHaveBeenCalledWith({
        where: { id: 'item-1' },
      });
    });
  });

  describe('deleteMany', () => {
    it('should delete all items for an approval', async () => {
      const mockBatchPayload = { count: 5 };

      prisma.approvalItem.deleteMany.mockResolvedValue(mockBatchPayload);

      const result = await repository.deleteMany('approval-1');

      expect(prisma.approvalItem.deleteMany).toHaveBeenCalledWith({
        where: { approvalId: 'approval-1' },
      });
      expect(result).toEqual(mockBatchPayload);
    });
  });
});