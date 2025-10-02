import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApprovalPanel } from './ApprovalPanel';
import type { PreviewItem, Approval } from '@agentris/db';

describe('ApprovalPanel', () => {
  const mockItems: PreviewItem[] = [
    {
      id: 'item-1',
      previewId: 'preview-1',
      itemType: 'FIELD',
      name: 'Test Field 1',
      currentState: null,
      proposedState: { field: 'value1' },
      impact: 'LOW',
      description: 'Test field description',
    },
    {
      id: 'item-2',
      previewId: 'preview-1',
      itemType: 'VALIDATION_RULE',
      name: 'Test Rule 1',
      currentState: null,
      proposedState: { rule: 'value2' },
      impact: 'HIGH',
      description: 'Test rule description',
    },
  ] as PreviewItem[];

  const mockApprovals: Approval[] = [];

  const mockHandlers = {
    onApprove: vi.fn(),
    onReject: vi.fn(),
    onModify: vi.fn(),
    onBulkApprove: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render approval panel with items', () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Approval Workflow')).toBeInTheDocument();
    expect(screen.getByText('Test Field 1')).toBeInTheDocument();
    expect(screen.getByText('Test Rule 1')).toBeInTheDocument();
    expect(screen.getByText('2 pending')).toBeInTheDocument();
  });

  it('should handle item selection', () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);

    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('should handle select all', () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    const selectAllButton = screen.getByText('Select All');
    fireEvent.click(selectAllButton);

    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByText('Deselect All')).toBeInTheDocument();
  });

  it('should open comment dialog on approve', async () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    // Select an item first
    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);

    // Click approve button
    const approveButton = screen.getByText('Approve');
    fireEvent.click(approveButton);

    // Dialog should open
    await waitFor(() => {
      expect(screen.getByText('Approve Changes')).toBeInTheDocument();
    });
  });

  it('should handle rejection with reason', async () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    // Select an item
    const firstCheckbox = screen.getAllByRole('checkbox')[0];
    fireEvent.click(firstCheckbox);

    // Click reject button
    const rejectButton = screen.getByText('Reject');
    fireEvent.click(rejectButton);

    // Dialog should open with rejection text
    await waitFor(() => {
      expect(screen.getByText('Reject Changes')).toBeInTheDocument();
      expect(screen.getByText('Please provide a reason for rejection')).toBeInTheDocument();
    });
  });

  it('should switch between tabs', async () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    // Click history tab
    const historyTab = screen.getByText('Approval History');
    fireEvent.click(historyTab);

    // Should show history content - wait for tab content to render
    await waitFor(() => {
      const historyContent = screen.getByRole('tabpanel');
      expect(historyContent).toHaveAttribute('aria-labelledby', expect.stringContaining('history'));
    });
  });

  it('should group items by type', () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('FIELD (1)')).toBeInTheDocument();
    expect(screen.getByText('VALIDATION RULE (1)')).toBeInTheDocument();
  });

  it('should disable actions when no items selected', () => {
    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={mockApprovals}
        {...mockHandlers}
      />
    );

    const approveButton = screen.getByText('Approve');
    const rejectButton = screen.getByText('Reject');

    expect(approveButton).toBeDisabled();
    expect(rejectButton).toBeDisabled();
  });

  it('should filter out already approved items', () => {
    const approvalsWithItems: Approval[] = [
      {
        id: 'approval-1',
        previewId: 'preview-1',
        userId: 'user-1',
        status: 'APPROVED',
        comments: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        items: [
          {
            id: 'approval-item-1',
            approvalId: 'approval-1',
            previewItemId: 'item-1',
            status: 'APPROVED',
            modifiedData: null,
            reason: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      } as any,
    ];

    render(
      <ApprovalPanel
        previewId="preview-1"
        items={mockItems}
        approvals={approvalsWithItems}
        {...mockHandlers}
      />
    );

    // Should only show 1 pending item (item-2)
    expect(screen.getByText('1 pending')).toBeInTheDocument();
    expect(screen.getByText('Test Rule 1')).toBeInTheDocument();
    expect(screen.queryByText('Test Field 1')).not.toBeInTheDocument();
  });
});