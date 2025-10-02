'use client';

import { Button } from '@/components/ui/button';
import { Check, X, Edit } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ApprovalActionsProps {
  hasSelection: boolean;
  onApprove: () => void;
  onReject: () => void;
  onModify?: () => void;
}

export function ApprovalActions({
  hasSelection,
  onApprove,
  onReject,
  onModify,
}: ApprovalActionsProps) {
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="default"
              size="sm"
              onClick={onApprove}
              disabled={!hasSelection}
              className="gap-2"
            >
              <Check className="w-4 h-4" />
              Approve
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Approve selected changes (A)</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="sm"
              onClick={onReject}
              disabled={!hasSelection}
              className="gap-2"
            >
              <X className="w-4 h-4" />
              Reject
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Reject selected changes (R)</p>
          </TooltipContent>
        </Tooltip>

        {onModify && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onModify}
                disabled={!hasSelection}
                className="gap-2"
              >
                <Edit className="w-4 h-4" />
                Modify
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Modify selected changes (M)</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}