import { z } from 'zod';
import {
  PreviewFormat,
  PreviewData,
  DiagramData,
  MockupData,
  CodeDiffData,
  DependencyGraphData,
  TableData,
  TextData,
  diagramDataSchema,
  mockupDataSchema,
  codeDiffDataSchema,
  dependencyGraphDataSchema,
  tableDataSchema,
  textDataSchema,
} from '@agentris/shared';
import { ChangeDetector, ChangeType } from './change-detector';
import { LLMService } from './llm-service';
import { PREVIEW_GENERATION_PROMPTS } from './prompts/preview-generation';

export interface PreviewGeneratorOptions {
  llmService?: LLMService;
  changeDetector?: ChangeDetector;
}

export interface GeneratePreviewParams {
  ticketId: string;
  ticketContent: string;
  format?: PreviewFormat;
  metadata?: Record<string, any>;
}

export class PreviewGenerator {
  private llmService: LLMService;
  private changeDetector: ChangeDetector;

  constructor(options?: PreviewGeneratorOptions) {
    this.llmService = options?.llmService ?? new LLMService();
    this.changeDetector = options?.changeDetector ?? new ChangeDetector();
  }

  public async generatePreview(params: GeneratePreviewParams): Promise<{
    format: PreviewFormat;
    data: PreviewData;
    availableFormats: PreviewFormat[];
  }> {
    const detectionResult = this.changeDetector.detectChangeType(params.ticketContent);
    
    let selectedFormat: PreviewFormat;
    if (params.format) {
      selectedFormat = params.format;
    } else {
      const optimalFormat = this.changeDetector.determineOptimalPreviewFormat(detectionResult.primaryType);
      selectedFormat = this.mapFormatStringToEnum(optimalFormat);
    }

    const availableFormats = this.getAvailableFormats(detectionResult.detectedTypes);
    const previewData = await this.generatePreviewForFormat(selectedFormat, params.ticketContent, params.metadata);

    return {
      format: selectedFormat,
      data: previewData,
      availableFormats,
    };
  }

  private mapFormatStringToEnum(format: string): PreviewFormat {
    const mapping: Record<string, PreviewFormat> = {
      'diagram': PreviewFormat.DIAGRAM,
      'mockup': PreviewFormat.MOCKUP,
      'code-diff': PreviewFormat.CODE_DIFF,
      'dependency-graph': PreviewFormat.DEPENDENCY_GRAPH,
      'table': PreviewFormat.TABLE,
      'text': PreviewFormat.TEXT,
    };
    return mapping[format] ?? PreviewFormat.TEXT;
  }

  private getAvailableFormats(changeTypes: ChangeType[]): PreviewFormat[] {
    const formats = new Set<PreviewFormat>();
    
    for (const changeType of changeTypes) {
      const format = this.changeDetector.determineOptimalPreviewFormat(changeType);
      formats.add(this.mapFormatStringToEnum(format));
    }

    // Always include text as a fallback
    formats.add(PreviewFormat.TEXT);
    
    return Array.from(formats);
  }

  private async generatePreviewForFormat(
    format: PreviewFormat,
    ticketContent: string,
    metadata?: Record<string, any>
  ): Promise<PreviewData> {
    const prompt = this.getPromptForFormat(format, ticketContent);
    
    try {
      const response = await this.llmService.generateText({
        prompt,
        maxTokens: 2000,
        temperature: 0.3,
      });

      const parsedData = this.parsePreviewData(format, response);
      return this.validatePreviewData(format, parsedData);
    } catch (error) {
      console.error('Error generating preview:', error);
      return this.generateFallbackPreview(format, ticketContent);
    }
  }

  private getPromptForFormat(format: PreviewFormat, description: string): string {
    const promptTemplate = PREVIEW_GENERATION_PROMPTS[format] ?? PREVIEW_GENERATION_PROMPTS.text;
    return promptTemplate.replace('{description}', description);
  }

  private parsePreviewData(format: PreviewFormat, response: string): any {
    try {
      return JSON.parse(response);
    } catch {
      // If JSON parsing fails, try to extract JSON from the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {
          // Fall through to structured parsing
        }
      }

      // Attempt to create structured data from unstructured response
      return this.createStructuredData(format, response);
    }
  }

  private createStructuredData(format: PreviewFormat, content: string): any {
    switch (format) {
      case PreviewFormat.DIAGRAM:
        return {
          type: 'diagram',
          mermaidSyntax: this.extractMermaidSyntax(content) || 'graph TD\n  A[Start] --> B[End]',
          nodes: [],
          edges: [],
        };

      case PreviewFormat.MOCKUP:
        return {
          type: 'mockup',
          html: this.extractHTML(content) || '<div>Preview not available</div>',
          css: '',
          sections: [],
        };

      case PreviewFormat.CODE_DIFF:
        return {
          type: 'code-diff',
          language: 'apex',
          before: '',
          after: content,
          changes: [],
        };

      case PreviewFormat.DEPENDENCY_GRAPH:
        return {
          type: 'dependency-graph',
          mermaidSyntax: this.extractMermaidSyntax(content) || 'graph LR\n  A --> B',
          objects: [],
          relationships: [],
        };

      case PreviewFormat.TABLE:
        return {
          type: 'table',
          headers: ['Column 1', 'Column 2'],
          rows: [['Data', 'Data']],
          metadata: {},
        };

      case PreviewFormat.TEXT:
      default:
        return {
          type: 'text',
          content: content || 'Preview generation failed',
          format: 'markdown',
        };
    }
  }

  private extractMermaidSyntax(content: string): string | null {
    const mermaidMatch = content.match(/```mermaid\n([\s\S]*?)```/);
    if (mermaidMatch) {
      return mermaidMatch[1].trim();
    }
    
    if (content.includes('graph') || content.includes('flowchart')) {
      return content;
    }
    
    return null;
  }

  private extractHTML(content: string): string | null {
    const htmlMatch = content.match(/<[^>]+>[\s\S]*<\/[^>]+>/);
    if (htmlMatch) {
      return htmlMatch[0];
    }
    return null;
  }

  private validatePreviewData(format: PreviewFormat, data: any): PreviewData {
    try {
      switch (format) {
        case PreviewFormat.DIAGRAM:
          return diagramDataSchema.parse(data) as DiagramData;
        case PreviewFormat.MOCKUP:
          return mockupDataSchema.parse(data) as MockupData;
        case PreviewFormat.CODE_DIFF:
          return codeDiffDataSchema.parse(data) as CodeDiffData;
        case PreviewFormat.DEPENDENCY_GRAPH:
          return dependencyGraphDataSchema.parse(data) as DependencyGraphData;
        case PreviewFormat.TABLE:
          return tableDataSchema.parse(data) as TableData;
        case PreviewFormat.TEXT:
        default:
          return textDataSchema.parse(data) as TextData;
      }
    } catch (error) {
      console.error('Validation error:', error);
      return this.generateFallbackPreview(format, JSON.stringify(data, null, 2));
    }
  }

  private generateFallbackPreview(format: PreviewFormat, content: string): PreviewData {
    switch (format) {
      case PreviewFormat.DIAGRAM:
        return {
          type: 'diagram',
          mermaidSyntax: 'graph TD\n  A[Unable to generate diagram] --> B[Please review content]',
          nodes: [
            { id: 'A', label: 'Unable to generate diagram', type: 'error' },
            { id: 'B', label: 'Please review content', type: 'info' }
          ],
          edges: [{ from: 'A', to: 'B' }],
        };

      case PreviewFormat.MOCKUP:
        return {
          type: 'mockup',
          html: `<div style="padding: 20px; border: 1px solid #ccc;">
            <h3>Preview Generation Failed</h3>
            <p>Unable to generate mockup for the requested content.</p>
            <pre>${content.substring(0, 500)}...</pre>
          </div>`,
          sections: [],
        };

      case PreviewFormat.CODE_DIFF:
        return {
          type: 'code-diff',
          language: 'text',
          before: '// Original code',
          after: content,
          changes: [],
        };

      case PreviewFormat.DEPENDENCY_GRAPH:
        return {
          type: 'dependency-graph',
          mermaidSyntax: 'graph LR\n  Error[Unable to analyze dependencies]',
          objects: [],
          relationships: [],
        };

      case PreviewFormat.TABLE:
        return {
          type: 'table',
          headers: ['Status', 'Message'],
          rows: [['Error', 'Unable to generate table preview']],
        };

      case PreviewFormat.TEXT:
      default:
        return {
          type: 'text',
          content: content,
          format: 'plain',
        };
    }
  }

  public async generateDiagram(description: string): Promise<DiagramData> {
    const params: GeneratePreviewParams = {
      ticketId: 'temp',
      ticketContent: description,
      format: PreviewFormat.DIAGRAM,
    };
    const result = await this.generatePreview(params);
    return result.data as DiagramData;
  }

  public async generateMockup(description: string): Promise<MockupData> {
    const params: GeneratePreviewParams = {
      ticketId: 'temp',
      ticketContent: description,
      format: PreviewFormat.MOCKUP,
    };
    const result = await this.generatePreview(params);
    return result.data as MockupData;
  }

  public async generateCodeDiff(description: string): Promise<CodeDiffData> {
    const params: GeneratePreviewParams = {
      ticketId: 'temp',
      ticketContent: description,
      format: PreviewFormat.CODE_DIFF,
    };
    const result = await this.generatePreview(params);
    return result.data as CodeDiffData;
  }

  public async generateDependencyGraph(description: string): Promise<DependencyGraphData> {
    const params: GeneratePreviewParams = {
      ticketId: 'temp',
      ticketContent: description,
      format: PreviewFormat.DEPENDENCY_GRAPH,
    };
    const result = await this.generatePreview(params);
    return result.data as DependencyGraphData;
  }
}