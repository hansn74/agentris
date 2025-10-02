import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RecommendationPanel } from './RecommendationPanel';
import { trpc } from '@/trpc/client';
import type { Recommendation } from '@agentris/shared';

// Mock tRPC
vi.mock('@/trpc/client', () => ({
  trpc: {
    recommendations: {
      getRecommendations: {
        useQuery: vi.fn()
      },
      checkConflicts: {
        useQuery: vi.fn()
      },
      submitFeedback: {
        useMutation: vi.fn()
      }
    }
  }
}));

// Mock child components
vi.mock('./NamingConventionSuggestion', () => ({
  NamingConventionSuggestion: ({ recommendation, onAccept, onReject }: any) => (
    <div data-testid={`naming-${recommendation.id}`}>
      <span>{recommendation.title}</span>
      <button onClick={onAccept}>Accept</button>
      <button onClick={() => onReject('test reason')}>Reject</button>
    </div>
  )
}));

vi.mock('./FieldTypeSuggestion', () => ({
  FieldTypeSuggestion: ({ recommendation, onAccept, onReject }: any) => (
    <div data-testid={`field-${recommendation.id}`}>
      <span>{recommendation.title}</span>
      <button onClick={onAccept}>Accept</button>
      <button onClick={() => onReject('test reason')}>Reject</button>
    </div>
  )
}));

vi.mock('./ConflictAlert', () => ({
  ConflictAlert: ({ conflict, onResolve, onDismiss }: any) => (
    <div data-testid={`conflict-${conflict.id}`}>
      <span>{conflict.title}</span>
      <button onClick={onResolve}>Resolve</button>
      <button onClick={onDismiss}>Dismiss</button>
    </div>
  )
}));

vi.mock('./RelatedChangeSuggestion', () => ({
  RelatedChangeSuggestion: ({ recommendation, onAccept }: any) => (
    <div data-testid={`related-${recommendation.id}`}>
      <span>{recommendation.title}</span>
      <button onClick={onAccept}>Accept</button>
    </div>
  )
}));

describe('RecommendationPanel', () => {
  const mockRecommendations: Recommendation[] = [
    {
      id: 'rec-1',
      type: 'naming',
      category: 'suggestion',
      title: 'Update field naming',
      description: 'Follow org naming conventions',
      rationale: 'Consistency with existing fields',
      confidence: 0.85,
      examples: ['Field__c'],
      impact: 'low'
    },
    {
      id: 'rec-2',
      type: 'fieldType',
      category: 'warning',
      title: 'Change field type',
      description: 'Use TextArea instead of Text',
      rationale: 'Better for long descriptions',
      confidence: 0.75,
      impact: 'medium'
    },
    {
      id: 'rec-3',
      type: 'conflict',
      category: 'error',
      title: 'Duplicate field detected',
      description: 'Field already exists',
      rationale: 'Avoid duplicates',
      confidence: 0.95,
      impact: 'high'
    }
  ];

  const mockConflicts = [
    {
      id: 'conflict-1',
      type: 'duplicate',
      severity: 'critical',
      message: 'Duplicate field name'
    }
  ];

  const defaultProps = {
    ticketId: 'ticket-123',
    orgId: 'org-456'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: undefined
    } as any);

    render(<RecommendationPanel {...defaultProps} />);
    
    expect(screen.getByTestId('loading-skeleton')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Failed to load recommendations');
    
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: undefined
    } as any);

    render(<RecommendationPanel {...defaultProps} />);
    
    expect(screen.getByText(/Failed to load recommendations/)).toBeInTheDocument();
  });

  it('renders recommendations by type', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: mockRecommendations, fromCache: false },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: {
        conflicts: mockConflicts,
        hasConflicts: true,
        criticalCount: 1,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
      }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync: vi.fn()
    } as any);

    render(<RecommendationPanel {...defaultProps} />);
    
    // Check that recommendations are rendered
    expect(screen.getByTestId('naming-rec-1')).toBeInTheDocument();
    expect(screen.getByTestId('field-rec-2')).toBeInTheDocument();
    expect(screen.getByTestId('conflict-rec-3')).toBeInTheDocument();
    
    // Check tab counts
    expect(screen.getByText('All (3)')).toBeInTheDocument();
    expect(screen.getByText('Naming (1)')).toBeInTheDocument();
    expect(screen.getByText('Fields (1)')).toBeInTheDocument();
    expect(screen.getByText('Conflicts (1)')).toBeInTheDocument();
  });

  it('filters recommendations by tab', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: mockRecommendations, fromCache: false },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: { conflicts: [], hasConflicts: false }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync: vi.fn()
    } as any);

    render(<RecommendationPanel {...defaultProps} />);
    
    // Click on naming tab
    fireEvent.click(screen.getByText('Naming (1)'));
    
    // Should only show naming recommendation
    expect(screen.getByTestId('naming-rec-1')).toBeInTheDocument();
    expect(screen.queryByTestId('field-rec-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('conflict-rec-3')).not.toBeInTheDocument();
  });

  it('handles accept action', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const refetch = vi.fn();
    const onAccept = vi.fn();

    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: [mockRecommendations[0]], fromCache: false },
      isLoading: false,
      error: null,
      refetch
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: { conflicts: [], hasConflicts: false }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync,
      onSuccess: (callback: any) => {
        callback();
        return { mutateAsync };
      }
    } as any);

    render(<RecommendationPanel {...defaultProps} onAccept={onAccept} />);
    
    // Click accept on the naming recommendation
    const acceptButton = screen.getByTestId('naming-rec-1').querySelector('button');
    fireEvent.click(acceptButton!);
    
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        recommendationId: 'rec-1',
        action: 'accepted',
        timestamp: expect.any(Date)
      });
      expect(onAccept).toHaveBeenCalledWith(mockRecommendations[0]);
    });
  });

  it('handles reject action with reason', async () => {
    const mutateAsync = vi.fn().mockResolvedValue({});
    const onReject = vi.fn();

    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: [mockRecommendations[0]], fromCache: false },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: { conflicts: [], hasConflicts: false }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync
    } as any);

    render(<RecommendationPanel {...defaultProps} onReject={onReject} />);
    
    // Click reject on the naming recommendation
    const rejectButton = screen.getByTestId('naming-rec-1').querySelectorAll('button')[1];
    fireEvent.click(rejectButton);
    
    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        recommendationId: 'rec-1',
        action: 'rejected',
        reason: 'test reason',
        timestamp: expect.any(Date)
      });
      expect(onReject).toHaveBeenCalledWith(mockRecommendations[0]);
    });
  });

  it('displays critical conflicts alert', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: mockRecommendations, fromCache: false },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: {
        conflicts: mockConflicts,
        hasConflicts: true,
        criticalCount: 1,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0
      }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync: vi.fn()
    } as any);

    render(<RecommendationPanel {...defaultProps} proposedChanges={{}} />);
    
    expect(screen.getByText('Critical Conflicts Detected')).toBeInTheDocument();
    expect(screen.getByText(/1 critical conflict/)).toBeInTheDocument();
  });

  it('shows cached indicator when data is from cache', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: mockRecommendations, fromCache: true },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: { conflicts: [], hasConflicts: false }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync: vi.fn()
    } as any);

    render(<RecommendationPanel {...defaultProps} />);
    
    expect(screen.getByText('Cached')).toBeInTheDocument();
  });

  it('displays conflict summary', () => {
    vi.mocked(trpc.recommendations.getRecommendations.useQuery).mockReturnValue({
      data: { recommendations: [], fromCache: false },
      isLoading: false,
      error: null,
      refetch: vi.fn()
    } as any);

    vi.mocked(trpc.recommendations.checkConflicts.useQuery).mockReturnValue({
      data: {
        conflicts: [],
        hasConflicts: true,
        criticalCount: 2,
        highCount: 3,
        mediumCount: 1,
        lowCount: 5
      }
    } as any);

    vi.mocked(trpc.recommendations.submitFeedback.useMutation).mockReturnValue({
      mutateAsync: vi.fn()
    } as any);

    render(<RecommendationPanel {...defaultProps} proposedChanges={{}} />);
    
    expect(screen.getByText('Critical: 2')).toBeInTheDocument();
    expect(screen.getByText('High: 3')).toBeInTheDocument();
    expect(screen.getByText('Medium: 1')).toBeInTheDocument();
    expect(screen.getByText('Low: 5')).toBeInTheDocument();
  });
});