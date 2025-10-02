'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, Edit2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PreviewItem } from '@agentris/db';

interface ApprovalItemProps {
  item: PreviewItem;
  isSelected: boolean;
  onSelect: () => void;
  onModify: (modifiedData: any) => void;
}

export function ApprovalItem({ item, isSelected, onSelect, onModify }: ApprovalItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const impactColors = {
    LOW: 'bg-green-100 text-green-800',
    MEDIUM: 'bg-yellow-100 text-yellow-800',
    HIGH: 'bg-red-100 text-red-800',
  };

  const impactIcons = {
    LOW: null,
    MEDIUM: null,
    HIGH: <AlertCircle className="w-3 h-3" />,
  };

  const handleEdit = () => {
    setIsEditing(true);
    // In real implementation, this would open a proper editor
    // For now, we'll just simulate the modification
    setTimeout(() => {
      onModify({ ...item.proposedState, modified: true });
      setIsEditing(false);
    }, 1000);
  };

  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        isSelected && 'border-primary bg-primary/5'
      )}
      data-testid={`approval-item-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={isSelected}
          onCheckedChange={onSelect}
          aria-label={`Select ${item.name}`}
        />
        
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-medium">{item.name}</h4>
              <Badge 
                variant="secondary" 
                className={cn('text-xs', impactColors[item.impact as keyof typeof impactColors])}
              >
                {impactIcons[item.impact as keyof typeof impactIcons]}
                {item.impact}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {item.itemType.replace(/_/g, ' ')}
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleEdit}
                disabled={isEditing}
              >
                <Edit2 className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
          
          <p className="text-sm text-muted-foreground">{item.description}</p>
          
          {isExpanded && (
            <div className="mt-3 pt-3 border-t space-y-3">
              {item.currentState && (
                <div>
                  <h5 className="text-xs font-medium text-muted-foreground mb-1">
                    Current State
                  </h5>
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                    {JSON.stringify(item.currentState, null, 2)}
                  </pre>
                </div>
              )}
              
              <div>
                <h5 className="text-xs font-medium text-muted-foreground mb-1">
                  Proposed State
                </h5>
                <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">
                  {JSON.stringify(item.proposedState, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}