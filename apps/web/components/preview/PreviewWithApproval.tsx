'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ApprovalPanel } from '../approval/ApprovalPanel';
import { ChangeEditor } from '../approval/ChangeEditor';
import { ArrowRight, CheckCircle, XCircle, Clock, Edit } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { useApprovalNotifications } from '@/hooks/useApprovalNotifications';
import { useApprovalStore } from '@/stores/approvalStore';
import type { Preview, PreviewItem, Ticket } from '@agentris/db';

interface PreviewWithApprovalProps {
  preview: Preview & {
    items: PreviewItem[];
    ticket?: Ticket | null;
  };
  onNavigateToApprovals?: () => void;
}

export function PreviewWithApproval({ 
  preview, 
  onNavigateToApprovals 
}: PreviewWithApprovalProps) {
  const [activeTab, setActiveTab] = useState('preview');
  const [editingItem, setEditingItem] = useState<PreviewItem | null>(null);
  
  const {
    notifyApprovalSuccess,
    notifyRejectionSuccess,
    notifyModificationSuccess,
    notifyBulkApprovalSuccess,
    notifyError,
  } = useApprovalNotifications(preview.id);

  const { optimisticApprove, optimisticReject, revertOptimisticUpdate } = useApprovalStore();

  // Fetch approval status for this preview
  const { data: approvals, refetch: refetchApprovals } = trpc.approval.getPreviewApprovals.useQuery({
    previewId: preview.id,
  });

  // Mutations
  const approveMutation = trpc.approval.approveItems.useMutation({
    onMutate: ({ itemIds }) => {
      optimisticApprove(itemIds);
    },
    onSuccess: (_, { itemIds }) => {
      notifyApprovalSuccess(itemIds.length);
      refetchApprovals();
    },
    onError: (error, { itemIds }) => {
      revertOptimisticUpdate(itemIds);
      notifyError('Failed to approve changes', error);
    },
  });

  const rejectMutation = trpc.approval.rejectItems.useMutation({
    onMutate: ({ itemIds }) => {
      optimisticReject(itemIds);
    },
    onSuccess: (_, { itemIds }) => {
      notifyRejectionSuccess(itemIds.length);
      refetchApprovals();
    },
    onError: (error, { itemIds }) => {
      revertOptimisticUpdate(itemIds);
      notifyError('Failed to reject changes', error);
    },
  });

  const modifyMutation = trpc.approval.modifyItem.useMutation({
    onSuccess: () => {
      notifyModificationSuccess(editingItem?.name || 'item');
      setEditingItem(null);
      refetchApprovals();
    },
    onError: (error) => {
      notifyError('Failed to modify change', error);
    },
  });

  const bulkApproveMutation = trpc.approval.bulkApprove.useMutation({
    onSuccess: (data, { pattern }) => {
      const patternStr = pattern.itemType || pattern.impact || 'selected';
      notifyBulkApprovalSuccess(data.itemCount, patternStr);
      refetchApprovals();
    },
    onError: (error) => {
      notifyError('Failed to bulk approve', error);
    },
  });

  // Handlers
  const handleApprove = useCallback(async (itemIds: string[], comments?: string) => {
    await approveMutation.mutateAsync({
      previewId: preview.id,
      itemIds,
      comments,
    });
  }, [preview.id, approveMutation]);

  const handleReject = useCallback(async (itemIds: string[], reason: string) => {
    await rejectMutation.mutateAsync({
      previewId: preview.id,
      itemIds,
      reason,
    });
  }, [preview.id, rejectMutation]);

  const handleModify = useCallback(async (itemId: string, modifiedData: any) => {
    await modifyMutation.mutateAsync({
      itemId,
      modifiedData,
    });
  }, [modifyMutation]);

  const handleBulkApprove = useCallback(async (
    pattern: { itemType?: string; impact?: string },
    comments?: string
  ) => {
    await bulkApproveMutation.mutateAsync({
      previewId: preview.id,
      pattern,
      comments,
    });
  }, [preview.id, bulkApproveMutation]);

  const handleSaveEdit = useCallback((itemId: string, modifiedData: any) => {
    handleModify(itemId, modifiedData);
  }, [handleModify]);

  // Calculate approval stats
  const totalItems = preview.items.length;
  const approvedCount = approvals?.reduce((acc, a) => 
    acc + (a.status === 'APPROVED' ? a.items?.length || 0 : 0), 0
  ) || 0;
  const rejectedCount = approvals?.reduce((acc, a) => 
    acc + (a.status === 'REJECTED' ? a.items?.length || 0 : 0), 0
  ) || 0;
  const pendingCount = totalItems - approvedCount - rejectedCount;

  const approvalPercentage = totalItems > 0 
    ? Math.round((approvedCount / totalItems) * 100) 
    : 0;

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Preview & Approval</CardTitle>
            <CardDescription>
              {preview.ticket?.summary || `Preview ${preview.id}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="gap-1">
                <Clock className="w-3 h-3" />
                {pendingCount} Pending
              </Badge>
              <Badge variant="default" className="gap-1">
                <CheckCircle className="w-3 h-3" />
                {approvedCount} Approved
              </Badge>
              {rejectedCount > 0 && (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="w-3 h-3" />
                  {rejectedCount} Rejected
                </Badge>
              )}
            </div>
            {onNavigateToApprovals && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={onNavigateToApprovals}
                className="gap-2"
              >
                Full Approval View
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="preview">Preview Details</TabsTrigger>
            <TabsTrigger value="approval">Approval Workflow</TabsTrigger>
          </TabsList>

          <TabsContent value="preview" className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Approval Progress</span>
                <span className="font-medium">{approvalPercentage}%</span>
              </div>
              <div className="w-full bg-secondary rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${approvalPercentage}%` }}
                />
              </div>
            </div>

            {/* Item Summary by Type */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Changes by Type</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(
                  preview.items.reduce((acc, item) => {
                    acc[item.itemType] = (acc[item.itemType] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([type, count]) => (
                  <div 
                    key={type}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <span className="text-sm">{type.replace(/_/g, ' ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>

            {/* Impact Summary */}
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Impact Analysis</h3>
              <div className="flex items-center gap-4">
                {(['LOW', 'MEDIUM', 'HIGH'] as const).map(impact => {
                  const count = preview.items.filter(i => i.impact === impact).length;
                  if (count === 0) return null;
                  
                  return (
                    <div key={impact} className="flex items-center gap-2">
                      <Badge 
                        variant="outline"
                        className={
                          impact === 'HIGH' 
                            ? 'border-red-500 text-red-700' 
                            : impact === 'MEDIUM'
                            ? 'border-yellow-500 text-yellow-700'
                            : 'border-green-500 text-green-700'
                        }
                      >
                        {impact}
                      </Badge>
                      <span className="text-sm text-muted-foreground">{count} items</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 pt-4">
              <Button
                variant="default"
                size="sm"
                onClick={() => setActiveTab('approval')}
                disabled={pendingCount === 0}
              >
                Review Pending Items ({pendingCount})
              </Button>
              {approvedCount === totalItems && (
                <Badge variant="default" className="gap-1 px-3 py-1">
                  <CheckCircle className="w-4 h-4" />
                  All Changes Approved
                </Badge>
              )}
            </div>
          </TabsContent>

          <TabsContent value="approval">
            <ApprovalPanel
              previewId={preview.id}
              items={preview.items}
              approvals={approvals || []}
              onApprove={handleApprove}
              onReject={handleReject}
              onModify={(itemId) => {
                const item = preview.items.find(i => i.id === itemId);
                if (item) {
                  setEditingItem(item);
                }
              }}
              onBulkApprove={handleBulkApprove}
            />
          </TabsContent>
        </Tabs>

        <ChangeEditor
          item={editingItem}
          open={!!editingItem}
          onClose={() => setEditingItem(null)}
          onSave={handleSaveEdit}
        />
      </CardContent>
    </Card>
  );
}