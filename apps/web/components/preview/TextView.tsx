'use client';

import React from 'react';
import { TextData, sanitizeHTML } from '@agentris/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TextViewProps {
  data: TextData;
  className?: string;
}

export function TextView({ data, className }: TextViewProps) {
  const renderContent = () => {
    switch (data.format) {
      case 'markdown':
        // In production, use a markdown renderer like react-markdown
        // For now, sanitize as HTML
        return (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(data.content) }}
          />
        );
      
      case 'html':
        return (
          <div 
            className="prose prose-sm dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: sanitizeHTML(data.content) }}
          />
        );
      
      case 'plain':
      default:
        return (
          <pre className="whitespace-pre-wrap font-sans text-sm">
            {data.content}
          </pre>
        );
    }
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Description</CardTitle>
            {data.format && (
              <Badge variant="outline">{data.format}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}