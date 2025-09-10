import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TicketList } from './TicketList';

// Create mock function
const mockUseQuery = vi.fn();

// Mock tRPC
vi.mock('@/lib/trpc', () => ({
  trpc: {
    jira: {
      fetchTickets: {
        useQuery: () => mockUseQuery(),
      },
    },
  },
}));

// Default mock data
const defaultMockData = {
  data: {
    tickets: [
      {
        key: 'TEST-1',
        summary: 'Test ticket 1',
        status: 'In Progress',
        priority: 'High',
        assignee: 'John Doe',
        created: '2024-01-01',
        updated: '2024-01-02',
      },
      {
        key: 'TEST-2',
        summary: 'Test ticket 2',
        status: 'Done',
        priority: 'Low',
        assignee: 'Jane Smith',
        created: '2024-01-01',
        updated: '2024-01-02',
      },
    ],
    hasMore: false,
  },
  isLoading: false,
  error: null,
  refetch: vi.fn(),
};

describe('TicketList', () => {
  beforeEach(() => {
    // Reset mock before each test
    mockUseQuery.mockReset();
    mockUseQuery.mockReturnValue(defaultMockData);
  });

  it('renders ticket list', () => {
    render(<TicketList />);

    // Check if tickets are displayed
    expect(screen.getByText(/TEST-1/)).toBeInTheDocument();
    expect(screen.getByText(/Test ticket 1/)).toBeInTheDocument();
    expect(screen.getByText(/TEST-2/)).toBeInTheDocument();
  });

  it('displays loading skeleton when loading', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<TicketList />);

    // Check for skeleton elements
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('displays empty state when no tickets', () => {
    mockUseQuery.mockReturnValue({
      data: { tickets: [], hasMore: false },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<TicketList />);

    expect(screen.getByText(/No Tickets Found/)).toBeInTheDocument();
    expect(screen.getByText(/Connect Jira/)).toBeInTheDocument();
  });

  it('displays error state on error', () => {
    mockUseQuery.mockReturnValue({
      data: null,
      isLoading: false,
      error: new Error('Failed to fetch tickets'),
      refetch: vi.fn(),
    });

    render(<TicketList />);

    expect(screen.getByText(/Error/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load tickets/)).toBeInTheDocument();
  });

  it('handles pagination', async () => {
    // Mock data with hasMore: true to enable next button
    mockUseQuery.mockReturnValue({
      ...defaultMockData,
      data: {
        ...defaultMockData.data,
        hasMore: true, // Enable next button
      },
    });

    render(<TicketList />);
    const user = userEvent.setup();

    const nextButton = screen.getByRole('button', { name: /next/i });
    const prevButton = screen.getByRole('button', { name: /previous/i });

    // Initially, previous should be disabled and next should be enabled
    expect(prevButton).toBeDisabled();
    expect(nextButton).not.toBeDisabled();

    // Click next
    await user.click(nextButton);

    // Now previous should be enabled
    expect(prevButton).not.toBeDisabled();
  });
});
