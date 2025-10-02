'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Skeleton } from '../ui/skeleton';
import { Alert, AlertDescription } from '../ui/alert';
import { FieldPreview } from './FieldPreview';
import { ValidationRulePreview } from './ValidationRulePreview';
import { DiffViewer } from './DiffViewer';
import { ImpactIndicator } from './ImpactIndicator';
import type { DiffRepresentation } from '@agentris/services';

interface PreviewPanelProps {
  previewId?: string;
  loading?: boolean;
  error?: string;
  diffData?: DiffRepresentation;
  showComparison?: boolean;
  onRefresh?: () => void;
}

export function PreviewPanel({
  previewId,
  loading = false,
  error,
  diffData,
  showComparison = true,
  onRefresh
}: PreviewPanelProps) {
  if (loading) {
    return (
      <Card className="w-full">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!diffData) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Change Preview</CardTitle>
          <CardDescription>No changes to preview</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { summary, fields, validationRules, changePercentage } = diffData;

  return (
    <div className="space-y-6">
      {/* Summary Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Change Preview</CardTitle>
              <CardDescription>
                {summary.totalChanges} total changes ({changePercentage}% modification)
              </CardDescription>
            </div>
            {onRefresh && (
              <button
                onClick={onRefresh}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Refresh
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fields Added</p>
              <p className="text-2xl font-bold text-green-600">{summary.fieldsAdded}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fields Modified</p>
              <p className="text-2xl font-bold text-yellow-600">{summary.fieldsModified}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Fields Removed</p>
              <p className="text-2xl font-bold text-red-600">{summary.fieldsRemoved}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Rules Changed</p>
              <p className="text-2xl font-bold text-blue-600">
                {summary.rulesAdded + summary.rulesModified + summary.rulesRemoved}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fields Section */}
      {fields.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Field Changes</CardTitle>
            <CardDescription>
              {fields.filter(f => f.status !== 'unchanged').length} fields with changes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields
              .filter(f => f.status !== 'unchanged')
              .map((field) => (
                <div key={field.fieldName} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{field.fieldName}</h4>
                      <Badge
                        variant={
                          field.status === 'added'
                            ? 'default'
                            : field.status === 'modified'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {field.status}
                      </Badge>
                    </div>
                    <ImpactIndicator level="medium" />
                  </div>
                  
                  {showComparison && field.status === 'modified' ? (
                    <DiffViewer
                      current={field.current}
                      proposed={field.proposed}
                      differences={field.differences}
                    />
                  ) : (
                    <FieldPreview field={field.proposed || field.current} />
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Validation Rules Section */}
      {validationRules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Validation Rule Changes</CardTitle>
            <CardDescription>
              {validationRules.filter(r => r.status !== 'unchanged').length} rules with changes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {validationRules
              .filter(r => r.status !== 'unchanged')
              .map((rule) => (
                <div key={rule.ruleName} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{rule.ruleName}</h4>
                      <Badge
                        variant={
                          rule.status === 'added'
                            ? 'default'
                            : rule.status === 'modified'
                            ? 'secondary'
                            : 'destructive'
                        }
                      >
                        {rule.status}
                      </Badge>
                    </div>
                    <ImpactIndicator level="low" />
                  </div>
                  
                  {showComparison && rule.status === 'modified' ? (
                    <DiffViewer
                      current={rule.current}
                      proposed={rule.proposed}
                      differences={rule.differences}
                    />
                  ) : (
                    <ValidationRulePreview rule={rule.proposed || rule.current} />
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}