'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  DollarSign, 
  TrendingUp, 
  Bell, 
  BellOff,
  Info,
  CheckCircle 
} from 'lucide-react';
import { useCostAlertStore } from '@/stores/costAlertStore';

interface CostAlertsProps {
  currentSpend: number;
  timeRange: 'day' | 'week' | 'month' | 'quarter';
}

interface AlertThreshold {
  id: string;
  name: string;
  threshold: number;
  period: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  notifyEmail: boolean;
  notifyDashboard: boolean;
}

export default function CostAlerts({ currentSpend, timeRange }: CostAlertsProps) {
  const { 
    thresholds, 
    alerts, 
    addThreshold, 
    updateThreshold, 
    removeThreshold,
    clearAlert 
  } = useCostAlertStore();

  const [newThreshold, setNewThreshold] = useState<Partial<AlertThreshold>>({
    name: '',
    threshold: 100,
    period: 'monthly',
    enabled: true,
    notifyEmail: true,
    notifyDashboard: true,
  });

  // Check for threshold breaches
  useEffect(() => {
    thresholds.forEach(threshold => {
      if (!threshold.enabled) return;

      let shouldAlert = false;
      const normalizedSpend = normalizeSpendToPeriod(currentSpend, timeRange, threshold.period);

      if (normalizedSpend > threshold.threshold) {
        shouldAlert = true;
      }

      if (shouldAlert) {
        // This would normally trigger an alert in the system
        console.log(`Cost alert: ${threshold.name} threshold exceeded`);
      }
    });
  }, [currentSpend, timeRange, thresholds]);

  // Normalize spend to compare with thresholds
  const normalizeSpendToPeriod = (
    spend: number,
    currentPeriod: string,
    targetPeriod: string
  ): number => {
    const multipliers: Record<string, number> = {
      'day-daily': 1,
      'day-weekly': 7,
      'day-monthly': 30,
      'week-daily': 1/7,
      'week-weekly': 1,
      'week-monthly': 4.3,
      'month-daily': 1/30,
      'month-weekly': 1/4.3,
      'month-monthly': 1,
      'quarter-daily': 1/90,
      'quarter-weekly': 1/13,
      'quarter-monthly': 1/3,
    };

    const key = `${currentPeriod}-${targetPeriod}`;
    return spend * (multipliers[key] || 1);
  };

  const handleAddThreshold = () => {
    if (newThreshold.name && newThreshold.threshold) {
      addThreshold({
        ...newThreshold as AlertThreshold,
        id: Date.now().toString(),
      });
      setNewThreshold({
        name: '',
        threshold: 100,
        period: 'monthly',
        enabled: true,
        notifyEmail: true,
        notifyDashboard: true,
      });
    }
  };

  // Get active alerts based on current thresholds
  const activeAlerts = thresholds
    .filter(threshold => {
      if (!threshold.enabled) return false;
      const normalizedSpend = normalizeSpendToPeriod(currentSpend, timeRange, threshold.period);
      return normalizedSpend > threshold.threshold;
    })
    .map(threshold => ({
      ...threshold,
      percentageOver: 
        ((normalizeSpendToPeriod(currentSpend, timeRange, threshold.period) - threshold.threshold) / 
        threshold.threshold * 100).toFixed(1)
    }));

  return (
    <div className="space-y-6">
      {/* Active Alerts */}
      {activeAlerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Active Alerts</h3>
          {activeAlerts.map(alert => (
            <Alert key={alert.id} variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>{alert.name}</AlertTitle>
              <AlertDescription>
                Spending is {alert.percentageOver}% over the ${alert.threshold} {alert.period} threshold
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Budget Status */}
      <Card>
        <CardHeader>
          <CardTitle>Budget Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {thresholds.map(threshold => {
              const normalizedSpend = normalizeSpendToPeriod(currentSpend, timeRange, threshold.period);
              const percentage = (normalizedSpend / threshold.threshold) * 100;
              const status = percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'healthy';

              return (
                <div key={threshold.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{threshold.name}</span>
                      <Badge variant={threshold.enabled ? 'default' : 'secondary'}>
                        {threshold.period}
                      </Badge>
                      {!threshold.enabled && (
                        <BellOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="text-sm text-muted-foreground">
                      ${normalizedSpend.toFixed(2)} / ${threshold.threshold}
                    </span>
                  </div>
                  <div className="relative h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`absolute left-0 top-0 h-full rounded-full transition-all ${
                        status === 'exceeded'
                          ? 'bg-destructive'
                          : status === 'warning'
                          ? 'bg-warning'
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(percentage, 100)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{percentage.toFixed(1)}% of budget</span>
                    <div className="flex gap-2">
                      <Switch
                        checked={threshold.enabled}
                        onCheckedChange={(checked) =>
                          updateThreshold(threshold.id, { enabled: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeThreshold(threshold.id)}
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add New Threshold */}
      <Card>
        <CardHeader>
          <CardTitle>Add Budget Alert</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold-name">Alert Name</Label>
                <Input
                  id="threshold-name"
                  placeholder="e.g., Monthly API Budget"
                  value={newThreshold.name}
                  onChange={(e) =>
                    setNewThreshold({ ...newThreshold, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold-amount">Threshold Amount ($)</Label>
                <Input
                  id="threshold-amount"
                  type="number"
                  min="0"
                  step="10"
                  value={newThreshold.threshold}
                  onChange={(e) =>
                    setNewThreshold({
                      ...newThreshold,
                      threshold: parseFloat(e.target.value),
                    })
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold-period">Period</Label>
                <Select
                  value={newThreshold.period}
                  onValueChange={(value) =>
                    setNewThreshold({
                      ...newThreshold,
                      period: value as 'daily' | 'weekly' | 'monthly',
                    })
                  }
                >
                  <SelectTrigger id="threshold-period">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notify-email"
                  checked={newThreshold.notifyEmail}
                  onCheckedChange={(checked) =>
                    setNewThreshold({ ...newThreshold, notifyEmail: checked })
                  }
                />
                <Label htmlFor="notify-email">Email Alerts</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notify-dashboard"
                  checked={newThreshold.notifyDashboard}
                  onCheckedChange={(checked) =>
                    setNewThreshold({ ...newThreshold, notifyDashboard: checked })
                  }
                />
                <Label htmlFor="notify-dashboard">Dashboard Alerts</Label>
              </div>
            </div>

            <Button onClick={handleAddThreshold} className="w-full">
              <Bell className="mr-2 h-4 w-4" />
              Add Alert Threshold
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Alert History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.slice(0, 5).map((alert, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {alert.type === 'warning' ? (
                      <AlertTriangle className="h-4 w-4 text-warning" />
                    ) : (
                      <Info className="h-4 w-4 text-info" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{alert.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!alert.acknowledged && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => clearAlert(alert.id)}
                    >
                      <CheckCircle className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">
              No recent alerts
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Import statement fix for Select component
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';