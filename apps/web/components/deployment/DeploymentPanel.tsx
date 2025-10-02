'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { Rocket, AlertCircle, Info } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useToast } from '@/hooks/use-toast';

interface DeploymentPanelProps {
  approvalId: string;
  approvedItems: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
  }>;
}

export function DeploymentPanel({ approvalId, approvedItems }: DeploymentPanelProps) {
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');
  const [runTests, setRunTests] = useState(false);
  const [checkOnly, setCheckOnly] = useState(false);
  const [rollbackOnError, setRollbackOnError] = useState(true);
  const [isDeploying, setIsDeploying] = useState(false);
  
  const { toast } = useToast();
  const utils = trpc.useUtils();

  // Get user's Salesforce organizations
  const { data: orgs, isLoading: orgsLoading } = trpc.salesforce.listOrganizations.useQuery();
  
  // Deploy mutation
  const deployMutation = trpc.deployment.deployChanges.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Deployment Started',
        description: `Deployment ${data.deploymentId} has been initiated successfully.`,
      });
      
      // Navigate to deployment status page or open status panel
      window.location.href = `/dashboard/deployments/${data.deploymentId}`;
    },
    onError: (error) => {
      toast({
        title: 'Deployment Failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsDeploying(false);
    },
  });

  const handleDeploy = async () => {
    if (!selectedOrgId) {
      toast({
        title: 'Select Organization',
        description: 'Please select a target organization for deployment.',
        variant: 'destructive',
      });
      return;
    }

    setIsDeploying(true);
    
    await deployMutation.mutateAsync({
      approvalId,
      targetOrgId: selectedOrgId,
      options: {
        runTests,
        checkOnly,
        rollbackOnError,
      },
    });
  };

  const getOrgTypeBadge = (orgType: string) => {
    return orgType === 'PRODUCTION' ? (
      <Badge variant="destructive">Production</Badge>
    ) : (
      <Badge variant="secondary">Sandbox</Badge>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deploy Approved Changes
        </CardTitle>
        <CardDescription>
          Deploy {approvedItems.length} approved changes to your Salesforce organization
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Organization Selection */}
        <div className="space-y-2">
          <Label htmlFor="org-select">Target Organization</Label>
          <Select
            value={selectedOrgId}
            onValueChange={setSelectedOrgId}
            disabled={orgsLoading || isDeploying}
          >
            <SelectTrigger id="org-select">
              <SelectValue placeholder="Select a Salesforce organization" />
            </SelectTrigger>
            <SelectContent>
              {orgs?.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <div className="flex items-center justify-between gap-2">
                    <span>{org.name}</span>
                    {getOrgTypeBadge(org.orgType)}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Deployment Options */}
        <div className="space-y-3">
          <Label>Deployment Options</Label>
          
          <div className="flex items-center space-x-2">
            <Checkbox
              id="run-tests"
              checked={runTests}
              onCheckedChange={(checked) => setRunTests(checked as boolean)}
              disabled={isDeploying}
            />
            <Label
              htmlFor="run-tests"
              className="text-sm font-normal cursor-pointer"
            >
              Run all tests after deployment
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="check-only"
              checked={checkOnly}
              onCheckedChange={(checked) => setCheckOnly(checked as boolean)}
              disabled={isDeploying}
            />
            <Label
              htmlFor="check-only"
              className="text-sm font-normal cursor-pointer"
            >
              Validation only (no actual deployment)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="rollback-on-error"
              checked={rollbackOnError}
              onCheckedChange={(checked) => setRollbackOnError(checked as boolean)}
              disabled={isDeploying}
            />
            <Label
              htmlFor="rollback-on-error"
              className="text-sm font-normal cursor-pointer"
            >
              Automatically rollback on error
            </Label>
          </div>
        </div>

        {/* Warning for Production Deployment */}
        {selectedOrgId && orgs?.find(org => org.id === selectedOrgId)?.orgType === 'PRODUCTION' && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> You are about to deploy to a PRODUCTION organization. 
              Please ensure all changes have been thoroughly tested.
            </AlertDescription>
          </Alert>
        )}

        {/* Items Summary */}
        <div className="space-y-2">
          <Label>Changes to Deploy</Label>
          <div className="rounded-lg border p-3 space-y-1 max-h-32 overflow-y-auto">
            {approvedItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span className="font-mono">{item.name}</span>
                <Badge variant="outline">{item.type}</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Info Alert */}
        {checkOnly && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Validation mode: Changes will be validated but not deployed to the organization.
            </AlertDescription>
          </Alert>
        )}

        {/* Deploy Button */}
        <Button
          onClick={handleDeploy}
          disabled={!selectedOrgId || isDeploying || approvedItems.length === 0}
          className="w-full"
          size="lg"
        >
          {isDeploying ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Deploying...
            </>
          ) : checkOnly ? (
            'Validate Changes'
          ) : (
            'Deploy Changes'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}