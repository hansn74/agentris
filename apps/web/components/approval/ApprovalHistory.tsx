'use client';

import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { Approval } from '@agentris/db';

interface ApprovalHistoryProps {
  approvals: Approval[];
}

export function ApprovalHistory({ approvals }: ApprovalHistoryProps) {
  const statusColors = {
    PENDING: 'bg-gray-100 text-gray-800',
    APPROVED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-800',
    MODIFIED: 'bg-blue-100 text-blue-800',
  };

  const statusLabels = {
    PENDING: 'Pending',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    MODIFIED: 'Modified',
  };

  if (approvals.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No approval history available
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3">
        {approvals.map((approval) => (
          <Card key={approval.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={approval.user?.image || undefined} />
                  <AvatarFallback>
                    {approval.user?.name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {approval.user?.name || approval.user?.email}
                    </span>
                    <Badge 
                      variant="secondary"
                      className={statusColors[approval.status]}
                    >
                      {statusLabels[approval.status]}
                    </Badge>
                  </div>
                  
                  {approval.comments && (
                    <p className="text-sm text-muted-foreground">
                      {approval.comments}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>
                      {formatDistanceToNow(new Date(approval.createdAt), {
                        addSuffix: true,
                      })}
                    </span>
                    {approval.items && (
                      <span>{approval.items.length} items</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}