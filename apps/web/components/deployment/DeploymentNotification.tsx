'use client';

import { useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';

interface DeploymentNotificationProps {
  deploymentId: string;
}

export function DeploymentNotification({ deploymentId }: DeploymentNotificationProps) {
  // Subscribe to deployment updates for notifications
  trpc.deployment.getDeploymentStatus.useSubscription(
    { deploymentId },
    {
      enabled: !!deploymentId,
      onData: (event) => {
        switch (event.type) {
          case 'status_update':
            if (event.data.status === 'IN_PROGRESS') {
              toast.info('Deployment Started', {
                description: `Deployment ${deploymentId} is now in progress.`,
                icon: <Loader2 className="h-4 w-4 animate-spin" />,
              });
            }
            break;
            
          case 'progress':
            // Only show progress notifications for significant milestones
            if (event.data.progress) {
              const { deployed, total } = event.data.progress;
              const percentage = Math.round((deployed / total) * 100);
              
              if (percentage === 25 || percentage === 50 || percentage === 75) {
                toast.info('Deployment Progress', {
                  description: `${percentage}% complete (${deployed}/${total} components)`,
                  icon: <Loader2 className="h-4 w-4 animate-spin" />,
                });
              }
            }
            break;
            
          case 'completed':
            if (event.data.status === 'SUCCEEDED') {
              toast.success('Deployment Successful', {
                description: 'All components have been deployed successfully.',
                icon: <CheckCircle2 className="h-4 w-4" />,
                duration: 5000,
              });
            } else if (event.data.status === 'PARTIAL_SUCCESS') {
              toast.warning('Deployment Partially Succeeded', {
                description: 'Some components may have failed to deploy.',
                icon: <AlertCircle className="h-4 w-4" />,
                duration: 5000,
              });
            }
            break;
            
          case 'failed':
            toast.error('Deployment Failed', {
              description: event.data.error || 'The deployment encountered an error.',
              icon: <XCircle className="h-4 w-4" />,
              duration: 10000,
              action: {
                label: 'View Details',
                onClick: () => {
                  window.location.href = `/dashboard/deployments/${deploymentId}`;
                },
              },
            });
            break;
            
          case 'log':
            // Only show error logs as notifications
            if (event.data.level === 'ERROR') {
              toast.error('Deployment Error', {
                description: event.data.message,
                duration: 5000,
              });
            }
            break;
        }
      },
      onError: (error) => {
        console.error('Notification subscription error:', error);
      },
    }
  );

  return null; // This component doesn't render anything visible
}

// Utility function to show manual deployment notifications
export function showDeploymentNotification(
  type: 'info' | 'success' | 'warning' | 'error',
  title: string,
  description?: string,
  options?: any
) {
  const icons = {
    info: <Loader2 className="h-4 w-4 animate-spin" />,
    success: <CheckCircle2 className="h-4 w-4" />,
    warning: <AlertCircle className="h-4 w-4" />,
    error: <XCircle className="h-4 w-4" />,
  };

  toast[type](title, {
    description,
    icon: icons[type],
    ...options,
  });
}