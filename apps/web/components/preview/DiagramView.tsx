'use client';

import React, { useEffect, useRef } from 'react';
import { DiagramData, sanitizeMermaid } from '@agentris/shared';
import mermaid from 'mermaid';

interface DiagramViewProps {
  data: DiagramData;
  className?: string;
}

export function DiagramView({ data, className }: DiagramViewProps) {
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
    <div className={`overflow-auto p-4 bg-background rounded-lg ${className}`}>
      <div ref={containerRef} className="flex justify-center" />
      {data.nodes.length > 0 && (
        <div className="mt-4 p-4 bg-muted rounded-lg">
          <h4 className="font-medium mb-2">Flow Elements</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            {data.nodes.map((node) => (
              <div key={node.id} className="flex items-center gap-2">
                <span className="font-mono text-xs bg-background px-2 py-1 rounded">
                  {node.id}
                </span>
                <span>{node.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}