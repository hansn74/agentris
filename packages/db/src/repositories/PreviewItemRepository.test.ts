import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreviewItemRepository } from './PreviewItemRepository';
import type { PrismaClient } from '@prisma/client';

describe('PreviewItemRepository', () => {
  let repository: PreviewItemRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      previewItem: {
        create: vi.fn(),
        createMany: vi.fn(),
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
      },
    };
    repository = new PreviewItemRepository(mockPrisma as PrismaClient);
  });

  describe('createMany', () => {
    it('should bulk create preview items', async () => {
      const input = {
        previewId: 'preview-1',
        items: [
          {
            itemType: 'FIELD',
            name: 'Field1',
            proposedState: { type: 'Text' },
            impact: 'LOW',
            description: 'New text field',
          },
          {
            itemType: 'FIELD',
            name: 'Field2',
            proposedState: { type: 'Number' },
            impact: 'MEDIUM',
            description: 'New number field',
          },
        ],
      };
      mockPrisma.previewItem.createMany.mockResolvedValue({ count: 2 });

      const result = await repository.createMany(input);

      expect(mockPrisma.previewItem.createMany).toHaveBeenCalledWith({
        data: input.items.map(item => ({
          ...item,
          previewId: input.previewId,
        })),
      });
      expect(result).toBe(2);
    });
  });

  describe('findByPreviewIdAndType', () => {
    it('should find items by preview ID and type', async () => {
      const expected = [
        { id: 'item-1', previewId: 'preview-1', itemType: 'FIELD', name: 'Field1' },
        { id: 'item-2', previewId: 'preview-1', itemType: 'FIELD', name: 'Field2' },
      ];
      mockPrisma.previewItem.findMany.mockResolvedValue(expected);

      const result = await repository.findByPreviewIdAndType('preview-1', 'FIELD');

      expect(mockPrisma.previewItem.findMany).toHaveBeenCalledWith({
        where: {
          previewId: 'preview-1',
          itemType: 'FIELD',
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('countByType', () => {
    it('should count items by type', async () => {
      const mockGroupBy = [
        { itemType: 'FIELD', _count: { itemType: 5 } },
        { itemType: 'VALIDATION_RULE', _count: { itemType: 3 } },
      ];
      mockPrisma.previewItem.groupBy.mockResolvedValue(mockGroupBy);

      const result = await repository.countByType('preview-1');

      expect(mockPrisma.previewItem.groupBy).toHaveBeenCalledWith({
        by: ['itemType'],
        where: { previewId: 'preview-1' },
        _count: { itemType: true },
      });
      expect(result).toEqual({
        FIELD: 5,
        VALIDATION_RULE: 3,
      });
    });
  });

  describe('countByImpact', () => {
    it('should count items by impact level', async () => {
      const mockGroupBy = [
        { impact: 'LOW', _count: { impact: 2 } },
        { impact: 'MEDIUM', _count: { impact: 3 } },
        { impact: 'HIGH', _count: { impact: 1 } },
      ];
      mockPrisma.previewItem.groupBy.mockResolvedValue(mockGroupBy);

      const result = await repository.countByImpact('preview-1');

      expect(mockPrisma.previewItem.groupBy).toHaveBeenCalledWith({
        by: ['impact'],
        where: { previewId: 'preview-1' },
        _count: { impact: true },
      });
      expect(result).toEqual({
        LOW: 2,
        MEDIUM: 3,
        HIGH: 1,
      });
    });
  });

  describe('getHighImpactItems', () => {
    it('should get only high impact items', async () => {
      const expected = [
        { id: 'item-1', previewId: 'preview-1', impact: 'HIGH', name: 'CriticalField' },
      ];
      mockPrisma.previewItem.findMany.mockResolvedValue(expected);

      const result = await repository.getHighImpactItems('preview-1');

      expect(mockPrisma.previewItem.findMany).toHaveBeenCalledWith({
        where: {
          previewId: 'preview-1',
          impact: 'HIGH',
        },
        orderBy: [
          { itemType: 'asc' },
          { name: 'asc' },
        ],
      });
      expect(result).toEqual(expected);
    });
  });

  describe('hasChanges', () => {
    it('should return true if preview has items', async () => {
      mockPrisma.previewItem.count.mockResolvedValue(5);

      const result = await repository.hasChanges('preview-1');

      expect(mockPrisma.previewItem.count).toHaveBeenCalledWith({
        where: { previewId: 'preview-1' },
      });
      expect(result).toBe(true);
    });

    it('should return false if preview has no items', async () => {
      mockPrisma.previewItem.count.mockResolvedValue(0);

      const result = await repository.hasChanges('preview-1');

      expect(result).toBe(false);
    });
  });
});