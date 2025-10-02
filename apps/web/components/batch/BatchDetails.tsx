'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  Eye, 
  UserCheck, 
  RefreshCw,
  Package,
  FileText,
  Grid3x3,
  List
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface BatchDetailsProps {
  batchId: string;
}

export function BatchDetails({ batchId }: BatchDetailsProps) {
  const [previewFormat, setPreviewFormat] = useState<'TABLE' | 'TEXT' | 'DIAGRAM'>('TABLE');
  const [approvalComments, setApprovalComments] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);
  const [showRejectionDialog, setShowRejectionDialog] = useState(false);

  const { data: batchStatus, isLoading, refetch } = trpc.batch.getBatchStatus.useQuery({
    batchId,
  });

  const { data: preview, isLoading: previewLoading } = trpc.batch.generateBatchPreview.useQuery({
    batchId,
    format: previewFormat,
    includeDetails: true,
    includeRisks: true,
  });

  const approveMutation = trpc.batch.approveBatch.useMutation({
    onSuccess: () => {
      setShowApprovalDialog(false);
      setApprovalComments('');
      refetch();
    },
  });

  const rejectMutation = trpc.batch.rejectBatch.useMutation({
    onSuccess: () => {
      setShowRejectionDialog(false);
      setRejectionReason('');
      refetch();
    },
  });

  const excludeMutation = trpc.batch.excludeFromBatch.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const includeMutation = trpc.batch.includeInBatch.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const rollbackMutation = trpc.batch.rollbackBatch.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading batch details...</div>
      </div>
    );
  }

  if (!batchStatus?.data) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>Failed to load batch details</AlertDescription>
      </Alert>
    );
  }

  const { batch, tickets, approval, sync } = batchStatus.data;
  const canApprove = batch.status === 'PENDING' && !approval?.isApproved;
  const canRollback = batch.status === 'FAILED' || batch.status === 'PARTIALLY_COMPLETED';

  const statusConfig = {
    PENDING: { icon: Clock, color: 'bg-yellow-100 text-yellow-800' },
    APPROVED: { icon: UserCheck, color: 'bg-green-100 text-green-800' },
    PROCESSING: { icon: RefreshCw, color: 'bg-blue-100 text-blue-800' },
    COMPLETED: { icon: CheckCircle, color: 'bg-green-100 text-green-800' },
    PARTIALLY_COMPLETED: { icon: AlertTriangle, color: 'bg-orange-100 text-orange-800' },
    FAILED: { icon: XCircle, color: 'bg-red-100 text-red-800' },
  };

  const config = statusConfig[batch.status as keyof typeof statusConfig];
  const StatusIcon = config.icon;

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">{batch.name}</CardTitle>
              <CardDescription>
                Created {formatDistanceToNow(new Date(batch.createdAt))} ago
              </CardDescription>
            </div>
            <Badge className={config.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {batch.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">{tickets.total}</div>
              <div className="text-sm text-muted-foreground">Total Tickets</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{tickets.active}</div>
              <div className="text-sm text-muted-foreground">Active</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{tickets.excluded}</div>
              <div className="text-sm text-muted-foreground">Excluded</div>
            </div>
          </div>

          {canApprove && (
            <div className="flex gap-2 mt-6">
              <Button 
                className="flex-1"
                onClick={() => setShowApprovalDialog(true)}
              >
                <UserCheck className="mr-2 h-4 w-4" />
                Approve Batch
              </Button>
              <Button 
                variant="destructive"
                className="flex-1"
                onClick={() => setShowRejectionDialog(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject Batch
              </Button>
            </div>
          )}

          {canRollback && (
            <Button 
              variant="outline"
              className="w-full mt-6"
              onClick={() => {
                if (confirm('Are you sure you want to rollback this batch?')) {
                  rollbackMutation.mutate({
                    batchId,
                    reason: 'Manual rollback requested',
                  });
                }
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Rollback Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="preview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="preview">Preview</TabsTrigger>
          <TabsTrigger value="tickets">Tickets</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
          <TabsTrigger value="approval">Approval</TabsTrigger>
        </TabsList>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Batch Preview</CardTitle>
                <div className="flex gap-2">
                  <Button
                    variant={previewFormat === 'TABLE' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewFormat('TABLE')}
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewFormat === 'TEXT' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewFormat('TEXT')}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={previewFormat === 'DIAGRAM' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPreviewFormat('DIAGRAM')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {previewLoading ? (
                <div className="animate-pulse h-64 bg-gray-100 rounded" />
              ) : preview?.data ? (
                <div className="space-y-4">
                  <ScrollArea className="h-96 w-full border rounded p-4">
                    <pre className="whitespace-pre-wrap font-mono text-sm">
                      {preview.data.content}
                    </pre>
                  </ScrollArea>
                  
                  {preview.data.summary && (
                    <Alert>
                      <AlertTitle>Summary</AlertTitle>
                      <AlertDescription>
                        {JSON.stringify(preview.data.summary, null, 2)}
                      </AlertDescription>
                    </Alert>
                  )}

                  {preview.data.risks && preview.data.risks.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Risks Identified</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside mt-2">
                          {preview.data.risks.map((risk: any, idx: number) => (
                            <li key={idx}>{risk.description} (Severity: {risk.severity})</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertDescription>No preview available</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tickets">
          <Card>
            <CardHeader>
              <CardTitle>Batch Tickets</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center text-muted-foreground py-8">
                Ticket management interface would be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync">
          <Card>
            <CardHeader>
              <CardTitle>Jira Sync Status</CardTitle>
            </CardHeader>
            <CardContent>
              {sync && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Total Tickets</Label>
                      <div className="text-2xl font-bold">{sync.totalTickets}</div>
                    </div>
                    <div>
                      <Label>Processed</Label>
                      <div className="text-2xl font-bold">{sync.processedTickets}</div>
                    </div>
                  </div>
                  {sync.lastSyncAt && (
                    <Alert>
                      <AlertDescription>
                        Last synced {formatDistanceToNow(new Date(sync.lastSyncAt))} ago
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approval">
          <Card>
            <CardHeader>
              <CardTitle>Approval Status</CardTitle>
            </CardHeader>
            <CardContent>
              {approval && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    {approval.isApproved ? (
                      <>
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        <span>Batch has been approved</span>
                      </>
                    ) : approval.isPending ? (
                      <>
                        <Clock className="h-5 w-5 text-yellow-500" />
                        <span>Approval pending</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="h-5 w-5 text-red-500" />
                        <span>Not approved</span>
                      </>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approval Dialog */}
      {showApprovalDialog && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Approve Batch</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="comments">Comments (Optional)</Label>
                <Textarea
                  id="comments"
                  value={approvalComments}
                  onChange={(e) => setApprovalComments(e.target.value)}
                  placeholder="Add any comments about this approval..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    approveMutation.mutate({
                      batchId,
                      comments: approvalComments || undefined,
                    });
                  }}
                  disabled={approveMutation.isPending}
                >
                  Confirm Approval
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowApprovalDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Rejection Dialog */}
      {showRejectionDialog && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Reject Batch</h3>
            <div className="space-y-4">
              <div>
                <Label htmlFor="reason">Reason for Rejection</Label>
                <Textarea
                  id="reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a reason for rejecting this batch..."
                  rows={4}
                  required
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => {
                    if (rejectionReason.trim()) {
                      rejectMutation.mutate({
                        batchId,
                        reason: rejectionReason,
                      });
                    }
                  }}
                  disabled={!rejectionReason.trim() || rejectMutation.isPending}
                >
                  Confirm Rejection
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowRejectionDialog(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}