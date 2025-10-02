import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchList } from './BatchList';
import { trpc } from '@/trpc/client';

// Mock tRPC
vi.mock('@/trpc/client', () => ({
  trpc: {
    batch: {
      listBatches: {
        useQuery: vi.fn(),
      },
    },
  },
}));

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('BatchList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should display loading state', () => {
    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<BatchList />);
    
    expect(screen.getByText('Loading batches...')).toBeInTheDocument();
  });

  it('should display error state', () => {
    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed to fetch'),
    } as any);

    render(<BatchList />);
    
    expect(screen.getByText('Failed to load batches')).toBeInTheDocument();
  });

  it('should display empty state', () => {
    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: {
        data: {
          batches: [],
          total: 0,
        },
      },
      isLoading: false,
      error: null,
    } as any);

    render(<BatchList />);
    
    expect(screen.getByText('No batches found')).toBeInTheDocument();
    expect(screen.getByText('Create your first batch to get started')).toBeInTheDocument();
  });

  it('should display list of batches', () => {
    const mockBatches = [
      {
        id: 'batch-1',
        name: 'Account Updates',
        status: 'PENDING',
        ticketCount: 5,
        createdAt: new Date('2025-01-01').toISOString(),
      },
      {
        id: 'batch-2',
        name: 'Contact Validation',
        status: 'COMPLETED',
        ticketCount: 3,
        createdAt: new Date('2025-01-02').toISOString(),
      },
    ];

    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: {
        data: {
          batches: mockBatches,
          total: 2,
        },
      },
      isLoading: false,
      error: null,
    } as any);

    render(<BatchList />);
    
    expect(screen.getByText('Account Updates')).toBeInTheDocument();
    expect(screen.getByText('Contact Validation')).toBeInTheDocument();
    expect(screen.getByText('5 tickets')).toBeInTheDocument();
    expect(screen.getByText('3 tickets')).toBeInTheDocument();
  });

  it('should filter batches by status', async () => {
    const user = userEvent.setup();
    const mockQuery = vi.fn();

    vi.mocked(trpc.batch.listBatches.useQuery).mockImplementation((params: any) => {
      mockQuery(params);
      return {
        data: { data: { batches: [], total: 0 } },
        isLoading: false,
        error: null,
      } as any;
    });

    render(<BatchList />);
    
    // Click on PENDING tab
    const pendingTab = screen.getByText('Pending');
    await user.click(pendingTab);
    
    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'PENDING',
        })
      );
    });
  });

  it('should navigate to batch creation page', async () => {
    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: { data: { batches: [], total: 0 } },
      isLoading: false,
      error: null,
    } as any);

    render(<BatchList />);
    
    const createButton = screen.getByText('Create New Batch');
    expect(createButton.closest('a')).toHaveAttribute('href', '/batch/new');
  });

  it('should navigate to batch details', () => {
    const mockBatches = [
      {
        id: 'batch-1',
        name: 'Test Batch',
        status: 'PENDING',
        ticketCount: 2,
        createdAt: new Date().toISOString(),
      },
    ];

    vi.mocked(trpc.batch.listBatches.useQuery).mockReturnValue({
      data: { data: { batches: mockBatches, total: 1 } },
      isLoading: false,
      error: null,
    } as any);

    render(<BatchList />);
    
    const detailsLink = screen.getByRole('link', { name: /Test Batch/i }).closest('a');
    expect(detailsLink).toHaveAttribute('href', expect.stringContaining('/batch/batch-1'));
  });
});