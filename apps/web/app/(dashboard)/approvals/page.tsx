'use client';

import { useState, useEffect, useCallback } from 'react';
import { ApprovalPanel } from '@/components/approval/ApprovalPanel';
import { ChangeEditor } from '@/components/approval/ChangeEditor';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Filter, RefreshCw } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApprovalStore } from '@/stores/approvalStore';
import { trpc } from '@/trpc/client';
import { toast } from 'sonner';
import type { PreviewItem } from '@agentris/db';

export default function ApprovalsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterImpact, setFilterImpact] = useState<string>('all');
  const [editingItem, setEditingItem] = useState<PreviewItem | null>(null);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(null);

  const {
    selectedItems,
    setSelectedItems,
    clearSelection,
  } = useApprovalStore();

  // Fetch approval queue
  const { data: approvalQueue, isLoading, refetch } = trpc.approval.getApprovalQueue.useQuery(
    {
      status: filterStatus !== 'all' ? filterStatus : undefined,
    },
    {
      refetchInterval: 30000, // Refresh every 30 seconds
    }
  );

  // Fetch approval history
  const { data: approvalHistory } = trpc.approval.getApprovalHistory.useQuery({
    page: 1,
    pageSize: 10,
  });

  // Mutations
  const approveMutation = trpc.approval.approveItems.useMutation({
    onSuccess: () => {
      toast.success('Changes approved successfully');
      clearSelection();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to approve changes: ${error.message}`);
    },
  });

  const rejectMutation = trpc.approval.rejectItems.useMutation({
    onSuccess: () => {
      toast.success('Changes rejected');
      clearSelection();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to reject changes: ${error.message}`);
    },
  });

  const modifyMutation = trpc.approval.modifyItem.useMutation({
    onSuccess: () => {
      toast.success('Change modified successfully');
      setEditingItem(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to modify change: ${error.message}`);
    },
  });

  const bulkApproveMutation = trpc.approval.bulkApprove.useMutation({
    onSuccess: (data) => {
      toast.success(`Bulk approved ${data.itemCount} items`);
      clearSelection();
      refetch();
    },
    onError: (error) => {
      toast.error(`Failed to bulk approve: ${error.message}`);
    },
  });

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'a':
          if (selectedItems.size > 0 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleApprove(Array.from(selectedItems));
          }
          break;
        case 'r':
          if (selectedItems.size > 0 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleReject(Array.from(selectedItems), 'Rejected via keyboard shortcut');
          }
          break;
        case 'm':
          if (selectedItems.size === 1 && !e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            const itemId = Array.from(selectedItems)[0];
            const item = approvalQueue?.items.find(i => i.id === itemId);
            if (item) {
              setEditingItem(item);
            }
          }
          break;
        case 'escape':
          clearSelection();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedItems, approvalQueue]);

  const handleApprove = useCallback(async (itemIds: string[], comments?: string) => {
    if (!selectedPreviewId) return;
    
    await approveMutation.mutateAsync({
      previewId: selectedPreviewId,
      itemIds,
      comments,
    });
  }, [selectedPreviewId, approveMutation]);

  const handleReject = useCallback(async (itemIds: string[], reason: string) => {
    if (!selectedPreviewId) return;
    
    await rejectMutation.mutateAsync({
      previewId: selectedPreviewId,
      itemIds,
      reason,
    });
  }, [selectedPreviewId, rejectMutation]);

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
    if (!selectedPreviewId) return;
    
    await bulkApproveMutation.mutateAsync({
      previewId: selectedPreviewId,
      pattern,
      comments,
    });
  }, [selectedPreviewId, bulkApproveMutation]);

  const handleSaveEdit = useCallback((itemId: string, modifiedData: any) => {
    handleModify(itemId, modifiedData);
  }, [handleModify]);

  // Filter items based on search and filters
  const filteredItems = approvalQueue?.items.filter(item => {
    if (searchQuery && !item.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (filterImpact !== 'all' && item.impact !== filterImpact) {
      return false;
    }
    return true;
  }) || [];

  // Set selected preview ID when data loads
  useEffect(() => {
    if (approvalQueue?.previews?.[0]?.id && !selectedPreviewId) {
      setSelectedPreviewId(approvalQueue.previews[0].id);
    }
  }, [approvalQueue, selectedPreviewId]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
            <p className="text-muted-foreground">Review and approve pending changes</p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approvals</h1>
          <p className="text-muted-foreground">Review and approve pending changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {approvalQueue?.totalPending || 0} Pending
          </Badge>
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Approval Queue</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search changes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={filterImpact} onValueChange={setFilterImpact}>
                <SelectTrigger className="w-32">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Impact" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Impact</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {approvalQueue?.previews?.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No pending approvals</p>
              <p className="text-sm mt-2">New changes will appear here for review</p>
            </div>
          ) : (
            <>
              {approvalQueue?.previews?.length > 1 && (
                <div className="mb-4">
                  <Select value={selectedPreviewId || ''} onValueChange={setSelectedPreviewId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select preview" />
                    </SelectTrigger>
                    <SelectContent>
                      {approvalQueue.previews.map(preview => (
                        <SelectItem key={preview.id} value={preview.id}>
                          {preview.ticket?.summary || `Preview ${preview.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {selectedPreviewId && (
                <ApprovalPanel
                  previewId={selectedPreviewId}
                  items={filteredItems}
                  approvals={approvalHistory?.approvals || []}
                  onApprove={handleApprove}
                  onReject={handleReject}
                  onModify={(itemId) => {
                    const item = filteredItems.find(i => i.id === itemId);
                    if (item) {
                      setEditingItem(item);
                    }
                  }}
                  onBulkApprove={handleBulkApprove}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Keyboard Shortcuts</CardTitle>
          <CardDescription>Quick actions for efficient approval workflow</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <kbd className="px-2 py-1 bg-muted rounded">A</kbd>
              <span className="ml-2">Approve selected</span>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-muted rounded">R</kbd>
              <span className="ml-2">Reject selected</span>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-muted rounded">M</kbd>
              <span className="ml-2">Modify selected</span>
            </div>
            <div>
              <kbd className="px-2 py-1 bg-muted rounded">Esc</kbd>
              <span className="ml-2">Clear selection</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <ChangeEditor
        item={editingItem}
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleSaveEdit}
      />
    </div>
  );
}