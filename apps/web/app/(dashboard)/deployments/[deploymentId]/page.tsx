'use client';

import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeploymentStatus } from '@/components/deployment/DeploymentStatus';
import { DeploymentLogs } from '@/components/deployment/DeploymentLogs';
import { DeploymentNotification } from '@/components/deployment/DeploymentNotification';
import { trpc } from '@/lib/trpc';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const deploymentId = params.deploymentId as string;

  // Get deployment details
  const { data: deployment, isLoading, error } = trpc.deployment.getDeploymentStatusQuery.useQuery(
    { deploymentId },
    { enabled: !!deploymentId }
  );

  // Get rollback history
  const { data: rollbackHistory } = trpc.deployment.getRollbackHistory.useQuery(
    { deploymentId },
    { enabled: !!deploymentId }
  );

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error || !deployment) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            {error?.message || 'Deployment not found'}
          </AlertDescription>
        </Alert>
        <Button
          variant="outline"
          onClick={() => router.push('/dashboard/deployments')}
          className="mt-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Deployments
        </Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/deployments')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Deployment Details</h1>
            <p className="text-muted-foreground">
              Monitoring deployment {deploymentId}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Deployment Status Card */}
      <DeploymentStatus deploymentId={deploymentId} />

      {/* Tabs for Logs and Rollback History */}
      <Tabs defaultValue="logs" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="logs">Deployment Logs</TabsTrigger>
          <TabsTrigger value="rollbacks">
            Rollback History {rollbackHistory?.count ? `(${rollbackHistory.count})` : ''}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="mt-4">
          <DeploymentLogs deploymentId={deploymentId} />
        </TabsContent>

        <TabsContent value="rollbacks" className="mt-4 space-y-4">
          {rollbackHistory?.rollbacks && rollbackHistory.rollbacks.length > 0 ? (
            rollbackHistory.rollbacks.map((rollback) => (
              <div
                key={rollback.id}
                className="p-4 border rounded-lg space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Rollback {rollback.id}</p>
                    <p className="text-sm text-muted-foreground">
                      Initiated by {rollback.user.name || rollback.user.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      {new Date(rollback.createdAt).toLocaleString()}
                    </span>
                    <Badge
                      variant={
                        rollback.status === 'COMPLETED'
                          ? 'success'
                          : rollback.status === 'FAILED'
                          ? 'destructive'
                          : rollback.status === 'IN_PROGRESS'
                          ? 'default'
                          : 'secondary'
                      }
                    >
                      {rollback.status}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm">{rollback.reason}</p>
                {rollback.error && (
                  <Alert variant="destructive">
                    <AlertDescription>{rollback.error}</AlertDescription>
                  </Alert>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No rollback history for this deployment
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Real-time notifications */}
      <DeploymentNotification deploymentId={deploymentId} />
    </div>
  );
}