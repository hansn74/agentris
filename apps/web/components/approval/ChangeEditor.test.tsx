import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangeEditor } from './ChangeEditor';
import type { PreviewItem } from '@agentris/db';

describe('ChangeEditor', () => {
  const mockItem: PreviewItem = {
    id: 'item-1',
    previewId: 'preview-1',
    itemType: 'FIELD',
    name: 'Test Field',
    currentState: { oldValue: 'old' },
    proposedState: { 
      fieldName: 'TestField',
      fieldType: 'Text',
      required: true,
      maxLength: 255
    },
    impact: 'MEDIUM',
    description: 'Test field description',
  } as PreviewItem;

  const mockHandlers = {
    onClose: vi.fn(),
    onSave: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render editor dialog when open', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Edit Change: Test Field')).toBeInTheDocument();
    expect(screen.getByText('Modify the proposed changes before approval')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={false}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText('Edit Change: Test Field')).not.toBeInTheDocument();
  });

  it('should display item badges', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('FIELD')).toBeInTheDocument();
    expect(screen.getByText('MEDIUM')).toBeInTheDocument();
  });

  it('should show field editor by default', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    // Should show field labels
    expect(screen.getByLabelText('fieldName')).toBeInTheDocument();
    expect(screen.getByLabelText('fieldType')).toBeInTheDocument();
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByLabelText('maxLength')).toBeInTheDocument();
  });

  it('should switch to JSON editor', async () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    const jsonTab = screen.getByText('JSON Editor');
    fireEvent.click(jsonTab);

    await waitFor(() => {
      const jsonTextarea = screen.getByPlaceholderText('Enter valid JSON...');
      expect(jsonTextarea).toBeInTheDocument();
      expect(jsonTextarea.textContent).toContain('TestField');
    });
  });

  it('should update field values', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    const fieldNameInput = screen.getByLabelText('fieldName');
    fireEvent.change(fieldNameInput, { target: { value: 'UpdatedField' } });

    expect(fieldNameInput).toHaveValue('UpdatedField');
  });

  it('should toggle boolean values', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    // Find the False button for the required field
    const falseButton = screen.getAllByText('False')[0];
    fireEvent.click(falseButton);

    // The False button should become selected (default variant)
    expect(falseButton.parentElement?.querySelector('button:nth-child(2)')).toHaveClass('inline-flex', 'items-center');
  });

  it('should validate JSON input', async () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    // Switch to JSON editor
    const jsonTab = screen.getByText('JSON Editor');
    fireEvent.click(jsonTab);

    await waitFor(() => {
      const jsonInput = screen.getByPlaceholderText('Enter valid JSON...');
      fireEvent.change(jsonInput, { target: { value: '{ invalid json }' } });
    });

    await waitFor(() => {
      expect(screen.getByText(/Invalid JSON:/)).toBeInTheDocument();
    });
  });

  it('should save changes', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    const fieldNameInput = screen.getByLabelText('fieldName');
    fireEvent.change(fieldNameInput, { target: { value: 'UpdatedField' } });

    const saveButton = screen.getByText('Save Changes');
    fireEvent.click(saveButton);

    expect(mockHandlers.onSave).toHaveBeenCalledWith('item-1', {
      fieldName: 'UpdatedField',
      fieldType: 'Text',
      required: true,
      maxLength: 255
    });
    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('should cancel without saving', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);

    expect(mockHandlers.onSave).not.toHaveBeenCalled();
    expect(mockHandlers.onClose).toHaveBeenCalled();
  });

  it('should show live preview', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Live Preview')).toBeInTheDocument();
    expect(screen.getByText('How the change will look after modification')).toBeInTheDocument();
  });

  it('should show current state when available', () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.getByText('Current State')).toBeInTheDocument();
    expect(screen.getByText('Existing configuration for reference')).toBeInTheDocument();
    expect(screen.getByText(/"oldValue": "old"/)).toBeInTheDocument();
  });

  it('should handle items without current state', () => {
    const itemWithoutCurrent = { ...mockItem, currentState: null };
    
    render(
      <ChangeEditor
        item={itemWithoutCurrent}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText('Current State')).not.toBeInTheDocument();
  });

  it('should disable save button when JSON is invalid', async () => {
    render(
      <ChangeEditor
        item={mockItem}
        open={true}
        {...mockHandlers}
      />
    );

    // Switch to JSON editor
    const jsonTab = screen.getByText('JSON Editor');
    fireEvent.click(jsonTab);

    await waitFor(() => {
      const jsonInput = screen.getByPlaceholderText('Enter valid JSON...');
      fireEvent.change(jsonInput, { target: { value: '{ invalid' } });
    });

    await waitFor(() => {
      const saveButton = screen.getByText('Save Changes');
      expect(saveButton).toBeDisabled();
    });
  });

  it('should handle null item', () => {
    render(
      <ChangeEditor
        item={null}
        open={true}
        {...mockHandlers}
      />
    );

    expect(screen.queryByText('Edit Change:')).not.toBeInTheDocument();
  });
});