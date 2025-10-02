import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PreviewGenerator } from './preview-generator';
import { PreviewFormat } from '@agentris/shared';
import { ChangeDetector, ChangeType } from './change-detector';
import { LLMService } from './llm-service';

vi.mock('./llm-service');
vi.mock('./change-detector');

describe('PreviewGenerator', () => {
  let generator: PreviewGenerator;
  let mockLLMService: any;
  let mockChangeDetector: any;

  beforeEach(() => {
    mockLLMService = {
      generateText: vi.fn(),
    };

    mockChangeDetector = {
      detectChangeType: vi.fn(),
      determineOptimalPreviewFormat: vi.fn(),
    };

    generator = new PreviewGenerator({
      llmService: mockLLMService,
      changeDetector: mockChangeDetector,
    });
  });

  describe('generatePreview', () => {
    it('should generate a diagram preview for flow changes', async () => {
      const ticketContent = 'Create a screen flow for lead conversion';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.FLOW,
        detectedTypes: [ChangeType.FLOW],
        confidence: 80,
        metadata: { keywords: ['flow'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('diagram');

      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'diagram',
        mermaidSyntax: 'graph TD\n  A[Start] --> B[Screen]\n  B --> C[Decision]\n  C --> D[End]',
        nodes: [
          { id: 'A', label: 'Start', type: 'start' },
          { id: 'B', label: 'Screen', type: 'screen' },
          { id: 'C', label: 'Decision', type: 'decision' },
          { id: 'D', label: 'End', type: 'end' },
        ],
        edges: [
          { from: 'A', to: 'B' },
          { from: 'B', to: 'C' },
          { from: 'C', to: 'D' },
        ],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-123',
        ticketContent,
      });

      expect(result.format).toBe(PreviewFormat.DIAGRAM);
      expect(result.data.type).toBe('diagram');
      expect(result.data).toHaveProperty('mermaidSyntax');
      expect(result.data).toHaveProperty('nodes');
      expect(result.data).toHaveProperty('edges');
      expect(result.availableFormats).toContain(PreviewFormat.DIAGRAM);
      expect(result.availableFormats).toContain(PreviewFormat.TEXT);
    });

    it('should generate a mockup preview for layout changes', async () => {
      const ticketContent = 'Update Account page layout with new fields';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.LAYOUT,
        detectedTypes: [ChangeType.LAYOUT, ChangeType.FIELD],
        confidence: 75,
        metadata: { keywords: ['layout', 'field'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockImplementation((type) => {
        return type === ChangeType.LAYOUT ? 'mockup' : 'mockup';
      });

      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'mockup',
        html: '<div class="slds-form"><div class="slds-form-element">Field</div></div>',
        sections: [
          {
            name: 'Details',
            fields: [
              { label: 'Account Name', type: 'text', required: true },
              { label: 'Phone', type: 'phone', required: false },
            ],
          },
        ],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-124',
        ticketContent,
        format: PreviewFormat.MOCKUP,
      });

      expect(result.format).toBe(PreviewFormat.MOCKUP);
      expect(result.data.type).toBe('mockup');
      expect(result.data).toHaveProperty('html');
      expect(result.data).toHaveProperty('sections');
    });

    it('should generate a code diff preview for apex changes', async () => {
      const ticketContent = 'Modify AccountTrigger to add email validation';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.APEX,
        detectedTypes: [ChangeType.APEX, ChangeType.TRIGGER],
        confidence: 90,
        metadata: { keywords: ['trigger', 'apex'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('code-diff');

      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'code-diff',
        language: 'apex',
        before: 'trigger AccountTrigger on Account (before insert) {\n  // Existing code\n}',
        after: 'trigger AccountTrigger on Account (before insert) {\n  // Validate email\n  AccountHelper.validateEmail(Trigger.new);\n}',
        changes: [
          { type: 'add', lineStart: 2, lineEnd: 3, content: '  // Validate email\n  AccountHelper.validateEmail(Trigger.new);' },
        ],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-125',
        ticketContent,
      });

      expect(result.format).toBe(PreviewFormat.CODE_DIFF);
      expect(result.data.type).toBe('code-diff');
      expect(result.data).toHaveProperty('before');
      expect(result.data).toHaveProperty('after');
      expect(result.data).toHaveProperty('changes');
    });

    it('should generate a dependency graph for object relationships', async () => {
      const ticketContent = 'Create custom object Order__c with relationships to Account and Contact';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.CUSTOM_OBJECT,
        detectedTypes: [ChangeType.CUSTOM_OBJECT],
        confidence: 85,
        metadata: { keywords: ['custom object'], objectNames: ['Order__c', 'Account', 'Contact'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('dependency-graph');

      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'dependency-graph',
        mermaidSyntax: 'graph LR\n  Order__c --> Account\n  Order__c --> Contact',
        objects: [
          { name: 'Order__c', type: 'CustomObject' },
          { name: 'Account', type: 'StandardObject' },
          { name: 'Contact', type: 'StandardObject' },
        ],
        relationships: [
          { from: 'Order__c', to: 'Account', type: 'Lookup', field: 'Account__c' },
          { from: 'Order__c', to: 'Contact', type: 'Lookup', field: 'Contact__c' },
        ],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-126',
        ticketContent,
      });

      expect(result.format).toBe(PreviewFormat.DEPENDENCY_GRAPH);
      expect(result.data.type).toBe('dependency-graph');
      expect(result.data).toHaveProperty('mermaidSyntax');
      expect(result.data).toHaveProperty('objects');
      expect(result.data).toHaveProperty('relationships');
    });

    it('should handle LLM service errors gracefully', async () => {
      const ticketContent = 'Some content that will fail';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.UNKNOWN,
        detectedTypes: [ChangeType.UNKNOWN],
        confidence: 0,
        metadata: { keywords: [] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('text');
      mockLLMService.generateText.mockRejectedValue(new Error('LLM service error'));

      const result = await generator.generatePreview({
        ticketId: 'test-127',
        ticketContent,
      });

      expect(result.format).toBe(PreviewFormat.TEXT);
      expect(result.data.type).toBe('text');
      expect(result.data).toHaveProperty('content');
    });

    it('should handle malformed LLM responses', async () => {
      const ticketContent = 'Create a flow';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.FLOW,
        detectedTypes: [ChangeType.FLOW],
        confidence: 70,
        metadata: { keywords: ['flow'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('diagram');
      mockLLMService.generateText.mockResolvedValue('This is not JSON but contains mermaid```mermaid\ngraph TD\n  A --> B\n```');

      const result = await generator.generatePreview({
        ticketId: 'test-128',
        ticketContent,
      });

      expect(result.format).toBe(PreviewFormat.DIAGRAM);
      expect(result.data.type).toBe('diagram');
      expect(result.data).toHaveProperty('mermaidSyntax');
      expect((result.data as any).mermaidSyntax).toContain('graph TD');
    });

    it('should allow format override', async () => {
      const ticketContent = 'Create a field on Account';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD],
        confidence: 80,
        metadata: { keywords: ['field'] },
      });

      // Even though field normally gets mockup, we're overriding to table
      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'table',
        headers: ['Field Name', 'Type', 'Required'],
        rows: [['Customer_Priority__c', 'Text', 'No']],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-129',
        ticketContent,
        format: PreviewFormat.TABLE,
      });

      expect(result.format).toBe(PreviewFormat.TABLE);
      expect(result.data.type).toBe('table');
      expect(result.data).toHaveProperty('headers');
      expect(result.data).toHaveProperty('rows');
    });

    it('should provide multiple available formats for complex changes', async () => {
      const ticketContent = 'Create field, update layout, and add validation rule';
      
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.FIELD,
        detectedTypes: [ChangeType.FIELD, ChangeType.LAYOUT, ChangeType.VALIDATION_RULE],
        confidence: 85,
        metadata: { keywords: ['field', 'layout', 'validation'] },
      });

      mockChangeDetector.determineOptimalPreviewFormat.mockImplementation((type) => {
        const map: Record<ChangeType, string> = {
          [ChangeType.FIELD]: 'mockup',
          [ChangeType.LAYOUT]: 'mockup',
          [ChangeType.VALIDATION_RULE]: 'code-diff',
        } as any;
        return map[type] || 'text';
      });

      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'mockup',
        html: '<div>Preview</div>',
        sections: [],
      }));

      const result = await generator.generatePreview({
        ticketId: 'test-130',
        ticketContent,
      });

      expect(result.availableFormats).toContain(PreviewFormat.MOCKUP);
      expect(result.availableFormats).toContain(PreviewFormat.CODE_DIFF);
      expect(result.availableFormats).toContain(PreviewFormat.TEXT);
    });
  });

  describe('specific format generators', () => {
    beforeEach(() => {
      mockChangeDetector.detectChangeType.mockReturnValue({
        primaryType: ChangeType.FLOW,
        detectedTypes: [ChangeType.FLOW],
        confidence: 80,
        metadata: { keywords: [] },
      });
      mockChangeDetector.determineOptimalPreviewFormat.mockReturnValue('diagram');
    });

    it('should generate diagram directly', async () => {
      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'diagram',
        mermaidSyntax: 'graph TD\n  A --> B',
        nodes: [],
        edges: [],
      }));

      const result = await generator.generateDiagram('Create a flow');
      
      expect(result.type).toBe('diagram');
      expect(result.mermaidSyntax).toContain('graph TD');
    });

    it('should generate mockup directly', async () => {
      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'mockup',
        html: '<div>Layout</div>',
        sections: [],
      }));

      const result = await generator.generateMockup('Create layout');
      
      expect(result.type).toBe('mockup');
      expect(result.html).toContain('Layout');
    });

    it('should generate code diff directly', async () => {
      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'code-diff',
        language: 'apex',
        before: '// old',
        after: '// new',
        changes: [],
      }));

      const result = await generator.generateCodeDiff('Modify code');
      
      expect(result.type).toBe('code-diff');
      expect(result.language).toBe('apex');
    });

    it('should generate dependency graph directly', async () => {
      mockLLMService.generateText.mockResolvedValue(JSON.stringify({
        type: 'dependency-graph',
        mermaidSyntax: 'graph LR\n  A --> B',
        objects: [],
        relationships: [],
      }));

      const result = await generator.generateDependencyGraph('Show dependencies');
      
      expect(result.type).toBe('dependency-graph');
      expect(result.mermaidSyntax).toContain('graph LR');
    });
  });
});