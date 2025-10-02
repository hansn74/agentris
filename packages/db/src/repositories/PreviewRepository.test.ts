import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreviewRepository } from './PreviewRepository';
import type { PrismaClient } from '@prisma/client';

describe('PreviewRepository', () => {
  let repository: PreviewRepository;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      preview: {
        create: vi.fn(),
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
        deleteMany: vi.fn(),
        count: vi.fn(),
      },
    };
    repository = new PreviewRepository(mockPrisma as PrismaClient);
  });

  describe('create', () => {
    it('should create a new preview', async () => {
      const input = {
        ticketId: 'ticket-1',
        status: 'GENERATING',
        metadata: { fields: [] },
        expiresAt: new Date('2024-12-31'),
      };
      const expected = { id: 'preview-1', ...input, generatedAt: new Date() };
      mockPrisma.preview.create.mockResolvedValue(expected);

      const result = await repository.create(input);

      expect(mockPrisma.preview.create).toHaveBeenCalledWith({ data: input });
      expect(result).toEqual(expected);
    });
  });

  describe('findActiveByTicketId', () => {
    it('should find active preview for ticket', async () => {
      const ticketId = 'ticket-1';
      const expected = {
        id: 'preview-1',
        ticketId,
        status: 'READY',
        expiresAt: new Date('2024-12-31'),
      };
      mockPrisma.preview.findFirst.mockResolvedValue(expected);

      const result = await repository.findActiveByTicketId(ticketId);

      expect(mockPrisma.preview.findFirst).toHaveBeenCalledWith({
        where: {
          ticketId,
          status: 'READY',
          expiresAt: { gt: expect.any(Date) },
        },
        orderBy: { generatedAt: 'desc' },
      });
      expect(result).toEqual(expected);
    });
  });

  describe('expireOldPreviews', () => {
    it('should mark old previews as expired', async () => {
      mockPrisma.preview.updateMany.mockResolvedValue({ count: 5 });

      const result = await repository.expireOldPreviews();

      expect(mockPrisma.preview.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'READY',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'EXPIRED' },
      });
      expect(result).toBe(5);
    });
  });

  describe('getLatestPreviewForTicket', () => {
    it('should get latest preview with items', async () => {
      const expected = {
        id: 'preview-1',
        ticketId: 'ticket-1',
        items: [
          { id: 'item-1', itemType: 'FIELD', name: 'Field1' },
        ],
      };
      mockPrisma.preview.findFirst.mockResolvedValue(expected);

      const result = await repository.getLatestPreviewForTicket('ticket-1');

      expect(mockPrisma.preview.findFirst).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1' },
        orderBy: { generatedAt: 'desc' },
        include: {
          items: {
            orderBy: { itemType: 'asc' },
          },
        },
      });
      expect(result).toEqual(expected);
    });
  });
});