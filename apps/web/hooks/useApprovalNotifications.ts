import { useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/trpc/client';
import { useApprovalStore } from '@/stores/approvalStore';

export function useApprovalNotifications(previewId?: string) {
  const { handleRealtimeUpdate } = useApprovalStore();

  // Subscribe to real-time approval updates
  trpc.approval.onApprovalUpdate.useSubscription(
    { previewId },
    {
      onData: (update) => {
        // Update store with real-time data
        handleRealtimeUpdate({
          type: update.type,
          itemIds: update.itemIds || [],
          userId: update.userId,
        });

        // Show notification based on update type
        switch (update.type) {
          case 'APPROVED':
            toast.success(`${update.itemCount} item(s) approved`, {
              description: `Approved by ${update.userId}`,
            });
            break;
          case 'REJECTED':
            toast.error(`${update.itemCount} item(s) rejected`, {
              description: `Rejected by ${update.userId}`,
            });
            break;
          case 'MODIFIED':
            toast.info(`${update.itemCount} item(s) modified`, {
              description: `Modified by ${update.userId}`,
            });
            break;
        }
      },
      onError: (err) => {
        console.error('Subscription error:', err);
        toast.error('Connection lost', {
          description: 'Real-time updates may be delayed',
        });
      },
    }
  );

  // Notification helpers
  const notifyApprovalSuccess = (count: number) => {
    toast.success(`Successfully approved ${count} item(s)`, {
      duration: 4000,
      action: {
        label: 'Undo',
        onClick: () => {
          // Implement undo logic if needed
          toast.info('Undo not yet implemented');
        },
      },
    });
  };

  const notifyRejectionSuccess = (count: number) => {
    toast.success(`Successfully rejected ${count} item(s)`, {
      duration: 4000,
    });
  };

  const notifyModificationSuccess = (itemName: string) => {
    toast.success(`Successfully modified ${itemName}`, {
      duration: 4000,
    });
  };

  const notifyBulkApprovalSuccess = (count: number, pattern: string) => {
    toast.success(`Bulk approved ${count} items`, {
      description: `Pattern: ${pattern}`,
      duration: 5000,
    });
  };

  const notifyError = (message: string, error?: any) => {
    toast.error(message, {
      description: error?.message || 'Please try again',
      duration: 5000,
    });
  };

  const notifyWarning = (message: string) => {
    toast.warning(message, {
      duration: 4000,
    });
  };

  const notifyInfo = (message: string, description?: string) => {
    toast.info(message, {
      description,
      duration: 3000,
    });
  };

  // Keyboard shortcut notifications
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Show help on pressing '?'
      if (e.key === '?' && !e.target || 
          (e.target instanceof HTMLElement && 
           !['INPUT', 'TEXTAREA'].includes(e.target.tagName))) {
        e.preventDefault();
        toast.info('Keyboard Shortcuts', {
          description: 'A: Approve | R: Reject | M: Modify | Esc: Clear selection',
          duration: 5000,
        });
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return {
    notifyApprovalSuccess,
    notifyRejectionSuccess,
    notifyModificationSuccess,
    notifyBulkApprovalSuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };
}