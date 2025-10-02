'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  ArrowRight, 
  Info, 
  Link2, 
  Plus,
  AlertTriangle,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import type { Recommendation } from '@agentris/shared';

interface RelatedChangeSuggestionProps {
  recommendation: Recommendation;
  onAccept: () => void;
  isCompact?: boolean;
}

const typeIcons = {
  naming: Sparkles,
  fieldType: Info,
  relationship: Link2,
  validation: AlertTriangle,
  automation: CheckCircle,
  conflict: AlertTriangle
};

const typeColors = {
  naming: 'bg-blue-100 text-blue-800',
  fieldType: 'bg-purple-100 text-purple-800',
  relationship: 'bg-green-100 text-green-800',
  validation: 'bg-yellow-100 text-yellow-800',
  automation: 'bg-indigo-100 text-indigo-800',
  conflict: 'bg-red-100 text-red-800'
};

export function RelatedChangeSuggestion({
  recommendation,
  onAccept,
  isCompact = false
}: RelatedChangeSuggestionProps) {
  const [isSelected, setIsSelected] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const Icon = typeIcons[recommendation.type] || Info;
  const colorClass = typeColors[recommendation.type] || 'bg-gray-100 text-gray-800';

  const handleAccept = () => {
    setIsSelected(true);
    onAccept();
  };

  if (isCompact) {
    return (
      <div className="flex items-center justify-between p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors">
        <div className="flex items-center space-x-3">
          <Checkbox
            checked={isSelected}
            onCheckedChange={(checked) => {
              setIsSelected(checked as boolean);
              if (checked) onAccept();
            }}
          />
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">{recommendation.title}</span>
            <Badge variant="outline" className="text-xs">
              {recommendation.type}
            </Badge>
          </div>
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
              >
                <Info className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="max-w-xs">
              <p className="text-sm">{recommendation.rationale}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card className="border-dashed">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            <div className="mt-0.5">
              <Checkbox
                checked={isSelected}
                onCheckedChange={(checked) => {
                  setIsSelected(checked as boolean);
                  if (checked) onAccept();
                }}
              />
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4" />
                  <span className="font-medium text-sm">{recommendation.title}</span>
                  <Badge className={`${colorClass} text-xs`}>
                    {recommendation.type}
                  </Badge>
                </div>
                {recommendation.confidence && (
                  <Badge variant="outline" className="text-xs">
                    {Math.round(recommendation.confidence * 100)}%
                  </Badge>
                )}
              </div>
              
              <p className="text-sm text-muted-foreground">
                {recommendation.description}
              </p>

              {showDetails && (
                <div className="pt-2 space-y-2 border-t">
                  <div className="bg-muted/50 p-2 rounded text-sm">
                    <p className="font-medium mb-1">Why this is recommended:</p>
                    <p className="text-muted-foreground">{recommendation.rationale}</p>
                  </div>
                  
                  {recommendation.examples && recommendation.examples.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-1">Examples:</p>
                      <div className="flex flex-wrap gap-1">
                        {recommendation.examples.map((example, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs font-mono">
                            {example}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {recommendation.impact && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-muted-foreground">Impact:</span>
                      <Badge className={
                        recommendation.impact === 'high' ? 'bg-red-100 text-red-800' :
                        recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-green-100 text-green-800'
                      }>
                        {recommendation.impact}
                      </Badge>
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center space-x-2 pt-1">
                {!isSelected && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleAccept}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Include this change
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide' : 'Show'} details
                  <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {recommendation.relatedChanges && recommendation.relatedChanges.length > 0 && (
          <div className="mt-3 pl-7 border-l-2 border-dashed">
            <p className="text-xs text-muted-foreground mb-2">
              This change requires:
            </p>
            <div className="space-y-1">
              {recommendation.relatedChanges.map((nested: Recommendation) => (
                <RelatedChangeSuggestion
                  key={nested.id}
                  recommendation={nested}
                  onAccept={onAccept}
                  isCompact={true}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}