'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DollarSign, TrendingUp, Users, AlertCircle } from 'lucide-react';
import { trpc } from '@/trpc/client';
import { format, subDays, subWeeks, subMonths } from 'date-fns';
import UsageChart from './UsageChart';
import CostAlerts from './CostAlerts';

type TimeRange = 'day' | 'week' | 'month' | 'quarter';

export default function CostMonitoringPanel() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [selectedUser, setSelectedUser] = useState<string>('all');

  // Calculate date range based on selection
  const dateRange = useMemo(() => {
    const endDate = new Date();
    let startDate: Date;

    switch (timeRange) {
      case 'day':
        startDate = subDays(endDate, 1);
        break;
      case 'week':
        startDate = subWeeks(endDate, 1);
        break;
      case 'month':
        startDate = subMonths(endDate, 1);
        break;
      case 'quarter':
        startDate = subMonths(endDate, 3);
        break;
      default:
        startDate = subWeeks(endDate, 1);
    }

    return { startDate, endDate };
  }, [timeRange]);

  // Fetch usage statistics
  const { data: usageStats, isLoading, error } = trpc.llm.getUsageStats.useQuery({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center space-y-2 p-6">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-lg font-semibold">Error loading usage data</p>
            <p className="text-sm text-muted-foreground">{error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const stats = usageStats?.aggregated || {
    totalTokens: 0,
    totalCost: 0,
    totalRequests: 0,
    totalCacheHits: 0,
  };

  const cacheHitRate = stats.totalRequests > 0
    ? ((stats.totalCacheHits / stats.totalRequests) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold tracking-tight">LLM Cost Monitoring</h2>
        <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="day">Last 24 Hours</SelectItem>
            <SelectItem value="week">Last Week</SelectItem>
            <SelectItem value="month">Last Month</SelectItem>
            <SelectItem value="quarter">Last Quarter</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'day' ? 'Today' : `This ${timeRange}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.totalTokens.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalRequests} requests
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cacheHitRate}%</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalCacheHits} hits
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Cost/Request</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.totalRequests > 0 
                ? (stats.totalCost / stats.totalRequests).toFixed(4)
                : '0.0000'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Per API call
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed View */}
      <Tabs defaultValue="usage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="usage">Usage Trends</TabsTrigger>
          <TabsTrigger value="providers">Provider Breakdown</TabsTrigger>
          <TabsTrigger value="alerts">Cost Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <UsageChart
            data={usageStats?.userUsage || []}
            timeRange={timeRange}
          />
        </TabsContent>

        <TabsContent value="providers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Provider Usage</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {usageStats?.userUsage && (
                  <div className="space-y-2">
                    {Object.entries(
                      usageStats.userUsage.reduce((acc, item) => {
                        const provider = item.provider || 'ANTHROPIC';
                        if (!acc[provider]) {
                          acc[provider] = { cost: 0, tokens: 0, requests: 0 };
                        }
                        acc[provider].cost += item.cost;
                        acc[provider].tokens += item.tokens;
                        acc[provider].requests += item.requests;
                        return acc;
                      }, {} as Record<string, { cost: number; tokens: number; requests: number }>)
                    ).map(([provider, data]) => (
                      <div key={provider} className="flex items-center justify-between rounded-lg border p-4">
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">
                            {provider}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {data.requests} requests • {data.tokens.toLocaleString()} tokens
                          </p>
                        </div>
                        <Badge variant="secondary">
                          ${data.cost.toFixed(2)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <CostAlerts
            currentSpend={stats.totalCost}
            timeRange={timeRange}
          />
        </TabsContent>
      </Tabs>

      {/* Cache Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Cache Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1">
                <p className="text-sm font-medium">Total Entries</p>
                <p className="text-2xl font-bold">
                  {usageStats?.cacheStats?.totalEntries || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Total Hits</p>
                <p className="text-2xl font-bold">
                  {usageStats?.cacheStats?.totalHits || 0}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium">Avg Hit Rate</p>
                <p className="text-2xl font-bold">
                  {usageStats?.cacheStats?.avgHitRate?.toFixed(1) || 0}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}