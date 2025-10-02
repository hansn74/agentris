import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { NamingConventionSuggestion } from './NamingConventionSuggestion';
import type { Recommendation } from '@agentris/shared';

describe('NamingConventionSuggestion', () => {
  const mockRecommendation: Recommendation = {
    id: 'rec-1',
    type: 'naming',
    category: 'suggestion',
    title: 'Update field naming to follow org convention',
    description: 'Change from "customerStatus" to "CustomerStatus__c"',
    rationale: 'Your org consistently uses PascalCase with __c suffix for custom fields',
    confidence: 0.85,
    examples: ['CustomerStatus__c', 'OrderTotal__c', 'InvoiceDate__c'],
    impact: 'low',
    relatedChanges: [
      {
        id: 'rec-2',
        type: 'validation',
        category: 'suggestion',
        title: 'Update validation rule references',
        description: 'Update references to the renamed field',
        rationale: 'Maintain consistency',
        confidence: 0.9
      }
    ]
  };

  const mockHandlers = {
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onModify: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders recommendation details', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Naming Convention')).toBeInTheDocument();
    expect(screen.getByText('Update field naming to follow org convention')).toBeInTheDocument();
    expect(screen.getByText(/85% confidence/)).toBeInTheDocument();
    expect(screen.getByText('customerStatus')).toBeInTheDocument();
    expect(screen.getByText('CustomerStatus__c')).toBeInTheDocument();
  });

  it('displays rationale', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText(mockRecommendation.rationale)).toBeInTheDocument();
  });

  it('shows other naming patterns', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('OrderTotal__c')).toBeInTheDocument();
    expect(screen.getByText('InvoiceDate__c')).toBeInTheDocument();
  });

  it('handles accept action', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Accept'));
    expect(mockHandlers.onAccept).toHaveBeenCalled();
  });

  it('shows modify form when modify is clicked', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Modify'));
    
    expect(screen.getByLabelText('Custom Name')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your preferred name...')).toBeInTheDocument();
    expect(screen.getByText('Save Custom Name')).toBeInTheDocument();
  });

  it('handles custom name modification', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Modify'));
    
    const input = screen.getByPlaceholderText('Enter your preferred name...');
    fireEvent.change(input, { target: { value: 'MyCustomField__c' } });
    fireEvent.click(screen.getByText('Save Custom Name'));
    
    expect(mockHandlers.onModify).toHaveBeenCalledWith('MyCustomField__c');
  });

  it('cancels modification', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Modify'));
    expect(screen.getByText('Save Custom Name')).toBeInTheDocument();
    
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Save Custom Name')).not.toBeInTheDocument();
    expect(screen.getByText('Modify')).toBeInTheDocument();
  });

  it('opens reject dialog', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Reject'));
    
    expect(screen.getByText('Reject Naming Suggestion')).toBeInTheDocument();
    expect(screen.getByText(/Help us improve/)).toBeInTheDocument();
    expect(screen.getByLabelText('Reason (optional)')).toBeInTheDocument();
  });

  it('handles reject with reason', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Reject'));
    
    const textarea = screen.getByPlaceholderText(/We use a different naming convention/);
    fireEvent.change(textarea, { target: { value: 'We use snake_case' } });
    fireEvent.click(screen.getByText('Reject Suggestion'));
    
    expect(mockHandlers.onReject).toHaveBeenCalledWith('We use snake_case');
  });

  it('handles reject without reason', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Reject'));
    fireEvent.click(screen.getByText('Reject Suggestion'));
    
    expect(mockHandlers.onReject).toHaveBeenCalledWith('');
  });

  it('displays related changes', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('This change will also affect:')).toBeInTheDocument();
    expect(screen.getByText('Update validation rule references')).toBeInTheDocument();
  });

  it('shows impact badge with correct color', () => {
    const highImpactRec = {
      ...mockRecommendation,
      impact: 'high' as const
    };

    const { rerender } = render(
      <NamingConventionSuggestion 
        recommendation={highImpactRec}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('high impact')).toHaveClass('bg-red-100');

    const mediumImpactRec = {
      ...mockRecommendation,
      impact: 'medium' as const
    };

    rerender(
      <NamingConventionSuggestion 
        recommendation={mediumImpactRec}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('medium impact')).toHaveClass('bg-yellow-100');

    const lowImpactRec = {
      ...mockRecommendation,
      impact: 'low' as const
    };

    rerender(
      <NamingConventionSuggestion 
        recommendation={lowImpactRec}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('low impact')).toHaveClass('bg-green-100');
  });

  it('does not submit empty custom name', () => {
    render(
      <NamingConventionSuggestion 
        recommendation={mockRecommendation}
        {...mockHandlers}
      />
    );

    fireEvent.click(screen.getByText('Modify'));
    
    const input = screen.getByPlaceholderText('Enter your preferred name...');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Save Custom Name'));
    
    expect(mockHandlers.onModify).not.toHaveBeenCalled();
  });
});