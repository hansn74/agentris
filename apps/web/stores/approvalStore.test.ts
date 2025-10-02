import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useApprovalStore } from './approvalStore';
import type { PreviewItem } from '@agentris/db';

describe('approvalStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useApprovalStore.setState({
      selectedItems: new Set(),
      filterStatus: 'all',
      filterImpact: 'all',
      filterItemType: null,
      searchQuery: '',
      pendingItems: [],
      approvedItems: [],
      rejectedItems: [],
      modifiedItems: new Map(),
      bulkApprovalPattern: null,
      approvalHistory: [],
      isProcessing: false,
      processingItemIds: new Set(),
    });
  });

  describe('Selection Management', () => {
    it('should select an item', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.selectItem('item-1');
      });

      expect(result.current.selectedItems.has('item-1')).toBe(true);
    });

    it('should deselect an item', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.selectItem('item-1');
        result.current.deselectItem('item-1');
      });

      expect(result.current.selectedItems.has('item-1')).toBe(false);
    });

    it('should toggle item selection', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.toggleItemSelection('item-1');
      });
      expect(result.current.selectedItems.has('item-1')).toBe(true);

      act(() => {
        result.current.toggleItemSelection('item-1');
      });
      expect(result.current.selectedItems.has('item-1')).toBe(false);
    });

    it('should select all items', () => {
      const { result } = renderHook(() => useApprovalStore());
      const itemIds = ['item-1', 'item-2', 'item-3'];
      
      act(() => {
        result.current.selectAll(itemIds);
      });

      expect(result.current.selectedItems.size).toBe(3);
      itemIds.forEach(id => {
        expect(result.current.selectedItems.has(id)).toBe(true);
      });
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.selectAll(['item-1', 'item-2']);
        result.current.clearSelection();
      });

      expect(result.current.selectedItems.size).toBe(0);
    });
  });

  describe('Filter Management', () => {
    it('should set filter status', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setFilterStatus('approved');
      });

      expect(result.current.filterStatus).toBe('approved');
    });

    it('should set filter impact', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setFilterImpact('HIGH');
      });

      expect(result.current.filterImpact).toBe('HIGH');
    });

    it('should set search query', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setSearchQuery('test query');
      });

      expect(result.current.searchQuery).toBe('test query');
    });

    it('should reset all filters', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setFilterStatus('approved');
        result.current.setFilterImpact('HIGH');
        result.current.setSearchQuery('test');
        result.current.setFilterItemType('FIELD');
        result.current.resetFilters();
      });

      expect(result.current.filterStatus).toBe('all');
      expect(result.current.filterImpact).toBe('all');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.filterItemType).toBe(null);
    });
  });

  describe('Approval Queue Management', () => {
    it('should set pending items', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
      });

      expect(result.current.pendingItems).toEqual(items);
    });

    it('should mark item as approved', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.selectItem('item-1');
        result.current.markItemApproved('item-1');
      });

      expect(result.current.approvedItems).toContain('item-1');
      expect(result.current.pendingItems).toHaveLength(1);
      expect(result.current.selectedItems.has('item-1')).toBe(false);
    });

    it('should mark item as rejected', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.selectItem('item-1');
        result.current.markItemRejected('item-1');
      });

      expect(result.current.rejectedItems).toContain('item-1');
      expect(result.current.pendingItems).toHaveLength(1);
      expect(result.current.selectedItems.has('item-1')).toBe(false);
    });

    it('should mark item as modified', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1', proposedState: { field: 'original' } },
      ] as PreviewItem[];
      const modifiedData = { field: 'modified' };
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.markItemModified('item-1', modifiedData);
      });

      expect(result.current.modifiedItems.get('item-1')).toEqual(modifiedData);
      expect(result.current.pendingItems[0].proposedState).toEqual(modifiedData);
    });
  });

  describe('Optimistic Updates', () => {
    it('should optimistically approve items', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.selectAll(['item-1', 'item-2']);
        result.current.optimisticApprove(['item-1', 'item-2']);
      });

      expect(result.current.approvedItems).toEqual(['item-1', 'item-2']);
      expect(result.current.pendingItems).toHaveLength(0);
      expect(result.current.selectedItems.size).toBe(0);
      expect(result.current.isProcessing).toBe(true);
    });

    it('should revert optimistic update', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.optimisticApprove(['item-1']);
        result.current.revertOptimisticUpdate(['item-1']);
      });

      expect(result.current.approvedItems).toHaveLength(0);
      expect(result.current.selectedItems.has('item-1')).toBe(true);
      expect(result.current.isProcessing).toBe(false);
    });
  });

  describe('Real-time Updates', () => {
    it('should handle real-time approval update', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.selectItem('item-1');
        result.current.handleRealtimeUpdate({
          type: 'APPROVED',
          itemIds: ['item-1'],
          userId: 'other-user',
        });
      });

      expect(result.current.approvedItems).toContain('item-1');
      expect(result.current.pendingItems).toHaveLength(1);
      expect(result.current.selectedItems.has('item-1')).toBe(false);
    });

    it('should handle real-time rejection update', () => {
      const { result } = renderHook(() => useApprovalStore());
      const items = [
        { id: 'item-1', name: 'Field 1' },
        { id: 'item-2', name: 'Field 2' },
      ] as PreviewItem[];
      
      act(() => {
        result.current.setPendingItems(items);
        result.current.handleRealtimeUpdate({
          type: 'REJECTED',
          itemIds: ['item-2'],
          userId: 'other-user',
        });
      });

      expect(result.current.rejectedItems).toContain('item-2');
      expect(result.current.pendingItems).toHaveLength(1);
      expect(result.current.pendingItems[0].id).toBe('item-1');
    });
  });

  describe('UI State Management', () => {
    it('should set processing state', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setProcessing(true, ['item-1', 'item-2']);
      });

      expect(result.current.isProcessing).toBe(true);
      expect(result.current.processingItemIds.has('item-1')).toBe(true);
      expect(result.current.processingItemIds.has('item-2')).toBe(true);
    });

    it('should clear processing state', () => {
      const { result } = renderHook(() => useApprovalStore());
      
      act(() => {
        result.current.setProcessing(true, ['item-1']);
        result.current.setProcessing(false);
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.processingItemIds.size).toBe(0);
    });
  });
});