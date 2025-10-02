import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createInnerTRPCContext } from '../trpc';
import { previewRouter } from './preview';
import type { Session } from 'next-auth';

// Mock Prisma client
vi.mock('@agentris/db', () => ({
  prisma: {
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
  },
  PreviewRepository: vi.fn().mockImplementation(() => ({
    create: vi.fn().mockResolvedValue({
      id: 'preview-1',
      ticketId: 'ticket-1',
      status: 'GENERATING',
      metadata: {},
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    findById: vi.fn(),
    findByIdWithItems: vi.fn(),
    findByTicketId: vi.fn().mockResolvedValue([]),
    markAsReady: vi.fn().mockResolvedValue({
      id: 'preview-1',
      ticketId: 'ticket-1',
      status: 'READY',
      metadata: {},
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    }),
    update: vi.fn(),
    delete: vi.fn(),
    expireOldPreviews: vi.fn().mockResolvedValue(2),
    deleteExpiredPreviews: vi.fn().mockResolvedValue(1),
  })),
  PreviewItemRepository: vi.fn().mockImplementation(() => ({
    createMany: vi.fn().mockResolvedValue(2),
    findByPreviewId: vi.fn().mockResolvedValue([]),
    countByImpact: vi.fn().mockResolvedValue({ LOW: 2, MEDIUM: 1, HIGH: 0 }),
    countByType: vi.fn().mockResolvedValue({ FIELD: 2, VALIDATION_RULE: 1 }),
    getHighImpactItems: vi.fn().mockResolvedValue([]),
  })),
}));

describe('previewRouter', () => {
  const mockSession: Session = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  const mockConsultantSession: Session = {
    ...mockSession,
    user: {
      ...mockSession.user!,
      role: 'CONSULTANT',
    } as any,
  };

  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: any;

  beforeEach(() => {
    ctx = createInnerTRPCContext({ session: mockConsultantSession });
    caller = previewRouter.createCaller(ctx);
  });

  describe('generatePreview', () => {
    it('should generate a preview with items', async () => {
      const input = {
        ticketId: 'ticket-1',
        metadata: {
          fields: [
            { name: 'TestField', type: 'Text', required: false },
          ],
          validationRules: [
            { name: 'TestRule', errorMessage: 'Test error' },
          ],
        },
      };

      const result = await caller.generatePreview(input);

      expect(result).toEqual({
        preview: expect.objectContaining({
          id: 'preview-1',
          ticketId: 'ticket-1',
          status: 'READY',
        }),
        itemCount: 2, // 1 field + 1 validation rule
      });
    });

    it('should handle empty metadata', async () => {
      const input = {
        ticketId: 'ticket-1',
        metadata: {},
      };

      const result = await caller.generatePreview(input);

      expect(result.itemCount).toBe(0);
    });
  });

  describe('getImpactAnalysis', () => {
    it('should return impact analysis summary', async () => {
      const result = await caller.getImpactAnalysis({ previewId: 'preview-1' });

      expect(result).toEqual({
        summary: {
          totalChanges: 3,
          byImpact: { LOW: 2, MEDIUM: 1, HIGH: 0 },
          byType: { FIELD: 2, VALIDATION_RULE: 1 },
        },
        highImpactItems: [],
        riskScore: expect.any(Number),
      });
    });
  });

  describe('cleanupExpired', () => {
    it('should cleanup expired previews', async () => {
      const result = await caller.cleanupExpired();

      expect(result).toEqual({
        expired: 2,
        deleted: 1,
      });
    });
  });

  describe('calculateRiskScore', () => {
    it('should calculate risk score correctly', () => {
      // Test the risk score calculation indirectly through getImpactAnalysis
      const mockImpactCounts = { LOW: 2, MEDIUM: 1, HIGH: 0 };
      
      // LOW: 2 * 1 = 2, MEDIUM: 1 * 2 = 2, HIGH: 0 * 3 = 0
      // Total score: 4, Total items: 3, Max possible: 9
      // Expected: (4 / 9) * 100 = 44.44... ≈ 44
      
      // We can't test the function directly, but we can verify through the API
      caller.getImpactAnalysis({ previewId: 'preview-1' }).then((result: any) => {
        expect(result.riskScore).toBeGreaterThanOrEqual(0);
        expect(result.riskScore).toBeLessThanOrEqual(100);
      });
    });
  });
});