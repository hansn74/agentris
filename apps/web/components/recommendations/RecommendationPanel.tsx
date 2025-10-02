'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, XCircle, AlertCircle, Info, Lightbulb, AlertTriangle, Shield } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { NamingConventionSuggestion } from './NamingConventionSuggestion';
import { FieldTypeSuggestion } from './FieldTypeSuggestion';
import { ConflictAlert } from './ConflictAlert';
import { RelatedChangeSuggestion } from './RelatedChangeSuggestion';
import type { Recommendation } from '@agentris/shared';

interface RecommendationPanelProps {
  ticketId: string;
  orgId: string;
  proposedChanges?: any;
  onAccept?: (recommendation: Recommendation) => void;
  onReject?: (recommendation: Recommendation) => void;
  onModify?: (recommendation: Recommendation, modifiedValue: any) => void;
}

const typeIcons = {
  naming: Lightbulb,
  fieldType: Info,
  relationship: Shield,
  validation: AlertTriangle,
  automation: CheckCircle,
  conflict: AlertCircle
};

const categoryColors = {
  suggestion: 'bg-blue-100 text-blue-800',
  warning: 'bg-yellow-100 text-yellow-800',
  error: 'bg-red-100 text-red-800'
};

const impactColors = {
  low: 'bg-green-100 text-green-800',
  medium: 'bg-yellow-100 text-yellow-800',
  high: 'bg-red-100 text-red-800'
};

export function RecommendationPanel({
  ticketId,
  orgId,
  proposedChanges,
  onAccept,
  onReject,
  onModify
}: RecommendationPanelProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Fetch recommendations
  const { data: recommendationsData, isLoading, error, refetch } = trpc.recommendations.getRecommendations.useQuery({
    ticketId,
    orgId,
    proposedChanges
  });

  // Check conflicts
  const { data: conflictsData } = trpc.recommendations.checkConflicts.useQuery(
    {
      orgId,
      proposedChanges,
      existingMetadata: undefined
    },
    {
      enabled: !!proposedChanges
    }
  );

  // Submit feedback mutation
  const submitFeedback = trpc.recommendations.submitFeedback.useMutation({
    onSuccess: () => {
      refetch();
    }
  });

  const recommendations = recommendationsData?.recommendations || [];
  const conflicts = conflictsData?.conflicts || [];

  // Filter recommendations by type
  const filterByType = (type?: string) => {
    if (type === 'all') return recommendations;
    if (type === 'conflicts') return recommendations.filter(r => r.type === 'conflict');
    return recommendations.filter(r => r.type === type);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const handleAccept = async (recommendation: Recommendation) => {
    await submitFeedback.mutateAsync({
      recommendationId: recommendation.id,
      action: 'accepted',
      timestamp: new Date()
    });
    onAccept?.(recommendation);
  };

  const handleReject = async (recommendation: Recommendation, reason?: string) => {
    await submitFeedback.mutateAsync({
      recommendationId: recommendation.id,
      action: 'rejected',
      reason,
      timestamp: new Date()
    });
    onReject?.(recommendation);
  };

  const handleModify = async (recommendation: Recommendation, modifiedValue: any) => {
    await submitFeedback.mutateAsync({
      recommendationId: recommendation.id,
      action: 'modified',
      modifiedValue,
      timestamp: new Date()
    });
    onModify?.(recommendation, modifiedValue);
  };

  const renderRecommendation = (recommendation: Recommendation) => {
    const Icon = typeIcons[recommendation.type] || Info;
    const isExpanded = expandedItems.has(recommendation.id);

    switch (recommendation.type) {
      case 'naming':
        return (
          <NamingConventionSuggestion
            key={recommendation.id}
            recommendation={recommendation}
            onAccept={() => handleAccept(recommendation)}
            onReject={(reason) => handleReject(recommendation, reason)}
            onModify={(value) => handleModify(recommendation, value)}
          />
        );
      case 'fieldType':
        return (
          <FieldTypeSuggestion
            key={recommendation.id}
            recommendation={recommendation}
            onAccept={() => handleAccept(recommendation)}
            onReject={(reason) => handleReject(recommendation, reason)}
          />
        );
      case 'conflict':
        return (
          <ConflictAlert
            key={recommendation.id}
            conflict={recommendation}
            onResolve={() => handleAccept(recommendation)}
            onDismiss={() => handleReject(recommendation)}
          />
        );
      default:
        return (
          <Card key={recommendation.id} className="mb-4">
            <CardHeader
              className="cursor-pointer"
              onClick={() => toggleExpanded(recommendation.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  <Icon className="h-5 w-5 mt-0.5" />
                  <div>
                    <CardTitle className="text-base">{recommendation.title}</CardTitle>
                    <CardDescription className="mt-1">
                      {recommendation.description}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge className={categoryColors[recommendation.category]}>
                    {recommendation.category}
                  </Badge>
                  {recommendation.impact && (
                    <Badge className={impactColors[recommendation.impact]}>
                      {recommendation.impact} impact
                    </Badge>
                  )}
                  <Badge variant="outline">
                    {Math.round(recommendation.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>
            </CardHeader>
            {isExpanded && (
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium text-sm mb-1">Rationale</h4>
                    <p className="text-sm text-muted-foreground">
                      {recommendation.rationale}
                    </p>
                  </div>
                  {recommendation.examples && recommendation.examples.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Examples</h4>
                      <ul className="list-disc list-inside text-sm text-muted-foreground">
                        {recommendation.examples.map((example, idx) => (
                          <li key={idx}>{example}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {recommendation.relatedChanges && recommendation.relatedChanges.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2">Related Changes</h4>
                      <div className="space-y-2">
                        {recommendation.relatedChanges.map((related: Recommendation) => (
                          <RelatedChangeSuggestion
                            key={related.id}
                            recommendation={related}
                            onAccept={() => handleAccept(related)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex space-x-2 pt-3">
                    <Button
                      size="sm"
                      onClick={() => handleAccept(recommendation)}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(recommendation)}
                    >
                      <XCircle className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load recommendations: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  const currentRecommendations = filterByType(activeTab);
  const hasConflicts = conflicts.length > 0;
  const criticalConflicts = conflicts.filter((c: any) => c.severity === 'critical');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Context-Aware Recommendations</CardTitle>
            <CardDescription>
              AI-powered suggestions based on your org's patterns and best practices
            </CardDescription>
          </div>
          {recommendationsData?.fromCache && (
            <Badge variant="secondary">Cached</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {hasConflicts && criticalConflicts.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Critical Conflicts Detected</AlertTitle>
            <AlertDescription>
              {criticalConflicts.length} critical conflict{criticalConflicts.length !== 1 ? 's' : ''} found 
              that must be resolved before deployment.
            </AlertDescription>
          </Alert>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">
              All ({recommendations.length})
            </TabsTrigger>
            <TabsTrigger value="naming">
              Naming ({filterByType('naming').length})
            </TabsTrigger>
            <TabsTrigger value="fieldType">
              Fields ({filterByType('fieldType').length})
            </TabsTrigger>
            <TabsTrigger value="validation">
              Validation ({filterByType('validation').length})
            </TabsTrigger>
            <TabsTrigger value="automation">
              Automation ({filterByType('automation').length})
            </TabsTrigger>
            <TabsTrigger value="conflicts">
              Conflicts ({filterByType('conflict').length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab}>
            <ScrollArea className="h-[600px] w-full pr-4">
              {currentRecommendations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 text-center">
                  <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                  <p className="text-muted-foreground">
                    No {activeTab === 'all' ? '' : activeTab} recommendations at this time
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentRecommendations.map(renderRecommendation)}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
        
        {conflictsData && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Total Conflicts: {conflictsData.hasConflicts ? conflicts.length : 0}</span>
              <div className="flex space-x-4">
                <span className="text-red-600">Critical: {conflictsData.criticalCount}</span>
                <span className="text-orange-600">High: {conflictsData.highCount}</span>
                <span className="text-yellow-600">Medium: {conflictsData.mediumCount}</span>
                <span className="text-green-600">Low: {conflictsData.lowCount}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}