import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PrismaClient, ApprovalStatus } from '@prisma/client';
import { ApprovalRepository } from './ApprovalRepository';

vi.mock('@prisma/client', () => ({
  PrismaClient: vi.fn(),
  ApprovalStatus: {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    MODIFIED: 'MODIFIED',
  },
}));

describe('ApprovalRepository', () => {
  let prisma: any;
  let repository: ApprovalRepository;

  beforeEach(() => {
    prisma = {
      approval: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
    };
    repository = new ApprovalRepository(prisma as PrismaClient);
  });

  describe('create', () => {
    it('should create an approval with relations', async () => {
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.PENDING,
        comments: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.approval.create.mockResolvedValue(mockApproval);

      const result = await repository.create({
        preview: { connect: { id: 'preview-1' } },
        user: { connect: { id: 'user-1' } },
        status: ApprovalStatus.PENDING,
      });

      expect(prisma.approval.create).toHaveBeenCalledWith({
        data: {
          preview: { connect: { id: 'preview-1' } },
          user: { connect: { id: 'user-1' } },
          status: ApprovalStatus.PENDING,
        },
        include: {
          items: true,
          preview: true,
          user: true,
        },
      });
      expect(result).toEqual(mockApproval);
    });
  });

  describe('findById', () => {
    it('should find an approval by id with full relations', async () => {
      const mockApproval = {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: ApprovalStatus.PENDING,
        items: [],
        preview: { id: 'preview-1', items: [], ticket: {} },
        user: { id: 'user-1', email: 'test@example.com' },
      };

      prisma.approval.findUnique.mockResolvedValue(mockApproval);

      const result = await repository.findById('approval-1');

      expect(prisma.approval.findUnique).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
        include: {
          items: {
            include: {
              previewItem: true,
            },
          },
          preview: {
            include: {
              items: true,
              ticket: true,
            },
          },
          user: true,
        },
      });
      expect(result).toEqual(mockApproval);
    });

    it('should return null if approval not found', async () => {
      prisma.approval.findUnique.mockResolvedValue(null);

      const result = await repository.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findPending', () => {
    it('should find all pending approvals', async () => {
      const mockApprovals = [
        { id: 'approval-1', status: ApprovalStatus.PENDING },
        { id: 'approval-2', status: ApprovalStatus.PENDING },
      ];

      prisma.approval.findMany.mockResolvedValue(mockApprovals);

      const result = await repository.findPending();

      expect(prisma.approval.findMany).toHaveBeenCalledWith({
        where: { status: ApprovalStatus.PENDING },
        include: {
          items: {
            include: {
              previewItem: true,
            },
          },
          preview: {
            include: {
              ticket: true,
            },
          },
          user: true,
        },
        orderBy: { createdAt: 'asc' },
      });
      expect(result).toEqual(mockApprovals);
    });
  });

  describe('updateStatus', () => {
    it('should update approval status with comments', async () => {
      const mockUpdatedApproval = {
        id: 'approval-1',
        status: ApprovalStatus.APPROVED,
        comments: 'Looks good!',
      };

      prisma.approval.update.mockResolvedValue(mockUpdatedApproval);

      const result = await repository.updateStatus(
        'approval-1',
        ApprovalStatus.APPROVED,
        'Looks good!'
      );

      expect(prisma.approval.update).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
        data: {
          status: ApprovalStatus.APPROVED,
          comments: 'Looks good!',
          updatedAt: expect.any(Date),
        },
        include: {
          items: {
            include: {
              previewItem: true,
            },
          },
          preview: {
            include: {
              ticket: true,
            },
          },
          user: true,
        },
      });
      expect(result).toEqual(mockUpdatedApproval);
    });
  });

  describe('getApprovalHistory', () => {
    it('should get approval history with filters and pagination', async () => {
      const mockApprovals = [
        { id: 'approval-1', userId: 'user-1', status: ApprovalStatus.APPROVED },
        { id: 'approval-2', userId: 'user-1', status: ApprovalStatus.REJECTED },
      ];

      prisma.approval.findMany.mockResolvedValue(mockApprovals);
      prisma.approval.count.mockResolvedValue(2);

      const result = await repository.getApprovalHistory(
        {
          userId: 'user-1',
          status: ApprovalStatus.APPROVED,
          startDate: new Date('2025-01-01'),
          endDate: new Date('2025-12-31'),
        },
        {
          skip: 0,
          take: 10,
        }
      );

      expect(prisma.approval.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          status: ApprovalStatus.APPROVED,
          createdAt: {
            gte: new Date('2025-01-01'),
            lte: new Date('2025-12-31'),
          },
        },
        include: {
          items: {
            include: {
              previewItem: true,
            },
          },
          preview: {
            include: {
              ticket: true,
            },
          },
          user: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 10,
      });
      expect(result).toEqual({
        approvals: mockApprovals,
        total: 2,
      });
    });
  });

  describe('delete', () => {
    it('should delete an approval', async () => {
      prisma.approval.delete.mockResolvedValue({ id: 'approval-1' });

      await repository.delete('approval-1');

      expect(prisma.approval.delete).toHaveBeenCalledWith({
        where: { id: 'approval-1' },
      });
    });
  });
});