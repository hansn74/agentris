'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { ScrollArea } from '../ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  FileText, 
  Search, 
  Download, 
  Filter,
  Info,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { format } from 'date-fns';

interface DeploymentLogsProps {
  deploymentId: string;
}

export function DeploymentLogs({ deploymentId }: DeploymentLogsProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<'ALL' | 'INFO' | 'WARNING' | 'ERROR'>('ALL');
  
  // Fetch logs
  const { data, isLoading, refetch } = trpc.deployment.getDeploymentLogs.useQuery(
    { 
      deploymentId, 
      level: levelFilter === 'ALL' ? undefined : levelFilter,
      limit: 500 
    },
    { enabled: !!deploymentId }
  );

  const getLogIcon = (level: string) => {
    switch (level) {
      case 'INFO':
        return <Info className="h-4 w-4 text-blue-500" />;
      case 'WARNING':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'ERROR':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <FileText className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLogBadge = (level: string) => {
    const variants: Record<string, any> = {
      'INFO': 'default',
      'WARNING': 'warning',
      'ERROR': 'destructive',
    };

    return (
      <Badge variant={variants[level] || 'outline'} className="text-xs">
        {level}
      </Badge>
    );
  };

  const filteredLogs = data?.logs?.filter(log => 
    searchTerm === '' || 
    log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
    JSON.stringify(log.metadata).toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const handleExport = () => {
    if (!data?.logs) return;
    
    const logText = data.logs.map(log => 
      `[${format(new Date(log.timestamp), 'yyyy-MM-dd HH:mm:ss')}] [${log.level}] ${log.message}${
        log.metadata ? `\n  Metadata: ${JSON.stringify(log.metadata, null, 2)}` : ''
      }`
    ).join('\n\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `deployment-${deploymentId}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Deployment Logs</CardTitle>
            <CardDescription>
              {data?.total || 0} log entries {data?.hasMore && '(showing latest 500)'}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={!data?.logs || data.logs.length === 0}
            >
              <Download className="h-4 w-4 mr-1" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={levelFilter}
            onValueChange={(value: any) => setLevelFilter(value)}
          >
            <SelectTrigger className="w-32">
              <Filter className="h-4 w-4 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Levels</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="WARNING">Warning</SelectItem>
              <SelectItem value="ERROR">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Logs List */}
        <ScrollArea className="h-[400px] rounded-lg border">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-current border-t-transparent" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="h-8 w-8 text-gray-400 mb-2" />
              <p className="text-sm text-muted-foreground">No logs found</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {filteredLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getLogIcon(log.level)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {getLogBadge(log.level)}
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                      </span>
                    </div>
                    <p className="text-sm">{log.message}</p>
                    {log.metadata && (
                      <pre className="text-xs text-muted-foreground bg-muted/30 p-2 rounded overflow-x-auto">
                        {JSON.stringify(log.metadata, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}