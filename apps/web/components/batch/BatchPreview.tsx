'use client';

import { trpc } from '@/trpc/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, FileText, Info } from 'lucide-react';

interface BatchPreviewProps {
  batchId: string;
  format?: 'TABLE' | 'TEXT' | 'DIAGRAM';
}

export function BatchPreview({ batchId, format = 'TABLE' }: BatchPreviewProps) {
  const { data, isLoading, error } = trpc.batch.generateBatchPreview.useQuery({
    batchId,
    format,
    includeDetails: true,
    includeRisks: true,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to generate preview: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data?.data) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>No preview available for this batch</AlertDescription>
      </Alert>
    );
  }

  const preview = data.data;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Batch Preview</CardTitle>
              <CardDescription>
                Generated at {new Date(preview.generatedAt).toLocaleString()}
              </CardDescription>
            </div>
            <Badge variant="outline">
              <FileText className="h-3 w-3 mr-1" />
              {preview.format}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px] w-full border rounded-md p-4 bg-muted/10">
            <pre className="text-sm font-mono whitespace-pre-wrap">
              {preview.content}
            </pre>
          </ScrollArea>
        </CardContent>
      </Card>

      {preview.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(preview.summary).map(([key, value]) => (
                <div key={key}>
                  <div className="text-sm text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}
                  </div>
                  <div className="font-semibold">
                    {typeof value === 'object' ? JSON.stringify(value) : value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {preview.risks && preview.risks.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Identified Risks</AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-2">
              {preview.risks.map((risk: any, idx: number) => (
                <li key={idx} className="flex items-start gap-2">
                  <Badge 
                    variant={risk.severity === 'HIGH' ? 'destructive' : 'secondary'}
                    className="mt-0.5"
                  >
                    {risk.severity}
                  </Badge>
                  <span className="flex-1">{risk.description}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}