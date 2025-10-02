'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';
import { ChevronRight, Package, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';

const statusConfig = {
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Approved', icon: CheckCircle, className: 'bg-green-100 text-green-800' },
  PROCESSING: { label: 'Processing', icon: Package, className: 'bg-blue-100 text-blue-800' },
  COMPLETED: { label: 'Completed', icon: CheckCircle, className: 'bg-green-100 text-green-800' },
  PARTIALLY_COMPLETED: { label: 'Partial', icon: AlertCircle, className: 'bg-orange-100 text-orange-800' },
  FAILED: { label: 'Failed', icon: XCircle, className: 'bg-red-100 text-red-800' },
};

export function BatchList() {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  
  const { data, isLoading, error } = trpc.batch.listBatches.useQuery({
    status: selectedStatus === 'ALL' ? undefined : selectedStatus as any,
    limit: 20,
    offset: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-pulse text-muted-foreground">Loading batches...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-red-500 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            <span>Failed to load batches</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Batch Processing</h2>
        <Link href="/batch/new">
          <Button>Create New Batch</Button>
        </Link>
      </div>

      <Tabs value={selectedStatus} onValueChange={setSelectedStatus}>
        <TabsList>
          <TabsTrigger value="ALL">All</TabsTrigger>
          <TabsTrigger value="PENDING">Pending</TabsTrigger>
          <TabsTrigger value="PROCESSING">Processing</TabsTrigger>
          <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
          <TabsTrigger value="FAILED">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={selectedStatus} className="mt-6">
          <div className="grid gap-4">
            {data?.data.batches.map((batch) => {
              const config = statusConfig[batch.status as keyof typeof statusConfig];
              const Icon = config.icon;
              
              return (
                <Card key={batch.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{batch.name}</CardTitle>
                        <CardDescription>
                          {batch.ticketCount} tickets • Created {formatDistanceToNow(new Date(batch.createdAt))} ago
                        </CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={config.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <Link href={`/batch/${batch.id}`}>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
            
            {data?.data.batches.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                  <Package className="h-12 w-12 mb-4" />
                  <p>No batches found</p>
                  <p className="text-sm mt-1">Create your first batch to get started</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}