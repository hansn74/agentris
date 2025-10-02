'use client';

import React from 'react';
import { Badge } from '../ui/badge';

interface FieldPreviewProps {
  field: any;
  compact?: boolean;
}

export function FieldPreview({ field, compact = false }: FieldPreviewProps) {
  if (!field) return null;

  const getFieldTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      'Text': 'Text',
      'TextArea': 'Text Area',
      'LongTextArea': 'Long Text Area',
      'RichTextArea': 'Rich Text',
      'Email': 'Email',
      'Phone': 'Phone',
      'Url': 'URL',
      'Number': 'Number',
      'Currency': 'Currency',
      'Percent': 'Percentage',
      'Date': 'Date',
      'DateTime': 'Date/Time',
      'Time': 'Time',
      'Checkbox': 'Checkbox',
      'Picklist': 'Picklist',
      'MultiselectPicklist': 'Multi-Select',
      'Lookup': 'Lookup',
      'MasterDetail': 'Master-Detail',
      'Formula': 'Formula',
      'AutoNumber': 'Auto Number'
    };
    return typeMap[type] || type;
  };

  const renderFieldProperty = (label: string, value: any) => {
    if (value === undefined || value === null || value === '') return null;
    
    return (
      <div className="flex justify-between py-1">
        <span className="text-sm text-muted-foreground">{label}:</span>
        <span className="text-sm font-medium">
          {typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}
        </span>
      </div>
    );
  };

  if (compact) {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{field.label || field.name}</span>
          <Badge variant="outline" className="text-xs">
            {getFieldTypeDisplay(field.type)}
          </Badge>
          {field.required && (
            <Badge variant="secondary" className="text-xs">
              Required
            </Badge>
          )}
        </div>
        {field.helpText && (
          <p className="text-sm text-muted-foreground">{field.helpText}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h5 className="font-medium text-base">{field.label || field.name}</h5>
          <Badge variant="outline">{getFieldTypeDisplay(field.type)}</Badge>
          {field.required && <Badge variant="secondary">Required</Badge>}
          {field.unique && <Badge variant="secondary">Unique</Badge>}
          {field.externalId && <Badge variant="secondary">External ID</Badge>}
        </div>
        {field.description && (
          <p className="text-sm text-muted-foreground mt-1">{field.description}</p>
        )}
      </div>

      {/* Properties Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {renderFieldProperty('API Name', field.name || field.fullName)}
        {renderFieldProperty('Label', field.label)}
        
        {/* Type-specific properties */}
        {(field.type === 'Text' || field.type === 'TextArea' || field.type === 'LongTextArea') && (
          <>
            {renderFieldProperty('Max Length', field.length)}
            {renderFieldProperty('Case Sensitive', field.caseSensitive)}
          </>
        )}
        
        {(field.type === 'Number' || field.type === 'Currency' || field.type === 'Percent') && (
          <>
            {renderFieldProperty('Precision', field.precision)}
            {renderFieldProperty('Scale', field.scale)}
          </>
        )}
        
        {(field.type === 'Picklist' || field.type === 'MultiselectPicklist') && (
          <>
            {renderFieldProperty('Restricted', field.restricted)}
            {field.picklistValues && field.picklistValues.length > 0 && (
              <div className="col-span-2">
                <span className="text-sm text-muted-foreground">Values:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {field.picklistValues.slice(0, 10).map((value: any, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {typeof value === 'string' ? value : value.label || value.value}
                    </Badge>
                  ))}
                  {field.picklistValues.length > 10 && (
                    <Badge variant="outline" className="text-xs">
                      +{field.picklistValues.length - 10} more
                    </Badge>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        
        {(field.type === 'Lookup' || field.type === 'MasterDetail') && (
          <>
            {renderFieldProperty('References', field.referenceTo?.join(', '))}
            {renderFieldProperty('Relationship Name', field.relationshipName)}
            {field.type === 'MasterDetail' && 
              renderFieldProperty('Delete Constraint', field.deleteConstraint)}
          </>
        )}
        
        {field.type === 'Formula' && (
          <div className="col-span-2">
            <span className="text-sm text-muted-foreground">Formula:</span>
            <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto">
              {field.formula}
            </pre>
          </div>
        )}
        
        {field.type === 'AutoNumber' && (
          <>
            {renderFieldProperty('Format', field.displayFormat)}
            {renderFieldProperty('Starting Number', field.startingNumber)}
          </>
        )}
        
        {renderFieldProperty('Default Value', field.defaultValue)}
      </div>

      {/* Help Text */}
      {field.helpText && (
        <div className="pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium">Help Text:</span> {field.helpText}
          </p>
        </div>
      )}
    </div>
  );
}