'use client';

import { FC } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface AmbiguityScoreProps {
  score: number;
  confidence: number;
  className?: string;
  showConfidence?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const AmbiguityScore: FC<AmbiguityScoreProps> = ({
  score,
  confidence,
  className,
  showConfidence = true,
  size = 'md',
}) => {
  const getScoreLevel = (score: number) => {
    if (score <= 0.3) return { level: 'low', label: 'Low Ambiguity', color: 'text-green-600' };
    if (score <= 0.6) return { level: 'medium', label: 'Medium Ambiguity', color: 'text-yellow-600' };
    return { level: 'high', label: 'High Ambiguity', color: 'text-red-600' };
  };

  const getIcon = (level: string) => {
    const iconSize = size === 'sm' ? 'h-4 w-4' : size === 'md' ? 'h-5 w-5' : 'h-6 w-6';
    
    switch (level) {
      case 'low':
        return <CheckCircle className={cn(iconSize, 'text-green-600')} />;
      case 'medium':
        return <AlertTriangle className={cn(iconSize, 'text-yellow-600')} />;
      case 'high':
        return <XCircle className={cn(iconSize, 'text-red-600')} />;
      default:
        return null;
    }
  };

  const getProgressColor = (score: number) => {
    if (score <= 0.3) return 'bg-green-600';
    if (score <= 0.6) return 'bg-yellow-600';
    return 'bg-red-600';
  };

  const { level, label, color } = getScoreLevel(score);
  const percentage = Math.round(score * 100);

  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <TooltipProvider>
      <div className={cn('space-y-2', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getIcon(level)}
            <span className={cn(color, 'font-medium', sizeClasses[size])}>
              {label}
            </span>
          </div>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant={level === 'low' ? 'default' : level === 'medium' ? 'secondary' : 'destructive'}>
                {percentage}%
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                Ambiguity Score: {percentage}%
                {showConfidence && (
                  <>
                    <br />
                    Confidence: {Math.round(confidence * 100)}%
                  </>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-1">
          <Progress
            value={percentage}
            className={cn('h-2', size === 'sm' && 'h-1.5')}
            indicatorClassName={getProgressColor(score)}
          />
          
          {showConfidence && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Confidence</span>
              <span>{Math.round(confidence * 100)}%</span>
            </div>
          )}
        </div>

        {size !== 'sm' && (
          <div className="text-xs text-muted-foreground space-y-1">
            {level === 'high' && (
              <p>Requirements need significant clarification before implementation.</p>
            )}
            {level === 'medium' && (
              <p>Some clarification needed to ensure accurate implementation.</p>
            )}
            {level === 'low' && (
              <p>Requirements are clear and ready for implementation.</p>
            )}
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

// Compact variant for lists
export const AmbiguityScoreBadge: FC<{ score: number; className?: string }> = ({
  score,
  className,
}) => {
  const getVariant = (score: number) => {
    if (score <= 0.3) return 'default';
    if (score <= 0.6) return 'secondary';
    return 'destructive';
  };

  const getLabel = (score: number) => {
    if (score <= 0.3) return 'Clear';
    if (score <= 0.6) return 'Unclear';
    return 'Ambiguous';
  };

  return (
    <Badge variant={getVariant(score)} className={className}>
      {getLabel(score)} ({Math.round(score * 100)}%)
    </Badge>
  );
};