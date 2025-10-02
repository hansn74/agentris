import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AmbiguityScore, AmbiguityScoreBadge } from './AmbiguityScore';

describe('AmbiguityScore', () => {
  it('should display low ambiguity correctly', () => {
    render(<AmbiguityScore score={0.2} confidence={0.9} />);

    expect(screen.getByText('Low Ambiguity')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText(/Requirements are clear/)).toBeInTheDocument();
  });

  it('should display medium ambiguity correctly', () => {
    render(<AmbiguityScore score={0.5} confidence={0.85} />);

    expect(screen.getByText('Medium Ambiguity')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText(/Some clarification needed/)).toBeInTheDocument();
  });

  it('should display high ambiguity correctly', () => {
    render(<AmbiguityScore score={0.8} confidence={0.75} />);

    expect(screen.getByText('High Ambiguity')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText(/significant clarification/)).toBeInTheDocument();
  });

  it('should show confidence when enabled', () => {
    render(<AmbiguityScore score={0.5} confidence={0.85} showConfidence={true} />);

    expect(screen.getByText('Confidence')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should hide confidence when disabled', () => {
    render(<AmbiguityScore score={0.5} confidence={0.85} showConfidence={false} />);

    expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
  });

  it('should render small size correctly', () => {
    const { container } = render(<AmbiguityScore score={0.3} confidence={0.9} size="sm" />);

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('h-4', 'w-4');
    
    // Small size should not show description text
    expect(screen.queryByText(/Requirements are clear/)).not.toBeInTheDocument();
  });

  it('should render large size correctly', () => {
    const { container } = render(<AmbiguityScore score={0.3} confidence={0.9} size="lg" />);

    const icon = container.querySelector('svg');
    expect(icon).toHaveClass('h-6', 'w-6');
    
    // Check for larger text
    const label = screen.getByText('Low Ambiguity');
    expect(label).toHaveClass('text-lg');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <AmbiguityScore score={0.5} confidence={0.85} className="custom-class" />
    );

    const wrapper = container.firstChild;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('should calculate percentage correctly', () => {
    render(<AmbiguityScore score={0.67} confidence={0.92} />);

    expect(screen.getByText('67%')).toBeInTheDocument();
  });

  it('should handle edge cases for scores', () => {
    // Score of 0
    const { rerender } = render(<AmbiguityScore score={0} confidence={1} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByText('Low Ambiguity')).toBeInTheDocument();

    // Score of 1
    rerender(<AmbiguityScore score={1} confidence={1} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('High Ambiguity')).toBeInTheDocument();

    // Score exactly at boundary
    rerender(<AmbiguityScore score={0.3} confidence={1} />);
    expect(screen.getByText('Low Ambiguity')).toBeInTheDocument();

    rerender(<AmbiguityScore score={0.6} confidence={1} />);
    expect(screen.getByText('Medium Ambiguity')).toBeInTheDocument();
  });
});

describe('AmbiguityScoreBadge', () => {
  it('should display clear badge for low scores', () => {
    render(<AmbiguityScoreBadge score={0.2} />);

    expect(screen.getByText(/Clear/)).toBeInTheDocument();
    expect(screen.getByText(/20%/, { exact: false })).toBeInTheDocument();
  });

  it('should display unclear badge for medium scores', () => {
    render(<AmbiguityScoreBadge score={0.5} />);

    expect(screen.getByText(/Unclear/)).toBeInTheDocument();
    expect(screen.getByText(/50%/, { exact: false })).toBeInTheDocument();
  });

  it('should display ambiguous badge for high scores', () => {
    render(<AmbiguityScoreBadge score={0.8} />);

    expect(screen.getByText(/Ambiguous/)).toBeInTheDocument();
    expect(screen.getByText(/80%/, { exact: false })).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    const { container } = render(
      <AmbiguityScoreBadge score={0.5} className="custom-badge" />
    );

    const badge = container.querySelector('.custom-badge');
    expect(badge).toBeInTheDocument();
  });
});