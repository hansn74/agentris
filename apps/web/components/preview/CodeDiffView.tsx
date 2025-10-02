'use client';

import React from 'react';
import { CodeDiffData } from '@agentris/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface CodeDiffViewProps {
  data: CodeDiffData;
  className?: string;
}

export function CodeDiffView({ data, className }: CodeDiffViewProps) {
  const renderLine = (line: string, lineNumber: number, type: 'add' | 'remove' | 'unchanged') => {
    const bgColor = type === 'add' 
      ? 'bg-green-50 dark:bg-green-900/20' 
      : type === 'remove' 
      ? 'bg-red-50 dark:bg-red-900/20' 
      : '';
    
    const prefix = type === 'add' ? '+' : type === 'remove' ? '-' : ' ';
    const textColor = type === 'add' 
      ? 'text-green-700 dark:text-green-400' 
      : type === 'remove' 
      ? 'text-red-700 dark:text-red-400' 
      : 'text-gray-700 dark:text-gray-300';

    return (
      <div key={`${type}-${lineNumber}`} className={`font-mono text-sm ${bgColor}`}>
        <span className="inline-block w-12 text-right pr-2 text-gray-500 select-none">
          {lineNumber}
        </span>
        <span className={`inline-block w-6 text-center select-none ${textColor}`}>
          {prefix}
        </span>
        <span className={textColor}>{line}</span>
      </div>
    );
  };

  const renderUnifiedDiff = () => {
    const beforeLines = data.before.split('\n');
    const afterLines = data.after.split('\n');
    const maxLines = Math.max(beforeLines.length, afterLines.length);
    const diffLines: React.ReactNode[] = [];

    // Simple diff visualization - in production, use a proper diff algorithm
    let beforeIndex = 0;
    let afterIndex = 0;
    let lineNumber = 1;

    // This is a simplified diff - in production, use a library like diff-match-patch
    for (let i = 0; i < maxLines; i++) {
      if (beforeIndex < beforeLines.length && afterIndex < afterLines.length) {
        if (beforeLines[beforeIndex] === afterLines[afterIndex]) {
          diffLines.push(renderLine(beforeLines[beforeIndex], lineNumber++, 'unchanged'));
          beforeIndex++;
          afterIndex++;
        } else {
          // Show removal then addition
          if (beforeIndex < beforeLines.length) {
            diffLines.push(renderLine(beforeLines[beforeIndex], lineNumber++, 'remove'));
            beforeIndex++;
          }
          if (afterIndex < afterLines.length) {
            diffLines.push(renderLine(afterLines[afterIndex], lineNumber++, 'add'));
            afterIndex++;
          }
        }
      } else if (beforeIndex < beforeLines.length) {
        diffLines.push(renderLine(beforeLines[beforeIndex], lineNumber++, 'remove'));
        beforeIndex++;
      } else if (afterIndex < afterLines.length) {
        diffLines.push(renderLine(afterLines[afterIndex], lineNumber++, 'add'));
        afterIndex++;
      }
    }

    return diffLines;
  };

  const stats = {
    additions: data.changes.filter(c => c.type === 'add').length,
    deletions: data.changes.filter(c => c.type === 'remove').length,
    modifications: data.changes.filter(c => c.type === 'modify').length,
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Code Changes</CardTitle>
            <div className="flex gap-2">
              <Badge variant="default" className="bg-green-600">
                +{stats.additions}
              </Badge>
              <Badge variant="default" className="bg-red-600">
                -{stats.deletions}
              </Badge>
              <Badge variant="default" className="bg-blue-600">
                ~{stats.modifications}
              </Badge>
              <Badge variant="outline">{data.language}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[500px]">
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              {renderUnifiedDiff()}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}