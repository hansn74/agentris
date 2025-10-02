'use client';

import React from 'react';
import { MockupData, sanitizeHTML, sanitizeCSS } from '@agentris/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface MockupViewProps {
  data: MockupData;
  className?: string;
}

export function MockupView({ data, className }: MockupViewProps) {
  const renderField = (field: any) => {
    const fieldTypeMap: Record<string, string> = {
      text: 'text',
      email: 'email',
      phone: 'tel',
      number: 'number',
      date: 'date',
      datetime: 'datetime-local',
      url: 'url',
    };

    const inputType = fieldTypeMap[field.type?.toLowerCase()] || 'text';

    switch (field.type?.toLowerCase()) {
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox id={field.label} />
            <Label htmlFor={field.label}>{field.label}</Label>
          </div>
        );
      
      case 'picklist':
      case 'select':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.label}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Select>
              <SelectTrigger id={field.label}>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">Option 1</SelectItem>
                <SelectItem value="option2">Option 2</SelectItem>
                <SelectItem value="option3">Option 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      
      case 'textarea':
      case 'longtext':
        return (
          <div className="space-y-2">
            <Label htmlFor={field.label}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Textarea 
              id={field.label}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              rows={4}
            />
          </div>
        );
      
      default:
        return (
          <div className="space-y-2">
            <Label htmlFor={field.label}>
              {field.label}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
            <Input 
              id={field.label}
              type={inputType}
              placeholder={`Enter ${field.label.toLowerCase()}`}
              required={field.required}
            />
          </div>
        );
    }
  };

  if (data.html) {
    const sanitizedHTML = sanitizeHTML(data.html);
    const sanitizedCSS = data.css ? sanitizeCSS(data.css) : '';
    
    return (
      <div className={className}>
        {sanitizedCSS && <style dangerouslySetInnerHTML={{ __html: sanitizedCSS }} />}
        <div dangerouslySetInnerHTML={{ __html: sanitizedHTML }} />
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {data.sections.map((section, sectionIndex) => (
        <Card key={sectionIndex}>
          <CardHeader>
            <CardTitle className="text-lg">{section.name}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.fields.map((field, fieldIndex) => (
                <div key={fieldIndex}>
                  {renderField(field)}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
      <div className="flex justify-end gap-2 pt-4">
        <Badge variant="secondary">Preview Mode</Badge>
        <Badge variant="outline">{data.sections.reduce((acc, s) => acc + s.fields.length, 0)} Fields</Badge>
      </div>
    </div>
  );
}