'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CheckCircle, XCircle, Info, Database, ArrowRight, AlertTriangle } from 'lucide-react';
import type { Recommendation } from '@agentris/shared';

interface FieldTypeSuggestionProps {
  recommendation: Recommendation;
  onAccept: () => void;
  onReject: (reason?: string) => void;
}

const fieldTypeDetails = {
  'Text': { icon: '📝', description: 'Single line text, max 255 characters' },
  'TextArea': { icon: '📄', description: 'Multi-line text, max 131,072 characters' },
  'LongTextArea': { icon: '📚', description: 'Rich text, max 131,072 characters' },
  'Number': { icon: '🔢', description: 'Numeric values with decimal support' },
  'Currency': { icon: '💰', description: 'Monetary values with currency symbol' },
  'Percent': { icon: '📊', description: 'Percentage values' },
  'Date': { icon: '📅', description: 'Date only, no time' },
  'DateTime': { icon: '🕐', description: 'Date and time values' },
  'Email': { icon: '📧', description: 'Email address with validation' },
  'Phone': { icon: '📞', description: 'Phone number with formatting' },
  'URL': { icon: '🔗', description: 'Web address with validation' },
  'Checkbox': { icon: '☑️', description: 'Boolean true/false values' },
  'Picklist': { icon: '📋', description: 'Single selection from predefined values' },
  'MultiselectPicklist': { icon: '📋', description: 'Multiple selections from predefined values' },
  'Lookup': { icon: '🔍', description: 'Reference to another record' },
  'MasterDetail': { icon: '🔗', description: 'Parent-child relationship' }
};

export function FieldTypeSuggestion({
  recommendation,
  onAccept,
  onReject
}: FieldTypeSuggestionProps) {
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [alternativeType, setAlternativeType] = useState('');

  const handleReject = () => {
    const reason = alternativeType 
      ? `Prefer ${alternativeType} type. ${rejectReason}`.trim()
      : rejectReason.trim();
    onReject(reason);
    setIsRejectDialogOpen(false);
    setRejectReason('');
    setAlternativeType('');
  };

  // Parse field type from recommendation
  const match = recommendation.description.match(/from (\w+) to (\w+)/);
  const currentType = match?.[1] || 'Text';
  const suggestedType = match?.[2] || recommendation.examples?.[0] || 'TextArea';
  
  const currentTypeInfo = fieldTypeDetails[currentType as keyof typeof fieldTypeDetails];
  const suggestedTypeInfo = fieldTypeDetails[suggestedType as keyof typeof fieldTypeDetails];

  const hasHighImpact = recommendation.impact === 'high';

  return (
    <>
      <Card className="border-l-4 border-l-purple-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Database className="h-5 w-5 text-purple-500 mt-0.5" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Field Type Recommendation
                  <Badge variant="outline" className="ml-2">
                    {Math.round(recommendation.confidence * 100)}% confidence
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  {recommendation.title}
                </CardDescription>
              </div>
            </div>
            {recommendation.impact && (
              <Badge className={
                recommendation.impact === 'high' ? 'bg-red-100 text-red-800' :
                recommendation.impact === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                'bg-green-100 text-green-800'
              }>
                {recommendation.impact} impact
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{currentTypeInfo?.icon}</span>
                  <div>
                    <p className="font-medium">{currentType}</p>
                    <p className="text-sm text-muted-foreground">
                      {currentTypeInfo?.description}
                    </p>
                  </div>
                </div>
              </div>
              <ArrowRight className="h-5 w-5 mx-4" />
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{suggestedTypeInfo?.icon}</span>
                  <div>
                    <p className="font-medium text-green-700">{suggestedType}</p>
                    <p className="text-sm text-muted-foreground">
                      {suggestedTypeInfo?.description}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {recommendation.rationale}
            </AlertDescription>
          </Alert>

          {hasHighImpact && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>High Impact Change:</strong> Changing field type may require data migration
                and could affect existing integrations, reports, and automation.
              </AlertDescription>
            </Alert>
          )}

          {recommendation.examples && recommendation.examples.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2">
                Similar fields in your org using {suggestedType}:
              </Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {recommendation.examples.map((example, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono">
                    {example}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            <Button size="sm" onClick={onAccept}>
              <CheckCircle className="h-4 w-4 mr-1" />
              Accept {suggestedType}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRejectDialogOpen(true)}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>
          </div>

          {recommendation.relatedChanges && recommendation.relatedChanges.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2">
                Related recommendations:
              </p>
              <ul className="text-sm space-y-1">
                {recommendation.relatedChanges.map((related: Recommendation) => (
                  <li key={related.id} className="flex items-start space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {related.type}
                    </Badge>
                    <span className="text-muted-foreground">{related.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Field Type Suggestion</DialogTitle>
            <DialogDescription>
              Let us know why {suggestedType} isn't the right choice for this field.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="alternative-type">Preferred field type (optional)</Label>
              <Select value={alternativeType} onValueChange={setAlternativeType}>
                <SelectTrigger id="alternative-type" className="mt-1">
                  <SelectValue placeholder="Select an alternative type..." />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(fieldTypeDetails)
                    .filter(type => type !== suggestedType && type !== currentType)
                    .map(type => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center space-x-2">
                          <span>{fieldTypeDetails[type as keyof typeof fieldTypeDetails].icon}</span>
                          <span>{type}</span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="reject-reason">Additional context (optional)</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., This field needs to store values larger than 255 characters..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleReject}>
              Submit Feedback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}