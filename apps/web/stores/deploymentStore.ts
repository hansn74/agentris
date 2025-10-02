import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface DeploymentInfo {
  id: string;
  deploymentId: string;
  status: string;
  organizationId: string;
  organizationName?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentLog {
  id: string;
  deploymentId: string;
  level: 'INFO' | 'WARNING' | 'ERROR';
  message: string;
  timestamp: Date;
  metadata?: any;
}

export interface DeploymentRollback {
  id: string;
  deploymentId: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  reason: string;
  initiatedBy: string;
  createdAt: Date;
  completedAt?: Date;
  error?: string;
}

interface DeploymentState {
  // Active deployments map
  activeDeployments: Map<string, DeploymentInfo>;
  
  // Deployment logs cache
  deploymentLogs: Map<string, DeploymentLog[]>;
  
  // Rollback history
  rollbackHistory: Map<string, DeploymentRollback[]>;
  
  // Selected deployment for viewing
  selectedDeploymentId: string | null;
  
  // Selected organization for deployment
  selectedOrgId: string | null;
  
  // Deployment options
  deploymentOptions: {
    runTests: boolean;
    checkOnly: boolean;
    rollbackOnError: boolean;
  };
  
  // UI state
  isDeploying: boolean;
  isRollingBack: boolean;
  error: string | null;
  
  // Actions
  addActiveDeployment: (deployment: DeploymentInfo) => void;
  updateDeploymentStatus: (deploymentId: string, status: string, metadata?: any) => void;
  removeActiveDeployment: (deploymentId: string) => void;
  
  addDeploymentLog: (deploymentId: string, log: DeploymentLog) => void;
  setDeploymentLogs: (deploymentId: string, logs: DeploymentLog[]) => void;
  
  addRollback: (deploymentId: string, rollback: DeploymentRollback) => void;
  updateRollbackStatus: (rollbackId: string, status: string, error?: string) => void;
  
  setSelectedDeploymentId: (deploymentId: string | null) => void;
  setSelectedOrgId: (orgId: string | null) => void;
  setDeploymentOptions: (options: Partial<DeploymentState['deploymentOptions']>) => void;
  
  setIsDeploying: (isDeploying: boolean) => void;
  setIsRollingBack: (isRollingBack: boolean) => void;
  setError: (error: string | null) => void;
  
  clearDeploymentData: (deploymentId: string) => void;
  reset: () => void;
}

const initialState = {
  activeDeployments: new Map(),
  deploymentLogs: new Map(),
  rollbackHistory: new Map(),
  selectedDeploymentId: null,
  selectedOrgId: null,
  deploymentOptions: {
    runTests: false,
    checkOnly: false,
    rollbackOnError: true,
  },
  isDeploying: false,
  isRollingBack: false,
  error: null,
};

export const useDeploymentStore = create<DeploymentState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,
        
        addActiveDeployment: (deployment) =>
          set((state) => {
            const newMap = new Map(state.activeDeployments);
            newMap.set(deployment.deploymentId, deployment);
            return { activeDeployments: newMap };
          }),
        
        updateDeploymentStatus: (deploymentId, status, metadata) =>
          set((state) => {
            const newMap = new Map(state.activeDeployments);
            const deployment = newMap.get(deploymentId);
            if (deployment) {
              newMap.set(deploymentId, {
                ...deployment,
                status,
                metadata: metadata || deployment.metadata,
                updatedAt: new Date(),
              });
            }
            return { activeDeployments: newMap };
          }),
        
        removeActiveDeployment: (deploymentId) =>
          set((state) => {
            const newMap = new Map(state.activeDeployments);
            newMap.delete(deploymentId);
            return { activeDeployments: newMap };
          }),
        
        addDeploymentLog: (deploymentId, log) =>
          set((state) => {
            const newMap = new Map(state.deploymentLogs);
            const logs = newMap.get(deploymentId) || [];
            newMap.set(deploymentId, [...logs, log]);
            return { deploymentLogs: newMap };
          }),
        
        setDeploymentLogs: (deploymentId, logs) =>
          set((state) => {
            const newMap = new Map(state.deploymentLogs);
            newMap.set(deploymentId, logs);
            return { deploymentLogs: newMap };
          }),
        
        addRollback: (deploymentId, rollback) =>
          set((state) => {
            const newMap = new Map(state.rollbackHistory);
            const rollbacks = newMap.get(deploymentId) || [];
            newMap.set(deploymentId, [...rollbacks, rollback]);
            return { rollbackHistory: newMap };
          }),
        
        updateRollbackStatus: (rollbackId, status, error) =>
          set((state) => {
            const newMap = new Map(state.rollbackHistory);
            
            // Find and update the rollback across all deployments
            for (const [deploymentId, rollbacks] of newMap.entries()) {
              const rollbackIndex = rollbacks.findIndex(r => r.id === rollbackId);
              if (rollbackIndex !== -1) {
                const updatedRollbacks = [...rollbacks];
                updatedRollbacks[rollbackIndex] = {
                  ...updatedRollbacks[rollbackIndex],
                  status: status as any,
                  completedAt: status === 'COMPLETED' ? new Date() : undefined,
                  error,
                };
                newMap.set(deploymentId, updatedRollbacks);
                break;
              }
            }
            
            return { rollbackHistory: newMap };
          }),
        
        setSelectedDeploymentId: (deploymentId) =>
          set({ selectedDeploymentId: deploymentId }),
        
        setSelectedOrgId: (orgId) =>
          set({ selectedOrgId: orgId }),
        
        setDeploymentOptions: (options) =>
          set((state) => ({
            deploymentOptions: { ...state.deploymentOptions, ...options },
          })),
        
        setIsDeploying: (isDeploying) =>
          set({ isDeploying }),
        
        setIsRollingBack: (isRollingBack) =>
          set({ isRollingBack }),
        
        setError: (error) =>
          set({ error }),
        
        clearDeploymentData: (deploymentId) =>
          set((state) => {
            const activeDeployments = new Map(state.activeDeployments);
            const deploymentLogs = new Map(state.deploymentLogs);
            const rollbackHistory = new Map(state.rollbackHistory);
            
            activeDeployments.delete(deploymentId);
            deploymentLogs.delete(deploymentId);
            rollbackHistory.delete(deploymentId);
            
            return {
              activeDeployments,
              deploymentLogs,
              rollbackHistory,
            };
          }),
        
        reset: () => set(initialState),
      }),
      {
        name: 'deployment-store',
        // Only persist selected options and org, not active deployments or logs
        partialize: (state) => ({
          selectedOrgId: state.selectedOrgId,
          deploymentOptions: state.deploymentOptions,
        }),
      }
    )
  )
);

// Selectors
export const selectActiveDeployments = (state: DeploymentState) => 
  Array.from(state.activeDeployments.values());

export const selectDeploymentById = (deploymentId: string) => (state: DeploymentState) =>
  state.activeDeployments.get(deploymentId);

export const selectDeploymentLogs = (deploymentId: string) => (state: DeploymentState) =>
  state.deploymentLogs.get(deploymentId) || [];

export const selectRollbackHistory = (deploymentId: string) => (state: DeploymentState) =>
  state.rollbackHistory.get(deploymentId) || [];

export const selectIsDeploymentActive = (deploymentId: string) => (state: DeploymentState) => {
  const deployment = state.activeDeployments.get(deploymentId);
  return deployment && ['PENDING', 'IN_PROGRESS', 'DEPLOYING'].includes(deployment.status);
};