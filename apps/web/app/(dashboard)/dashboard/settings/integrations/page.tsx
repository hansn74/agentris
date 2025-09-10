'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, Link2, Loader2, X } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const jiraConnectionSchema = z.object({
  instanceUrl: z.string().url('Please enter a valid URL'),
});

type JiraConnectionData = z.infer<typeof jiraConnectionSchema>;

export default function IntegrationsPage() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Mock connection status - in real app would come from API
  const [isConnected, setIsConnected] = useState(false);
  const [connectedInstance, setConnectedInstance] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JiraConnectionData>({
    resolver: zodResolver(jiraConnectionSchema),
  });

  // TODO: Fix TypeScript issue with jira router
  const connectJira = trpc.jira?.connect?.useMutation({
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
    onError: (error: { message: string }) => {
      setConnectionError(error.message);
      setIsConnecting(false);
    },
  }) || { mutate: () => {} };

  const disconnectJira = trpc.jira?.disconnect?.useMutation({
    onSuccess: () => {
      setIsConnected(false);
      setConnectedInstance(null);
    },
  }) || { mutate: () => {} };

  const onSubmit = async (data: JiraConnectionData) => {
    setIsConnecting(true);
    setConnectionError(null);
    connectJira.mutate({ instanceUrl: data.instanceUrl });
  };

  const handleDisconnect = () => {
    disconnectJira.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm">
        <Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">
          Settings
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">Integrations</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Integrations</h1>
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Settings
          </Button>
        </Link>
      </div>

      {/* Jira Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Link2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Jira Integration</CardTitle>
                <CardDescription>
                  Connect your Jira account to import and sync tickets
                </CardDescription>
              </div>
            </div>
            {isConnected && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                Connected
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {connectionError && (
            <Alert variant="destructive">
              <AlertDescription>{connectionError}</AlertDescription>
            </Alert>
          )}

          {!isConnected ? (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instanceUrl">Jira Instance URL</Label>
                <Input
                  id="instanceUrl"
                  type="url"
                  placeholder="https://your-domain.atlassian.net"
                  {...register('instanceUrl')}
                  disabled={isConnecting}
                />
                {errors.instanceUrl && (
                  <p className="text-sm text-red-500">{errors.instanceUrl.message}</p>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <Button type="submit" disabled={isConnecting}>
                  {isConnecting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Connect Jira
                    </>
                  )}
                </Button>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>You'll be redirected to Jira to authorize the connection.</p>
                <p>Make sure you have admin access to your Jira instance.</p>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm font-medium">Connected Instance</p>
                <p className="text-sm text-muted-foreground">{connectedInstance}</p>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-medium">Connection Settings</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Auto-sync tickets</p>
                      <p className="text-xs text-muted-foreground">
                        Automatically sync tickets every 15 minutes
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="text-sm font-medium">Project filters</p>
                      <p className="text-xs text-muted-foreground">Select which projects to sync</p>
                    </div>
                    <Button variant="outline" size="sm">
                      Configure
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 pt-4 border-t">
                <Button variant="destructive" onClick={handleDisconnect}>
                  <X className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
                <Button variant="outline">Test Connection</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Other Integrations (Future) */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>GitHub Integration</CardTitle>
            <CardDescription>Connect GitHub to link code changes with tickets</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline">
              Coming Soon
            </Button>
          </CardContent>
        </Card>

        <Card className="opacity-50">
          <CardHeader>
            <CardTitle>Slack Integration</CardTitle>
            <CardDescription>Get notifications and updates in Slack</CardDescription>
          </CardHeader>
          <CardContent>
            <Button disabled variant="outline">
              Coming Soon
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
