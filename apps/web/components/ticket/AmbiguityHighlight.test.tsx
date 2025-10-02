import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AmbiguityHighlight } from './AmbiguityHighlight';
import type { AmbiguityHighlight as Highlight } from '@agentris/shared/types/ambiguity';

describe('AmbiguityHighlight', () => {
  it('should render plain text when no highlights provided', () => {
    const text = 'This is a simple requirement.';
    render(<AmbiguityHighlight text={text} highlights={[]} />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('should highlight text segments', () => {
    const text = 'The system should be fast and user-friendly.';
    const highlights: Highlight[] = [
      {
        text: 'fast',
        startIndex: 22,
        endIndex: 26,
        type: 'vague',
        severity: 'medium',
        tooltip: 'Define specific performance metrics',
      },
      {
        text: 'user-friendly',
        startIndex: 31,
        endIndex: 44,
        type: 'vague',
        severity: 'high',
        tooltip: 'Specify usability requirements',
      },
    ];

    const { container } = render(<AmbiguityHighlight text={text} highlights={highlights} />);

    // Check that highlighted spans exist
    const highlightedSpans = container.querySelectorAll('span.cursor-help');
    expect(highlightedSpans).toHaveLength(2);

    // Check that non-highlighted text exists
    expect(screen.getByText('The system should be ', { exact: false })).toBeInTheDocument();
  });

  it('should apply correct severity colors', () => {
    const text = 'Missing critical information';
    const highlights: Highlight[] = [
      {
        text: 'Missing critical information',
        startIndex: 0,
        endIndex: 28,
        type: 'missing',
        severity: 'high',
        tooltip: 'No acceptance criteria',
      },
    ];

    const { container } = render(<AmbiguityHighlight text={text} highlights={highlights} />);

    const highlightedSpan = container.querySelector('span.cursor-help');
    expect(highlightedSpan).toHaveClass('bg-blue-300');
    expect(highlightedSpan).toHaveClass('border-blue-500');
  });

  it('should handle overlapping highlights correctly', () => {
    const text = 'The quick brown fox jumps';
    const highlights: Highlight[] = [
      {
        text: 'quick',
        startIndex: 4,
        endIndex: 9,
        type: 'vague',
        severity: 'low',
        tooltip: 'Define speed',
      },
      {
        text: 'brown',
        startIndex: 10,
        endIndex: 15,
        type: 'vague',
        severity: 'medium',
        tooltip: 'Specify color precisely',
      },
    ];

    const { container } = render(<AmbiguityHighlight text={text} highlights={highlights} />);

    const highlightedSpans = container.querySelectorAll('span.cursor-help');
    expect(highlightedSpans).toHaveLength(2);
    
    // Verify text is segmented correctly
    expect(screen.getByText('The ', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(' fox jumps', { exact: false })).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const text = 'Test text';
    const { container } = render(
      <AmbiguityHighlight text={text} highlights={[]} className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
    expect(container.firstChild).toHaveClass('whitespace-pre-wrap');
  });

  it('should handle conflict type highlights', () => {
    const text = 'Conflicting requirement';
    const highlights: Highlight[] = [
      {
        text: 'Conflicting',
        startIndex: 0,
        endIndex: 11,
        type: 'conflict',
        severity: 'high',
        tooltip: 'This conflicts with another requirement',
      },
    ];

    const { container } = render(<AmbiguityHighlight text={text} highlights={highlights} />);

    const highlightedSpan = container.querySelector('span.cursor-help');
    expect(highlightedSpan).toHaveClass('bg-red-300');
    expect(highlightedSpan).toHaveClass('border-red-500');
  });
});