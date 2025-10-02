'use client';

import { FC, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AmbiguityHighlight as Highlight } from '@agentris/shared/types/ambiguity';

interface AmbiguityHighlightProps {
  text: string;
  highlights: Highlight[];
  className?: string;
}

export const AmbiguityHighlight: FC<AmbiguityHighlightProps> = ({
  text,
  highlights,
  className,
}) => {
  const segments = useMemo(() => {
    if (highlights.length === 0) {
      return [{ text, type: 'normal' as const }];
    }

    // Sort highlights by start index
    const sortedHighlights = [...highlights].sort((a, b) => a.startIndex - b.startIndex);

    const result: Array<{
      text: string;
      type: 'normal' | 'highlight';
      highlight?: Highlight;
    }> = [];

    let lastIndex = 0;

    sortedHighlights.forEach((highlight) => {
      // Add normal text before highlight
      if (highlight.startIndex > lastIndex) {
        result.push({
          text: text.substring(lastIndex, highlight.startIndex),
          type: 'normal',
        });
      }

      // Add highlighted text
      result.push({
        text: text.substring(highlight.startIndex, highlight.endIndex),
        type: 'highlight',
        highlight,
      });

      lastIndex = highlight.endIndex;
    });

    // Add remaining normal text
    if (lastIndex < text.length) {
      result.push({
        text: text.substring(lastIndex),
        type: 'normal',
      });
    }

    return result;
  }, [text, highlights]);

  const getSeverityColor = (severity: 'low' | 'medium' | 'high', type: string) => {
    const colors = {
      missing: {
        low: 'bg-blue-100 border-b-2 border-blue-300',
        medium: 'bg-blue-200 border-b-2 border-blue-400',
        high: 'bg-blue-300 border-b-2 border-blue-500',
      },
      vague: {
        low: 'bg-yellow-100 border-b-2 border-yellow-300',
        medium: 'bg-yellow-200 border-b-2 border-yellow-400',
        high: 'bg-yellow-300 border-b-2 border-yellow-500',
      },
      conflict: {
        low: 'bg-red-100 border-b-2 border-red-300',
        medium: 'bg-red-200 border-b-2 border-red-400',
        high: 'bg-red-300 border-b-2 border-red-500',
      },
    };

    return colors[type as keyof typeof colors]?.[severity] || colors.vague.medium;
  };

  return (
    <TooltipProvider>
      <div className={cn('whitespace-pre-wrap', className)}>
        {segments.map((segment, index) => {
          if (segment.type === 'normal') {
            return <span key={index}>{segment.text}</span>;
          }

          const { highlight } = segment;
          if (!highlight) return <span key={index}>{segment.text}</span>;

          return (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'cursor-help px-0.5 rounded',
                    getSeverityColor(highlight.severity, highlight.type)
                  )}
                >
                  {segment.text}
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  <div className="font-semibold capitalize">
                    {highlight.type.replace('_', ' ')} Issue
                  </div>
                  <div className="text-sm">{highlight.tooltip}</div>
                  <div className="text-xs text-muted-foreground">
                    Severity: {highlight.severity}
                  </div>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
};