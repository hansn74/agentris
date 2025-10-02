'use client';

import React from 'react';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';

interface ValidationRulePreviewProps {
  rule: any;
  compact?: boolean;
}

export function ValidationRulePreview({ rule, compact = false }: ValidationRulePreviewProps) {
  if (!rule) return null;

  const simplifyFormula = (formula: string) => {
    if (!formula) return '';
    
    return formula
      .replace(/ISBLANK\((.*?)\)/g, '$1 is blank')
      .replace(/NOT\(ISBLANK\((.*?)\)\)/g, '$1 is not blank')
      .replace(/ISNULL\((.*?)\)/g, '$1 is null')
      .replace(/NOT\(ISNULL\((.*?)\)\)/g, '$1 is not null')
      .replace(/AND\(/g, '(')
      .replace(/OR\(/g, '(')
      .replace(/\s+/g, ' ')
      .trim();
  };

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{rule.name || 'Unnamed Rule'}</span>
          <Badge variant={rule.active === false ? 'secondary' : 'default'}>
            {rule.active === false ? 'Inactive' : 'Active'}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{rule.errorMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h5 className="font-medium text-base">{rule.name || 'Unnamed Rule'}</h5>
          <Badge variant={rule.active === false ? 'secondary' : 'default'}>
            {rule.active === false ? 'Inactive' : 'Active'}
          </Badge>
        </div>
        {rule.description && (
          <p className="text-sm text-muted-foreground">{rule.description}</p>
        )}
      </div>

      {/* Error Condition */}
      <div>
        <p className="text-sm font-medium mb-1">Triggers When:</p>
        <div className="p-3 bg-muted rounded-md">
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
            {simplifyFormula(rule.errorConditionFormula)}
          </p>
          <details className="cursor-pointer">
            <summary className="text-xs text-muted-foreground hover:text-foreground">
              View Original Formula
            </summary>
            <pre className="mt-2 text-xs overflow-x-auto whitespace-pre-wrap">
              {rule.errorConditionFormula}
            </pre>
          </details>
        </div>
      </div>

      {/* Error Message */}
      <div>
        <p className="text-sm font-medium mb-1">Error Message:</p>
        <Alert className="border-red-200 bg-red-50 dark:bg-red-900/20">
          <AlertDescription className="text-sm">
            {rule.errorMessage}
          </AlertDescription>
        </Alert>
      </div>

      {/* Additional Properties */}
      {rule.errorDisplayField && (
        <div>
          <p className="text-sm">
            <span className="text-muted-foreground">Display Location:</span>{' '}
            <span className="font-medium">{rule.errorDisplayField}</span>
          </p>
        </div>
      )}

      {/* Metadata Info */}
      <div className="pt-2 border-t grid grid-cols-2 gap-2 text-sm">
        <div>
          <span className="text-muted-foreground">API Name:</span>{' '}
          <span className="font-mono text-xs">{rule.name || rule.fullName}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Status:</span>{' '}
          <span className="font-medium">
            {rule.active === false ? 'Inactive' : 'Active'}
          </span>
        </div>
      </div>
    </div>
  );
}