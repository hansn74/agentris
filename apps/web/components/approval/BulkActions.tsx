'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, CheckSquare, Square } from 'lucide-react';

interface BulkActionsProps {
  onSelectAll: () => void;
  onBulkApprove: (pattern: { itemType?: string; impact?: string }, comments?: string) => void;
  isAllSelected: boolean;
  itemTypes: string[];
}

export function BulkActions({
  onSelectAll,
  onBulkApprove,
  isAllSelected,
  itemTypes,
}: BulkActionsProps) {
  const [selectedPattern, setSelectedPattern] = useState<{
    itemType?: string;
    impact?: string;
  }>({});

  const handleBulkApprove = (itemType?: string, impact?: string) => {
    const pattern: { itemType?: string; impact?: string } = {};
    if (itemType) pattern.itemType = itemType;
    if (impact) pattern.impact = impact;
    
    onBulkApprove(pattern);
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onSelectAll}
        className="gap-2"
      >
        {isAllSelected ? (
          <>
            <CheckSquare className="w-4 h-4" />
            Deselect All
          </>
        ) : (
          <>
            <Square className="w-4 h-4" />
            Select All
          </>
        )}
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            Bulk Actions
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Approve by Type</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {itemTypes.map(type => (
            <DropdownMenuItem
              key={type}
              onClick={() => handleBulkApprove(type)}
            >
              Approve all {type.replace(/_/g, ' ').toLowerCase()}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Approve by Impact</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => handleBulkApprove(undefined, 'LOW')}>
            Approve all low impact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleBulkApprove(undefined, 'MEDIUM')}>
            Approve all medium impact
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleBulkApprove(undefined, 'HIGH')}>
            Approve all high impact
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}