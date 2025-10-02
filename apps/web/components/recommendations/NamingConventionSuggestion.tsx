'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Edit2, Lightbulb, ArrowRight, Info } from 'lucide-react';
import type { Recommendation } from '@agentris/shared';

interface NamingConventionSuggestionProps {
  recommendation: Recommendation;
  onAccept: () => void;
  onReject: (reason?: string) => void;
  onModify: (value: string) => void;
}

export function NamingConventionSuggestion({
  recommendation,
  onAccept,
  onReject,
  onModify
}: NamingConventionSuggestionProps) {
  const [isModifying, setIsModifying] = useState(false);
  const [modifiedName, setModifiedName] = useState('');
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const handleModify = () => {
    if (modifiedName.trim()) {
      onModify(modifiedName.trim());
      setIsModifying(false);
      setModifiedName('');
    }
  };

  const handleReject = () => {
    onReject(rejectReason.trim());
    setIsRejectDialogOpen(false);
    setRejectReason('');
  };

  // Extract suggested name from description or examples
  const suggestedName = recommendation.examples?.[0] || 'SuggestedName__c';
  const currentName = recommendation.description.match(/from "(.+?)"/)?.[1] || 'CurrentName';

  return (
    <>
      <Card className="border-l-4 border-l-blue-500">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  Naming Convention
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
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center space-x-2 text-sm">
              <span className="font-mono bg-red-100 text-red-800 px-2 py-1 rounded">
                {currentName}
              </span>
              <ArrowRight className="h-4 w-4" />
              <span className="font-mono bg-green-100 text-green-800 px-2 py-1 rounded">
                {suggestedName}
              </span>
            </div>
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {recommendation.rationale}
            </AlertDescription>
          </Alert>

          {recommendation.examples && recommendation.examples.length > 1 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2">
                Other naming patterns in your org:
              </Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {recommendation.examples.slice(1).map((example, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono">
                    {example}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {isModifying ? (
            <div className="space-y-3 border-t pt-3">
              <div>
                <Label htmlFor="modified-name">Custom Name</Label>
                <Input
                  id="modified-name"
                  value={modifiedName}
                  onChange={(e) => setModifiedName(e.target.value)}
                  placeholder="Enter your preferred name..."
                  className="mt-1 font-mono"
                />
              </div>
              <div className="flex space-x-2">
                <Button size="sm" onClick={handleModify}>
                  Save Custom Name
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsModifying(false);
                    setModifiedName('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex space-x-2 pt-2">
              <Button size="sm" onClick={onAccept}>
                <CheckCircle className="h-4 w-4 mr-1" />
                Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsModifying(true)}
              >
                <Edit2 className="h-4 w-4 mr-1" />
                Modify
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
          )}

          {recommendation.relatedChanges && recommendation.relatedChanges.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm text-muted-foreground mb-2">
                This change will also affect:
              </p>
              <ul className="text-sm space-y-1">
                {recommendation.relatedChanges.map((related: Recommendation) => (
                  <li key={related.id} className="flex items-center space-x-2">
                    <ArrowRight className="h-3 w-3" />
                    <span>{related.title}</span>
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
            <DialogTitle>Reject Naming Suggestion</DialogTitle>
            <DialogDescription>
              Help us improve by explaining why this suggestion doesn't work for your use case.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="reject-reason">Reason (optional)</Label>
              <Textarea
                id="reject-reason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., We use a different naming convention for this type of field..."
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
              Reject Suggestion
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}