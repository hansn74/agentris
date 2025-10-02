'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PreviewPanel } from '@/components/preview/PreviewPanel';
import { ImpactLegend } from '@/components/preview/ImpactIndicator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { trpc } from '@/lib/trpc';
import type { DiffRepresentation } from '@agentris/services';

export default function PreviewPage() {
  const searchParams = useSearchParams();
  const ticketId = searchParams.get('ticketId');
  const runId = searchParams.get('runId');
  
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [diffData, setDiffData] = useState<DiffRepresentation | null>(null);

  // Generate preview mutation
  const generatePreview = trpc.changePreview.generatePreview.useMutation({
    onSuccess: (data) => {
      setPreviewId(data.id);
    }
  });

  // Get comparison query
  const comparison = trpc.changePreview.getComparison.useQuery(
    { previewId: previewId! },
    { 
      enabled: !!previewId,
      refetchInterval: 5000 // Poll every 5 seconds for updates
    }
  );

  // Subscribe to real-time updates (if WebSocket is configured)
  const subscription = trpc.changePreview.subscribeToPreviewUpdates.useSubscription(
    { previewId: previewId! },
    {
      enabled: !!previewId,
      onData: (data) => {
        if (data.diffData) {
          setDiffData(data.diffData);
        }
      }
    }
  );

  useEffect(() => {
    if (ticketId) {
      generatePreview.mutate({ ticketId, runId: runId || undefined });
    }
  }, [ticketId, runId]);

  useEffect(() => {
    if (comparison.data) {
      setDiffData(comparison.data);
    }
  }, [comparison.data]);

  const handleRefresh = () => {
    if (ticketId) {
      generatePreview.mutate({ ticketId, runId: runId || undefined });
    }
  };

  if (!ticketId) {
    return (
      <div className="container mx-auto py-8">
        <Alert>
          <AlertDescription>
            No ticket selected. Please select a ticket to preview changes.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (generatePreview.isLoading || comparison.isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (generatePreview.error || comparison.error) {
    const error = generatePreview.error || comparison.error;
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load preview: {error?.message || 'Unknown error'}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Change Preview</h1>
          <p className="text-muted-foreground mt-2">
            Review metadata changes before applying them to Salesforce
          </p>
        </div>
        <ImpactLegend />
      </div>

      <PreviewPanel
        previewId={previewId || undefined}
        diffData={diffData || undefined}
        showComparison={true}
        onRefresh={handleRefresh}
      />

      {/* Additional Information */}
      <Card>
        <CardHeader>
          <CardTitle>Preview Information</CardTitle>
          <CardDescription>
            Details about this preview session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Ticket ID</p>
              <p className="font-medium">{ticketId}</p>
            </div>
            {runId && (
              <div>
                <p className="text-muted-foreground">Run ID</p>
                <p className="font-medium">{runId}</p>
              </div>
            )}
            {previewId && (
              <div>
                <p className="text-muted-foreground">Preview ID</p>
                <p className="font-medium font-mono text-xs">{previewId}</p>
              </div>
            )}
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="font-medium">
                {subscription.status === 'connected' ? 'Live Updates' : 'Polling'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}