'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  AlertCircle, 
  AlertTriangle, 
  XOctagon, 
  Shield, 
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  GitBranch,
  Link2,
  FileWarning,
  Ban
} from 'lucide-react';
import type { Recommendation } from '@agentris/shared';

interface ConflictAlertProps {
  conflict: Recommendation;
  onResolve: () => void;
  onDismiss: () => void;
}

const severityConfig = {
  critical: {
    icon: XOctagon,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-l-red-600',
    badgeColor: 'bg-red-100 text-red-800'
  },
  high: {
    icon: AlertTriangle,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-l-orange-600',
    badgeColor: 'bg-orange-100 text-orange-800'
  },
  medium: {
    icon: AlertCircle,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-l-yellow-600',
    badgeColor: 'bg-yellow-100 text-yellow-800'
  },
  low: {
    icon: Shield,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-l-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800'
  }
};

const conflictTypeIcons = {
  duplicate: FileWarning,
  dependency: Link2,
  circular: GitBranch,
  naming: AlertCircle,
  reserved: Ban
};

export function ConflictAlert({
  conflict,
  onResolve,
  onDismiss
}: ConflictAlertProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [resolutionChoice, setResolutionChoice] = useState('');

  const severity = (conflict.impact || 'medium') as keyof typeof severityConfig;
  const config = severityConfig[severity];
  const Icon = config.icon;

  // Parse conflict type from description
  const conflictType = conflict.description.toLowerCase().includes('duplicate') ? 'duplicate' :
                       conflict.description.toLowerCase().includes('circular') ? 'circular' :
                       conflict.description.toLowerCase().includes('dependency') ? 'dependency' :
                       conflict.description.toLowerCase().includes('reserved') ? 'reserved' : 'naming';
  
  const TypeIcon = conflictTypeIcons[conflictType];

  const handleResolve = () => {
    onResolve();
    setIsResolveDialogOpen(false);
    setResolutionChoice('');
  };

  const resolutionOptions = [
    { value: 'rename', label: 'Rename the conflicting component', description: 'Choose a different name to avoid the conflict' },
    { value: 'merge', label: 'Merge with existing component', description: 'Use the existing component instead of creating a new one' },
    { value: 'override', label: 'Override existing component', description: 'Replace the existing component (requires careful review)' },
    { value: 'postpone', label: 'Address in a later phase', description: 'Document the conflict and resolve it separately' }
  ];

  return (
    <>
      <Card className={`border-l-4 ${config.borderColor} ${config.bgColor}`}>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-3">
              <div className="flex items-center space-x-2">
                <Icon className={`h-5 w-5 ${config.color}`} />
                <TypeIcon className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-base flex items-center gap-2">
                  {conflict.title}
                  <Badge className={config.badgeColor}>
                    {severity === 'critical' ? 'CRITICAL' : severity.toUpperCase()} CONFLICT
                  </Badge>
                </CardTitle>
                <CardDescription className="mt-1">
                  {conflict.description}
                </CardDescription>
              </div>
            </div>
            <Badge variant="outline">
              {Math.round(conflict.confidence * 100)}% confidence
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {severity === 'critical' && (
            <Alert variant="destructive">
              <XOctagon className="h-4 w-4" />
              <AlertTitle>Critical Conflict</AlertTitle>
              <AlertDescription>
                This conflict must be resolved before deployment. It could cause system failures or data loss.
              </AlertDescription>
            </Alert>
          )}

          <div className="bg-white p-3 rounded-lg border">
            <p className="text-sm font-medium mb-2">Why this is a problem:</p>
            <p className="text-sm text-muted-foreground">
              {conflict.rationale}
            </p>
          </div>

          {conflict.examples && conflict.examples.length > 0 && (
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="w-full justify-between">
                  <span>View affected components ({conflict.examples.length})</span>
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-2">
                <div className="bg-muted/50 p-3 rounded-lg space-y-2">
                  {conflict.examples.map((component, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <FileWarning className="h-4 w-4 text-muted-foreground" />
                      <code className="text-sm font-mono bg-white px-2 py-1 rounded">
                        {component}
                      </code>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {conflict.relatedChanges && conflict.relatedChanges.length > 0 && (
            <div className="border-t pt-3">
              <p className="text-sm font-medium mb-2">Related conflicts:</p>
              <div className="space-y-1">
                {conflict.relatedChanges.map((related: Recommendation) => (
                  <div key={related.id} className="flex items-center space-x-2 text-sm">
                    <AlertCircle className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{related.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-2 pt-2">
            {severity === 'critical' || severity === 'high' ? (
              <Button 
                size="sm" 
                variant="default"
                onClick={() => setIsResolveDialogOpen(true)}
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Resolve Conflict
              </Button>
            ) : (
              <>
                <Button 
                  size="sm"
                  onClick={() => setIsResolveDialogOpen(true)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onDismiss}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Dismiss
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={isResolveDialogOpen} onOpenChange={setIsResolveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Resolve Conflict</DialogTitle>
            <DialogDescription>
              Choose how to resolve the {conflictType} conflict
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <RadioGroup value={resolutionChoice} onValueChange={setResolutionChoice}>
              {resolutionOptions.map((option) => (
                <div key={option.value} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-muted/50">
                  <RadioGroupItem value={option.value} id={option.value} className="mt-1" />
                  <Label htmlFor={option.value} className="flex-1 cursor-pointer">
                    <p className="font-medium">{option.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {option.description}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsResolveDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleResolve}
              disabled={!resolutionChoice}
            >
              Apply Resolution
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}