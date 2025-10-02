'use client';

import { useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/components/ui/use-toast';

interface PreviewUpdateEvent {
  previewId: string;
  type: 'created' | 'updated' | 'deleted' | 'expired';
  preview?: any;
  items?: any[];
}

interface UsePreviewSubscriptionOptions {
  ticketId: string;
  enabled?: boolean;
  onUpdate?: (event: PreviewUpdateEvent) => void;
  onCreated?: (event: PreviewUpdateEvent) => void;
  onDeleted?: (event: PreviewUpdateEvent) => void;
  onExpired?: (event: PreviewUpdateEvent) => void;
}

export function usePreviewSubscription({
  ticketId,
  enabled = true,
  onUpdate,
  onCreated,
  onDeleted,
  onExpired,
}: UsePreviewSubscriptionOptions) {
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Subscribe to preview updates
  const subscription = trpc.preview.subscribeToPreviewUpdates.useSubscription(
    { ticketId },
    {
      enabled: enabled && !!ticketId,
      onData: (event: PreviewUpdateEvent) => {
        // Call general update handler
        onUpdate?.(event);

        // Call specific handlers based on event type
        switch (event.type) {
          case 'created':
            onCreated?.(event);
            // Invalidate preview list to refresh UI
            utils.preview.list.invalidate({ ticketId });
            utils.preview.getById.invalidate({ id: event.previewId });
            toast({
              title: 'Preview Generated',
              description: 'Your change preview is ready to review',
            });
            break;

          case 'updated':
            // Invalidate specific preview data
            utils.preview.getById.invalidate({ id: event.previewId });
            utils.preview.getImpactAnalysis.invalidate({ previewId: event.previewId });
            break;

          case 'deleted':
            onDeleted?.(event);
            utils.preview.list.invalidate({ ticketId });
            toast({
              title: 'Preview Deleted',
              description: 'The preview has been removed',
              variant: 'destructive',
            });
            break;

          case 'expired':
            onExpired?.(event);
            utils.preview.list.invalidate({ ticketId });
            toast({
              title: 'Preview Expired',
              description: 'The preview has expired and is no longer available',
              variant: 'destructive',
            });
            break;
        }
      },
      onError: (error) => {
        console.error('Preview subscription error:', error);
        toast({
          title: 'Connection Error',
          description: 'Unable to receive real-time preview updates',
          variant: 'destructive',
        });
      },
    }
  );

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      subscription.unsubscribe?.();
    };
  }, [subscription]);

  return {
    isConnected: subscription.status === 'connected',
    status: subscription.status,
  };
}

// Hook for managing preview state with optimistic updates
export function usePreviewWithOptimisticUpdates(ticketId: string) {
  const utils = trpc.useUtils();
  
  // Query hooks
  const previewList = trpc.preview.list.useQuery(
    { ticketId },
    { enabled: !!ticketId }
  );

  // Mutation hooks
  const generatePreview = trpc.preview.generatePreview.useMutation({
    onMutate: async (newPreview) => {
      // Cancel any outgoing refetches
      await utils.preview.list.cancel({ ticketId });

      // Snapshot the previous value
      const previousPreviews = utils.preview.list.getData({ ticketId });

      // Optimistically update to the new value
      utils.preview.list.setData({ ticketId }, (old) => {
        if (!old) return { items: [], nextCursor: undefined };
        
        // Add optimistic preview
        return {
          ...old,
          items: [
            {
              id: 'temp-' + Date.now(),
              ticketId,
              status: 'GENERATING',
              metadata: newPreview.metadata,
              generatedAt: new Date(),
              expiresAt: new Date(Date.now() + (newPreview.expiresIn || 86400) * 1000),
            } as any,
            ...old.items,
          ],
        };
      });

      // Return a context object with the snapshotted value
      return { previousPreviews };
    },
    onError: (err, newPreview, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousPreviews) {
        utils.preview.list.setData({ ticketId }, context.previousPreviews);
      }
    },
    onSettled: () => {
      // Always refetch after error or success
      utils.preview.list.invalidate({ ticketId });
    },
  });

  const deletePreview = trpc.preview.delete.useMutation({
    onMutate: async ({ id }) => {
      await utils.preview.list.cancel({ ticketId });
      const previousPreviews = utils.preview.list.getData({ ticketId });

      // Remove preview optimistically
      utils.preview.list.setData({ ticketId }, (old) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.filter((item) => item.id !== id),
        };
      });

      return { previousPreviews };
    },
    onError: (err, variables, context) => {
      if (context?.previousPreviews) {
        utils.preview.list.setData({ ticketId }, context.previousPreviews);
      }
    },
    onSettled: () => {
      utils.preview.list.invalidate({ ticketId });
    },
  });

  // Subscribe to real-time updates
  const subscription = usePreviewSubscription({
    ticketId,
    enabled: !!ticketId,
  });

  return {
    previews: previewList.data?.items || [],
    isLoading: previewList.isLoading,
    error: previewList.error,
    generatePreview,
    deletePreview,
    refetch: previewList.refetch,
    isConnected: subscription.isConnected,
  };
}