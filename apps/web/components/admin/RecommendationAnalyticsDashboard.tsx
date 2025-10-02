'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Activity, Users, 
  FileText, Download, RefreshCw, Calendar,
  CheckCircle, XCircle, Edit, AlertCircle
} from 'lucide-react';
import { trpc } from '@/trpc/client';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'stable';
}

function MetricCard({ title, value, change, icon: Icon, trend }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <div className="flex items-center text-xs text-muted-foreground">
            {trend === 'up' && <TrendingUp className="h-3 w-3 text-green-500 mr-1" />}
            {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 mr-1" />}
            <span className={
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : ''
            }>
              {change > 0 ? '+' : ''}{change}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function RecommendationAnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('week');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch analytics data
  const { data: metrics, isLoading, refetch } = trpc.recommendations.getAnalytics.useQuery({
    timeRange,
    type: selectedType === 'all' ? undefined : selectedType
  }, {
    refetchInterval: 60000 // Refresh every minute
  });

  // Fetch pattern accuracy data
  const { data: patternAccuracy } = trpc.recommendations.getPatternAccuracy.useQuery();

  // Fetch learning metrics
  const { data: learningMetrics } = trpc.recommendations.getLearningMetrics.useQuery();

  const handleExport = async (format: 'json' | 'csv') => {
    const response = await fetch(`/api/recommendations/export?format=${format}&range=${timeRange}`);
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recommendations-analytics-${timeRange}.${format}`;
    a.click();
  };

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  const acceptanceData = [
    { name: 'Accepted', value: metrics?.overview.accepted || 0, color: '#10b981' },
    { name: 'Rejected', value: metrics?.overview.rejected || 0, color: '#ef4444' },
    { name: 'Modified', value: metrics?.overview.modified || 0, color: '#f59e0b' }
  ];

  const typeData = Object.entries(metrics?.byType || {}).map(([type, data]) => ({
    type,
    acceptance: Math.round(data.acceptanceRate * 100),
    total: data.total
  }));

  const trendData = metrics?.trending || [];

  const accuracyData = patternAccuracy || [];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Recommendation Analytics</h1>
          <p className="text-muted-foreground">
            Monitor recommendation performance and learning progress
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={timeRange} onValueChange={(v: any) => setTimeRange(v)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} variant="outline" size="icon">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button onClick={() => handleExport('csv')} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Total Recommendations"
          value={metrics?.overview.totalRecommendations || 0}
          icon={FileText}
        />
        <MetricCard
          title="Acceptance Rate"
          value={`${Math.round((metrics?.overview.overallAcceptance || 0) * 100)}%`}
          change={5}
          trend="up"
          icon={CheckCircle}
        />
        <MetricCard
          title="Average Confidence"
          value={`${Math.round((metrics?.overview.averageConfidence || 0) * 100)}%`}
          icon={Activity}
        />
        <MetricCard
          title="Active Tickets"
          value={metrics?.overview.activeTickets || 0}
          icon={Users}
        />
      </div>

      <Tabs defaultValue="acceptance" className="space-y-4">
        <TabsList>
          <TabsTrigger value="acceptance">Acceptance Rates</TabsTrigger>
          <TabsTrigger value="types">By Type</TabsTrigger>
          <TabsTrigger value="patterns">Pattern Accuracy</TabsTrigger>
          <TabsTrigger value="learning">Learning Progress</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="acceptance" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Acceptance Distribution</CardTitle>
                <CardDescription>Overall recommendation outcomes</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={acceptanceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {acceptanceData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Time-based Metrics</CardTitle>
                <CardDescription>Acceptance rates over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Today</span>
                      <span>{Math.round((metrics?.byTimeRange.today.acceptanceRate || 0) * 100)}%</span>
                    </div>
                    <Progress value={(metrics?.byTimeRange.today.acceptanceRate || 0) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>This Week</span>
                      <span>{Math.round((metrics?.byTimeRange.thisWeek.acceptanceRate || 0) * 100)}%</span>
                    </div>
                    <Progress value={(metrics?.byTimeRange.thisWeek.acceptanceRate || 0) * 100} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>This Month</span>
                      <span>{Math.round((metrics?.byTimeRange.thisMonth.acceptanceRate || 0) * 100)}%</span>
                    </div>
                    <Progress value={(metrics?.byTimeRange.thisMonth.acceptanceRate || 0) * 100} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="types" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommendations by Type</CardTitle>
              <CardDescription>Performance breakdown by recommendation type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={typeData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="type" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="acceptance" fill="#8884d8" name="Acceptance %" />
                  <Bar dataKey="total" fill="#82ca9d" name="Total Count" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pattern Detection Accuracy</CardTitle>
              <CardDescription>How well we predict org patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {accuracyData.map((pattern: any) => (
                  <div key={pattern.patternType} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{pattern.patternType}</span>
                      <div className="flex space-x-2">
                        <Badge variant="outline">
                          Accuracy: {Math.round(pattern.accuracy * 100)}%
                        </Badge>
                        <Badge variant="outline">
                          Precision: {Math.round(pattern.precision * 100)}%
                        </Badge>
                        <Badge variant="outline">
                          Recall: {Math.round(pattern.recall * 100)}%
                        </Badge>
                      </div>
                    </div>
                    <Progress value={pattern.accuracy * 100} className="h-2" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="learning" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Learning System Progress</CardTitle>
                <CardDescription>Improvements from feedback</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between">
                    <span>Iterations</span>
                    <span className="font-bold">{learningMetrics?.iterationCount || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Improvement Rate</span>
                    <span className="font-bold text-green-600">
                      +{((learningMetrics?.improvementRate || 0) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Feedback Incorporated</span>
                    <span className="font-bold">{learningMetrics?.feedbackIncorporated || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Pattern Refinements</span>
                    <span className="font-bold">{learningMetrics?.patternRefinements || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Confidence Adjustments</span>
                    <span className="font-bold">{learningMetrics?.confidenceAdjustments || 0}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Learning Impact</CardTitle>
                <CardDescription>Effect on recommendation quality</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={[
                    { week: 'W1', before: 65, after: 68 },
                    { week: 'W2', before: 68, after: 72 },
                    { week: 'W3', before: 72, after: 78 },
                    { week: 'W4', before: 78, after: 82 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="before" stroke="#94a3b8" name="Before Learning" />
                    <Line type="monotone" dataKey="after" stroke="#10b981" name="After Learning" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trending Recommendations</CardTitle>
              <CardDescription>Recent changes in recommendation patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {trendData.map((trend: any) => (
                  <div key={trend.type} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-full ${
                        trend.trend === 'up' ? 'bg-green-100' : 
                        trend.trend === 'down' ? 'bg-red-100' : 
                        'bg-gray-100'
                      }`}>
                        {trend.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                        {trend.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                        {trend.trend === 'stable' && <Activity className="h-4 w-4 text-gray-600" />}
                      </div>
                      <div>
                        <p className="font-medium">{trend.type}</p>
                        <p className="text-sm text-muted-foreground">
                          {trend.trend === 'up' ? 'Increasing' : 
                           trend.trend === 'down' ? 'Decreasing' : 
                           'Stable'} acceptance
                        </p>
                      </div>
                    </div>
                    <Badge variant={
                      trend.trend === 'up' ? 'default' : 
                      trend.trend === 'down' ? 'destructive' : 
                      'secondary'
                    }>
                      {trend.change > 0 ? '+' : ''}{(trend.change * 100).toFixed(0)}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}