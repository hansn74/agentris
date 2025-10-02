'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Alert, AlertDescription } from '../ui/alert';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Loader2, 
  RotateCcw,
  Clock,
  Package
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';
import { RollbackDialog } from './RollbackDialog';

interface DeploymentStatusProps {
  deploymentId: string;
}

export function DeploymentStatus({ deploymentId }: DeploymentStatusProps) {
  const [showRollbackDialog, setShowRollbackDialog] = useState(false);
  const [deploymentStatus, setDeploymentStatus] = useState<any>(null);
  
  // Get initial deployment status
  const { data: initialStatus, isLoading } = trpc.deployment.getDeploymentStatusQuery.useQuery(
    { deploymentId },
    { enabled: !!deploymentId }
  );

  // Subscribe to real-time updates
  trpc.deployment.getDeploymentStatus.useSubscription(
    { deploymentId },
    {
      enabled: !!deploymentId && initialStatus?.status === 'IN_PROGRESS',
      onData: (event) => {
        console.log('Deployment update:', event);
        
        if (event.type === 'status_update' || event.type === 'progress') {
          setDeploymentStatus(event.data);
        } else if (event.type === 'completed' || event.type === 'failed') {
          setDeploymentStatus(event.data);
        }
      },
      onError: (error) => {
        console.error('Subscription error:', error);
      },
    }
  );

  // Check if can rollback
  const { data: canRollback } = trpc.deployment.canRollback.useQuery(
    { deploymentId },
    { enabled: !!deploymentId }
  );

  useEffect(() => {
    if (initialStatus) {
      setDeploymentStatus(initialStatus);
    }
  }, [initialStatus]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'IN_PROGRESS':
      case 'DEPLOYING':
        return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
      case 'PENDING':
        return <Clock className="h-5 w-5 text-gray-500" />;
      case 'PARTIAL_SUCCESS':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <Package className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'SUCCEEDED': 'success',
      'FAILED': 'destructive',
      'IN_PROGRESS': 'default',
      'DEPLOYING': 'default',
      'PENDING': 'secondary',
      'PARTIAL_SUCCESS': 'warning',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const calculateProgress = () => {
    if (!deploymentStatus?.metadata?.progress) return 0;
    
    const { deployed, total } = deploymentStatus.metadata.progress;
    if (total === 0) return 0;
    
    return Math.round((deployed / total) * 100);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  if (!deploymentStatus) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No deployment status available.
        </AlertDescription>
      </Alert>
    );
  }

  const isInProgress = ['IN_PROGRESS', 'DEPLOYING', 'PENDING'].includes(deploymentStatus.status);
  const hasCompleted = ['SUCCEEDED', 'FAILED', 'PARTIAL_SUCCESS'].includes(deploymentStatus.status);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon(deploymentStatus.status)}
              <div>
                <CardTitle>Deployment Status</CardTitle>
                <CardDescription>
                  ID: {deploymentId}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge(deploymentStatus.status)}
              {canRollback?.canRollback && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRollbackDialog(true)}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Rollback
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Progress Bar */}
          {isInProgress && deploymentStatus.metadata?.progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Deployment Progress</span>
                <span>
                  {deploymentStatus.metadata.progress.deployed} / {deploymentStatus.metadata.progress.total} components
                </span>
              </div>
              <Progress value={calculateProgress()} className="h-2" />
              {deploymentStatus.metadata.progress.errors > 0 && (
                <p className="text-sm text-red-500">
                  {deploymentStatus.metadata.progress.errors} error(s) encountered
                </p>
              )}
            </div>
          )}

          {/* Test Progress */}
          {isInProgress && deploymentStatus.metadata?.testsProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Test Execution</span>
                <span>
                  {deploymentStatus.metadata.testsProgress.completed} / {deploymentStatus.metadata.testsProgress.total} tests
                </span>
              </div>
              <Progress 
                value={(deploymentStatus.metadata.testsProgress.completed / deploymentStatus.metadata.testsProgress.total) * 100} 
                className="h-2" 
              />
            </div>
          )}

          {/* Deployment Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Started</p>
              <p className="font-medium">
                {deploymentStatus.createdAt 
                  ? format(new Date(deploymentStatus.createdAt), 'PPp')
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Updated</p>
              <p className="font-medium">
                {deploymentStatus.updatedAt 
                  ? format(new Date(deploymentStatus.updatedAt), 'PPp')
                  : 'N/A'}
              </p>
            </div>
          </div>

          {/* Metadata Info */}
          {deploymentStatus.metadata?.itemCount && (
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="font-medium">{deploymentStatus.metadata.itemCount}</p>
            </div>
          )}

          {/* Error Message */}
          {deploymentStatus.status === 'FAILED' && deploymentStatus.metadata?.error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {deploymentStatus.metadata.error}
              </AlertDescription>
            </Alert>
          )}

          {/* Success Message */}
          {deploymentStatus.status === 'SUCCEEDED' && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>
                Deployment completed successfully. All components have been deployed.
              </AlertDescription>
            </Alert>
          )}

          {/* Partial Success Message */}
          {deploymentStatus.status === 'PARTIAL_SUCCESS' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Deployment partially succeeded. Some components may have failed to deploy.
              </AlertDescription>
            </Alert>
          )}

          {/* Rollback Info */}
          {deploymentStatus.rollbacks && deploymentStatus.rollbacks.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Rollback History</p>
              <div className="rounded-lg border p-2 space-y-1">
                {deploymentStatus.rollbacks.map((rollback: any) => (
                  <div key={rollback.id} className="flex items-center justify-between text-sm">
                    <span>{rollback.reason}</span>
                    <Badge variant="outline">{rollback.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rollback Dialog */}
      {showRollbackDialog && (
        <RollbackDialog
          deploymentId={deploymentId}
          open={showRollbackDialog}
          onClose={() => setShowRollbackDialog(false)}
        />
      )}
    </>
  );
}