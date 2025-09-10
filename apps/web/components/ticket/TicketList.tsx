'use client';

import { useState } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function TicketList() {
  const [page, setPage] = useState(0);
  const limit = 10;

  // Fetch tickets from tRPC API
  const { data, isLoading, error, refetch } = trpc.jira.fetchTickets.useQuery(
    { maxResults: limit, startAt: page * limit },
    {
      retry: false,
      enabled: true, // Enable tRPC endpoint connection
    }
  );

  const tickets = data?.tickets || [];
  const hasMore = data?.hasMore || false;

  if (isLoading) {
    return <TicketListSkeleton />;
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load tickets. Please check your Jira connection.
          <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Tickets Found</CardTitle>
          <CardDescription>Connect your Jira account to see your tickets here.</CardDescription>
        </CardHeader>
        <CardContent>
          <Link href="/dashboard/settings/integrations">
            <Button>Connect Jira</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4">
        {tickets.map((ticket) => (
          <Card key={ticket.key} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <Link href={`/dashboard/tickets/${ticket.key}`} className="hover:underline">
                    <CardTitle className="text-lg">
                      {ticket.key}: {ticket.summary}
                    </CardTitle>
                  </Link>
                  <CardDescription>
                    Assigned to {ticket.assignee || 'Unassigned'} • Created{' '}
                    {new Date(ticket.created).toLocaleDateString()} • Updated{' '}
                    {new Date(ticket.updated).toLocaleDateString()}
                  </CardDescription>
                </div>
                <Link
                  href={`/dashboard/tickets/${ticket.key}`}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                <Badge variant={getPriorityVariant(ticket.priority)}>{ticket.priority}</Badge>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex justify-between items-center">
        <Button
          variant="outline"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
        >
          Previous
        </Button>
        <span className="text-sm text-muted-foreground">Page {page + 1}</span>
        <Button variant="outline" onClick={() => setPage((p) => p + 1)} disabled={!hasMore}>
          Next
        </Button>
      </div>
    </div>
  );
}

function TicketListSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20" />
              <Skeleton className="h-6 w-16" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status.toLowerCase()) {
    case 'done':
    case 'completed':
      return 'default';
    case 'in progress':
    case 'implementing':
      return 'secondary';
    case 'blocked':
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getPriorityVariant(priority: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (priority.toLowerCase()) {
    case 'critical':
    case 'highest':
      return 'destructive';
    case 'high':
      return 'default';
    case 'medium':
      return 'secondary';
    default:
      return 'outline';
  }
}
