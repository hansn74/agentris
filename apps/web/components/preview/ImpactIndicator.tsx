'use client';

import React from 'react';
import { Badge } from '../ui/badge';

interface ImpactIndicatorProps {
  level: 'low' | 'medium' | 'high' | 'critical';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  description?: string;
}

export function ImpactIndicator({
  level,
  showLabel = true,
  size = 'md',
  description
}: ImpactIndicatorProps) {
  const getImpactColor = () => {
    switch (level) {
      case 'critical':
        return 'bg-red-500 text-white';
      case 'high':
        return 'bg-orange-500 text-white';
      case 'medium':
        return 'bg-yellow-500 text-white';
      case 'low':
        return 'bg-green-500 text-white';
      default:
        return 'bg-gray-500 text-white';
    }
  };

  const getImpactBorderColor = () => {
    switch (level) {
      case 'critical':
        return 'border-red-500';
      case 'high':
        return 'border-orange-500';
      case 'medium':
        return 'border-yellow-500';
      case 'low':
        return 'border-green-500';
      default:
        return 'border-gray-500';
    }
  };

  const getImpactIcon = () => {
    switch (level) {
      case 'critical':
        return '⚠️';
      case 'high':
        return '🔺';
      case 'medium':
        return '🔶';
      case 'low':
        return '🟢';
      default:
        return '⚪';
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'text-xs px-2 py-0.5';
      case 'lg':
        return 'text-base px-4 py-2';
      default:
        return 'text-sm px-3 py-1';
    }
  };

  const label = level.charAt(0).toUpperCase() + level.slice(1) + ' Impact';

  if (description) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">{getImpactIcon()}</span>
          <Badge className={`${getImpactColor()} ${getSizeClasses()}`}>
            {showLabel ? label : level.toUpperCase()}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className={`
          inline-flex items-center justify-center
          ${getSizeClasses()}
          ${getImpactColor()}
          rounded-md font-medium
          transition-colors
        `}
        title={label}
      >
        {showLabel ? (
          <>
            <span className="mr-1">{getImpactIcon()}</span>
            {level.toUpperCase()}
          </>
        ) : (
          <span>{getImpactIcon()}</span>
        )}
      </div>
    </div>
  );
}

export function ImpactLegend() {
  return (
    <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-lg">
      <span className="text-sm font-medium">Impact Levels:</span>
      <ImpactIndicator level="low" size="sm" />
      <ImpactIndicator level="medium" size="sm" />
      <ImpactIndicator level="high" size="sm" />
      <ImpactIndicator level="critical" size="sm" />
    </div>
  );
}