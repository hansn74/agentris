'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

interface RollbackDialogProps {
  deploymentId: string;
  open: boolean;
  onClose: () => void;
}

export function RollbackDialog({ deploymentId, open, onClose }: RollbackDialogProps) {
  const [reason, setReason] = useState('');
  const [isRollingBack, setIsRollingBack] = useState(false);
  
  const { toast } = useToast();
  const utils = trpc.useUtils();

  const rollbackMutation = trpc.deployment.rollbackDeployment.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Rollback Initiated',
        description: `Rollback ${data.rollbackId} has been started successfully.`,
      });
      
      // Invalidate deployment status to refresh
      utils.deployment.getDeploymentStatusQuery.invalidate({ deploymentId });
      utils.deployment.getRollbackHistory.invalidate({ deploymentId });
      
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Rollback Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsRollingBack(false);
    },
  });

  const handleRollback = async () => {
    if (!reason.trim()) {
      toast({
        title: 'Reason Required',
        description: 'Please provide a reason for the rollback.',
        variant: 'destructive',
      });
      return;
    }

    setIsRollingBack(true);
    
    await rollbackMutation.mutateAsync({
      deploymentId,
      reason: reason.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5" />
            Rollback Deployment
          </DialogTitle>
          <DialogDescription>
            This will revert the changes made by this deployment. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> Rolling back a deployment will restore the previous state 
              of your Salesforce organization. Ensure you understand the implications before proceeding.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Rollback</Label>
            <Textarea
              id="reason"
              placeholder="Describe why this deployment needs to be rolled back..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={isRollingBack}
              rows={4}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRollingBack}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleRollback}
            disabled={isRollingBack || !reason.trim()}
          >
            {isRollingBack ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                Rolling Back...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Rollback Deployment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}