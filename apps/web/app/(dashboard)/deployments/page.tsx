'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Loader2,
  Filter,
  RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';

export default function DeploymentsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');

  // Get active deployments
  const { data: activeDeployments, refetch: refetchActive } = trpc.deployment.getActiveDeployments.useQuery();

  // Get deployment history
  const { data: deploymentHistory, refetch: refetchHistory } = trpc.deployment.getDeploymentHistory.useQuery({
    limit: 50,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'IN_PROGRESS':
      case 'DEPLOYING':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'PENDING':
        return <Clock className="h-4 w-4 text-gray-500" />;
      case 'PARTIAL_SUCCESS':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Rocket className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      'SUCCEEDED': 'success',
      'FAILED': 'destructive',
      'IN_PROGRESS': 'default',
      'DEPLOYING': 'default',
      'PENDING': 'secondary',
      'PARTIAL_SUCCESS': 'warning',
    };

    return (
      <Badge variant={variants[status] || 'outline'}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  const handleRefresh = () => {
    refetchActive();
    refetchHistory();
  };

  const navigateToDeployment = (deploymentId: string) => {
    router.push(`/dashboard/deployments/${deploymentId}`);
  };

  const filterDeployments = (deployments: any[]) => {
    if (!searchTerm) return deployments;
    
    return deployments.filter(d => 
      d.deploymentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.organization?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Deployments</h1>
          <p className="text-muted-foreground">
            Monitor and manage your Salesforce deployments
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Active Deployments Card */}
      {activeDeployments && activeDeployments.count > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Active Deployments</CardTitle>
            <CardDescription>
              {activeDeployments.count} deployment{activeDeployments.count !== 1 ? 's' : ''} in progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeDeployments.deployments.map((deployment) => (
                <div
                  key={deployment.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 cursor-pointer transition-colors"
                  onClick={() => navigateToDeployment(deployment.deploymentId)}
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(deployment.status)}
                    <div>
                      <p className="font-medium">{deployment.deploymentId}</p>
                      <p className="text-sm text-muted-foreground">
                        {deployment.organization.name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {deployment.organization.orgType === 'PRODUCTION' ? (
                      <Badge variant="destructive">Production</Badge>
                    ) : (
                      <Badge variant="secondary">Sandbox</Badge>
                    )}
                    {getStatusBadge(deployment.status)}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployment History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Deployment History</CardTitle>
              <CardDescription>
                Recent deployments across all organizations
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search deployments..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="succeeded">Succeeded</TabsTrigger>
              <TabsTrigger value="failed">Failed</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              <DeploymentList 
                deployments={filterDeployments(deploymentHistory?.deployments || [])}
                onSelect={navigateToDeployment}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </TabsContent>

            <TabsContent value="succeeded" className="mt-4">
              <DeploymentList 
                deployments={filterDeployments(
                  deploymentHistory?.deployments.filter(d => d.status === 'SUCCEEDED') || []
                )}
                onSelect={navigateToDeployment}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </TabsContent>

            <TabsContent value="failed" className="mt-4">
              <DeploymentList 
                deployments={filterDeployments(
                  deploymentHistory?.deployments.filter(d => d.status === 'FAILED') || []
                )}
                onSelect={navigateToDeployment}
                getStatusIcon={getStatusIcon}
                getStatusBadge={getStatusBadge}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function DeploymentList({ 
  deployments, 
  onSelect, 
  getStatusIcon, 
  getStatusBadge 
}: {
  deployments: any[];
  onSelect: (id: string) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusBadge: (status: string) => JSX.Element;
}) {
  if (deployments.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No deployments found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {deployments.map((deployment) => (
        <div
          key={deployment.id}
          className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/5 cursor-pointer transition-colors"
          onClick={() => onSelect(deployment.deploymentId)}
        >
          <div className="flex items-center gap-3">
            {getStatusIcon(deployment.status)}
            <div>
              <p className="font-medium font-mono text-sm">{deployment.deploymentId}</p>
              <p className="text-sm text-muted-foreground">
                {deployment.organization?.name || 'Unknown Organization'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm">
                {format(new Date(deployment.createdAt), 'MMM d, yyyy')}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(deployment.createdAt), 'h:mm a')}
              </p>
            </div>
            {getStatusBadge(deployment.status)}
          </div>
        </div>
      ))}
    </div>
  );
}