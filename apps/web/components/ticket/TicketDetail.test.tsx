import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TicketDetail } from './TicketDetail';
import { trpc } from '@/lib/trpc';

// Mock tRPC
vi.mock('@/lib/trpc', () => ({
  trpc: {
    jira: {
      fetchTicketDetails: {
        useQuery: vi.fn(() => ({
          data: {
            key: 'TEST-123',
            summary: 'Test ticket summary',
            description: 'Test ticket description',
            status: 'In Progress',
            priority: 'High',
            type: 'Story',
            assignee: 'John Doe',
            reporter: 'Jane Smith',
            created: '2024-01-01T10:00:00Z',
            updated: '2024-01-02T14:00:00Z',
            dueDate: '2024-02-01',
            labels: ['test', 'important'],
            acceptanceCriteria: '- Criteria 1\n- Criteria 2',
            comments: [
              {
                id: '1',
                author: 'Test User',
                created: '2024-01-01T11:00:00Z',
                body: 'Test comment',
              },
            ],
          },
          isLoading: false,
          error: null,
          refetch: vi.fn(),
        })),
      },
    },
  },
}));

describe('TicketDetail', () => {
  it('renders ticket details', () => {
    render(<TicketDetail ticketKey="TEST-123" />);

    // Check main content
    expect(screen.getByText(/TEST-123: Test ticket summary/)).toBeInTheDocument();
    expect(screen.getByText(/Test ticket description/)).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('Story')).toBeInTheDocument();
  });

  it('displays assignee and reporter', () => {
    render(<TicketDetail ticketKey="TEST-123" />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });

  it('displays acceptance criteria', () => {
    render(<TicketDetail ticketKey="TEST-123" />);

    expect(screen.getByText('Acceptance Criteria')).toBeInTheDocument();
    expect(screen.getByText('Criteria 1')).toBeInTheDocument();
    expect(screen.getByText('Criteria 2')).toBeInTheDocument();
  });

  it('displays comments', () => {
    render(<TicketDetail ticketKey="TEST-123" />);

    expect(screen.getByText(/Comments \(1\)/)).toBeInTheDocument();
    expect(screen.getByText('Test User')).toBeInTheDocument();
    expect(screen.getByText('Test comment')).toBeInTheDocument();
  });

  it('displays labels', () => {
    render(<TicketDetail ticketKey="TEST-123" />);

    expect(screen.getByText('Labels')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.getByText('important')).toBeInTheDocument();
  });

  it('shows loading skeleton when loading', () => {
    const mockUseQuery = vi.fn(() => ({
      data: null,
      isLoading: true,
      error: null,
      refetch: vi.fn(),
    }));

    vi.mocked(trpc.jira.fetchTicketDetails.useQuery).mockImplementation(mockUseQuery);

    render(<TicketDetail ticketKey="TEST-123" />);

    // Check for skeleton elements
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows error state on error', () => {
    const mockUseQuery = vi.fn(() => ({
      data: null,
      isLoading: false,
      error: new Error('Failed to load'),
      refetch: vi.fn(),
    }));

    vi.mocked(trpc.jira.fetchTicketDetails.useQuery).mockImplementation(mockUseQuery);

    render(<TicketDetail ticketKey="TEST-123" />);

    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText(/Failed to load ticket details/)).toBeInTheDocument();
  });
});
