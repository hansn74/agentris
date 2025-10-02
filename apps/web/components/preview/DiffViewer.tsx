'use client';

import React from 'react';
import { Badge } from '../ui/badge';

interface DiffViewerProps {
  current?: any;
  proposed?: any;
  differences?: Array<{
    property: string;
    currentValue: any;
    proposedValue: any;
    changeType: 'added' | 'modified' | 'removed';
  }>;
  mode?: 'inline' | 'side-by-side';
}

export function DiffViewer({
  current,
  proposed,
  differences = [],
  mode = 'inline'
}: DiffViewerProps) {
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) return '(empty)';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'text-green-600 dark:text-green-400';
      case 'modified':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'removed':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getChangeTypeBadge = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <Badge variant="default" className="text-xs">Added</Badge>;
      case 'modified':
        return <Badge variant="secondary" className="text-xs">Modified</Badge>;
      case 'removed':
        return <Badge variant="destructive" className="text-xs">Removed</Badge>;
      default:
        return null;
    }
  };

  if (differences.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        No differences detected
      </div>
    );
  }

  if (mode === 'side-by-side') {
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="font-medium">Current</div>
          <div className="font-medium">Proposed</div>
        </div>
        <div className="border-t pt-2 space-y-2">
          {differences.map((diff, index) => (
            <div key={index} className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{diff.property}</p>
                <div className={`text-sm p-2 rounded ${
                  diff.changeType === 'removed' ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted'
                }`}>
                  {diff.changeType === 'added' ? (
                    <span className="text-muted-foreground italic">Not set</span>
                  ) : (
                    <span className={diff.changeType === 'removed' ? 'line-through' : ''}>
                      {formatValue(diff.currentValue)}
                    </span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">{diff.property}</p>
                <div className={`text-sm p-2 rounded ${
                  diff.changeType === 'added' ? 'bg-green-50 dark:bg-green-900/20' : 
                  diff.changeType === 'modified' ? 'bg-yellow-50 dark:bg-yellow-900/20' : 'bg-muted'
                }`}>
                  {diff.changeType === 'removed' ? (
                    <span className="text-muted-foreground italic">Will be removed</span>
                  ) : (
                    <span className={getChangeTypeColor(diff.changeType)}>
                      {formatValue(diff.proposedValue)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Inline mode (default)
  return (
    <div className="space-y-2">
      {differences.map((diff, index) => (
        <div key={index} className="border rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{diff.property}</span>
            {getChangeTypeBadge(diff.changeType)}
          </div>
          
          <div className="space-y-1 text-sm">
            {diff.changeType !== 'added' && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[60px]">Before:</span>
                <span className={`${diff.changeType === 'removed' ? 'line-through text-red-600' : ''}`}>
                  {formatValue(diff.currentValue)}
                </span>
              </div>
            )}
            
            {diff.changeType !== 'removed' && (
              <div className="flex items-start gap-2">
                <span className="text-muted-foreground min-w-[60px]">After:</span>
                <span className={getChangeTypeColor(diff.changeType)}>
                  {formatValue(diff.proposedValue)}
                </span>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}