import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchDetails } from './BatchDetails';

// Mock tRPC
vi.mock('@/trpc/client', () => ({
  trpc: {
    batch: {
      getBatchStatus: {
        useQuery: vi.fn(),
      },
      generateBatchPreview: {
        useQuery: vi.fn(),
      },
      approveBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      rejectBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      excludeFromBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      includeInBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
      rollbackBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
        })),
      },
    },
  },
}));

describe('BatchDetails', () => {
  const mockBatchId = 'batch-123';
  const mockBatchStatus = {
    data: {
      batch: {
        id: mockBatchId,
        name: 'Test Batch',
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tickets: {
        total: 5,
        active: 4,
        excluded: 1,
      },
      approval: {
        isApproved: false,
        isPending: true,
        approvals: [],
      },
      sync: {
        totalTickets: 5,
        processedTickets: 0,
        lastSyncAt: null,
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading state', () => {
    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      refetch: vi.fn(),
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    expect(screen.getByText('Loading batch details...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: null,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    expect(screen.getByText('Failed to load batch details')).toBeInTheDocument();
  });

  it('should display batch information', () => {
    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: mockBatchStatus,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(trpc.batch.generateBatchPreview.useQuery).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    expect(screen.getByText('Test Batch')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument(); // Total tickets
    expect(screen.getByText('4')).toBeInTheDocument(); // Active tickets
    expect(screen.getByText('1')).toBeInTheDocument(); // Excluded tickets
  });

  it('should show approve/reject buttons for pending batch', () => {
    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: mockBatchStatus,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    expect(screen.getByRole('button', { name: /Approve Batch/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reject Batch/i })).toBeInTheDocument();
  });

  it('should handle batch approval', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    const mockRefetch = vi.fn();

    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: mockBatchStatus,
      isLoading: false,
      refetch: mockRefetch,
    } as any);

    vi.mocked(trpc.batch.approveBatch.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    // Click approve button
    const approveButton = screen.getByRole('button', { name: /Approve Batch/i });
    await user.click(approveButton);
    
    // Should show approval dialog
    expect(screen.getByText('Approve Batch')).toBeInTheDocument();
    
    // Confirm approval
    const confirmButton = screen.getByRole('button', { name: /Confirm Approval/i });
    await user.click(confirmButton);
    
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: mockBatchId,
      })
    );
  });

  it('should handle batch rejection', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();

    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: mockBatchStatus,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(trpc.batch.rejectBatch.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    // Click reject button
    const rejectButton = screen.getByRole('button', { name: /Reject Batch/i });
    await user.click(rejectButton);
    
    // Should show rejection dialog
    expect(screen.getByText('Reject Batch')).toBeInTheDocument();
    
    // Enter reason
    const reasonInput = screen.getByPlaceholderText(/reason for rejecting/i);
    await user.type(reasonInput, 'Missing requirements');
    
    // Confirm rejection
    const confirmButton = screen.getByRole('button', { name: /Confirm Rejection/i });
    await user.click(confirmButton);
    
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        batchId: mockBatchId,
        reason: 'Missing requirements',
      })
    );
  });

  it('should show rollback button for failed batch', () => {
    const failedBatchStatus = {
      ...mockBatchStatus,
      data: {
        ...mockBatchStatus.data,
        batch: {
          ...mockBatchStatus.data.batch,
          status: 'FAILED',
        },
      },
    };

    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: failedBatchStatus,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    render(<BatchDetails batchId={mockBatchId} />);
    
    expect(screen.getByRole('button', { name: /Rollback Changes/i })).toBeInTheDocument();
  });

  it('should handle preview format switching', async () => {
    const user = userEvent.setup();
    const mockQuery = vi.fn();

    vi.mocked(trpc.batch.getBatchStatus.useQuery).mockReturnValue({
      data: mockBatchStatus,
      isLoading: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(trpc.batch.generateBatchPreview.useQuery).mockImplementation((params: any) => {
      mockQuery(params);
      return {
        data: {
          data: {
            content: 'Preview content',
            format: params.format,
          },
        },
        isLoading: false,
      } as any;
    });

    render(<BatchDetails batchId={mockBatchId} />);
    
    // Click on preview tab
    const previewTab = screen.getByRole('tab', { name: 'Preview' });
    await user.click(previewTab);
    
    // Switch to TEXT format
    const textButton = screen.getByRole('button', { name: /TEXT/i });
    await user.click(textButton);
    
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'TEXT',
        })
      );
    });
  });
});