import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ApprovalItem } from './ApprovalItem';
import type { PreviewItem } from '@agentris/db';

describe('ApprovalItem', () => {
  const mockItem: PreviewItem = {
    id: 'item-1',
    previewId: 'preview-1',
    itemType: 'FIELD',
    name: 'Test Field',
    currentState: { oldValue: 'old' },
    proposedState: { newValue: 'new' },
    impact: 'HIGH',
    description: 'Test field description',
  } as PreviewItem;

  const mockHandlers = {
    onSelect: vi.fn(),
    onModify: vi.fn(),
  };

  it('should render item details', () => {
    render(
      <ApprovalItem
        item={mockItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Test Field')).toBeInTheDocument();
    expect(screen.getByText('Test field description')).toBeInTheDocument();
    expect(screen.getByText('HIGH')).toBeInTheDocument();
    expect(screen.getByText('FIELD')).toBeInTheDocument();
  });

  it('should handle selection', () => {
    render(
      <ApprovalItem
        item={mockItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(mockHandlers.onSelect).toHaveBeenCalled();
  });

  it('should show selected state', () => {
    const { container } = render(
      <ApprovalItem
        item={mockItem}
        isSelected={true}
        {...mockHandlers}
      />
    );

    const card = container.querySelector('[data-testid="approval-item-item-1"]');
    expect(card).toHaveClass('border-primary', 'bg-primary/5');
  });

  it('should expand to show details', () => {
    render(
      <ApprovalItem
        item={mockItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    // Initially collapsed
    expect(screen.queryByText('Current State')).not.toBeInTheDocument();

    // Click expand button - find by the last button which is the expand/collapse
    const buttons = screen.getAllByRole('button');
    const expandButton = buttons[buttons.length - 1];
    fireEvent.click(expandButton);

    // Should show expanded content
    expect(screen.getByText('Current State')).toBeInTheDocument();
    expect(screen.getByText('Proposed State')).toBeInTheDocument();
  });

  it('should handle edit action', async () => {
    vi.useFakeTimers();
    
    render(
      <ApprovalItem
        item={mockItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    // Find edit button - it's the second to last button
    const buttons = screen.getAllByRole('button');
    const editButton = buttons[buttons.length - 2];
    
    // Use act to wrap the state update
    await vi.waitFor(() => {
      fireEvent.click(editButton);
      vi.runAllTimers();
    });

    expect(mockHandlers.onModify).toHaveBeenCalledWith({
      newValue: 'new',
      modified: true,
    });

    vi.useRealTimers();
  });

  it('should apply correct impact colors', () => {
    const lowImpactItem = { ...mockItem, impact: 'LOW' };
    const { rerender } = render(
      <ApprovalItem
        item={lowImpactItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    let badge = screen.getByText('LOW');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');

    const mediumImpactItem = { ...mockItem, impact: 'MEDIUM' };
    rerender(
      <ApprovalItem
        item={mediumImpactItem}
        isSelected={false}
        {...mockHandlers}
      />
    );

    badge = screen.getByText('MEDIUM');
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('should handle items without current state', () => {
    const itemWithoutCurrent = { ...mockItem, currentState: null };
    
    render(
      <ApprovalItem
        item={itemWithoutCurrent}
        isSelected={false}
        {...mockHandlers}
      />
    );

    // Click expand button - find by the last button which is the expand/collapse
    const buttons = screen.getAllByRole('button');
    const expandButton = buttons[buttons.length - 1];
    fireEvent.click(expandButton);

    // Should not show current state section
    expect(screen.queryByText('Current State')).not.toBeInTheDocument();
    expect(screen.getByText('Proposed State')).toBeInTheDocument();
  });
});