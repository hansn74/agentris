import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PreviewItem, Approval } from '@agentris/db';

interface ApprovalState {
  // Selection state
  selectedItems: Set<string>;
  selectItem: (itemId: string) => void;
  deselectItem: (itemId: string) => void;
  toggleItemSelection: (itemId: string) => void;
  selectAll: (itemIds: string[]) => void;
  clearSelection: () => void;
  setSelectedItems: (items: Set<string>) => void;

  // Filter state
  filterStatus: 'all' | 'pending' | 'approved' | 'rejected' | 'modified';
  filterImpact: 'all' | 'LOW' | 'MEDIUM' | 'HIGH';
  filterItemType: string | null;
  searchQuery: string;
  setFilterStatus: (status: ApprovalState['filterStatus']) => void;
  setFilterImpact: (impact: ApprovalState['filterImpact']) => void;
  setFilterItemType: (itemType: string | null) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // Approval queue state
  pendingItems: PreviewItem[];
  approvedItems: string[];
  rejectedItems: string[];
  modifiedItems: Map<string, any>;
  setPendingItems: (items: PreviewItem[]) => void;
  markItemApproved: (itemId: string) => void;
  markItemRejected: (itemId: string) => void;
  markItemModified: (itemId: string, data: any) => void;
  
  // Bulk operations
  bulkApprovalPattern: {
    itemType?: string;
    impact?: string;
  } | null;
  setBulkApprovalPattern: (pattern: ApprovalState['bulkApprovalPattern']) => void;
  
  // History
  approvalHistory: Approval[];
  setApprovalHistory: (history: Approval[]) => void;
  
  // Optimistic updates
  optimisticApprove: (itemIds: string[]) => void;
  optimisticReject: (itemIds: string[]) => void;
  revertOptimisticUpdate: (itemIds: string[]) => void;
  
  // UI state
  isProcessing: boolean;
  processingItemIds: Set<string>;
  setProcessing: (isProcessing: boolean, itemIds?: string[]) => void;
  
  // Real-time updates
  handleRealtimeUpdate: (update: {
    type: 'APPROVED' | 'REJECTED' | 'MODIFIED';
    itemIds: string[];
    userId: string;
  }) => void;
}

export const useApprovalStore = create<ApprovalState>()(
  devtools(
    persist(
      immer((set, get) => ({
        // Selection state
        selectedItems: new Set(),
        
        selectItem: (itemId) => set((state) => {
          state.selectedItems.add(itemId);
        }),
        
        deselectItem: (itemId) => set((state) => {
          state.selectedItems.delete(itemId);
        }),
        
        toggleItemSelection: (itemId) => set((state) => {
          if (state.selectedItems.has(itemId)) {
            state.selectedItems.delete(itemId);
          } else {
            state.selectedItems.add(itemId);
          }
        }),
        
        selectAll: (itemIds) => set((state) => {
          state.selectedItems = new Set(itemIds);
        }),
        
        clearSelection: () => set((state) => {
          state.selectedItems.clear();
        }),
        
        setSelectedItems: (items) => set((state) => {
          state.selectedItems = items;
        }),

        // Filter state
        filterStatus: 'all',
        filterImpact: 'all',
        filterItemType: null,
        searchQuery: '',
        
        setFilterStatus: (status) => set((state) => {
          state.filterStatus = status;
        }),
        
        setFilterImpact: (impact) => set((state) => {
          state.filterImpact = impact;
        }),
        
        setFilterItemType: (itemType) => set((state) => {
          state.filterItemType = itemType;
        }),
        
        setSearchQuery: (query) => set((state) => {
          state.searchQuery = query;
        }),
        
        resetFilters: () => set((state) => {
          state.filterStatus = 'all';
          state.filterImpact = 'all';
          state.filterItemType = null;
          state.searchQuery = '';
        }),

        // Approval queue state
        pendingItems: [],
        approvedItems: [],
        rejectedItems: [],
        modifiedItems: new Map(),
        
        setPendingItems: (items) => set((state) => {
          state.pendingItems = items;
        }),
        
        markItemApproved: (itemId) => set((state) => {
          state.approvedItems.push(itemId);
          state.pendingItems = state.pendingItems.filter(item => item.id !== itemId);
          state.selectedItems.delete(itemId);
        }),
        
        markItemRejected: (itemId) => set((state) => {
          state.rejectedItems.push(itemId);
          state.pendingItems = state.pendingItems.filter(item => item.id !== itemId);
          state.selectedItems.delete(itemId);
        }),
        
        markItemModified: (itemId, data) => set((state) => {
          state.modifiedItems.set(itemId, data);
          const itemIndex = state.pendingItems.findIndex(item => item.id === itemId);
          if (itemIndex !== -1) {
            state.pendingItems[itemIndex].proposedState = data;
          }
        }),

        // Bulk operations
        bulkApprovalPattern: null,
        
        setBulkApprovalPattern: (pattern) => set((state) => {
          state.bulkApprovalPattern = pattern;
        }),

        // History
        approvalHistory: [],
        
        setApprovalHistory: (history) => set((state) => {
          state.approvalHistory = history;
        }),

        // Optimistic updates
        optimisticApprove: (itemIds) => set((state) => {
          itemIds.forEach(id => {
            state.approvedItems.push(id);
            state.pendingItems = state.pendingItems.filter(item => item.id !== id);
            state.selectedItems.delete(id);
          });
          state.processingItemIds = new Set(itemIds);
          state.isProcessing = true;
        }),
        
        optimisticReject: (itemIds) => set((state) => {
          itemIds.forEach(id => {
            state.rejectedItems.push(id);
            state.pendingItems = state.pendingItems.filter(item => item.id !== id);
            state.selectedItems.delete(id);
          });
          state.processingItemIds = new Set(itemIds);
          state.isProcessing = true;
        }),
        
        revertOptimisticUpdate: (itemIds) => set((state) => {
          // Remove from approved/rejected lists
          state.approvedItems = state.approvedItems.filter(id => !itemIds.includes(id));
          state.rejectedItems = state.rejectedItems.filter(id => !itemIds.includes(id));
          
          // Re-add to selected items
          itemIds.forEach(id => state.selectedItems.add(id));
          
          state.processingItemIds.clear();
          state.isProcessing = false;
        }),

        // UI state
        isProcessing: false,
        processingItemIds: new Set(),
        
        setProcessing: (isProcessing, itemIds) => set((state) => {
          state.isProcessing = isProcessing;
          if (itemIds) {
            state.processingItemIds = new Set(itemIds);
          } else {
            state.processingItemIds.clear();
          }
        }),

        // Real-time updates
        handleRealtimeUpdate: (update) => set((state) => {
          const { type, itemIds } = update;
          
          switch (type) {
            case 'APPROVED':
              itemIds.forEach(id => {
                if (!state.approvedItems.includes(id)) {
                  state.approvedItems.push(id);
                }
                state.pendingItems = state.pendingItems.filter(item => item.id !== id);
                state.selectedItems.delete(id);
              });
              break;
              
            case 'REJECTED':
              itemIds.forEach(id => {
                if (!state.rejectedItems.includes(id)) {
                  state.rejectedItems.push(id);
                }
                state.pendingItems = state.pendingItems.filter(item => item.id !== id);
                state.selectedItems.delete(id);
              });
              break;
              
            case 'MODIFIED':
              // Handle modified items - would need additional data in real implementation
              break;
          }
          
          state.processingItemIds.clear();
          state.isProcessing = false;
        }),
      })),
      {
        name: 'approval-store',
        partialize: (state) => ({
          // Only persist filter preferences
          filterStatus: state.filterStatus,
          filterImpact: state.filterImpact,
          filterItemType: state.filterItemType,
        }),
      }
    ),
    {
      name: 'ApprovalStore',
    }
  )
);