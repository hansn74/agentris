import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreviewPanel } from './PreviewPanel';
import type { DiffRepresentation } from '@agentris/services';

describe('PreviewPanel', () => {
  it('should render loading state', () => {
    render(<PreviewPanel loading={true} />);
    
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should render error state', () => {
    const errorMessage = 'Failed to load preview';
    render(<PreviewPanel error={errorMessage} />);
    
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should render empty state when no diff data', () => {
    render(<PreviewPanel />);
    
    expect(screen.getByText('No changes to preview')).toBeInTheDocument();
  });

  it('should render change summary', () => {
    const diffData: DiffRepresentation = {
      summary: {
        totalChanges: 5,
        fieldsAdded: 2,
        fieldsModified: 1,
        fieldsRemoved: 0,
        rulesAdded: 1,
        rulesModified: 1,
        rulesRemoved: 0
      },
      fields: [],
      validationRules: [],
      changePercentage: 25
    };
    
    render(<PreviewPanel diffData={diffData} />);
    
    expect(screen.getByText('5 total changes (25% modification)')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // Fields Added
    expect(screen.getByText('1')).toBeInTheDocument(); // Fields Modified
  });

  it('should render field changes', () => {
    const diffData: DiffRepresentation = {
      summary: {
        totalChanges: 1,
        fieldsAdded: 1,
        fieldsModified: 0,
        fieldsRemoved: 0,
        rulesAdded: 0,
        rulesModified: 0,
        rulesRemoved: 0
      },
      fields: [
        {
          fieldName: 'test_field__c',
          status: 'added',
          proposed: {
            name: 'test_field__c',
            label: 'Test Field',
            type: 'Text'
          }
        }
      ],
      validationRules: [],
      changePercentage: 100
    };
    
    render(<PreviewPanel diffData={diffData} />);
    
    expect(screen.getByText('test_field__c')).toBeInTheDocument();
    expect(screen.getByText('added')).toBeInTheDocument();
  });

  it('should call onRefresh when refresh button is clicked', () => {
    const onRefresh = vi.fn();
    const diffData: DiffRepresentation = {
      summary: {
        totalChanges: 0,
        fieldsAdded: 0,
        fieldsModified: 0,
        fieldsRemoved: 0,
        rulesAdded: 0,
        rulesModified: 0,
        rulesRemoved: 0
      },
      fields: [],
      validationRules: [],
      changePercentage: 0
    };
    
    render(<PreviewPanel diffData={diffData} onRefresh={onRefresh} />);
    
    const refreshButton = screen.getByText('Refresh');
    refreshButton.click();
    
    expect(onRefresh).toHaveBeenCalled();
  });
});