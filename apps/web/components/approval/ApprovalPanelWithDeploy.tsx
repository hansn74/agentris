'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ApprovalItem } from './ApprovalItem';
import { ApprovalActions } from './ApprovalActions';
import { BulkActions } from './BulkActions';
import { CommentDialog } from './CommentDialog';
import { ApprovalHistory } from './ApprovalHistory';
import { DeploymentPanel } from '../deployment/DeploymentPanel';
import { CheckCircle, Rocket, Package } from 'lucide-react';
import type { PreviewItem, Approval, ApprovalItem as ApprovalItemType } from '@agentris/db';

interface ApprovalPanelWithDeployProps {
  previewId: string;
  items: PreviewItem[];
  approvals?: Approval[];
  currentApproval?: Approval & { items: ApprovalItemType[] };
  onApprove: (itemIds: string[], comments?: string) => Promise<void>;
  onReject: (itemIds: string[], reason: string) => Promise<void>;
  onModify: (itemId: string, modifiedData: any) => Promise<void>;
  onBulkApprove: (pattern: { itemType?: string; impact?: string }, comments?: string) => Promise<void>;
}

export function ApprovalPanelWithDeploy({
  previewId,
  items,
  approvals = [],
  currentApproval,
  onApprove,
  onReject,
  onModify,
  onBulkApprove,
}: ApprovalPanelWithDeployProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('pending');
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [showDeploymentPanel, setShowDeploymentPanel] = useState(false);

  const pendingItems = useMemo(() => {
    const approvedItemIds = new Set(
      approvals.flatMap(a => a.items?.map(i => i.previewItemId) || [])
    );
    return items.filter(item => !approvedItemIds.has(item.id));
  }, [items, approvals]);

  const approvedItems = useMemo(() => {
    if (!currentApproval?.items) return [];
    
    return currentApproval.items
      .filter(item => item.status === 'APPROVED' || item.status === 'MODIFIED')
      .map(item => {
        const previewItem = items.find(pi => pi.id === item.previewItemId);
        return {
          id: item.id,
          name: previewItem?.name || 'Unknown',
          type: previewItem?.itemType || 'Unknown',
          status: item.status,
        };
      });
  }, [currentApproval, items]);

  const hasApprovedItems = approvedItems.length > 0;
  const allItemsProcessed = pendingItems.length === 0 && items.length > 0;
  const isApprovalComplete = currentApproval?.status === 'APPROVED';

  const handleSelectItem = (itemId: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedItems.size === pendingItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(pendingItems.map(item => item.id)));
    }
  };

  const handleApprove = async (comments?: string) => {
    if (selectedItems.size === 0) return;
    await onApprove(Array.from(selectedItems), comments);
    setSelectedItems(new Set());
    setShowCommentDialog(false);
    setPendingAction(null);
  };

  const handleReject = async (reason: string) => {
    if (selectedItems.size === 0) return;
    await onReject(Array.from(selectedItems), reason);
    setSelectedItems(new Set());
    setShowCommentDialog(false);
    setPendingAction(null);
  };

  const handleActionClick = (action: 'approve' | 'reject') => {
    setPendingAction(action);
    setShowCommentDialog(true);
  };

  const handleCommentSubmit = async (text: string) => {
    if (pendingAction === 'approve') {
      await handleApprove(text);
    } else if (pendingAction === 'reject') {
      await handleReject(text);
    }
  };

  const groupedItems = useMemo(() => {
    const groups: Record<string, PreviewItem[]> = {};
    pendingItems.forEach(item => {
      if (!groups[item.itemType]) {
        groups[item.itemType] = [];
      }
      groups[item.itemType].push(item);
    });
    return groups;
  }, [pendingItems]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Approval Workflow</CardTitle>
              <CardDescription>
                Review and approve changes before deployment
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {allItemsProcessed && (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  All items reviewed
                </Badge>
              )}
              {hasApprovedItems && isApprovalComplete && (
                <Button
                  onClick={() => setShowDeploymentPanel(!showDeploymentPanel)}
                  variant={showDeploymentPanel ? "secondary" : "default"}
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  {showDeploymentPanel ? 'Hide Deployment' : 'Deploy Changes'}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Pending ({pendingItems.length})
              </TabsTrigger>
              <TabsTrigger value="approved" className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Approved ({approvedItems.length})
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                  <p>All items have been reviewed!</p>
                  {hasApprovedItems && (
                    <p className="mt-2">You can now deploy the approved changes.</p>
                  )}
                </div>
              ) : (
                <>
                  <ApprovalActions
                    selectedCount={selectedItems.size}
                    totalCount={pendingItems.length}
                    onSelectAll={handleSelectAll}
                    onApprove={() => handleActionClick('approve')}
                    onReject={() => handleActionClick('reject')}
                  />

                  <BulkActions onBulkApprove={onBulkApprove} items={pendingItems} />

                  <div className="space-y-4">
                    {Object.entries(groupedItems).map(([itemType, typeItems]) => (
                      <div key={itemType}>
                        <h3 className="text-sm font-medium mb-2">
                          {itemType} ({typeItems.length})
                        </h3>
                        <div className="space-y-2">
                          {typeItems.map(item => (
                            <ApprovalItem
                              key={item.id}
                              item={item}
                              isSelected={selectedItems.has(item.id)}
                              onSelect={handleSelectItem}
                              onModify={onModify}
                              onApprove={(id) => onApprove([id])}
                              onReject={(id, reason) => onReject([id], reason)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="approved" className="space-y-4">
              {approvedItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No approved items yet
                </div>
              ) : (
                <div className="space-y-2">
                  {approvedItems.map(item => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-3 border rounded-lg bg-green-50 dark:bg-green-900/10"
                    >
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="font-mono text-sm">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.type}</Badge>
                        <Badge variant="success">
                          {item.status === 'MODIFIED' ? 'Modified & Approved' : 'Approved'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="history">
              <ApprovalHistory approvals={approvals} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Deployment Panel - Show when ready */}
      {showDeploymentPanel && hasApprovedItems && currentApproval && (
        <div className="mt-4">
          <DeploymentPanel
            approvalId={currentApproval.id}
            approvedItems={approvedItems}
          />
        </div>
      )}

      {/* Comment Dialog */}
      <CommentDialog
        open={showCommentDialog}
        onClose={() => {
          setShowCommentDialog(false);
          setPendingAction(null);
        }}
        onSubmit={handleCommentSubmit}
        title={pendingAction === 'approve' ? 'Approve Changes' : 'Reject Changes'}
        description={
          pendingAction === 'approve'
            ? 'Add optional comments for the approval'
            : 'Please provide a reason for rejection'
        }
        placeholder={
          pendingAction === 'approve'
            ? 'Optional comments...'
            : 'Reason for rejection...'
        }
        required={pendingAction === 'reject'}
      />
    </>
  );
}