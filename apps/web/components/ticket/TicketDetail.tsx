'use client';

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  AlertCircle,
  Calendar,
  User,
  MessageSquare,
  CheckCircle,
  Clock,
  RefreshCw,
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface TicketDetailProps {
  ticketKey: string;
}

export function TicketDetail({ ticketKey }: TicketDetailProps) {
  // Fetch ticket details from tRPC API
  const { data, isLoading, error, refetch } = trpc.jira?.fetchTicketDetails?.useQuery(
    { ticketKey },
    {
      retry: false,
      enabled: true, // Enable tRPC endpoint connection
    }
  ) || { data: undefined, isLoading: false, error: undefined, refetch: () => {} };

  const ticket = data;

  if (isLoading) {
    return <TicketDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/dashboard/tickets">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Tickets
          </Button>
        </Link>

        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>
            Failed to load ticket details. Please try again.
            <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center space-x-2 text-sm">
        <Link href="/dashboard/tickets" className="text-muted-foreground hover:text-foreground">
          Tickets
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{ticket.key}</span>
      </div>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl">
                {ticket.key}: {ticket.summary}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant={getStatusVariant(ticket.status)}>{ticket.status}</Badge>
                <Badge variant={getPriorityVariant(ticket.priority)}>{ticket.priority}</Badge>
                <Badge variant="outline">{ticket.type}</Badge>
              </div>
            </div>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              Sync
            </Button>
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <pre className="whitespace-pre-wrap font-sans">
                  {ticket.description || 'No description provided'}
                </pre>
              </div>
            </CardContent>
          </Card>

          {/* Acceptance Criteria */}
          {ticket.acceptanceCriteria && (
            <Card>
              <CardHeader>
                <CardTitle>Acceptance Criteria</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {ticket.acceptanceCriteria.split('\n').map((criteria: string, index: number) => (
                    <div key={index} className="flex items-start space-x-2">
                      {criteria.trim() && (
                        <>
                          <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <span className="text-sm">{criteria.replace(/^-\s*/, '')}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Comments ({ticket.comments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ticket.comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No comments yet</p>
                ) : (
                  ticket.comments.map((comment: any) => (
                    <div key={comment.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium text-sm">{comment.author}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm pl-6">{comment.body}</p>
                      <Separator />
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Details */}
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Assignee</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{ticket.assignee || 'Unassigned'}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Reporter</p>
                <div className="flex items-center gap-2 mt-1">
                  <User className="h-4 w-4" />
                  <span className="text-sm">{ticket.reporter}</span>
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium text-muted-foreground">Created</p>
                <div className="flex items-center gap-2 mt-1">
                  <Calendar className="h-4 w-4" />
                  <span className="text-sm">{new Date(ticket.created).toLocaleDateString()}</span>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-muted-foreground">Updated</p>
                <div className="flex items-center gap-2 mt-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-sm">{new Date(ticket.updated).toLocaleDateString()}</span>
                </div>
              </div>

              {ticket.dueDate && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Due Date</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm">{ticket.dueDate}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Labels */}
          {ticket.labels && ticket.labels.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Labels</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {ticket.labels.map((label: string) => (
                    <Badge key={label} variant="secondary">
                      {label}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TicketDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />

      <Card>
        <CardHeader>
          <Skeleton className="h-8 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardHeader>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-24" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
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
