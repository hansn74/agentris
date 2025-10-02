import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { createInnerTRPCContext } from '../trpc';
import { previewRouter } from './preview';
import type { Session } from 'next-auth';

describe('Preview Router - Real-time Synchronization', () => {
  let ee: EventEmitter;
  let ctx: ReturnType<typeof createInnerTRPCContext>;
  let caller: any;
  
  const mockConsultantSession: Session = {
    user: {
      id: 'user-1',
      email: 'test@example.com',
      name: 'Test User',
      role: 'CONSULTANT',
    } as any,
    expires: new Date(Date.now() + 86400000).toISOString(),
  };

  beforeEach(() => {
    ee = new EventEmitter();
    
    // Mock the database repositories
    vi.mock('@agentris/db', () => ({
      PreviewRepository: vi.fn().mockImplementation(() => ({
        create: vi.fn().mockResolvedValue({
          id: 'preview-1',
          ticketId: 'ticket-1',
          status: 'GENERATING',
          metadata: {},
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }),
        markAsReady: vi.fn().mockResolvedValue({
          id: 'preview-1',
          ticketId: 'ticket-1',
          status: 'READY',
          metadata: {},
          generatedAt: new Date(),
          expiresAt: new Date(Date.now() + 86400000),
        }),
      })),
      PreviewItemRepository: vi.fn().mockImplementation(() => ({
        createMany: vi.fn().mockResolvedValue(1),
      })),
    }));

    ctx = createInnerTRPCContext({ session: mockConsultantSession });
    ctx.ee = ee; // Use our test event emitter
    caller = previewRouter.createCaller(ctx);
  });

  afterEach(() => {
    ee.removeAllListeners();
  });

  describe('subscribeToPreviewUpdates', () => {
    it('should receive events when preview is created', async () => {
      const receivedEvents: any[] = [];
      
      // Set up subscription
      const subscription = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-1' },
        {
          onData: (data: any) => {
            receivedEvents.push(data);
          },
        }
      );

      // Emit a preview created event
      ee.emit('preview:ticket-1', {
        previewId: 'preview-1',
        type: 'created',
        preview: {
          id: 'preview-1',
          ticketId: 'ticket-1',
          status: 'READY',
        },
      });

      // Wait for event to be processed
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toEqual({
        previewId: 'preview-1',
        type: 'created',
        preview: expect.objectContaining({
          id: 'preview-1',
          ticketId: 'ticket-1',
        }),
      });

      subscription.unsubscribe();
    });

    it('should handle multiple subscribers', async () => {
      const subscriber1Events: any[] = [];
      const subscriber2Events: any[] = [];

      // Set up two subscriptions
      const sub1 = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-1' },
        { onData: (data: any) => subscriber1Events.push(data) }
      );

      const sub2 = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-1' },
        { onData: (data: any) => subscriber2Events.push(data) }
      );

      // Emit an event
      ee.emit('preview:ticket-1', {
        previewId: 'preview-2',
        type: 'updated',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Both subscribers should receive the event
      expect(subscriber1Events).toHaveLength(1);
      expect(subscriber2Events).toHaveLength(1);
      expect(subscriber1Events[0]).toEqual(subscriber2Events[0]);

      sub1.unsubscribe();
      sub2.unsubscribe();
    });

    it('should stop receiving events after unsubscribe', async () => {
      const receivedEvents: any[] = [];

      const subscription = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-1' },
        { onData: (data: any) => receivedEvents.push(data) }
      );

      // Emit first event
      ee.emit('preview:ticket-1', { previewId: '1', type: 'created' });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(receivedEvents).toHaveLength(1);

      // Unsubscribe
      subscription.unsubscribe();

      // Emit second event after unsubscribe
      ee.emit('preview:ticket-1', { previewId: '2', type: 'created' });
      await new Promise(resolve => setTimeout(resolve, 10));

      // Should still only have 1 event
      expect(receivedEvents).toHaveLength(1);
    });

    it('should isolate events by ticketId', async () => {
      const ticket1Events: any[] = [];
      const ticket2Events: any[] = [];

      const sub1 = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-1' },
        { onData: (data: any) => ticket1Events.push(data) }
      );

      const sub2 = await caller.subscribeToPreviewUpdates.subscribe(
        { ticketId: 'ticket-2' },
        { onData: (data: any) => ticket2Events.push(data) }
      );

      // Emit events for different tickets
      ee.emit('preview:ticket-1', { previewId: 'p1', type: 'created' });
      ee.emit('preview:ticket-2', { previewId: 'p2', type: 'created' });
      ee.emit('preview:ticket-1', { previewId: 'p3', type: 'updated' });

      await new Promise(resolve => setTimeout(resolve, 10));

      // Each subscriber should only receive their ticket's events
      expect(ticket1Events).toHaveLength(2);
      expect(ticket2Events).toHaveLength(1);
      expect(ticket1Events[0].previewId).toBe('p1');
      expect(ticket1Events[1].previewId).toBe('p3');
      expect(ticket2Events[0].previewId).toBe('p2');

      sub1.unsubscribe();
      sub2.unsubscribe();
    });
  });

  describe('Event emission on mutations', () => {
    it('should emit event when preview is generated', async () => {
      const receivedEvents: any[] = [];
      
      // Set up listener
      ee.on('preview:ticket-1', (data) => receivedEvents.push(data));

      // Generate preview
      await caller.generatePreview({
        ticketId: 'ticket-1',
        metadata: { fields: [{ name: 'TestField' }] },
      });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        previewId: 'preview-1',
        type: 'created',
      });
    });

    it('should emit delete event when preview is deleted', async () => {
      const receivedEvents: any[] = [];
      
      // Mock delete to succeed
      vi.mock('@agentris/db', () => ({
        PreviewRepository: vi.fn().mockImplementation(() => ({
          delete: vi.fn().mockResolvedValue(undefined),
        })),
      }));

      ee.on('preview:delete', (data) => receivedEvents.push(data));

      await caller.delete({ id: 'preview-1' });

      expect(receivedEvents).toHaveLength(1);
      expect(receivedEvents[0]).toMatchObject({
        previewId: 'preview-1',
        type: 'deleted',
      });
    });
  });
});