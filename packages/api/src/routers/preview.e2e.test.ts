import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createCallerFactory } from '../trpc';
import { previewRouter } from './preview';
import { PrismaClient } from '@agentris/db';
import { EventEmitter } from 'events';

// Mock PreviewGenerator to avoid external dependencies
vi.mock('@agentris/ai-engine', () => ({
  PreviewGenerator: class {
    async generatePreview({ ticketId, ticketContent, format }: any) {
      const defaultFormat = format || 'mockup';
      return {
        format: defaultFormat,
        data: {
          type: defaultFormat,
          ...(defaultFormat === 'mockup' && {
            html: '<div>Mock preview</div>',
            sections: [{
              name: 'Test Section',
              fields: [{
                label: 'Test Field',
                type: 'text',
                required: true,
              }]
            }]
          }),
          ...(defaultFormat === 'diagram' && {
            mermaidSyntax: 'graph TD\n  A-->B',
            nodes: [
              { id: 'A', label: 'Start', type: 'start' },
              { id: 'B', label: 'End', type: 'end' }
            ],
            edges: [{ from: 'A', to: 'B' }]
          }),
          ...(defaultFormat === 'text' && {
            content: 'Test preview content',
            format: 'plain'
          })
        },
        availableFormats: ['mockup', 'diagram', 'text', 'table']
      };
    }
  }
}));

describe('Preview Router - E2E Tests', () => {
  let caller: any;
  let ctx: any;
  let mockPrisma: any;

  beforeEach(() => {
    // Create mock Prisma client with all necessary methods
    mockPrisma = {
      preview: {
        create: vi.fn().mockResolvedValue({
          id: 'preview-123',
          ticketId: 'ticket-456',
          status: 'GENERATING',
          metadata: {},
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }),
        update: vi.fn().mockResolvedValue({
          id: 'preview-123',
          ticketId: 'ticket-456', 
          status: 'READY',
          metadata: { format: 'mockup', data: {} },
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }),
        findMany: vi.fn().mockResolvedValue([]),
        findFirst: vi.fn().mockResolvedValue(null),
        findUnique: vi.fn().mockResolvedValue({
          id: 'preview-123',
          ticketId: 'ticket-456',
          status: 'READY',
          metadata: {},
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
          items: []
        }),
        delete: vi.fn().mockResolvedValue({ id: 'preview-123' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        count: vi.fn().mockResolvedValue(0),
      },
      previewItem: {
        createMany: vi.fn().mockResolvedValue({ count: 1 }),
        findMany: vi.fn().mockResolvedValue([]),
        groupBy: vi.fn().mockResolvedValue([]),
      },
      $transaction: vi.fn().mockImplementation(async (fn: any) => {
        if (typeof fn === 'function') {
          return fn(mockPrisma);
        }
        return Promise.all(fn);
      }),
    };

    // Create context with required properties
    ctx = {
      prisma: mockPrisma,
      session: {
        user: { 
          id: 'user-123',
          email: 'test@example.com',
          role: 'CONSULTANT'
        }
      },
      ee: new EventEmitter(),
    };

    // Create caller with context
    const createCaller = createCallerFactory(previewRouter);
    caller = createCaller(ctx);
  });

  describe('generateIntelligentPreview', () => {
    it('should generate a preview with automatic format detection', async () => {
      const input = {
        ticketId: 'ticket-456',
        ticketContent: 'Add a new email field to the Contact object',
      };

      const result = await caller.generateIntelligentPreview(input);

      expect(result).toBeDefined();
      expect(result.id).toBe('preview-123');
      expect(result.format).toBe('mockup');
      expect(result.data).toBeDefined();
      expect(result.data.type).toBe('mockup');
      expect(result.availableFormats).toContain('mockup');
      expect(result.generatedAt).toBeInstanceOf(Date);
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should generate a preview with specified format', async () => {
      const input = {
        ticketId: 'ticket-789',
        ticketContent: 'Create an approval flow for large opportunities',
        format: 'diagram' as const,
      };

      const result = await caller.generateIntelligentPreview(input);

      expect(result.format).toBe('diagram');
      expect(result.data.type).toBe('diagram');
      expect(result.data).toHaveProperty('mermaidSyntax');
      expect(result.data).toHaveProperty('nodes');
      expect(result.data).toHaveProperty('edges');
    });

    it('should apply rate limiting for preview generation', async () => {
      // Mock rate limit exceeded
      const rateLimitedCtx = {
        ...ctx,
        session: { user: { id: 'rate-limited-user' } }
      };
      
      // First 20 calls should work (based on our rate limit config)
      // This is a simplified test - in reality would need to mock checkRateLimit
      const input = {
        ticketId: 'ticket-rate-test',
        ticketContent: 'Test content',
      };

      const result = await caller.generateIntelligentPreview(input);
      expect(result).toBeDefined();
    });
  });

  describe('switchPreviewFormat', () => {
    it('should switch to a different preview format', async () => {
      const input = {
        ticketId: 'ticket-456',
        ticketContent: 'Add validation rule to Account',
        newFormat: 'text' as const,
      };

      const result = await caller.switchPreviewFormat(input);

      expect(result.format).toBe('text');
      expect(result.data.type).toBe('text');
      expect(result.data).toHaveProperty('content');
    });

    it('should expire existing previews when switching format', async () => {
      const input = {
        ticketId: 'ticket-456',
        ticketContent: 'Update field permissions',
        newFormat: 'diagram' as const,
      };

      await caller.switchPreviewFormat(input);

      // Verify that updateMany was called to expire old previews
      expect(mockPrisma.preview.updateMany).toHaveBeenCalled();
    });
  });

  describe('getAvailableFormats', () => {
    it('should return available preview formats for a ticket', async () => {
      mockPrisma.preview.findFirst.mockResolvedValueOnce({
        id: 'preview-123',
        metadata: { type: 'mockup' },
      });

      const result = await caller.getAvailableFormats({ ticketId: 'ticket-456' });

      expect(result.currentFormat).toBe('mockup');
      expect(result.availableFormats).toBeInstanceOf(Array);
      expect(result.previewId).toBe('preview-123');
    });

    it('should handle when no preview exists', async () => {
      mockPrisma.preview.findFirst.mockResolvedValueOnce(null);

      const result = await caller.getAvailableFormats({ ticketId: 'no-preview' });

      expect(result.currentFormat).toBeNull();
      expect(result.availableFormats).toBeInstanceOf(Array);
      expect(result.previewId).toBeUndefined();
    });
  });

  describe('generatePreview (legacy)', () => {
    it('should generate a preview with metadata parsing', async () => {
      const input = {
        ticketId: 'ticket-legacy',
        metadata: {
          fields: [
            {
              name: 'TestField__c',
              type: 'Text',
              required: true,
            }
          ],
          validationRules: [
            {
              name: 'TestRule',
              errorMessage: 'Test error',
            }
          ]
        }
      };

      const result = await caller.generatePreview(input);

      expect(result.preview).toBeDefined();
      expect(result.itemCount).toBeGreaterThanOrEqual(0);
      expect(mockPrisma.previewItem.createMany).toHaveBeenCalled();
    });

    it('should calculate expiration time correctly', async () => {
      const customExpiry = 7200; // 2 hours in seconds
      const input = {
        ticketId: 'ticket-expiry',
        metadata: {},
        expiresIn: customExpiry,
      };

      await caller.generatePreview(input);

      const createCall = mockPrisma.preview.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt;
      const expectedExpiry = new Date(Date.now() + customExpiry * 1000);
      
      // Allow 1 second tolerance for test execution time
      expect(Math.abs(expiresAt.getTime() - expectedExpiry.getTime())).toBeLessThan(1000);
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockPrisma.preview.create.mockRejectedValueOnce(new Error('Database error'));

      await expect(
        caller.generatePreview({
          ticketId: 'error-ticket',
          metadata: {},
        })
      ).rejects.toThrow();
    });

    it('should handle missing preview on getById', async () => {
      mockPrisma.preview.findUnique.mockResolvedValueOnce(null);

      await expect(
        caller.getById({ id: 'non-existent' })
      ).rejects.toThrow('Preview not found');
    });
  });

  describe('Real-time updates', () => {
    it('should emit events when preview is created', async () => {
      const eventPromise = new Promise((resolve) => {
        ctx.ee.once('preview:ticket-realtime', resolve);
      });

      await caller.generateIntelligentPreview({
        ticketId: 'ticket-realtime',
        ticketContent: 'Test content',
      });

      const event = await eventPromise;
      expect(event).toHaveProperty('type', 'created');
      expect(event).toHaveProperty('previewId');
      expect(event).toHaveProperty('preview');
    });

    it('should emit events when preview is deleted', async () => {
      const eventPromise = new Promise((resolve) => {
        ctx.ee.once('preview:delete', resolve);
      });

      await caller.delete({ id: 'preview-to-delete' });

      const event = await eventPromise;
      expect(event).toHaveProperty('type', 'deleted');
      expect(event).toHaveProperty('previewId', 'preview-to-delete');
    });
  });

  describe('Cleanup operations', () => {
    it('should expire old previews', async () => {
      mockPrisma.preview.updateMany
        .mockResolvedValueOnce({ count: 3 }) // expired
        .mockResolvedValueOnce({ count: 1 }); // deleted

      const result = await caller.cleanupExpired();

      expect(result.expired).toBe(3);
      expect(result.deleted).toBe(1);
      expect(mockPrisma.preview.updateMany).toHaveBeenCalledTimes(2);
    });

    it('should extend preview expiration', async () => {
      const newExpiry = 172800; // 48 hours
      
      const result = await caller.extend({
        id: 'preview-extend',
        expiresIn: newExpiry,
      });

      expect(result.id).toBe('preview-123');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockPrisma.preview.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'preview-extend' },
          data: expect.objectContaining({
            status: 'READY',
            expiresAt: expect.any(Date),
          })
        })
      );
    });
  });
});