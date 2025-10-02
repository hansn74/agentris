'use client';

import React, { useEffect, useRef } from 'react';
import { DependencyGraphData, sanitizeMermaid } from '@agentris/shared';
import mermaid from 'mermaid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface DependencyGraphProps {
  data: DependencyGraphData;
  className?: string;
}

export function DependencyGraph({ data, className }: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && data.mermaidSyntax) {
      const sanitizedSyntax = sanitizeMermaid(data.mermaidSyntax);
      
      mermaid.initialize({ 
        startOnLoad: true,
        theme: 'default',
        flowchart: {
          useMaxWidth: true,
          htmlLabels: true,
        },
        securityLevel: 'strict', // Add security level
      });
      
      containerRef.current.innerHTML = `<div class="mermaid">${sanitizedSyntax}</div>`;
      mermaid.init(undefined, containerRef.current);
    }
  }, [data.mermaidSyntax]);

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Object Dependencies</CardTitle>
        </CardHeader>
        <CardContent>
          <div ref={containerRef} className="flex justify-center mb-4" />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div>
              <h4 className="font-medium mb-2">Objects ({data.objects.length})</h4>
              <div className="space-y-2">
                {data.objects.map((obj) => (
                  <div key={obj.name} className="flex items-center justify-between">
                    <span className="font-mono text-sm">{obj.name}</span>
                    <Badge variant="outline">{obj.type}</Badge>
                  </div>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium mb-2">Relationships ({data.relationships.length})</h4>
              <div className="space-y-2">
                {data.relationships.map((rel, index) => (
                  <div key={index} className="text-sm">
                    <span className="font-mono">{rel.from}</span>
                    <span className="mx-2 text-muted-foreground">→</span>
                    <span className="font-mono">{rel.to}</span>
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {rel.type}
                    </Badge>
                    {rel.field && (
                      <span className="text-xs text-muted-foreground ml-2">
                        via {rel.field}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}