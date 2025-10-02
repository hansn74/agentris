import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AlertThreshold {
  id: string;
  name: string;
  threshold: number;
  period: 'daily' | 'weekly' | 'monthly';
  enabled: boolean;
  notifyEmail: boolean;
  notifyDashboard: boolean;
}

interface Alert {
  id: string;
  thresholdId: string;
  message: string;
  timestamp: number;
  type: 'warning' | 'critical' | 'info';
  acknowledged: boolean;
}

interface CostAlertStore {
  thresholds: AlertThreshold[];
  alerts: Alert[];
  addThreshold: (threshold: AlertThreshold) => void;
  updateThreshold: (id: string, updates: Partial<AlertThreshold>) => void;
  removeThreshold: (id: string) => void;
  addAlert: (alert: Omit<Alert, 'id'>) => void;
  clearAlert: (id: string) => void;
  acknowledgeAlert: (id: string) => void;
  clearAllAlerts: () => void;
}

export const useCostAlertStore = create<CostAlertStore>()(
  persist(
    (set) => ({
      thresholds: [
        {
          id: 'default-daily',
          name: 'Daily Limit',
          threshold: 10,
          period: 'daily',
          enabled: true,
          notifyEmail: false,
          notifyDashboard: true,
        },
        {
          id: 'default-monthly',
          name: 'Monthly Budget',
          threshold: 100,
          period: 'monthly',
          enabled: true,
          notifyEmail: true,
          notifyDashboard: true,
        },
      ],
      alerts: [],

      addThreshold: (threshold) =>
        set((state) => ({
          thresholds: [...state.thresholds, threshold],
        })),

      updateThreshold: (id, updates) =>
        set((state) => ({
          thresholds: state.thresholds.map((t) =>
            t.id === id ? { ...t, ...updates } : t
          ),
        })),

      removeThreshold: (id) =>
        set((state) => ({
          thresholds: state.thresholds.filter((t) => t.id !== id),
        })),

      addAlert: (alert) =>
        set((state) => ({
          alerts: [
            {
              ...alert,
              id: Date.now().toString(),
            },
            ...state.alerts,
          ].slice(0, 100), // Keep only last 100 alerts
        })),

      clearAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((a) => a.id !== id),
        })),

      acknowledgeAlert: (id) =>
        set((state) => ({
          alerts: state.alerts.map((a) =>
            a.id === id ? { ...a, acknowledged: true } : a
          ),
        })),

      clearAllAlerts: () =>
        set(() => ({
          alerts: [],
        })),
    }),
    {
      name: 'cost-alert-storage',
      partialize: (state) => ({
        thresholds: state.thresholds,
        // Don't persist alerts across sessions
      }),
    }
  )
);