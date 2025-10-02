import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BatchCreator } from './BatchCreator';
import { useRouter } from 'next/navigation';

// Mock dependencies
vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}));

vi.mock('@/trpc/client', () => ({
  trpc: {
    batch: {
      createBatch: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
          error: null,
        })),
      },
      analyzeSimilarity: {
        useMutation: vi.fn(() => ({
          mutate: vi.fn(),
          isPending: false,
          error: null,
        })),
      },
    },
  },
}));

describe('BatchCreator', () => {
  const mockPush = vi.fn();
  const mockBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      back: mockBack,
    } as any);
  });

  it('should render batch creation form', () => {
    render(<BatchCreator />);
    
    expect(screen.getByLabelText('Batch Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Grouping Strategy')).toBeInTheDocument();
    expect(screen.getByText(/Select Tickets/i)).toBeInTheDocument();
  });

  it('should display available tickets', () => {
    render(<BatchCreator />);
    
    expect(screen.getByText('TEST-101')).toBeInTheDocument();
    expect(screen.getByText('Update Account field validation')).toBeInTheDocument();
    expect(screen.getByText('TEST-102')).toBeInTheDocument();
  });

  it('should handle ticket selection', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    const firstCheckbox = screen.getAllByRole('checkbox')[1]; // Skip the select-all checkbox
    await user.click(firstCheckbox);
    
    expect(screen.getByText('(1 selected)')).toBeInTheDocument();
  });

  it('should handle select all tickets', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    const selectAllButton = screen.getByText('Select All');
    await user.click(selectAllButton);
    
    // Should show 5 selected (based on mock data)
    expect(screen.getByText('(5 selected)')).toBeInTheDocument();
  });

  it('should handle deselect all tickets', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    // First select all
    const selectAllButton = screen.getByText('Select All');
    await user.click(selectAllButton);
    
    // Then deselect all
    const deselectAllButton = screen.getByText('Deselect All');
    await user.click(deselectAllButton);
    
    expect(screen.getByText('(0 selected)')).toBeInTheDocument();
  });

  it('should validate batch name is required', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    // Select some tickets first
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    await user.click(firstCheckbox);
    
    // Try to create without batch name
    const createButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(createButton);
    
    // Should show alert (mocked)
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('batch name')
    );
  });

  it('should validate at least one ticket selected', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    // Enter batch name
    const nameInput = screen.getByLabelText('Batch Name');
    await user.type(nameInput, 'Test Batch');
    
    // Try to create without selecting tickets
    const createButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(createButton);
    
    expect(window.alert).toHaveBeenCalledWith(
      expect.stringContaining('select tickets')
    );
  });

  it('should enable similarity analysis with 2+ tickets', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    // Select 2 tickets
    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[1]);
    await user.click(checkboxes[2]);
    
    // Analyze button should appear
    expect(screen.getByRole('button', { name: /Analyze Similarity/i })).toBeInTheDocument();
  });

  it('should handle batch creation', async () => {
    const user = userEvent.setup();
    const mockMutate = vi.fn();
    
    vi.mocked(trpc.batch.createBatch.useMutation).mockReturnValue({
      mutate: mockMutate,
      isPending: false,
      error: null,
    } as any);
    
    render(<BatchCreator />);
    
    // Fill form
    const nameInput = screen.getByLabelText('Batch Name');
    await user.type(nameInput, 'Test Batch');
    
    // Select tickets
    const firstCheckbox = screen.getAllByRole('checkbox')[1];
    await user.click(firstCheckbox);
    
    // Create batch
    const createButton = screen.getByRole('button', { name: 'Create Batch' });
    await user.click(createButton);
    
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Batch',
        ticketIds: expect.arrayContaining([expect.any(String)]),
      })
    );
  });

  it('should navigate back on cancel', async () => {
    const user = userEvent.setup();
    render(<BatchCreator />);
    
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);
    
    expect(mockBack).toHaveBeenCalled();
  });
});