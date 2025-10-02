'use client';

import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Eye, 
  Code2, 
  GitBranch, 
  Layout, 
  Table, 
  FileText,
  RefreshCw,
  Clock,
  AlertCircle
} from 'lucide-react';
import { PreviewFormat, PreviewData } from '@agentris/shared';
import { DiagramView } from './DiagramView';
import { MockupView } from './MockupView';
import { CodeDiffView } from './CodeDiffView';
import { DependencyGraph } from './DependencyGraph';
import { TableView } from './TableView';
import { TextView } from './TextView';
import { formatDistanceToNow } from 'date-fns';
import { trpc } from '@/trpc/client';
import { useToast } from '@/components/ui/use-toast';

interface PreviewViewerProps {
  ticketId: string;
  ticketContent: string;
  initialFormat?: PreviewFormat;
  className?: string;
}

const formatIcons = {
  [PreviewFormat.DIAGRAM]: <GitBranch className="h-4 w-4" />,
  [PreviewFormat.MOCKUP]: <Layout className="h-4 w-4" />,
  [PreviewFormat.CODE_DIFF]: <Code2 className="h-4 w-4" />,
  [PreviewFormat.DEPENDENCY_GRAPH]: <GitBranch className="h-4 w-4" />,
  [PreviewFormat.TABLE]: <Table className="h-4 w-4" />,
  [PreviewFormat.TEXT]: <FileText className="h-4 w-4" />,
};

const formatLabels = {
  [PreviewFormat.DIAGRAM]: 'Flow Diagram',
  [PreviewFormat.MOCKUP]: 'Layout Mockup',
  [PreviewFormat.CODE_DIFF]: 'Code Changes',
  [PreviewFormat.DEPENDENCY_GRAPH]: 'Dependencies',
  [PreviewFormat.TABLE]: 'Table View',
  [PreviewFormat.TEXT]: 'Text Description',
};

export function PreviewViewer({ 
  ticketId, 
  ticketContent,
  initialFormat,
  className 
}: PreviewViewerProps) {
  const [selectedFormat, setSelectedFormat] = useState<PreviewFormat | null>(initialFormat || null);
  const { toast } = useToast();

  // Fetch available formats
  const { data: formatsData } = trpc.preview.getAvailableFormats.useQuery(
    { ticketId },
    { enabled: !!ticketId }
  );

  // Generate initial preview
  const generatePreviewMutation = trpc.preview.generateIntelligentPreview.useMutation({
    onSuccess: (data) => {
      setSelectedFormat(data.format);
      toast({
        title: 'Preview Generated',
        description: `${formatLabels[data.format]} preview created successfully`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Generation Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Switch format mutation
  const switchFormatMutation = trpc.preview.switchPreviewFormat.useMutation({
    onSuccess: (data) => {
      toast({
        title: 'Format Switched',
        description: `Switched to ${formatLabels[data.format]} view`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Switch Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Get current preview data
  const { data: previewData, isLoading } = trpc.preview.getById.useQuery(
    { id: formatsData?.previewId || '' },
    { enabled: !!formatsData?.previewId }
  );

  const handleGeneratePreview = useCallback(() => {
    generatePreviewMutation.mutate({
      ticketId,
      ticketContent,
      format: initialFormat,
    });
  }, [ticketId, ticketContent, initialFormat]);

  const handleFormatChange = useCallback((format: PreviewFormat) => {
    setSelectedFormat(format);
    switchFormatMutation.mutate({
      ticketId,
      ticketContent,
      newFormat: format,
    });
  }, [ticketId, ticketContent]);

  const renderPreviewContent = () => {
    if (!previewData?.metadata) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <Eye className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Preview Available</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Generate a preview to visualize the proposed changes
          </p>
          <Button onClick={handleGeneratePreview}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Generate Preview
          </Button>
        </div>
      );
    }

    const data = previewData.metadata as PreviewData;
    
    switch (data.type) {
      case 'diagram':
        return <DiagramView data={data} />;
      case 'mockup':
        return <MockupView data={data} />;
      case 'code-diff':
        return <CodeDiffView data={data} />;
      case 'dependency-graph':
        return <DependencyGraph data={data} />;
      case 'table':
        return <TableView data={data} />;
      case 'text':
        return <TextView data={data} />;
      default:
        return (
          <div className="p-4 text-center text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2" />
            <p>Unsupported preview format</p>
          </div>
        );
    }
  };

  const availableFormats = formatsData?.availableFormats || [];
  const isGenerating = generatePreviewMutation.isLoading || switchFormatMutation.isLoading;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Change Preview
          </CardTitle>
          {previewData?.expiresAt && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Expires {formatDistanceToNow(new Date(previewData.expiresAt), { addSuffix: true })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {availableFormats.length > 0 ? (
          <Tabs 
            value={selectedFormat || availableFormats[0]} 
            onValueChange={(value) => handleFormatChange(value as PreviewFormat)}
          >
            <TabsList className="grid grid-cols-3 lg:grid-cols-6 mb-4">
              {Object.values(PreviewFormat).map((format) => {
                const isAvailable = availableFormats.includes(format);
                return (
                  <TabsTrigger
                    key={format}
                    value={format}
                    disabled={!isAvailable || isGenerating}
                    className="flex items-center gap-1"
                  >
                    {formatIcons[format]}
                    <span className="hidden sm:inline">{formatLabels[format]}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
            <TabsContent value={selectedFormat || availableFormats[0]} className="mt-4">
              <div className="relative">
                {isLoading || isGenerating ? (
                  <div className="flex items-center justify-center p-8">
                    <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  renderPreviewContent()
                )}
              </div>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex flex-col items-center justify-center p-8">
            {!previewData ? (
              <>
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Generate Your First Preview</h3>
                <p className="text-sm text-muted-foreground mb-4 text-center max-w-md">
                  Our AI will analyze your requirements and generate the most appropriate preview format
                </p>
                <Button 
                  onClick={handleGeneratePreview}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Generate Preview
                    </>
                  )}
                </Button>
              </>
            ) : (
              renderPreviewContent()
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}