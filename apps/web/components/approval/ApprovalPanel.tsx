'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ApprovalItem } from './ApprovalItem';
import { ApprovalActions } from './ApprovalActions';
import { BulkActions } from './BulkActions';
import { CommentDialog } from './CommentDialog';
import { ApprovalHistory } from './ApprovalHistory';
import type { PreviewItem, Approval } from '@agentris/db';

interface ApprovalPanelProps {
  previewId: string;
  items: PreviewItem[];
  approvals?: Approval[];
  onApprove: (itemIds: string[], comments?: string) => Promise<void>;
  onReject: (itemIds: string[], reason: string) => Promise<void>;
  onModify: (itemId: string, modifiedData: any) => Promise<void>;
  onBulkApprove: (pattern: { itemType?: string; impact?: string }, comments?: string) => Promise<void>;
}

export function ApprovalPanel({
  previewId,
  items,
  approvals = [],
  onApprove,
  onReject,
  onModify,
  onBulkApprove,
}: ApprovalPanelProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState('pending');
  const [showCommentDialog, setShowCommentDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);

  const pendingItems = useMemo(() => {
    const approvedItemIds = new Set(
      approvals.flatMap(a => a.items?.map(i => i.previewItemId) || [])
    );
    return items.filter(item => !approvedItemIds.has(item.id));
  }, [items, approvals]);

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
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Approval Workflow</CardTitle>
            <CardDescription>
              Review and approve proposed changes
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {selectedItems.size} selected
            </Badge>
            <Badge variant="secondary">
              {pendingItems.length} pending
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pending">Pending Changes</TabsTrigger>
            <TabsTrigger value="history">Approval History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-4">
            <div className="flex items-center justify-between">
              <BulkActions
                onSelectAll={handleSelectAll}
                onBulkApprove={onBulkApprove}
                isAllSelected={selectedItems.size === pendingItems.length}
                itemTypes={Object.keys(groupedItems)}
              />
              <ApprovalActions
                hasSelection={selectedItems.size > 0}
                onApprove={() => handleActionClick('approve')}
                onReject={() => handleActionClick('reject')}
              />
            </div>

            <div className="space-y-6">
              {Object.entries(groupedItems).map(([itemType, typeItems]) => (
                <div key={itemType}>
                  <h3 className="text-sm font-medium mb-3 text-muted-foreground">
                    {itemType.replace(/_/g, ' ')} ({typeItems.length})
                  </h3>
                  <div className="space-y-2">
                    {typeItems.map(item => (
                      <ApprovalItem
                        key={item.id}
                        item={item}
                        isSelected={selectedItems.has(item.id)}
                        onSelect={() => handleSelectItem(item.id)}
                        onModify={(data) => onModify(item.id, data)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {pendingItems.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No pending changes to approve
              </div>
            )}
          </TabsContent>

          <TabsContent value="history">
            <ApprovalHistory approvals={approvals} />
          </TabsContent>
        </Tabs>

        <CommentDialog
          open={showCommentDialog}
          onClose={() => setShowCommentDialog(false)}
          onSubmit={handleCommentSubmit}
          title={pendingAction === 'approve' ? 'Approve Changes' : 'Reject Changes'}
          description={
            pendingAction === 'approve'
              ? 'Add optional comments for this approval'
              : 'Please provide a reason for rejection'
          }
          placeholder={
            pendingAction === 'approve'
              ? 'Optional approval comments...'
              : 'Reason for rejection (required)...'
          }
          required={pendingAction === 'reject'}
        />
      </CardContent>
    </Card>
  );
}